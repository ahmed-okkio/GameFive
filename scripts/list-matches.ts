import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});
async function findMatches() {
    const player = await prisma.player.findFirst({
        where: { riotIdName: { equals: "GrandLift", mode: "insensitive" } }
    });
    const participants = await prisma.matchParticipant.findMany({
        where: { playerId: player?.id },
        include: { match: true },
        take: 3
    });
    participants.forEach(p => console.log(`Match: ${p.match.matchId}`));
}
findMatches().finally(async () => await prisma.$disconnect());
