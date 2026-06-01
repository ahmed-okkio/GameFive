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

  if (profile.state === "awaiting") {
      return <div>Player not found or awaiting calculation...</div>;
  }

  const initialStatus = {
          state: profile.state,
          player: {
            riotIdName: profile.player.riotIdName,
            riotIdTag: profile.player.riotIdTag,
            isPlaced: profile.player.isPlaced,
            profileIconId: profile.player.profileIconId
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
              isPlacement: m.isPlacement,
              championId: m.championId,
              championName: m.championName ?? "Unknown",
              damageToChampions: m.damageToChampions,
              healingDone: m.healingDone,
              match: {
                  gameDate: m.match.gameDate.toISOString()
              }
          })),
          activeJob: null,
          latestProfileJob: null,
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
