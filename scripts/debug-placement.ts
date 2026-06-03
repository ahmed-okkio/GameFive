import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function checkPlacements() {
    console.log("Checking placement matches for Okkio#ETU...");
    
    const player = await prisma.player.findFirst({
        where: {
            riotIdName: { equals: "Okkio", mode: 'insensitive' },
            riotIdTag: { equals: "ETU", mode: 'insensitive' }
        }
    });

    if (!player) {
        console.log("Player not found.");
        return;
    }

    const participants = await prisma.matchParticipant.findMany({
        where: { playerId: player.id },
        include: { match: true },
        orderBy: { match: { gameDate: "asc" } },
        take: 10
    });

    console.log(`Found ${participants.length} matches.`);
    let sum = 0;
    let count = 0;

    participants.forEach((p, i) => {
        console.log(`Match ${i+1}: lobbyAvgMmr = ${p.match.lobbyAvgMmr}`);
        if (p.match.lobbyAvgMmr !== null) {
            sum += p.match.lobbyAvgMmr;
            count++;
        }
    });

    console.log(`Calculable matches: ${count}`);
    const placementLobbyAvgMmr = count > 0 ? sum / count : null;
    console.log(`Calculated placementLobbyAvgMmr: ${placementLobbyAvgMmr}`);
}

checkPlacements()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
