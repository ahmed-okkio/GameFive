import { PrismaClient } from "@prisma/client";
import { rankedToMmr } from "../lib/mmr/ranked";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function verifyAllMatches() {
    console.log("Verifying lobby average MMR calculations for ALL matches...");
    
    const matches = await prisma.match.findMany({
        include: { participants: { include: { player: true } } }
    });

    for (const match of matches) {
        console.log(`\nMatch: ${match.matchId} (Stored lobbyAvgMmr: ${match.lobbyAvgMmr})`);
        
        // Per spec: Exclude uploader (assuming first participant created or simply filtering all out? 
        // Spec says "each opponent", so we need the uploader. 
        // In ingest, uploader is passed. Here we don't have uploaderPuuid easily, 
        // but we can try to derive opponents. Let's just list all valid participants to see the calc)
        
        const validParticipants = match.participants.filter(p => 
            (p.player.soloDuoTier && p.player.soloDuoTier !== "UNRANKED") || 
            (p.player.flexTier && p.player.flexTier !== "UNRANKED")
        );

        let sumMmr = 0;
        let count = 0;

        validParticipants.forEach(p => {
            const mmr = rankedToMmr(p.player.soloDuoTier, p.player.soloDuoDivision) ?? 
                        rankedToMmr(p.player.flexTier, p.player.flexDivision);
            
            if (mmr !== null) {
                console.log(`  Player: ${p.player.riotIdName}#${p.player.riotIdTag} | Solo: ${p.player.soloDuoTier} ${p.player.soloDuoDivision} | Flex: ${p.player.flexTier} ${p.player.flexDivision} | Resolved MMR: ${mmr}`);
                sumMmr += mmr;
                count++;
            }
        });

        const recomputed = count > 0 ? sumMmr / count : null;
        console.log(`  Recomputed lobbyAvgMmr: ${recomputed}`);
    }
}

verifyAllMatches().finally(async () => await prisma.$disconnect());
