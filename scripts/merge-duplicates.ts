import { PrismaClient } from "@prisma/client";

// Hardcoding the URL here to bypass environment loading issues for this script
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:YasuoisGam383@db.opqknegnedfypkctcbuh.supabase.co:6543/postgres?pgbouncer=true"
        }
    }
});

async function mergeDuplicates() {
    console.log("Starting duplicate player merge...");
    
    const players = await prisma.player.findMany();
    const groups = new Map<string, typeof players>();

    // Group by name+tag
    for (const player of players) {
        const key = `${player.riotIdName.toLowerCase()}#${player.riotIdTag.toLowerCase()}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(player);
    }

    let count = 0;
    for (const [key, list] of groups) {
        if (list.length > 1) {
            console.log(`Merging ${key}...`);
            // Sort by PUUID length (assume longer = real)
            const sorted = list.sort((a, b) => (b.puuid?.length ?? 0) - (a.puuid?.length ?? 0));
            const realPlayer = sorted[0];
            const fakePlayers = sorted.slice(1);

            for (const fakePlayer of fakePlayers) {
                console.log(`Merging fake player ${fakePlayer.id} into real player ${realPlayer.id}`);
                
                // Get all matches for fake player
                const fakeParticipants = await prisma.matchParticipant.findMany({ 
                    where: { playerId: fakePlayer.id } 
                });

                for (const fp of fakeParticipants) {
                    // Check if real player already participated in this match
                    const existing = await prisma.matchParticipant.findUnique({
                        where: {
                            matchId_playerId: {
                                matchId: fp.matchId,
                                playerId: realPlayer.id
                            }
                        }
                    });

                    if (existing) {
                        // Real player already has an entry, delete the fake one
                        await prisma.matchParticipant.delete({ where: { id: fp.id } });
                    } else {
                        // Move the match to the real player
                        await prisma.matchParticipant.update({ 
                            where: { id: fp.id }, 
                            data: { playerId: realPlayer.id } 
                        });
                    }
                }

                // Delete fake player
                await prisma.player.delete({ where: { id: fakePlayer.id } });
                count++;
            }
        }
    }
    console.log(`Merge complete. ${count} fake players removed.`);
}

mergeDuplicates()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
