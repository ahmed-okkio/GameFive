import { PrismaClient } from "@prisma/client";
import { rankedToMmr } from "../lib/mmr/ranked";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function printDetailedMatches() {
    console.log("Detailed Match MMR Verification:");
    
    const matches = await prisma.match.findMany({
        orderBy: { gameDate: "asc" },
        include: { participants: { include: { player: true } } }
    });

    for (const match of matches) {
        console.log(`\nMatch: ${match.matchId}`);
        console.log(`Stored lobbyAvgMmr: ${match.lobbyAvgMmr}`);
        
        let sumMmr = 0;
        let count = 0;

        match.participants.forEach(p => {
            const mmr = rankedToMmr(p.player.soloDuoTier, p.player.soloDuoDivision) ?? 
                        rankedToMmr(p.player.flexTier, p.player.flexDivision);
            
            console.log(`  Player: ${p.player.riotIdName}#${p.player.riotIdTag} | Solo: ${p.player.soloDuoTier} ${p.player.soloDuoDivision} | Flex: ${p.player.flexTier} ${p.player.flexDivision} | Resolved MMR: ${mmr}`);
            
            if (mmr !== null) {
                sumMmr += mmr;
                count++;
            }
        });

        const recomputed = count > 0 ? sumMmr / count : null;
        console.log(`  Recomputed lobbyAvgMmr: ${recomputed}`);
    }
}

printDetailedMatches().finally(async () => await prisma.$disconnect());
