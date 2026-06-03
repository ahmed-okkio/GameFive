import { PrismaClient } from "@prisma/client";
import { rankedToMmr } from "../lib/mmr/ranked";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function debugPlayer() {
    const player = await prisma.player.findFirst({
        where: { riotIdName: { equals: "Okkio", mode: 'insensitive' } }
    });

    if (!player) {
        console.log("Player Okkio not found.");
        return;
    }

    console.log(`Player: ${player.riotIdName}#${player.riotIdTag}`);
    console.log(`Solo: ${player.soloDuoTier} ${player.soloDuoDivision}`);
    console.log(`Flex: ${player.flexTier} ${player.flexDivision}`);
    
    const mmr = rankedToMmr(player.flexTier, player.flexDivision);
    console.log(`Computed MMR: ${mmr}`);
}

debugPlayer().finally(async () => await prisma.$disconnect());
