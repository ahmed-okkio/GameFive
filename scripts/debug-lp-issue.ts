import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function debugMatch(gameId: string) {
    const match = await prisma.match.findFirst({
        where: { matchId: `LCU_${gameId}` },
        include: { participants: { include: { player: true } } }
    });

    if (!match) {
        console.log(`Match LCU_${gameId} not found.`);
        return;
    }

    console.log(`Match: ${match.matchId} | LobbyAvgMmr: ${match.lobbyAvgMmr}`);

    match.participants.forEach(p => {
        console.log(`Player: ${p.player.riotIdName}#${p.player.riotIdTag} | LP Delta: ${p.lpDelta} | Placed: ${p.isPlacement}`);
        if (p.lpDelta !== 0) {
            console.log(`  -> Participant ${p.player.riotIdName} had non-zero LP Delta!`);
        }
    });
}

// Replace this with the actual game ID of the match where Leona got 0 LP
debugMatch("7873222419").finally(async () => await prisma.$disconnect());
