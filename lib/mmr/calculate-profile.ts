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
        // Calculate average lobby MMR across all placement games where it was calculable
        const calculableMatches = participants.filter(p => p.match.lobbyAvgMmr !== null);
        const lobbyAnchorMmr = calculableMatches.length > 0 
            ? calculableMatches.reduce((sum, p) => sum + (p.match.lobbyAvgMmr ?? 0), 0) / calculableMatches.length 
            : null;

        const wins = participants.filter(g => g.win).length;
        const startingMmr = calculatePlacementMmr({
            soloDuoTier: player.soloDuoTier,
            soloDuoDivision: player.soloDuoDivision,
            flexTier: player.flexTier,
            flexDivision: player.flexDivision,
            mayhemWins: wins,
            lobbyAnchorMmr
        });

        // Defer placement if MMR is still uncalculable (null)
        if (startingMmr === null) {
            await prisma.player.update({
                where: { id: player.id },
                data: { mayhemGames: mayhemGamesCount, cacheUpdatedAt: new Date() }
            });
            return;
        }

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

        // Automatically add to leaderboard if they just became placed
        await prisma.friendsLeaderboard.upsert({
          where: { playerId: player.id },
          update: {},
          create: {
            playerId: player.id,
            addedBy: "auto-placed"
          }
        });
    } else {
        await prisma.player.update({
            where: { id: player.id },
            data: {
                mayhemGames: mayhemGamesCount,
                cacheUpdatedAt: new Date()
            }
        });
    }
}
