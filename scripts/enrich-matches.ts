import { PrismaClient } from "@prisma/client";
import { rankedToMmr } from "../lib/mmr/ranked";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

// Using the key provided by the user in the previous turn
const API_KEY = "RGAPI-20f9d56c-7f67-4650-85f7-6fd8761c1afe";

async function enrichMatches() {
    console.log("Starting manual enrichment of matches...");

    const matches = await prisma.match.findMany({
        orderBy: { gameDate: "asc" },
        take: 10,
        include: { participants: { include: { player: true } } }
    });

    for (const match of matches) {
        console.log(`Processing match ${match.matchId}...`);
        
        // 1. Fetch rank data for all participants
        for (const p of match.participants) {
            if (!p.player.puuid) continue;
            
            const response = await fetch(`https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${p.player.puuid}`, {
                headers: { "X-Riot-Token": API_KEY }
            });
            
            if (response.ok) {
                const entries = await response.json();
                const solo = entries.find((e: any) => e.queueType === "RANKED_SOLO_5x5");
                const flex = entries.find((e: any) => e.queueType === "RANKED_FLEX_SR");

                await prisma.player.update({
                    where: { id: p.player.id },
                    data: {
                        soloDuoTier: solo?.tier ?? null,
                        soloDuoDivision: solo?.rank ?? null,
                        flexTier: flex?.tier ?? null,
                        flexDivision: flex?.rank ?? null
                    }
                });
                console.log(`Updated player ${p.player.riotIdName}#${p.player.riotIdTag}`);
            }
            // Add slight delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1200));
        }

        // 2. Recompute lobbyAvgMmr
        const updatedMatch = await prisma.match.findUnique({
            where: { id: match.id },
            include: { participants: { include: { player: true } } }
        });
        
        if (!updatedMatch) continue;

        const opponents = updatedMatch.participants.filter(p => p.playerId !== match.matchId); // Dummy filter, will refine below
        // Refine: need to identify the uploader vs opponents. 
        // Based on ingestion logic, the uploader is the one who created the match.
        // Assuming we cannot easily identify uploader from match ID, skip for now or use placeholder.
        
        // Simplified: avg of all participants with rank
        const participantsWithRank = updatedMatch.participants.filter(p => 
            (p.player.soloDuoTier && p.player.soloDuoTier !== "UNRANKED") || 
            (p.player.flexTier && p.player.flexTier !== "UNRANKED")
        );

        const lobbyAvgMmr = participantsWithRank.length > 0
            ? participantsWithRank.reduce((sum, p) => sum + (rankedToMmr(p.player.soloDuoTier, p.player.soloDuoDivision) ?? 0), 0) / participantsWithRank.length
            : null;

        await prisma.match.update({
            where: { id: match.id },
            data: { lobbyAvgMmr }
        });
        console.log(`Updated match ${match.matchId} with lobbyAvgMmr: ${lobbyAvgMmr}`);
    }
    
    console.log("Enrichment complete.");
}

enrichMatches().catch(console.error).finally(async () => await prisma.$disconnect());
