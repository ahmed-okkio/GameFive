import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function debugGrandLift() {
    console.log("Debugging GrandLift#ADC match LP...");
    
    const player = await prisma.player.findFirst({
        where: {
            riotIdName: { equals: "GrandLift", mode: 'insensitive' },
            riotIdTag: { equals: "ADC", mode: 'insensitive' }
        }
    });

    if (!player) {
        console.log("Player GrandLift#ADC not found.");
        return;
    }

    const participants = await prisma.matchParticipant.findMany({
        where: { playerId: player.id },
        include: { match: true },
        orderBy: { match: { gameDate: "desc" } },
        take: 5
    });

    for (const p of participants) {
        console.log(`Match ${p.matchId}: LP Delta Stored = ${p.lpDelta}, Win = ${p.win}, Placed = ${p.isPlacement}`);
    }
}

debugGrandLift().finally(async () => await prisma.$disconnect());
