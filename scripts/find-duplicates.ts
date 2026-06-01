import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function findDuplicates() {
    console.log("Searching for duplicates...");
    const players = await prisma.player.findMany();
    const groups = new Map<string, typeof players>();

    for (const player of players) {
        const key = `${player.riotIdName.toLowerCase()}#${player.riotIdTag.toLowerCase()}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(player);
    }

    let found = false;
    for (const [key, list] of groups) {
        if (list.length > 1) {
            found = true;
            console.log(`DUPLICATE FOUND for ${key}:`);
            list.forEach(p => console.log(`  ID: ${p.id}, PUUID: ${p.puuid}`));
        }
    }

    if (!found) {
        console.log("No duplicates found.");
    }
}

findDuplicates()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
