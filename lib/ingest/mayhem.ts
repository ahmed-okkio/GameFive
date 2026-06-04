import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Player } from "@prisma/client";
import { bestRankedMmrWithHistoricalFallback } from "@/lib/mmr/ranked";
import { applyPromoUpdate, getPromoRankLabel } from "@/lib/mmr/promos";
import { calculateLpDelta } from "@/lib/mmr/calculate";
import { getTierLabel } from "@/lib/mmr/tier";
import { getChampionMap } from "@/lib/riot/champions";
import { getPlayerByPuuid } from "@/lib/players";

export const companionMatchPayloadSchema = z.object({
  source: z.literal("lcu"),
  uploaderPuuid: z.string().min(1),
  gameId: z.number().int().positive(),
  queueId: z.number().int(),
  gameMode: z.string().nullable().optional(),
  mapId: z.number().int().nullable().optional(),
  gameCreation: z.number().int().positive(),
  gameDuration: z.number().int().nonnegative(),
  teams: z.array(z.record(z.any())).optional(),
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
        goldEarned: z.number().int().nonnegative().optional(),
        spell1Id: z.number().int().nullable().optional(),
        spell2Id: z.number().int().nullable().optional(),
        items: z.array(z.number().int().nonnegative()).max(7).optional(),
        augments: z.array(z.number().int().nonnegative()).max(6).optional(),
        champLevel: z.number().int().nonnegative().optional(),
        goldSpent: z.number().int().nonnegative().optional(),
        damageTaken: z.number().int().nonnegative().optional(),
        selfMitigated: z.number().int().nonnegative().optional(),
        minionsKilled: z.number().int().nonnegative().optional()
      })
    )
    .min(1)
});

export type CompanionMatchPayload = z.infer<typeof companionMatchPayloadSchema>;

function isMayhemPayload(payload: CompanionMatchPayload) {
  return payload.queueId === 2400 || payload.gameMode?.toUpperCase() === "KIWI";
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
    where: { matchId }
  });

  if (existingMatch) {
    return {
      accepted: true,
      duplicate: true,
      matchId
    };
  }

  const playerRows = new Map<string, Player>();
  const playerRankSignals = new Map<string, number | null>();
  const CHAMPION_MAP = await getChampionMap();

  // 1. Resolve only players that already exist in the database
  for (const participant of payload.participants) {
    const player = await getPlayerByPuuid(participant.puuid);
    if (player) {
      playerRows.set(participant.puuid, player);
      playerRankSignals.set(
        participant.puuid,
        bestRankedMmrWithHistoricalFallback({
          soloDuoTier: player.soloDuoTier,
          soloDuoDivision: player.soloDuoDivision,
          flexTier: player.flexTier,
          flexDivision: player.flexDivision,
          historicalTier: player.historicalTier,
          historicalDivision: player.historicalDivision
        })
      );
    }
  }

  // 2. Calculate Lobby Average MMR
  const uploader = playerRows.get(payload.uploaderPuuid);
  const rankedParticipants = [...playerRankSignals.values()].filter((value): value is number => value !== null);

  let lobbyAvgMmr: number | null = null;
  if (rankedParticipants.length > 0) {
      lobbyAvgMmr = rankedParticipants.reduce((sum, pMmr) => sum + pMmr, 0) / rankedParticipants.length;
  }

  // 3. Create the match
  const storedMatch = await prisma.match.create({
    data: {
      matchId,
      gameMode: "MAYHEM",
      gameDate: new Date(payload.gameCreation),
      durationSeconds: payload.gameDuration,
      queueId: payload.queueId,
      lobbyAvgMmr,
      teamsJson: payload.teams ?? undefined
    }
  });

  // 4. Calculate LP delta
  let calculatedLpDelta = 0;
  if (uploader) {
    const isWin = payload.participants.find(p => p.puuid === payload.uploaderPuuid)?.win ?? false;
    console.log(`Debug LP: uploader=${uploader.riotIdName}, isPlaced=${uploader.isPlaced}, isWin=${isWin}`);
    
    if (uploader.isPlaced) {
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
        console.log(`Debug LP: Calculated delta=${calculatedLpDelta}`);
    } else {
        console.log("Debug LP: Uploader not placed, skipping delta calculation.");
    }
  } else {
      console.log("Debug LP: Uploader not found, skipping delta calculation.");
  }

  // 5. Create match participants and update known players
  for (const participant of payload.participants) {
    const player = playerRows.get(participant.puuid) ?? null;
    const rankSignalMmr = player ? playerRankSignals.get(participant.puuid) ?? null : null;
    const playerRiotIdName = participant.gameName ?? player?.riotIdName ?? participant.summonerName ?? null;
    const playerRiotIdTag = participant.tagLine ?? player?.riotIdTag ?? null;

    // 1. Calculate stats for the match participant
    const championName = CHAMPION_MAP[participant.championId] ?? `Champion ${participant.championId}`;

    // 2. Calculate LP delta only if player exists and is placed
    let participantLpDelta = 0;
    if (player && player.isPlaced) {
        const last5Games = await prisma.matchParticipant.findMany({
            where: { playerId: player.id, match: { gameMode: "MAYHEM" } },
            include: { match: true },
            orderBy: { match: { gameDate: "desc" } },
            take: 5
        });
        
        let consecutiveStreak = 0;
        for (const g of last5Games) {
            if (g.win === participant.win) consecutiveStreak++;
            else break;
        }
        
        const delta = calculateLpDelta({
            playerCurrentMmr: player.rawMmr,
            lobbyAvgMmr: lobbyAvgMmr,
            consecutiveStreak: consecutiveStreak,
            win: participant.win
        });
        participantLpDelta = Math.round(participant.win ? delta : -delta);

        // 3. Update player MMR/LP
        const newMmr = player.rawMmr + participantLpDelta;
        const promoState = applyPromoUpdate({
          previousMmr: player.rawMmr,
          updatedMmr: newMmr,
          win: participant.win,
          promo: {
            promoFromTier: player.promoFromTier,
            promoToTier: player.promoToTier,
            promoWins: player.promoWins,
            promoLosses: player.promoLosses
          }
        });
        const resolvedMmr = promoState.rawMmr;
        const tier = getTierLabel(resolvedMmr);

        await prisma.player.update({
            where: { id: player.id },
            data: {
                rawMmr: resolvedMmr,
                currentLp: Math.round(resolvedMmr % 100),
                mayhemGames: { increment: 1 },
                lastGameDate: new Date(payload.gameCreation),
                lastGameTier: promoState.promoFromTier && promoState.promoToTier ? getPromoRankLabel({
                  promoFromTier: promoState.promoFromTier,
                  promoToTier: promoState.promoToTier,
                  promoWins: promoState.promoWins,
                  promoLosses: promoState.promoLosses,
                  rawMmr: resolvedMmr
                }) : tier.label,
                promoFromTier: promoState.promoFromTier,
                promoToTier: promoState.promoToTier,
                promoWins: promoState.promoWins,
                promoLosses: promoState.promoLosses,
                cacheUpdatedAt: new Date()
            }
        });
    }

    await prisma.matchParticipant.create({
        data: {
        matchId: storedMatch.id,
        playerId: player?.id,
        playerRiotIdName,
        playerRiotIdTag,
        rankSignalMmr,
          team: participant.teamId,
          win: participant.win,
        championId: participant.championId,
        championName,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        damageToChampions: participant.totalDamageDealtToChampions,
        healingDone: participant.totalHeal,
        killParticipation: 0,
        damageShare: 0,
        healingShare: 0,
        performanceScore: 0,
        lpDelta: participantLpDelta,
        isPlacement: player ? !player.isPlaced : false,
        itemsJson: participant.items,
        augmentsJson: participant.augments,
        spell1Id: participant.spell1Id,
        spell2Id: participant.spell2Id,
        champLevel: participant.champLevel,
        goldEarned: participant.goldEarned,
        goldSpent: participant.goldSpent,
        damageTaken: participant.damageTaken,
        selfMitigated: participant.selfMitigated,
        minionsKilled: participant.minionsKilled
      }
    });
  }

  return {
    accepted: true,
    duplicate: false,
    matchId,
    participants: payload.participants.length
  };
}
