import { prisma } from "@/lib/prisma";
import { appConfig } from "@/lib/config";
import { getEnrichmentQueue, getProfileQueue } from "@/lib/jobs/queue";

const ACTIVE_STATUSES = ["queued", "processing"];

export async function enqueueProfileCalculation(gameName: string, tagLine: string, manual = false) {
  const normalizedName = gameName.trim();
  const normalizedTag = tagLine.trim();

  const activeJobs = await prisma.profileJob.findMany({
    where: {
      riotIdTag: normalizedTag,
      status: {
        in: ACTIVE_STATUSES
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
  const existing = activeJobs.find((job) => job.riotIdName.toLowerCase() === normalizedName.toLowerCase());

  if (existing) {
    return existing;
  }

  const profileJob = await prisma.profileJob.create({
    data: {
      riotIdName: normalizedName,
      riotIdTag: normalizedTag,
      status: "queued",
      message: manual ? "Manual refresh queued" : "Queued"
    }
  });

  if (appConfig.queueDriver === "database") {
    return profileJob;
  }

  const queue = getProfileQueue();
  const bullJob = await queue.add(
    "depth-0",
    {
      profileJobId: profileJob.id,
      gameName: normalizedName,
      tagLine: normalizedTag
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000
      },
      removeOnComplete: 100,
      removeOnFail: 100
    }
  );

  return prisma.profileJob.update({
    where: {
      id: profileJob.id
    },
    data: {
      bullJobId: bullJob.id
    }
  });
}

export async function enqueueEnrichment(playerId: string) {
  const player = await prisma.player.findUnique({
    where: {
      id: playerId
    },
    select: {
      mayhemGames: true
    }
  });

  if (!player || player.mayhemGames >= 10) {
    return null;
  }

  const existing = await prisma.enrichmentQueue.findFirst({
    where: {
      playerId,
      status: {
        in: ["pending", "processing"]
      }
    }
  });

  if (existing) {
    return existing;
  }

  const aramParticipantMatches = await prisma.matchParticipant.findMany({
    where: {
      playerId,
      match: {
        gameMode: "ARAM"
      }
    },
    select: {
      matchId: true
    },
    take: 100
  });
  const aramMatchIds = [...new Set(aramParticipantMatches.map((participant) => participant.matchId))];

  if (!aramMatchIds.length) {
    return null;
  }

  const missingLobbyCount = await prisma.match.count({
    where: {
      id: {
        in: aramMatchIds
      },
      lobbyAvgMmr: null
    }
  });

  if (missingLobbyCount === 0) {
    return null;
  }

  const enrichmentJob = await prisma.enrichmentQueue.create({
    data: {
      playerId,
      status: "pending",
      totalCallsEstimate: 1000
    }
  });

  if (appConfig.queueDriver === "database") {
    return enrichmentJob;
  }

  const queue = getEnrichmentQueue();
  const bullJob = await queue.add(
    "enrich",
    {
      playerId,
      enrichmentQueueId: enrichmentJob.id
    },
    {
      attempts: 2,
      removeOnComplete: 100,
      removeOnFail: 100
    }
  );

  return prisma.enrichmentQueue.update({
    where: {
      id: enrichmentJob.id
    },
    data: {
      bullJobId: bullJob.id
    }
  });
}
