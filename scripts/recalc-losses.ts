import { PrismaClient } from "@prisma/client";
import { calculateLpDelta } from "../lib/mmr/calculate";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function recalculateLosses() {
    console.log("Starting historical LP loss correction...");
    
    const players = await prisma.player.findMany({ where: { isPlaced: true } });

    for (const player of players) {
        const participants = await prisma.matchParticipant.findMany({
            where: { playerId: player.id, match: { gameMode: "MAYHEM" } },
            include: { match: true },
            orderBy: { match: { gameDate: "asc" } }
        });

        // We need a 'running' MMR simulation. 
        // We start with a reasonable assumption: their current rawMmr 
        // is the result of all their recorded match deltas.
        // Let's find their starting MMR before these matches.
        
        let runningMmr = player.rawMmr - participants.reduce((sum, p) => sum + p.lpDelta, 0);

        for (const p of participants) {
            if (!p.win) {
                // Get streak: preceding 5 matches
                const precedingGames = await prisma.matchParticipant.findMany({
                    where: { 
                        playerId: player.id, 
                        match: { gameDate: { lt: p.match.gameDate }, gameMode: "MAYHEM" }
                    },
                    orderBy: { match: { gameDate: "desc" } },
                    take: 5
                });
                
                let consecutiveStreak = 0;
                for (const g of precedingGames) {
                    if (g.win === p.win) consecutiveStreak++;
                    else break;
                }
                
                const oldDelta = p.lpDelta;
                const newDelta = Math.round(-1 * calculateLpDelta({
                    playerCurrentMmr: runningMmr,
                    lobbyAvgMmr: p.match.lobbyAvgMmr,
                    consecutiveStreak: consecutiveStreak,
                    win: false
                }));

                await prisma.matchParticipant.update({
                    where: { id: p.id },
                    data: { lpDelta: newDelta }
                });
                
                runningMmr += newDelta;
                console.log(`Updated match ${p.matchId}: ${oldDelta} -> ${newDelta}`);
            } else {
                runningMmr += p.lpDelta;
            }
        }
        
        await prisma.player.update({
            where: { id: player.id },
            data: { rawMmr: runningMmr, currentLp: Math.round(runningMmr % 100) }
        });
    }
    console.log("Correction complete.");
}

recalculateLosses().catch(console.error).finally(async () => await prisma.$disconnect());
