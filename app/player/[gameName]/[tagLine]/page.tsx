import { ProfileClient, StatusResponse } from "@/components/ProfileClient";
import { getPlayerProfile } from "@/lib/players";
import { appConfig } from "@/lib/config";
import { getLatestDDragonVersion } from "@/lib/riot/ddragon";
import { PageLoader } from "@/components/Loading";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{
    gameName: string;
    tagLine: string;
  }>;
};

export const revalidate = 0;

// The data-fetching component
async function PlayerProfileLoader({ gameName, tagLine }: { gameName: string, tagLine: string }) {
  const decodedGameName = decodeURIComponent(gameName);
  const decodedTagLine = decodeURIComponent(tagLine);
  
  const [profile, ddragonVersion] = await Promise.all([
    getPlayerProfile(decodedGameName, decodedTagLine),
    getLatestDDragonVersion()
  ]);

  if (profile.state === "awaiting") {
      return <div>Player not found or awaiting calculation...</div>;
  }

  const initialStatus = {
          state: profile.state,
          player: {
            riotIdName: profile.player.riotIdName,
            riotIdTag: profile.player.riotIdTag,
            isPlaced: profile.player.isPlaced,
            profileIconId: profile.player.profileIconId,
            promoFromTier: profile.player.promoFromTier,
            promoToTier: profile.player.promoToTier,
            promoWins: profile.player.promoWins,
            promoLosses: profile.player.promoLosses
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
              championImage: m.championImage,
              damageToChampions: m.damageToChampions,
              healingDone: m.healingDone,
              match: {
                  gameDate: m.match.gameDate.toISOString(),
                  durationSeconds: m.match.durationSeconds,
              participants: m.match.participants.map(part => ({
                      id: part.id,
                      championId: part.championId,
                      championName: part.championName,
                      championImage: part.championImage,
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
                      playerRiotIdName: part.playerRiotIdName,
                      playerRiotIdTag: part.playerRiotIdTag,
                      rankSignalMmr: part.rankSignalMmr,
                      rankLabelAtMatch: part.rankLabelAtMatch,
                      spell1Id: part.spell1Id,
                      spell2Id: part.spell2Id,
                      itemsJson: part.itemsJson,
                      augmentsJson: part.augmentsJson
                  }))
              }
          })),
          activeJob: null,
          latestProfileJob: null,
          latestEnrichment: null,
          champions: profile.champions.map(c => ({
              championId: c.championId,
              championName: c.championName,
              championImage: c.championImage,
              games: c.games,
              wins: c.wins,
              kills: c.kills,
              deaths: c.deaths,
              assists: c.assists,
              damage: c.damage,
              healing: c.healing
          }))
        };

  return <ProfileClient 
            gameName={decodedGameName} 
            tagLine={decodedTagLine} 
            initialStatus={initialStatus as StatusResponse} 
            maintenanceMode={appConfig.maintenanceMode} 
            initialVersion={ddragonVersion}
         />;
}

export default async function PlayerPage({ params }: PageProps) {
  const { gameName, tagLine } = await params;
  
  return (
    <Suspense fallback={<PageLoader text="Loading profile..." />}>
      <PlayerProfileLoader gameName={gameName} tagLine={tagLine} />
    </Suspense>
  );
}
