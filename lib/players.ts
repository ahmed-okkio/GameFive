import { prisma } from "@/lib/prisma";
import { DEFAULT_MEDIAN_MMR } from "@/lib/mmr/ranked";
import { getTierLabel } from "@/lib/mmr/tier";
import { CHAMPION_MAP } from "@/lib/riot/champions";

const CACHE_MS = 60 * 60 * 1000;

export async function getGlobalMedianMmr() {
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

export async function getPlayerByRiotId(gameName: string, tagLine: string) {
  const candidates = await prisma.player.findMany({
    where: {
      riotIdTag: {
        equals: tagLine
      }
    }
  });

  return candidates.find((player) => player.riotIdName.toLowerCase() === gameName.toLowerCase()) ?? null;
}

export type PlayerProfile = 
  | {
      state: "awaiting";
      player: null;
      job: null;
    }
  | {
      state: "ready";
      player: {
        id: string;
        puuid: string;
        riotIdName: string;
        riotIdTag: string;
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
        decayAmount: number;
        mayhemGames: number;
        aramGames: number;
      };
      tier: {
        label: string;
        tier: string;
      };
      matches: Array<{
        id: string;
        win: boolean;
        kills: number;
        deaths: number;
        assists: number;
        lpDelta: number;
        championId: number;
        championName: string;
        damageToChampions: number;
        healingDone: number;
        match: {
          gameDate: Date;
        };
      }>;
      champions: Array<{
        championId: number;
        championName: string;
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
  const player = await getPlayerByRiotId(gameName, tagLine);

  if (!player) {
    return {
      state: "awaiting",
      player: null,
      job: null
    };
  }

  const participants = await prisma.matchParticipant.findMany({
    where: {
      playerId: player.id,
      match: {
          gameMode: "MAYHEM"
      }
    },
    include: {
      match: true
    },
    orderBy: {
      match: {
        gameDate: "desc"
      }
    },
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
        championId: p.championId,
        championName: p.championName ?? "Unknown",
        damageToChampions: p.damageToChampions,
        healingDone: p.healingDone,
        match: {
            gameDate: p.match.gameDate
        }
    })),
    champions: buildChampionStats(participants)
  };
}

export async function readPlayerProfileStatus(gameName: string, tagLine: string) {
  return getPlayerProfile(gameName, tagLine);
}

function buildChampionStats(
  participants: Array<{
    championId: number;
    win: boolean;
    kills: number;
    deaths: number;
    assists: number;
    damageToChampions: number;
    healingDone: number;
  }>
) {
  const byChampion = new Map<
    number,
    {
      championId: number;
      championName: string;
      games: number;
      wins: number;
      kills: number;
      deaths: number;
      assists: number;
      damage: number;
      healing: number;
    }
  >();

  for (const participant of participants) {
    const current =
      byChampion.get(participant.championId) ??
      {
        championId: participant.championId,
        championName: CHAMPION_MAP[participant.championId] ?? `Champion ${participant.championId}`,
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        healing: 0
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
