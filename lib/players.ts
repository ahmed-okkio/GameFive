import { prisma } from "@/lib/prisma";
import { DEFAULT_MEDIAN_MMR } from "@/lib/mmr/ranked";
import { getTierLabel } from "@/lib/mmr/tier";
import { enqueueProfileCalculation } from "@/lib/jobs/enqueue";
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

export async function getPlayerProfile(gameName: string, tagLine: string) {
  const player = await getPlayerByRiotId(gameName, tagLine);

  if (!player) {
    const job = await enqueueProfileCalculation(gameName, tagLine);
    return {
      state: "awaiting" as const,
      player: null,
      job: await withProfileQueuePosition(job)
    };
  }

  const cacheAge = player.cacheUpdatedAt ? Date.now() - player.cacheUpdatedAt.getTime() : Number.POSITIVE_INFINITY;
  const activeJob = await prisma.profileJob.findFirst({
    where: {
      OR: [
        {
          playerId: player.id
        },
        {
          riotIdName: player.riotIdName,
          riotIdTag: player.riotIdTag
        }
      ],
      status: {
        in: ["queued", "processing"]
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
  const latestProfileJob = await prisma.profileJob.findFirst({
    where: {
      OR: [
        {
          playerId: player.id
        },
        {
          riotIdName: player.riotIdName,
          riotIdTag: player.riotIdTag
        }
      ]
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (cacheAge > CACHE_MS && !activeJob) {
    await enqueueProfileCalculation(player.riotIdName, player.riotIdTag);
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

  // Calculate Inactivity Decay on demand
  const lastMayhemGame = participants
    .filter((p) => p.match.gameMode === "MAYHEM")
    .sort((a, b) => b.match.gameDate.getTime() - a.match.gameDate.getTime())[0];
  
  const now = new Date();
  const daysInactive = lastMayhemGame ? Math.max(0, (now.getTime() - lastMayhemGame.match.gameDate.getTime()) / 86_400_000) : 0;
  const decayAmount = player.isPlaced ? player.rawMmr * (0.005 * daysInactive) : 0;
  
  // Note: Decay is purely for display as per spec 3.10
  const displayedMmr = Math.round(Math.max(0, player.rawMmr - decayAmount));
  const tier = getTierLabel(displayedMmr);

  return {
    state: "ready" as const,
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
    activeJob: activeJob ? await withProfileQueuePosition(activeJob) : null,
    latestProfileJob,
    recentGames: participants.slice(0, 5),
    matches: participants,
    champions: buildChampionStats(participants)
  };
}

export async function readPlayerProfileStatus(gameName: string, tagLine: string) {
  const player = await getPlayerByRiotId(gameName, tagLine);

  if (!player) {
    const job = await prisma.profileJob.findFirst({
      where: {
        riotIdName: gameName,
        riotIdTag: tagLine,
        status: {
          in: ["queued", "processing", "failed"]
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (job) {
      return {
        state: "awaiting" as const,
        player: null,
        job: await withProfileQueuePosition(job)
      };
    }

    return getPlayerProfile(gameName, tagLine);
  }

  return getPlayerProfile(gameName, tagLine);
}

async function withProfileQueuePosition<T extends { id: string; status: string }>(job: T) {
  if (job.status !== "queued") {
    return {
      ...job,
      queuePosition: null,
      queueLength: null
    };
  }

  const queuedJobs = await prisma.profileJob.findMany({
    where: {
      status: "queued"
    },
    select: {
      id: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });
  const index = queuedJobs.findIndex((queuedJob) => queuedJob.id === job.id);

  return {
    ...job,
    queuePosition: index >= 0 ? index + 1 : null,
    queueLength: queuedJobs.length
  };
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
