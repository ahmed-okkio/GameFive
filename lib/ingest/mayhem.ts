import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Player } from "@prisma/client";
import { bestRankedMmr } from "@/lib/mmr/ranked";
import { rankedToMmr } from "@/lib/mmr/ranked";
import { calculateLpDelta } from "@/lib/mmr/calculate";
import { getTierLabel } from "@/lib/mmr/tier";
import { getChampionMap } from "@/lib/riot/champions";
import { calculateAndStoreProfile } from "@/lib/mmr/calculate-profile";
import { upsertPlayer } from "@/lib/players";

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
  const CHAMPION_MAP = await getChampionMap();

  // 1. Resolve or create all players
  for (const participant of payload.participants) {
    const riotIdName = participant.gameName?.trim() || participant.summonerName?.trim() || "Unknown";
    const riotIdTag = participant.tagLine?.trim() || "EUW";

    const player = await upsertPlayer(riotIdName, riotIdTag, participant.puuid);
    playerRows.set(participant.puuid, player);
  }

  // 2. Calculate Lobby Average MMR
  const uploader = playerRows.get(payload.uploaderPuuid);
  const opponents = [...playerRows.values()].filter(p => p.id !== uploader?.id);
  
  // Filter for players with real rank data
  const validOpponents = opponents.filter(p => 
      (p.soloDuoTier && p.soloDuoTier !== "UNRANKED") || 
      (p.flexTier && p.flexTier !== "UNRANKED")
  );

  let lobbyAvgMmr = 0;
  if (validOpponents.length > 0) {
      lobbyAvgMmr = validOpponents.reduce((sum, player) => {
        // Resolve best rank signal (Solo/Duo OR Flex)
        const pMmr = bestRankedMmr(player.soloDuoTier, player.soloDuoDivision, player.flexTier, player.flexDivision);
        return sum + (pMmr ?? 0);
      }, 0) / validOpponents.length;
  } else {
      // Fallback: use uploader's own rawMmr
      lobbyAvgMmr = uploader?.rawMmr ?? 1100;
  }

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
    const isWin = payload.participants.find(p => p.puuid === payload.uploaderPuuid)?.win ?? false;
    
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
    }
  }

  // 5. Create match participants
  for (const participant of payload.participants) {
    const player = playerRows.get(participant.puuid);
    if (!player) continue;

    const championName = CHAMPION_MAP[participant.championId] ?? `Champion ${participant.championId}`;

    await prisma.matchParticipant.create({
      data: {
        matchId: storedMatch.id,
        playerId: player.id,
        team: participant.teamId,
        win: participant.win,
        championId: participant.championId,
        championName: championName,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        damageToChampions: participant.totalDamageDealtToChampions,
        healingDone: participant.totalHeal,
        killParticipation: 0,
        damageShare: 0,
        healingShare: 0,
        performanceScore: 0,
        lpDelta: participant.puuid === payload.uploaderPuuid ? calculatedLpDelta : 0,
        isPlacement: !player.isPlaced
      }
    });
  }

  // 6. Update uploader MMR/LP
  if (uploader) {
      if (uploader.isPlaced) {
          const newMmr = uploader.rawMmr + calculatedLpDelta;
          const tier = getTierLabel(newMmr);

          await prisma.player.update({
              where: { id: uploader.id },
              data: {
                  rawMmr: newMmr,
                  currentLp: Math.round(newMmr % 100),
                  mayhemGames: { increment: 1 },
                  lastGameDate: new Date(payload.gameCreation),
                  lastGameTier: tier.tier,
                  cacheUpdatedAt: new Date()
              }
          });
      } else {
        await calculateAndStoreProfile(uploader);
      }
  }

  return {
    accepted: true,
    duplicate: false,
    matchId,
    participants: payload.participants.length
  };
}
