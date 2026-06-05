import { prisma } from "@/lib/prisma";
import { DEFAULT_MEDIAN_MMR } from "@/lib/mmr/ranked";
import { getTierLabel } from "@/lib/mmr/tier";
import { getChampionAssetMap, getChampionMap } from "@/lib/riot/champions";
import { riotClient } from "@/lib/riot/client";
import { fetchOpggHistoricalRank } from "@/lib/riot/opgg";
import { extractRankedSnapshot } from "@/lib/riot/ranked";
import { Player } from "@prisma/client";

export async function getGlobalMedianMmr() {
  const players = await prisma.player.findMany({
    where: { rawMmr: { gt: 0 } },
    select: { rawMmr: true },
    orderBy: { rawMmr: "asc" }
  });
  return players.length < 10 ? DEFAULT_MEDIAN_MMR : players[Math.floor(players.length / 2)].rawMmr;
}

export async function getPlayerByRiotId(gameName: string, tagLine: string) {
  return await prisma.player.findFirst({
    where: {
      riotIdName: { equals: gameName, mode: 'insensitive' },
      riotIdTag: { equals: tagLine, mode: 'insensitive' },
    },
  });
}

export async function getPlayerByPuuid(puuid: string) {
  return prisma.player.findFirst({
    where: {
      puuid
    }
  });
}

// ALWAYS use the "Official" Riot-provided name and tag to ensure correct casing
export async function upsertPlayer(
  riotIdName: string,
  riotIdTag: string,
  puuid: string | null | undefined,
  profileIconId?: number | null
) {
  const player = await prisma.player.upsert({
    where: {
        riotIdName_riotIdTag: {
            riotIdName: riotIdName,
            riotIdTag: riotIdTag
        }
    },
    update: {
        puuid: (puuid && puuid.length > 10) ? puuid : undefined,
        profileIconId: profileIconId ?? undefined,
        // Ensure we update to the official casing provided by Riot
        riotIdName: riotIdName,
        riotIdTag: riotIdTag,
    },
    create: {
        puuid: (puuid && puuid.length > 10) ? puuid : null,
        riotIdName: riotIdName,
        riotIdTag: riotIdTag,
        profileIconId,
    },
  });

  // Self-heal: Link unlinked participants to this player
  await linkUnlinkedParticipants(player.id, riotIdName, riotIdTag);

  return hydrateRankedSignals(player);
}

export async function linkUnlinkedParticipants(playerId: string, name: string, tag: string) {
    await prisma.matchParticipant.updateMany({
        where: {
            playerId: null,
            playerRiotIdName: { equals: name, mode: 'insensitive' },
            playerRiotIdTag: { equals: tag, mode: 'insensitive' }
        },
        data: {
            playerId: playerId
        }
    });
}

export async function hydrateRankedSignals(player: Player): Promise<Player> {
  if (!player.puuid) return player;

  const cacheAgeMs = player.cacheUpdatedAt ? Date.now() - player.cacheUpdatedAt.getTime() : Number.POSITIVE_INFINITY;
  const rankCacheTtlMs = 7 * 24 * 60 * 60 * 1000;

  if ((player.soloDuoTier || player.flexTier || player.historicalTier) && cacheAgeMs < rankCacheTtlMs) {
    return player;
  }

  let riotData: Awaited<ReturnType<typeof extractRankedSnapshot>> | null = null;
  let opggData: { tier: string, division: string } | null = null;

  // 1. Try Riot API (Current)
  try {
    const entries = await riotClient.getLeagueEntriesByPuuid(player.puuid);
    if (entries.length > 0) {
      riotData = extractRankedSnapshot(entries);
    }
  } catch (error) {
    console.warn(`Failed to fetch Riot ranked entries for ${player.riotIdName}`, error);
  }

  // 2. Fallback to OP.GG (Historical) if NO current ranked data found
  if (!riotData || (!riotData.soloDuoTier && !riotData.flexTier)) {
    try {
      const historicalRank = await fetchOpggHistoricalRank(player.region, player.riotIdName, player.riotIdTag);
      if (historicalRank) {
        opggData = {
            tier: historicalRank.tier,
            division: historicalRank.division ?? "I" // Ensure division is a string
        };
      }
    } catch (error) {
      console.warn(`Failed to fetch OP.GG historical rank for ${player.riotIdName}`, error);
    }
  }

  // 3. Persist and return
  return await prisma.player.update({
    where: { id: player.id },
    data: {
      soloDuoTier: riotData?.soloDuoTier ?? undefined,
      soloDuoDivision: riotData?.soloDuoDivision ?? undefined,
      flexTier: riotData?.flexTier ?? undefined,
      flexDivision: riotData?.flexDivision ?? undefined,
      historicalTier: opggData?.tier ?? (riotData ? undefined : "UNRANKED"),
      historicalDivision: opggData?.division ?? (riotData ? undefined : null),
      cacheUpdatedAt: new Date()
    }
  });
}


export async function ensurePlayerExists(gameName: string, tagLine: string): Promise<Player | null> {
    try {
        console.log(`Ensuring player ${gameName}#${tagLine} exists in DB (Official Riot Casing)...`);
        const account = await riotClient.getAccountByRiotId(gameName, tagLine);
        if (account) {
            const summoner = await riotClient.getSummonerByPuuid(account.puuid);
            // PASS THE OFFICIAL ACCOUNT.GAMENAME AND TAGLINE!
            return await upsertPlayer(account.gameName, account.tagLine, account.puuid, summoner.profileIconId);
        }
    } catch (e) {
        console.error(`Failed to fetch/upsert player from Riot API: ${gameName}#${tagLine}`, e);
    }
    
    // Fallback: If not found on Riot, find locally (already cased)
    return await getPlayerByRiotId(gameName, tagLine);
}

export type PlayerProfile = 
  | { state: "awaiting"; player: null; job: null; }
  | {
      state: "ready";
      player: {
        id: string;
        puuid: string | null;
        riotIdName: string;
        riotIdTag: string;
        profileIconId: number | null;
        rawMmr: number;
        currentLp: number;
        isPlaced: boolean;
        promoFromTier: string | null;
        promoToTier: string | null;
        promoWins: number;
        promoLosses: number;
        mayhemGames: number;
        aramGames: number;
        cacheUpdatedAt: Date | null;
      };
      mmr: {
        rawMmr: number;
        displayedMmr: number;
        currentLp: number;
        decayAmount: number;
        mayhemGames: number;
        aramGames: number;
      };
      tier: { label: string; tier: string; };
      matches: Array<{
        id: string;
        win: boolean;
        kills: number;
        deaths: number;
        assists: number;
        lpDelta: number;
        isPlacement: boolean;
        championId: number;
        championName: string;
        championImage: string | null;
        damageToChampions: number;
        healingDone: number;
        match: {
          gameDate: Date;
          durationSeconds: number;
        participants: Array<{
            id: string;
            championId: number;
            championName: string | null;
            championImage: string | null;
            kills: number;
            deaths: number;
            assists: number;
            damageToChampions: number;
            healingDone: number;
            win: boolean;
            team: number;
            player: { riotIdName: string; riotIdTag: string; } | null;
            playerRiotIdName: string | null;
            playerRiotIdTag: string | null;
            rankSignalMmr: number | null;
            rankLabelAtMatch: string;
          }>
        };
      }>;
      champions: Array<{
        championId: number;
        championName: string;
        championImage: string | null;
        games: number;
        wins: number;
        kills: number;
        deaths: number;
        assists: number;
        damage: number;
        healing: number;
      }>;
    };

export async function getPlayerProfile(gameName: string, tagLine: string): Promise<PlayerProfile> {
  const player = await ensurePlayerExists(gameName, tagLine);

  if (!player) {
    return { state: "awaiting", player: null, job: null };
  }

  const participants = await prisma.matchParticipant.findMany({
    where: { playerId: player.id, match: { gameMode: "MAYHEM" } },
    include: { match: { include: { participants: { include: { player: true } } } } },
    orderBy: { match: { gameDate: "desc" } },
    take: 100
  });

  const lastMayhemGame = participants
    .filter((p) => p.match.gameMode === "MAYHEM")
    .sort((a, b) => b.match.gameDate.getTime() - a.match.gameDate.getTime())[0];
  
  const now = new Date();
  const daysInactive = lastMayhemGame ? Math.max(0, (now.getTime() - lastMayhemGame.match.gameDate.getTime()) / 86_400_000) : 0;
  const decayAmount = player.isPlaced ? player.rawMmr * (0.005 * daysInactive) : 0;
  
  const displayedMmr = Math.round(Math.max(0, player.rawMmr - decayAmount));
  const tier = getTierLabel(displayedMmr);
  const championAssets = await getChampionAssetMap();

  return {
    state: "ready",
    player: {
      ...player,
      isPlaced: player.isPlaced,
      promoFromTier: player.promoFromTier,
      promoToTier: player.promoToTier,
      promoWins: player.promoWins,
      promoLosses: player.promoLosses
    },
    mmr: {
        rawMmr: Math.round(player.rawMmr),
        displayedMmr,
        currentLp: player.currentLp,
        decayAmount: Math.round(decayAmount),
        mayhemGames: player.mayhemGames,
        aramGames: player.aramGames
    },
    tier,
    matches: participants.map(p => ({
        id: p.id,
        win: p.win,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        lpDelta: p.lpDelta,
        isPlacement: p.isPlacement,
        championId: p.championId,
        championName: p.championName ?? "Unknown",
        championImage: championAssets[p.championId]?.imageUrl ?? null,
        damageToChampions: p.damageToChampions,
        healingDone: p.healingDone,
        match: {
            gameDate: p.match.gameDate,
            durationSeconds: p.match.durationSeconds,
            participants: p.match.participants.map(part => ({
                id: part.id,
                championId: part.championId,
                championName: part.championName,
                championImage: championAssets[part.championId]?.imageUrl ?? null,
                kills: part.kills,
                deaths: part.deaths,
                assists: part.assists,
                damageToChampions: part.damageToChampions,
                healingDone: part.healingDone,
                win: part.win,
                team: part.team,
                player: part.player ? {
                    riotIdName: part.player.riotIdName,
                    riotIdTag: part.player.riotIdTag
                } : null,
                playerRiotIdName: part.playerRiotIdName ?? part.player?.riotIdName ?? null,
                playerRiotIdTag: part.playerRiotIdTag ?? part.player?.riotIdTag ?? null,
                rankSignalMmr: part.rankSignalMmr ?? null,
                rankLabelAtMatch: part.rankSignalMmr !== null
                  ? getTierLabel(part.rankSignalMmr).label
                  : (part.playerId ? "Unranked" : "Unknown rank")
            }))
        }
    })),
    champions: await buildChampionStats(participants)
  };
}

export async function readPlayerProfileStatus(gameName: string, tagLine: string) {
  return getPlayerProfile(gameName, tagLine);
}

async function buildChampionStats(
  participants: Array<{
    championId: number; win: boolean; kills: number; deaths: number; assists: number;
    damageToChampions: number; healingDone: number;
  }>
) {
  const CHAMPION_MAP = await getChampionMap();
  const byChampion = new Map<
    number,
    {
      championId: number; championName: string; championImage: string | null; games: number; wins: number;
      kills: number; deaths: number; assists: number; damage: number; healing: number;
    }
  >();
  const championAssets = await getChampionAssetMap();

  for (const participant of participants) {
    const current = byChampion.get(participant.championId) ?? {
        championId: participant.championId,
        championName: CHAMPION_MAP[participant.championId] ?? `Champion ${participant.championId}`,
        championImage: championAssets[participant.championId]?.imageUrl ?? null,
        games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, damage: 0, healing: 0
      };

    current.games += 1;
    current.wins += participant.win ? 1 : 0;
    current.kills += participant.kills;
    current.deaths += participant.deaths;
    current.assists += participant.assists;
    current.damage += participant.damageToChampions;
    current.healing += participant.healingDone;
    byChampion.set(participant.championId, current);
  }

  return [...byChampion.values()].sort((a, b) => b.games - a.games);
}
