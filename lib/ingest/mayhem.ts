import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Player } from "@prisma/client";
import { bestRankedMmr, DEFAULT_MEDIAN_MMR } from "@/lib/mmr/ranked";
import { calculateLpDelta, calculatePlacementMmr } from "@/lib/mmr/calculate";
import { getTierLabel } from "@/lib/mmr/tier";
import { enqueueProfileCalculation } from "@/lib/jobs/enqueue";

export const companionMatchPayloadSchema = z.object({
  source: z.literal("lcu"),
  uploaderPuuid: z.string().min(1),
  gameId: z.number().int().positive(),
  queueId: z.number().int(),
  gameMode: z.string().nullable().optional(),
  mapId: z.number().int().nullable().optional(),
  gameCreation: z.number().int().positive(),
  gameDuration: z.number().int().nonnegative(),
  participants: z
    .array(
      z.object({
        puuid: z.string().min(1),
        gameName: z.string().nullable().optional(),
        tagLine: z.string().nullable().optional(),
        summonerName: z.string().nullable().optional(),
        participantId: z.number().int(),
        teamId: z.number().int(),
        championId: z.number().int(),
        win: z.boolean(),
        kills: z.number().int().nonnegative(),
        deaths: z.number().int().nonnegative(),
        assists: z.number().int().nonnegative(),
        totalDamageDealtToChampions: z.number().int().nonnegative(),
        totalHeal: z.number().int().nonnegative(),
        goldEarned: z.number().int().nonnegative().optional()
      })
    )
    .min(1)
});

export type CompanionMatchPayload = z.infer<typeof companionMatchPayloadSchema>;

function isMayhemPayload(payload: CompanionMatchPayload) {
  return payload.queueId === 2400 || payload.gameMode?.toUpperCase() === "KIWI";
}

async function getGlobalMedianMmr() {
  const players = await prisma.player.findMany({
    where: {
      rawMmr: {
        gt: 0
      }
    },
    select: {
      rawMmr: true
    },
    orderBy: {
      rawMmr: "asc"
    }
  });

  if (players.length < 10) {
    return DEFAULT_MEDIAN_MMR;
  }

  return players[Math.floor(players.length / 2)].rawMmr;
}

export async function ingestCompanionMayhemMatch(payload: CompanionMatchPayload) {
  if (!isMayhemPayload(payload)) {
    return {
      accepted: false,
      duplicate: false,
      reason: "not_mayhem"
    };
  }

  const matchId = `LCU_${payload.gameId}`;
  const existingMatch = await prisma.match.findUnique({
    where: {
      matchId
    }
  });

  if (existingMatch) {
    return {
      accepted: true,
      duplicate: true,
      matchId
    };
  }

  const globalMedianMmr = await getGlobalMedianMmr();
  const playerRows = new Map<string, Player>();

  // 1. Resolve or create all players
  for (const participant of payload.participants) {
    const riotIdName = participant.gameName?.trim() || participant.summonerName?.trim() || "Unknown";
    const riotIdTag = participant.tagLine?.trim() || "EUW";

    let player = await prisma.player.findUnique({
      where: {
        puuid: participant.puuid
      }
    });

    if (!player && riotIdName !== "Unknown") {
      player = await prisma.player.findFirst({
        where: {
          riotIdName,
          riotIdTag
        }
      });

      if (player) {
        const isNewReal = participant.puuid.length > 50;
        const isOldReal = player.puuid.length > 50;
        if (isNewReal && !isOldReal) {
          player = await prisma.player.update({
            where: { id: player.id },
            data: { puuid: participant.puuid }
          });
        }
      }
    }

    if (!player) {
      player = await prisma.player.create({
        data: {
          puuid: participant.puuid,
          riotIdName,
          riotIdTag
        }
      });
    } else if (participant.gameName && participant.tagLine) {
      player = await prisma.player.update({
        where: { id: player.id },
        data: { riotIdName, riotIdTag }
      });
    }

    playerRows.set(participant.puuid, player);
  }

  // 2. Calculate Lobby Average MMR
  // Spec: "Calculate lobby_avg_mmr as the average of all 9 other players in the lobby (allies and enemies)."
  const uploader = playerRows.get(payload.uploaderPuuid);
  const opponents = [...playerRows.values()].filter(p => p.id !== uploader?.id);
  
  const lobbyAvgMmr = opponents.reduce((sum, player) => {
    const pMmr = player.isPlaced ? player.rawMmr : bestRankedMmr(player.soloDuoTier, player.soloDuoDivision, player.flexTier, player.flexDivision, globalMedianMmr);
    return sum + (pMmr ?? globalMedianMmr);
  }, 0) / Math.max(opponents.length, 1);

  // 3. Create the match
  const storedMatch = await prisma.match.create({
    data: {
      matchId,
      gameMode: "MAYHEM",
      gameDate: new Date(payload.gameCreation),
      durationSeconds: payload.gameDuration,
      queueId: payload.queueId,
      lobbyAvgMmr
    }
  });

  // 4. Calculate LP delta
  let calculatedLpDelta = 0;
  if (uploader) {
    const existingMayhemGamesCount = await prisma.matchParticipant.count({
        where: { playerId: uploader.id, match: { gameMode: "MAYHEM" } }
    });
    const mayhemGamesCount = existingMayhemGamesCount + 1;
    const isWin = payload.participants.find(p => p.puuid === payload.uploaderPuuid)?.win ?? false;
    
    if (mayhemGamesCount >= 10 && uploader.isPlaced) {
        const last5Games = await prisma.matchParticipant.findMany({
            where: { playerId: uploader.id, match: { gameMode: "MAYHEM" } },
            include: { match: true },
            orderBy: { match: { gameDate: "desc" } },
            take: 5
        });
        
        let consecutiveStreak = 0;
        for (const g of last5Games) {
            if (g.win === isWin) consecutiveStreak++;
            else break;
        }
        
        const delta = calculateLpDelta({
            playerCurrentMmr: uploader.rawMmr,
            lobbyAvgMmr: lobbyAvgMmr,
            consecutiveStreak: consecutiveStreak,
            win: isWin
        });
        calculatedLpDelta = Math.round(isWin ? delta : -delta);
    }
  }

  // 5. Create match participants
  for (const participant of payload.participants) {
    const player = playerRows.get(participant.puuid);
    if (!player) continue;

    await prisma.matchParticipant.create({
      data: {
        matchId: storedMatch.id,
        playerId: player.id,
        team: participant.teamId,
        win: participant.win,
        championId: participant.championId,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        damageToChampions: participant.totalDamageDealtToChampions,
        healingDone: participant.totalHeal,
        // Performance stats stored but not used for MMR
        killParticipation: 0,
        damageShare: 0,
        healingShare: 0,
        performanceScore: 0,
        lpDelta: participant.puuid === payload.uploaderPuuid ? calculatedLpDelta : 0
      }
    });
  }

  // 6. Update uploader MMR/LP
  if (uploader) {
    const mayhemGamesCount = await prisma.matchParticipant.count({
        where: { playerId: uploader.id, match: { gameMode: "MAYHEM" } }
    });

    if (mayhemGamesCount >= 10 && uploader.isPlaced) {
        const newMmr = uploader.rawMmr + calculatedLpDelta;
        const tier = getTierLabel(newMmr);

        await prisma.player.update({
            where: { id: uploader.id },
            data: {
                rawMmr: newMmr,
                currentLp: Math.round(newMmr % 100),
                mayhemGames: mayhemGamesCount,
                lastGameDate: new Date(payload.gameCreation),
                lastGameTier: tier.tier,
                cacheUpdatedAt: new Date()
            }
        });
    } else if (mayhemGamesCount >= 10 && !uploader.isPlaced) {
        // Just finished or passed 10th game - Run Placement Formula
        const first10Games = await prisma.matchParticipant.findMany({
            where: { playerId: uploader.id, match: { gameMode: "MAYHEM" } },
            include: { match: true },
            orderBy: { match: { gameDate: "asc" } },
            take: 10
        });
        const wins = first10Games.filter(g => g.win).length;

        const startingMmr = calculatePlacementMmr({
            soloDuoTier: uploader.soloDuoTier,
            soloDuoDivision: uploader.soloDuoDivision,
            flexTier: uploader.flexTier,
            flexDivision: uploader.flexDivision,
            historicalTier: uploader.historicalTier,
            historicalDivision: uploader.historicalDivision,
            mayhemWins: wins,
            globalMedianMmr
        });

        const tier = getTierLabel(startingMmr);

        await prisma.player.update({
            where: { id: uploader.id },
            data: {
                isPlaced: true,
                rawMmr: startingMmr,
                currentLp: Math.round(startingMmr % 100),
                mayhemGames: mayhemGamesCount,
                lastGameDate: new Date(payload.gameCreation),
                lastGameTier: tier.tier,
                cacheUpdatedAt: new Date()
            }
        });
    } else {
        // Still in placements
        await prisma.player.update({
            where: { id: uploader.id },
            data: {
                mayhemGames: mayhemGamesCount,
                lastGameDate: new Date(payload.gameCreation),
                cacheUpdatedAt: new Date()
            }
        });
    }

    if (uploader.riotIdName !== "Unknown") {
      await enqueueProfileCalculation(uploader.riotIdName, uploader.riotIdTag);
    }
  }

  return {
    accepted: true,
    duplicate: false,
    matchId,
    participants: payload.participants.length
  };
}
