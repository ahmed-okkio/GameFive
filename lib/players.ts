import { prisma } from "@/lib/prisma";
import { DEFAULT_MEDIAN_MMR } from "@/lib/mmr/ranked";
import { getTierLabel } from "@/lib/mmr/tier";
import { getChampionAssetMap, getChampionMap } from "@/lib/riot/champions";


export async function getGlobalMedianMmr() {
  const players = await prisma.player.findMany({
    where: { rawMmr: { gt: 0 } },
    select: { rawMmr: true },
    orderBy: { rawMmr: "asc" }
  });
  return players.length < 10 ? DEFAULT_MEDIAN_MMR : players[Math.floor(players.length / 2)].rawMmr;
}

// Display lookup for the old profile page only (deleted in M5); never used for identity and never creates a player.
export async function getPlayerByRiotId(gameName: string, tagLine: string) {
  return await prisma.player.findFirst({
    where: {
      riotIdName: { equals: gameName, mode: 'insensitive' },
      riotIdTag: { equals: tagLine, mode: 'insensitive' },
    },
  });
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
        mayhemGames: number;
        aramGames: number;
        cacheUpdatedAt: Date | null;
      };
      mmr: {
        rawMmr: number;
        displayedMmr: number;
        currentLp: number;
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
          team100AvgMmr: number | null;
          team200AvgMmr: number | null;
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
            rankTier: string | null;
            leaguePoints: number | null;
            spell1Id: number | null;
            spell2Id: number | null;
            itemsJson: unknown;
            augmentsJson: unknown;
            consecutiveStreak: number;
            performanceScore: number;
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

export function formatRankLabel(rankTier: string | null, leaguePoints: number | null, rankSignalMmr: number | null, playerRawMmr: number | null | undefined, isPlayer: boolean): string {
    // 1. If player (registered in DB), prioritize rawMmr (most accurate)
    if (isPlayer && playerRawMmr && playerRawMmr > 0) {
        return getTierLabel(playerRawMmr).label;
    }
    
    // 2. Not a player (unregistered), use rankTier for Master+
    if (rankTier && ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(rankTier.toUpperCase())) {
        return `${rankTier.charAt(0).toUpperCase() + rankTier.slice(1).toLowerCase()} ${leaguePoints ?? 0} LP`;
    }
    
    // 3. Fallback for others
    if (rankSignalMmr !== null && rankSignalMmr > 0) {
        return getTierLabel(rankSignalMmr).label;
    }
    
    return "Unranked";
}

export async function getPlayerProfile(gameName: string, tagLine: string): Promise<PlayerProfile> {
  const player = await getPlayerByRiotId(gameName, tagLine);

  if (!player) {
    return { state: "awaiting", player: null, job: null };
  }

  const participants = await prisma.matchParticipant.findMany({
    where: { playerId: player.id, match: { gameMode: "MAYHEM" } },
    include: { match: { include: { participants: { include: { player: true } } } } },
    orderBy: { match: { gameDate: "desc" } },
    take: 500
  });

  const displayedMmr = Math.round(player.rawMmr);
  const tier = getTierLabel(displayedMmr);
  const championAssets = await getChampionAssetMap();

  const streakMap = new Map<string, number>();
  const pReversed = [...participants].reverse(); 
  let runningStreak = 0;
  for (const p of pReversed) {
      if (p.win) {
          if (runningStreak >= 0) runningStreak++;
          else runningStreak = 1;
      } else {
          if (runningStreak <= 0) runningStreak--;
          else runningStreak = -1;
      }
      streakMap.set(p.id, runningStreak);
  }

  return {
    state: "ready",
    player: {
      ...player,
      isPlaced: player.isPlaced
    },
    mmr: {
        rawMmr: Math.round(player.rawMmr),
        displayedMmr,
        currentLp: player.currentLp,
        mayhemGames: player.mayhemGames,
        aramGames: player.aramGames
    },
    tier,
    matches: participants.map(p => ({
        id: p.matchId,
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
            team100AvgMmr: p.match.team100AvgMmr,
            team200AvgMmr: p.match.team200AvgMmr,
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
                rankTier: part.rankTier,
                leaguePoints: part.leaguePoints,
                performanceScore: part.performanceScore,
                rankLabelAtMatch: formatRankLabel(part.rankTier, part.leaguePoints, part.rankSignalMmr, part.player?.rawMmr, !!part.player),
                spell1Id: part.spell1Id,
                spell2Id: part.spell2Id,
                itemsJson: part.itemsJson,
                augmentsJson: part.augmentsJson,
                consecutiveStreak: part.playerId === player.id ? (streakMap.get(p.id) ?? 0) : 0
            }))
        }
    })),
    champions: await buildChampionStats(participants)
  };
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
