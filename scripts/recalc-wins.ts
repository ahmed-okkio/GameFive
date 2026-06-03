import { PrismaClient } from "@prisma/client";
import { calculateLpDelta } from "../lib/mmr/calculate";
import * as readline from 'readline';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function previewAndApply() {
    console.log("Preparing to recalculate LP for WINNING matches...");
    
    const updates: { pId: string, mId: string, oldDelta: number, newDelta: number, pId_db: string }[] = [];
    const players = await prisma.player.findMany({ where: { isPlaced: true } });

    for (const player of players) {
        const participants = await prisma.matchParticipant.findMany({
            where: { playerId: player.id, match: { gameMode: "MAYHEM" } },
            include: { match: true },
            orderBy: { match: { gameDate: "asc" } }
        });

        let runningMmr = 0; // Simplified re-simulation
        for (const p of participants) {
            // Requirement: Skip placement matches
            if (p.isPlacement) {
                runningMmr += p.lpDelta; // Maintain the MMR chain even for placement games
                continue; 
            }

            if (p.win) {
                // It was a win. Re-calculate delta using new logic.
                const streakMatch = await prisma.matchParticipant.findMany({
                    where: { playerId: player.id, match: { gameDate: { lt: p.match.gameDate }, gameMode: "MAYHEM" } },
                    orderBy: { match: { gameDate: "desc" } },
                    take: 5
                });

                let streak = 0;
                for (const g of streakMatch) {
                    if (g.win === p.win) streak++;
                    else break;
                }

                const oldDelta = p.lpDelta;
                const newDelta = Math.round(calculateLpDelta({
                    playerCurrentMmr: runningMmr,
                    lobbyAvgMmr: p.match.lobbyAvgMmr,
                    consecutiveStreak: streak,
                    win: true
                }));

                if (oldDelta !== newDelta) {
                    updates.push({ pId: p.matchId, mId: p.id, oldDelta, newDelta, pId_db: p.id });
                    console.log(`[PREVIEW] Match ${p.matchId}: ${oldDelta} -> ${newDelta}`);
                }
                runningMmr += newDelta;
            } else {
                runningMmr += p.lpDelta; // Use previously corrected loss delta
            }
        }
    }

    if (updates.length === 0) {
        console.log("No changes needed.");
        process.exit(0);
    }

    console.log(`\nFound ${updates.length} updates. Press ENTER to apply...`);
    rl.question('', async () => {
        for (const u of updates) {
            await prisma.matchParticipant.update({
                where: { id: u.pId_db },
                data: { lpDelta: u.newDelta }
            });
        }
        console.log("Applied updates.");
        await prisma.$disconnect();
        process.exit(0);
    });
}

previewAndApply().catch(e => { console.error(e); process.exit(1); });
