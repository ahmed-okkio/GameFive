import { prisma } from "@/lib/prisma";
import type { Player } from "@prisma/client";
import { calculatePlacementMmr } from "@/lib/mmr/calculate";
import { bestRankedMmr, DEFAULT_MEDIAN_MMR } from "@/lib/mmr/ranked";
import { getTierLabel } from "@/lib/mmr/tier";
import { riotClient } from "@/lib/riot/client";
import { extractRankedSnapshot } from "@/lib/riot/ranked";
import type { ProfileJobData } from "@/lib/jobs/queue";

async function updateProgress(profileJobId: string, completedSteps: number, message: string) {
  await prisma.profileJob.update({
    where: {
      id: profileJobId
    },
    data: {
      completedSteps,
      message
    }
  });
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

async function fetchMayhemOpponentRanksFromDb(playerId: string, profileJobId: string, currentStep: number) {
  // Find all Mayhem matches for this player that haven't been "finalized" with a lobbyAvgMmr yet.
  const unfinalizedMatches = await prisma.match.findMany({
    where: {
      participants: {
        some: {
          playerId
        }
      },
      gameMode: "MAYHEM",
      lobbyAvgMmr: null
    },
    include: {
      participants: {
        include: {
          player: true
        }
      }
    }
  });

  if (unfinalizedMatches.length === 0) {
    return currentStep;
  }

  const opponents = new Map<string, Player>();
  for (const match of unfinalizedMatches) {
    for (const participant of match.participants) {
      if (participant.playerId !== playerId && !opponents.has(participant.player.puuid)) {
        if (!participant.player.soloDuoTier && !participant.player.flexTier) {
          opponents.set(participant.player.puuid, participant.player);
        }
      }
    }
  }

  let completedSteps = currentStep;

  await prisma.profileJob.update({
    where: {
      id: profileJobId
    },
    data: {
      totalSteps: currentStep + opponents.size + 1
    }
  });

  const globalMedianMmr = await getGlobalMedianMmr();

  for (const opponent of opponents.values()) {
    try {
      let puuid = opponent.puuid;
      
      if (puuid.length < 50 && opponent.riotIdName !== "Unknown") {
        try {
          const account = await riotClient.getAccountByRiotId(opponent.riotIdName, opponent.riotIdTag);
          puuid = account.puuid;
          await prisma.player.update({
            where: { id: opponent.id },
            data: { puuid }
          });
        } catch {}
      }

      const ranked = extractRankedSnapshot(await riotClient.getLeagueEntriesByPuuid(puuid));
      await prisma.player.update({
        where: { id: opponent.id },
        data: ranked
      });
    } catch {
    } finally {
      completedSteps += 1;
      await updateProgress(profileJobId, completedSteps, "Estimating new Mayhem lobby strength");
    }
  }

  for (const match of unfinalizedMatches) {
    const finalizedParticipants = await prisma.matchParticipant.findMany({
      where: { matchId: match.id },
      include: { player: true }
    });

    const lobbyAvgMmr = finalizedParticipants.reduce((sum, p) => {
      const pMmr = p.player.isPlaced ? p.player.rawMmr : bestRankedMmr(p.player.soloDuoTier, p.player.soloDuoDivision, p.player.flexTier, p.player.flexDivision, globalMedianMmr);
      return sum + (pMmr ?? globalMedianMmr);
    }, 0) / Math.max(finalizedParticipants.length, 1);

    await prisma.match.update({
      where: { id: match.id },
      data: { lobbyAvgMmr }
    });
  }

  return completedSteps;
}

export async function processProfileCalculation(data: ProfileJobData) {
  const { profileJobId, gameName, tagLine } = data;
  let completedSteps = 0;

  await prisma.profileJob.update({
    where: {
      id: profileJobId
    },
    data: {
      status: "processing",
      startedAt: new Date(),
      message: "Resolving Riot ID",
      totalSteps: 5 // Default steps for basic info
    }
  });

  try {
    const account = await riotClient.getAccountByRiotId(gameName, tagLine);
    completedSteps += 1;
    await updateProgress(profileJobId, completedSteps, "Fetching summoner profile");

    const summoner = await riotClient.getSummonerByPuuid(account.puuid);
    completedSteps += 1;
    await updateProgress(profileJobId, completedSteps, "Fetching ranked data");

    let ranked = extractRankedSnapshot(await riotClient.getLeagueEntriesByPuuid(account.puuid));

    if (!ranked.soloDuoTier && !ranked.flexTier && summoner.id) {
      ranked = extractRankedSnapshot(await riotClient.getLeagueEntries(summoner.id));
    }
    completedSteps += 1;

    const player = await prisma.player.upsert({
      where: {
        puuid: account.puuid
      },
      create: {
        puuid: account.puuid,
        riotIdName: account.gameName,
        riotIdTag: account.tagLine,
        summonerId: summoner.id,
        profileIconId: summoner.profileIconId,
        summonerLevel: summoner.summonerLevel,
        ...ranked
      },
      update: {
        riotIdName: account.gameName,
        riotIdTag: account.tagLine,
        summonerId: summoner.id,
        profileIconId: summoner.profileIconId,
        summonerLevel: summoner.summonerLevel,
        ...ranked
      }
    });

    await prisma.profileJob.update({
      where: {
        id: profileJobId
      },
      data: {
        playerId: player.id
      }
    });

    await updateProgress(profileJobId, completedSteps, "Checking companion Mayhem data");
    const mayhemGamesCount = await prisma.matchParticipant.count({
        where: {
            playerId: player.id,
            match: { gameMode: "MAYHEM" }
        }
    });
    completedSteps += 1;

    // Check for unfinalized matches and resolve opponents
    completedSteps = await fetchMayhemOpponentRanksFromDb(player.id, profileJobId, completedSteps);

    const globalMedianMmr = await getGlobalMedianMmr();

    if (mayhemGamesCount >= 10 && !player.isPlaced) {
        // Run Placement Formula
        await updateProgress(profileJobId, completedSteps, "Calculating placement MMR");
        const wins = await prisma.matchParticipant.count({
            where: { playerId: player.id, win: true, match: { gameMode: "MAYHEM" } }
        });

        const startingMmr = calculatePlacementMmr({
            soloDuoTier: player.soloDuoTier,
            soloDuoDivision: player.soloDuoDivision,
            flexTier: player.flexTier,
            flexDivision: player.flexDivision,
            historicalTier: player.historicalTier,
            historicalDivision: player.historicalDivision,
            mayhemWins: wins,
            globalMedianMmr
        });

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

        // Automatically add to leaderboard if not already there
        await prisma.friendsLeaderboard.upsert({
          where: { playerId: player.id },
          update: {},
          create: {
            playerId: player.id,
            addedBy: "auto-placed"
          }
        });
    } else {
        // Just update cache timestamp and basic info
        await prisma.player.update({
            where: { id: player.id },
            data: {
                mayhemGames: mayhemGamesCount,
                cacheUpdatedAt: new Date()
            }
        });
    }

    await prisma.profileJob.update({
      where: {
        id: profileJobId
      },
      data: {
        status: "complete",
        completedSteps,
        message: "Profile updated",
        completedAt: new Date()
      }
    });
  } catch (error) {
    await prisma.profileJob.update({
      where: {
        id: profileJobId
      },
      data: {
        status: "failed",
        message: "Calculation failed",
        error: error instanceof Error ? error.message : "Unknown error"
      }
    });

    throw error;
  }
}
