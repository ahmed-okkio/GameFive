import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function findMissingMatches() {
    const logGameIds = [
        "7874749978",
        "7874746474",
        "7873268802",
        "7873222419",
        "7873199616",
        "7873080325",
        "7873060334",
        "7873035938"
    ];

    console.log("Checking DB for matches:", logGameIds);

    const existingMatches = await prisma.match.findMany({
        where: {
            matchId: { in: logGameIds.map(id => `LCU_${id}`) }
        },
        select: { matchId: true }
    });

    const existingIds = existingMatches.map(m => m.matchId.replace("LCU_", ""));
    const missingIds = logGameIds.filter(id => !existingIds.includes(id));

    console.log("Missing Match IDs:", missingIds);
}

findMissingMatches().finally(async () => await prisma.$disconnect());
