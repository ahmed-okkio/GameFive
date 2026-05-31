import { ProfileClient } from "@/components/ProfileClient";
import { getPlayerProfile } from "@/lib/players";
import type { Metadata } from "next";

type PageProps = {
  params: Promise<{
    gameName: string;
    tagLine: string;
  }>;
};

export const revalidate = 0;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameName, tagLine } = await params;
  const riotId = `${decodeURIComponent(gameName)}#${decodeURIComponent(tagLine)}`;

  return {
    title: `${riotId} | GameFive`
  };
}

export default async function PlayerPage({ params }: PageProps) {
  const { gameName, tagLine } = await params;
  const decodedGameName = decodeURIComponent(gameName);
  const decodedTagLine = decodeURIComponent(tagLine);
  const profile = await getPlayerProfile(decodedGameName, decodedTagLine);
  const initialStatus =
    profile.state === "awaiting"
      ? {
          state: profile.state,
          job: serializeProfileJob(profile.job)
        }
      : {
          state: profile.state,
          player: {
            riotIdName: profile.player.riotIdName,
            riotIdTag: profile.player.riotIdTag,
            rawMmr: profile.player.rawMmr,
            isPlaced: profile.player.isPlaced,
            mayhemGames: profile.player.mayhemGames,
            aramGames: profile.player.aramGames,
            cacheUpdatedAt: profile.player.cacheUpdatedAt?.toISOString() ?? null
          },
          mmr: {
            rawMmr: Math.round(profile.mmr.rawMmr),
            displayedMmr: profile.mmr.displayedMmr,
            currentLp: profile.player.currentLp,
            mayhemGames: profile.mmr.mayhemGames,
            aramGames: profile.mmr.aramGames
          },
          tier: profile.tier,
          matches: profile.matches.map(m => ({
              id: m.id,
              win: m.win,
              kills: m.kills,
              deaths: m.deaths,
              assists: m.assists,
              lpDelta: m.lpDelta,
              championId: m.championId,
              championName: m.championName ?? "Unknown",
              damageToChampions: m.damageToChampions,
              healingDone: m.healingDone,
              match: {
                  gameDate: m.match.gameDate.toISOString()
              }
          })),
          activeJob: profile.activeJob
            ? {
                status: profile.activeJob.status,
                completedSteps: profile.activeJob.completedSteps,
                totalSteps: profile.activeJob.totalSteps,
                message: profile.activeJob.message,
                queuePosition: profile.activeJob.queuePosition,
                queueLength: profile.activeJob.queueLength
              }
            : null,
          latestProfileJob: profile.latestProfileJob ? serializeProfileJob(profile.latestProfileJob) : null,
          latestEnrichment: null,
          champions: profile.champions.map(c => ({
              championId: c.championId,
              championName: c.championName,
              games: c.games,
              wins: c.wins,
              kills: c.kills,
              deaths: c.deaths,
              assists: c.assists,
              damage: c.damage,
              healing: c.healing
          }))
        };

  return <ProfileClient gameName={decodedGameName} tagLine={decodedTagLine} initialStatus={initialStatus} />;
}

function serializeProfileJob(job: {
  status: string;
  completedSteps: number;
  totalSteps: number;
  message: string;
  queuePosition?: number | null;
  queueLength?: number | null;
  error?: string | null;
  completedAt?: Date | null;
  updatedAt: Date;
}) {
  return {
    status: job.status,
    completedSteps: job.completedSteps,
    totalSteps: job.totalSteps,
    message: job.message,
    queuePosition: job.queuePosition ?? null,
    queueLength: job.queueLength ?? null,
    error: job.error ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    updatedAt: job.updatedAt.toISOString()
  };
}
