import { PrismaClient } from "@prisma/client";
import { bestRankedMmr } from "../lib/mmr/ranked";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function verifyMatches() {
    console.log("Verifying lobby average MMR calculations...");
    
    // Get Okkio's placement matches
    const player = await prisma.player.findFirst({
        where: { riotIdName: { equals: "Okkio", mode: 'insensitive' } }
    });

    if (!player) return;

    const matches = await prisma.match.findMany({
        orderBy: { gameDate: "asc" },
        take: 10,
        include: { participants: { include: { player: true } } }
    });

    for (const match of matches) {
        console.log(`\nMatch ${match.matchId} (Stored lobbyAvgMmr: ${match.lobbyAvgMmr})`);
        
        const opponents = match.participants.filter(p => p.playerId !== player.id);
        
        const validOpponents = opponents.filter(p => 
            (p.player.soloDuoTier && p.player.soloDuoTier !== "UNRANKED") || 
            (p.player.flexTier && p.player.flexTier !== "UNRANKED")
        );

        console.log(`Opponents count: ${opponents.length}, Valid opponents: ${validOpponents.length}`);
        
        validOpponents.forEach(p => {
            const mmr = bestRankedMmr(p.player.soloDuoTier, p.player.soloDuoDivision, p.player.flexTier, p.player.flexDivision);
            console.log(`  Opponent ${p.player.riotIdName}: MMR = ${mmr}`);
        });

        const recomputed = validOpponents.length > 0 
            ? validOpponents.reduce((sum, p) => sum + (bestRankedMmr(p.player.soloDuoTier, p.player.soloDuoDivision, p.player.flexTier, p.player.flexDivision) ?? 0), 0) / validOpponents.length
            : null;
            
        console.log(`Recomputed lobbyAvgMmr: ${recomputed}`);
    }
}

verifyMatches().finally(async () => await prisma.$disconnect());
