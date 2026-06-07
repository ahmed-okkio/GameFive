import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Player } from "@prisma/client";
import { bestRankedMmrWithHistoricalFallback, rankedToMmr } from "@/lib/mmr/ranked";
import { calculateLpDelta } from "@/lib/mmr/calculate";
import { getTierLabel } from "@/lib/mmr/tier";
import { getChampionMap, refreshChampionMap } from "@/lib/riot/champions";
import { getPlayerByPuuid, upsertPlayer, hydrateRankedSignals } from "@/lib/players";
import { riotClient } from "@/lib/riot/client";
import { fetchOpggHistoricalRank } from "@/lib/riot/opgg";

let championMapCache: Record<number, string> | null = null;

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

async function resolveRank(name: string, tag: string): Promise<number | null> {
    try {
        // A: Resolve to public PUUID first
        const account = await riotClient.getAccountByRiotId(name, tag);

        // B: If account found, try to fetch ranked entries
        if (account) {
            const leagues = await riotClient.getLeagueEntriesByPuuid(account.puuid);
            const solo = leagues.find(l => l.queueType === "RANKED_SOLO_5x5");
            const flex = leagues.find(l => l.queueType === "RANKED_FLEX_SR");
            const mmr = Math.max(rankedToMmr(solo?.tier, solo?.rank) || 0, rankedToMmr(flex?.tier, flex?.rank) || 0);
            if (mmr > 0) return mmr;
        }

        // C: Fallback to OP.GG
        const hist = await fetchOpggHistoricalRank("euw", name, tag);
        if (hist) return rankedToMmr(hist.tier, hist.division) ?? null;
    } catch (e) {
        console.warn(`Failed to resolve rank for ${name}#${tag}`, e);
    }
    return null;
}

export async function ingestCompanionMayhemMatch(payload: CompanionMatchPayload) {
  if (!isMayhemPayload(payload)) {
    return { accepted: false, duplicate: false, reason: "not_mayhem" };
  }

  if (payload.gameDuration < 180) {
      console.log(`[Ingest] Skipping match ${payload.gameId} because it is a remake (duration: ${payload.gameDuration}s)`);
      return { accepted: false, duplicate: false, reason: "remake" };
  }

  const matchId = `LCU_${payload.gameId}`;
  console.log(`[Ingest] Starting match ${matchId}`);

  const existingMatch = await prisma.match.findUnique({ where: { matchId } });
  if (existingMatch) {
    console.log(`[Ingest] Match ${matchId} already exists, skipping.`);
    return { accepted: true, duplicate: true, matchId };
  }

  const playerRows = new Map<string, Player>();
  const playerRankSignals = new Map<string, number | null>();
  
  if (!championMapCache) {
      championMapCache = await getChampionMap();
  }

  // 1. Resolve ALL players in parallel
  console.log(`[Ingest] Resolving ${payload.participants.length} players...`);
  await Promise.all(payload.participants.map(async (participant) => {
      const name = participant.gameName ?? participant.summonerName ?? "Unknown";
      const tag = participant.tagLine ?? "EUW";

      // Try lookup by Name/Tag first
      let player = await prisma.player.findFirst({
          where: { riotIdName: name, riotIdTag: tag }
      });

      // Fallback lookup by PUUID
      if (!player) {
          player = await getPlayerByPuuid(participant.puuid);
      }

      // Self-heal: If found but PUUID is missing/mismatched, update it
      if (player && participant.puuid && player.puuid !== participant.puuid) {
          player = await prisma.player.update({
              where: { id: player.id },
              data: { puuid: participant.puuid }
          });
          console.log(`[Ingest] Updated PUUID for ${name}#${tag}`);
      }

      if (player) {
          player = await hydrateRankedSignals(player);
          playerRows.set(participant.puuid, player);
          playerRankSignals.set(participant.puuid, player.rawMmr);
      } else if (participant.puuid === payload.uploaderPuuid) {
          const player = await upsertPlayer(name, tag, participant.puuid);
          playerRows.set(participant.puuid, player);
          playerRankSignals.set(participant.puuid, player.rawMmr);
      } else {
          // Non-uploader, not in DB - resolve without persisting
          const rankMmr = await resolveRank(name, tag);
          playerRankSignals.set(participant.puuid, rankMmr);
      }
  }));
  console.log(`[Ingest] Players resolved.`);

  // 2. Calculate Team Average MMRs
  const team100Ranked: number[] = [];
  const team200Ranked: number[] = [];

  payload.participants.forEach(p => {
      const m = playerRankSignals.get(p.puuid);
      if (m !== null && m !== undefined) {
          if (p.teamId === 100) team100Ranked.push(m);
          else if (p.teamId === 200) team200Ranked.push(m);
      }
  });

  const allRanked = [...team100Ranked, ...team200Ranked];
  const lobbyAvgMmr = allRanked.length > 0
      ? allRanked.reduce((sum, pMmr) => sum + pMmr, 0) / allRanked.length
      : null;

  const team100Avg = team100Ranked.length > 0
      ? team100Ranked.reduce((a, b) => a + b, 0) / team100Ranked.length
      : lobbyAvgMmr;

  const team200Avg = team200Ranked.length > 0
      ? team200Ranked.reduce((a, b) => a + b, 0) / team200Ranked.length
      : lobbyAvgMmr;

  // 3. Create the match
  const storedMatch = await prisma.match.create({
    data: {
      matchId,
      gameMode: "MAYHEM",
      gameDate: new Date(payload.gameCreation),
      durationSeconds: payload.gameDuration,
      queueId: payload.queueId,
      lobbyAvgMmr,
      team100AvgMmr: team100Avg ? Math.round(team100Avg) : null,
      team200AvgMmr: team200Avg ? Math.round(team200Avg) : null,
      teamsJson: payload.teams ?? undefined
    }
  });

  // 4. Create match participants and update known players
  for (const participant of payload.participants) {
    const player = playerRows.get(participant.puuid) ?? null;
    console.log(`[Ingest] Processing participant ${participant.puuid}. Found in playerRows: ${!!player}`);
    if (player) console.log(`[Ingest] Player ${player.riotIdName} isPlaced: ${player.isPlaced}`);

    const rankSignalMmr = playerRankSignals.get(participant.puuid) ?? null;
    const playerRiotIdName = player ? null : participant.gameName ?? participant.summonerName ?? null;
    const playerRiotIdTag = player ? null : participant.tagLine ?? null;

    // 1. Calculate stats for the match participant
    if (!championMapCache[participant.championId]) {
        championMapCache = await refreshChampionMap();
    }
    const championName = championMapCache[participant.championId] ?? `Champion ${participant.championId}`;

    // 2. Update lastGameDate for all participants in DB
    if (player) {
        await prisma.player.update({
            where: { id: player.id },
            data: { lastGameDate: new Date(payload.gameCreation), cacheUpdatedAt: new Date() }
        });
    }

    // 3. Calculate LP delta only if player exists and is placed
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
        
        const myTeamAvgMmr = participant.teamId === 100 ? team100Avg : team200Avg;
        const opposingTeamAvgMmr = participant.teamId === 100 ? team200Avg : team100Avg;

        const delta = calculateLpDelta({
            playerCurrentMmr: player.rawMmr,
            myTeamAvgMmr,
            opposingTeamAvgMmr,
            lobbyAvgFallback: lobbyAvgMmr,
            consecutiveStreak: consecutiveStreak,
            win: participant.win
        });
        participantLpDelta = Math.round(participant.win ? delta : -delta);

        const newMmr = player.rawMmr + participantLpDelta;
        const tier = getTierLabel(newMmr);

        await prisma.player.update({
            where: { id: player.id },
            data: {
                rawMmr: newMmr,
                currentLp: Math.round(newMmr % 100),
                mayhemGames: { increment: 1 },
                lastGameDate: new Date(payload.gameCreation),
                lastGameTier: tier.label,
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

  return { accepted: true, duplicate: false, matchId, participants: payload.participants.length };
}
