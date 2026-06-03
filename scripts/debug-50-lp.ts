import { PrismaClient } from "@prisma/client";
import { calculateLpDelta } from "../lib/mmr/calculate";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function debugMatchMath() {
    const matchIdDb = "0e18fe05-f82f-427f-b97c-bd76291dc3a9";
    const participant = await prisma.matchParticipant.findFirst({
        where: { matchId: matchIdDb },
        include: { match: true, player: true }
    });

    if (!participant || !participant.player) {
        console.log("Match participant not found.");
        return;
    }

    const player = participant.player;
    
    // Streak simulation
    const streakMatches = await prisma.matchParticipant.findMany({
        where: { playerId: player.id, match: { gameDate: { lt: participant.match.gameDate }, gameMode: "MAYHEM" } },
        orderBy: { match: { gameDate: "desc" } },
        take: 5
    });
    
    let streak = 0;
    for (const g of streakMatches) {
        if (g.win === participant.win) streak++;
        else break;
    }

    // Need player MMR BEFORE this match. 
    // Simplified: Current MMR - sum of all LP deltas from this match onwards (if this wasn't the latest)
    // Or just use the rawMmr which should be the final state if ingestion was correct.
    // Let's assume rawMmr is the current state.
    
    const lobbyMmr = participant.match.lobbyAvgMmr ?? 1400;
    
    console.log(`Match: ${matchIdDb}`);
    console.log(`Player: ${player.riotIdName}#${player.riotIdTag}`);
    console.log(`Current Player MMR: ${player.rawMmr}`);
    console.log(`Lobby Avg MMR: ${lobbyMmr}`);
    console.log(`Win: ${participant.win}`);
    console.log(`Streak: ${streak}`);
    
    const delta = calculateLpDelta({
        playerCurrentMmr: player.rawMmr, 
        lobbyAvgMmr: lobbyMmr,
        consecutiveStreak: streak,
        win: participant.win
    });

    console.log(`Calculated Delta: ${Math.round(participant.win ? delta : -delta)}`);
}

debugMatchMath().finally(async () => await prisma.$disconnect());
