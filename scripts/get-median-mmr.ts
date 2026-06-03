import { PrismaClient } from "@prisma/client";
import { DEFAULT_MEDIAN_MMR } from "../lib/mmr/ranked";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function getMedian() {
    const players = await prisma.player.findMany({
        where: { rawMmr: { gt: 0 } },
        select: { rawMmr: true },
        orderBy: { rawMmr: "asc" }
    });
    const median = players.length < 10 ? DEFAULT_MEDIAN_MMR : players[Math.floor(players.length / 2)].rawMmr;
    console.log(`Global median MMR: ${median}`);
}

getMedian().finally(async () => await prisma.$disconnect());
