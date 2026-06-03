import { prisma } from "@/lib/prisma";
import { getTierLabel } from "@/lib/mmr/tier";
import { calculatePlacementMmr } from "@/lib/mmr/calculate";
import { DEFAULT_MEDIAN_MMR } from "@/lib/mmr/ranked";
import { Player } from "@prisma/client";

export async function calculateAndStoreProfile(player: Player) {
    const participants = await prisma.matchParticipant.findMany({
        where: { playerId: player.id, match: { gameMode: "MAYHEM" } },
        include: { match: true },
        orderBy: { match: { gameDate: "asc" } }
    });

    const mayhemGamesCount = participants.length;

    if (mayhemGamesCount >= 10 && !player.isPlaced) {
        const wins = participants.filter(g => g.win).length;
        const startingMmr = calculatePlacementMmr({
            soloDuoTier: player.soloDuoTier,
            soloDuoDivision: player.soloDuoDivision,
            flexTier: player.flexTier,
            flexDivision: player.flexDivision,
            historicalTier: player.historicalTier,
            historicalDivision: player.historicalDivision,
            mayhemWins: wins
        });

        const tier = getTierLabel(startingMmr);

        await prisma.player.update({
            where: { id: player.id },
            data: {
                isPlaced: true,
                rawMmr: startingMmr,
                currentLp: Math.round(startingMmr % 100),
                mayhemGames: mayhemGamesCount,
                lastGameTier: tier.tier,
                cacheUpdatedAt: new Date()
            }
        });
        
        // ... (remaining upsert code)
    }
    // ...
}

// REMOVED getGlobalMedianMmr function
