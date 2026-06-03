import { PrismaClient } from "@prisma/client";
import { calculateLpDelta } from "../lib/mmr/calculate";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function debugMath() {
    // Pick match 0e18fe05-f82f-427f-b97c-bd76291dc3a9 as the example
    const matchId = "LCU_7873060334"; // Valid match ID found
    const match = await prisma.match.findFirst({
        where: { matchId: matchId },
        include: { participants: { include: { player: true } } }
    });

    if (!match) { console.log("Match not found"); return; }
    
    // Pick the player GrandLift
    const p = match.participants.find(p => p.player.riotIdName === "GrandLift");
    if (!p) { console.log("Player not found in match"); return; }

    const player = p.player;
    
    // Streak simulation
    const streakMatches = await prisma.matchParticipant.findMany({
        where: { playerId: player.id, match: { gameDate: { lt: match.gameDate }, gameMode: "MAYHEM" } },
        orderBy: { match: { gameDate: "desc" } },
        take: 5
    });

    let streak = 0;
    for (const g of streakMatches) {
        if (g.win === p.win) streak++;
        else break;
    }

    const playerMmr = player.rawMmr; // Approximation
    const lobbyMmr = match.lobbyAvgMmr ?? 1400;
    
    const delta = calculateLpDelta({
        playerCurrentMmr: playerMmr,
        lobbyAvgMmr: lobbyMmr,
        consecutiveStreak: streak,
        win: p.win
    });

    console.log(`Match: ${match.matchId}`);
    console.log(`Player MMR: ${playerMmr}`);
    console.log(`Lobby Avg MMR: ${lobbyMmr}`);
    console.log(`Opponent Factor: ${(lobbyMmr / Math.max(playerMmr, 1)).toFixed(3)}`);
    console.log(`Streak Multiplier: ${(1 + (0.05 * Math.min(streak, 5))).toFixed(2)}`);
    console.log(`Resulting LP Delta: ${Math.round(p.win ? delta : -delta)}`);
}

debugMath().finally(async () => await prisma.$disconnect());
