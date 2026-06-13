"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";
import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ProgressScreen } from "@/components/ProgressScreen";
import { getLatestDDragonVersion, getProfileIconUrl } from "@/lib/riot/ddragon";
import { StatBar } from "@/components/StatBar";
import { LoadoutRow } from "@/components/LoadoutRow";
import { ChampionAvatar } from "@/components/ChampionAvatar";
import { MatchRow } from "@/components/MatchRow";
import { PerformanceBadge } from "@/components/PerformanceBadge";
import { getTierLabel } from "@/lib/mmr/tier";

type ProfileJobSnapshot = {
  status: string;
  completedSteps: number;
  totalSteps: number;
  message: string;
  queuePosition?: number | null;
  queueLength?: number | null;
  error?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
};

export type StatusResponse =
  | { state: "awaiting"; job: ProfileJobSnapshot }
  | {
      state: "ready";
      player: {
        riotIdName: string;
        riotIdTag: string;
        isPlaced: boolean;
        profileIconId: number | null;
        promoFromTier: string | null;
        promoToTier: string | null;
        promoWins: number;
        promoLosses: number;
      };
      mmr: { currentLp: number; mayhemGames: number };
      tier: { label: string; tier: string };
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
          gameDate: string;
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
            player: { riotIdName: string; riotIdTag: string } | null;
            playerRiotIdName: string | null;
            playerRiotIdTag: string | null;
            rankSignalMmr: number | null;
            rankLabelAtMatch: string;
            rankTier: string | null;
            leaguePoints: number | null;
            performanceScore: number;
            spell1Id: number | null;
            spell2Id: number | null;
            itemsJson: unknown;
            augmentsJson: unknown;
            consecutiveStreak: number;
          }>;
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

type ProfileClientProps = {
  gameName: string;
  tagLine: string;
  initialStatus?: StatusResponse;
  maintenanceMode: boolean;
  initialVersion: string;
};

type ReadyStatus = Extract<StatusResponse, { state: "ready" }>;
type ProfileMatch = ReadyStatus["matches"][number];
type MatchParticipant = ProfileMatch["match"]["participants"][number];

function formatKda(kills: number, deaths: number, assists: number) {
  return ((kills + assists) / Math.max(deaths, 1)).toFixed(2);
}

function getTeamKills(participants: MatchParticipant[], team: number) {
  return participants
    .filter((participant) => participant.team === team)
    .reduce((sum, participant) => sum + participant.kills, 0);
}

function getKillParticipation(
  participant: Pick<MatchParticipant, "kills" | "assists" | "team">,
  participants: MatchParticipant[]
) {
  const teamKills = getTeamKills(participants, participant.team);
  return teamKills > 0
    ? Math.round(((participant.kills + participant.assists) / teamKills) * 100)
    : 0;
}

export function ProfileClient({
  gameName,
  tagLine,
  initialStatus,
  maintenanceMode,
  initialVersion
}: ProfileClientProps) {
  const [status] = useState<StatusResponse | null>(initialStatus ?? null);
  const [tab, setTab] = useState("matches");
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [matchesToDisplay, setMatchesToDisplay] = useState(20);
  const [championSort, setChampionSort] = useState<{
    key: "name" | "games" | "winrate" | "kda";
    direction: "asc" | "desc";
  }>({ key: "games", direction: "desc" });
  const [ddragonVersion, setDdragonVersion] = useState<string | null>(initialVersion);

  // Track if we have a pending scroll request from the URL
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);

  useEffect(() => {
      getLatestDDragonVersion().then(setDdragonVersion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!initialVersion) {
      getLatestDDragonVersion().then(setDdragonVersion);
    }
  }, [initialVersion]);

  // When deep-linked, set pending scroll
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("match")) {
          setPendingMatchId(params.get("match"));
      }
  }, []);

  // Execute scroll when tab becomes 'matches', or when document becomes visible
  useEffect(() => {
    const performScroll = () => {
      if (!status || status.state !== "ready" || tab !== "matches" || !pendingMatchId) return false;

      const matchIndex = status.matches.findIndex(m => m.id === pendingMatchId);
      if (matchIndex !== -1) {
          // Expand matches until the target is visible
          setMatchesToDisplay(Math.max(20, matchIndex + 1));
          setExpandedMatchId(pendingMatchId);
          
          // Robust scroll retry loop using requestAnimationFrame
          const startTime = Date.now();
          const scrollIfFound = () => {
            const el = document.getElementById(`match-${pendingMatchId}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              setPendingMatchId(null); // Clear pending scroll
            } else if (Date.now() - startTime < 3000) {
              requestAnimationFrame(scrollIfFound);
            }
          };
          
          requestAnimationFrame(scrollIfFound);
          return true;
      } else {
          setPendingMatchId(null); // Match not found
          return true;
      }
    };

    // Try immediately
    if (document.visibilityState === 'visible') {
        performScroll();
    }

    // Also try when tab gains visibility
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            if (performScroll()) {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status, tab, pendingMatchId]);
  
  const recentSummary = useMemo(() => {
    if (!status || status.state !== "ready") return null;

    const recentMatches = status.matches.slice(0, 20);
    const wins = recentMatches.filter((match) => match.win).length;

    // Overall Stats
    const totalMatches = status.matches.length;
    const totalWins = status.matches.filter((m) => m.win).length;
    const overallWinrate =
      totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

    const totals = recentMatches.reduce(
      (acc, match) => {
        const viewedParticipant = match.match.participants.find((participant) => {
          const participantName =
            participant.player?.riotIdName ?? participant.playerRiotIdName;
          const participantTag =
            participant.player?.riotIdTag ?? participant.playerRiotIdTag;
          return (
            participantName === status.player.riotIdName &&
            participantTag === status.player.riotIdTag
          );
        });
        acc.kills += match.kills;
        acc.deaths += match.deaths;
        acc.assists += match.assists;
        acc.kp += viewedParticipant
          ? getKillParticipation(viewedParticipant, match.match.participants)
          : 0;
        return acc;
      },
      { kills: 0, deaths: 0, assists: 0, kp: 0 }
    );

    const championMap = new Map<
      number,
      {
        championId: number;
        championName: string;
        championImage: string | null;
        games: number;
        wins: number;
        kills: number;
        deaths: number;
        assists: number;
      }
    >();

    for (const match of recentMatches) {
      const current = championMap.get(match.championId) ?? {
        championId: match.championId,
        championName: match.championName,
        championImage: match.championImage,
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0
      };
      current.games += 1;
      current.wins += match.win ? 1 : 0;
      current.kills += match.kills;
      current.deaths += match.deaths;
      current.assists += match.assists;
      championMap.set(match.championId, current);
    }

    const sortedChampions = [...championMap.values()].sort((a, b) => {
      let comparison = 0;
      switch (championSort.key) {
        case "name":
          comparison = a.championName.localeCompare(b.championName);
          break;
        case "games":
          comparison = a.games - b.games;
          break;
        case "winrate":
          comparison = a.wins / a.games - b.wins / b.games;
          break;
        case "kda":
          comparison =
            (a.kills + a.assists) / Math.max(a.deaths, 1) -
            (b.kills + b.assists) / Math.max(b.deaths, 1);
          break;
      }
      return championSort.direction === "asc" ? comparison : -comparison;
    });

    return {
      games: recentMatches.length,
      wins,
      losses: recentMatches.length - wins,
      winrate: recentMatches.length
        ? Math.round((wins / recentMatches.length) * 100)
        : 0,
      overallWinrate,
      avgKills: recentMatches.length ? totals.kills / recentMatches.length : 0,
      avgDeaths: recentMatches.length ? totals.deaths / recentMatches.length : 0,
      avgAssists: recentMatches.length ? totals.assists / recentMatches.length : 0,
      avgKp: recentMatches.length ? Math.round(totals.kp / recentMatches.length) : 0,
      champions: [...championMap.values()]
        .sort((a, b) => b.games - a.games)
        .slice(0, 3),
      allChampions: sortedChampions
    };
  }, [status, championSort]);

  const handleSort = (key: "name" | "games" | "winrate" | "kda") => {
    setChampionSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc"
    }));
  };

  if (!status || status.state === "awaiting") {
    return (
      <ProgressScreen
        gameName={gameName}
        tagLine={tagLine}
        status="loading"
        completedSteps={0}
        totalSteps={100}
      />
    );
  }

  const promoLabel =
    status.player.promoFromTier && status.player.promoToTier
      ? `${status.player.promoFromTier} I PROMO (${status.player.promoWins}W ${status.player.promoLosses}L)`
      : null;

  const rankLabel = maintenanceMode
    ? "Under Maintenance"
    : status.player.isPlaced
    ? (promoLabel ?? status.tier.label)
    : status.mmr.mayhemGames > 0
    ? "Placements"
    : "Unranked";

  const getTierIcon = (tierName: string) => {
    if (maintenanceMode) return null;
    const formattedTier = tierName.charAt(0).toUpperCase() + tierName.slice(1).toLowerCase();
    return `/tiers/Season_2023_-_${formattedTier}.png`;
  };

  return (
    <section className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-lg border border-line bg-panel/95 p-5 shadow-xl shadow-black/20">
          <div className="flex flex-col items-center text-center">
            <div className="h-24 w-24 rounded-full bg-black/30 flex items-center justify-center mb-4 overflow-hidden">
              {ddragonVersion && status.player.profileIconId ? (
                <Image
                  src={getProfileIconUrl(status.player.profileIconId, ddragonVersion)}
                  alt="Profile Icon"
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-4xl font-black text-stone-500">?</span>
              )}
            </div>
            <h1 className="text-2xl font-black text-white">{status.player.riotIdName}</h1>
            <p className="text-sm text-stone-500">#{status.player.riotIdTag}</p>
          </div>

          <div className="mt-6 border-t border-line pt-6">
            {status.player.isPlaced && !maintenanceMode ? (
              <div className="flex flex-col items-center gap-2">
                <Image
                  src={getTierIcon(status.tier.tier)!}
                  alt={status.tier.tier}
                  width={96}
                  height={96}
                  className="h-24 w-24 object-contain"
                />
                <span className="text-lg font-bold text-gold">{rankLabel}</span>
                <span className="text-sm text-stone-300">{status.mmr.currentLp} LP</span>
                <div className="grid w-full grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line">
                  <div className="flex flex-col items-center bg-panel p-2">
                    <span
                      className={`text-sm font-bold ${
                        recentSummary && recentSummary.overallWinrate > 60
                          ? "text-jade"
                          : recentSummary && recentSummary.overallWinrate < 40
                          ? "text-red-500"
                          : recentSummary && recentSummary.overallWinrate < 50
                          ? "text-yellow-500"
                          : "text-stone-300"
                      }`}
                    >
                      {recentSummary?.overallWinrate ?? 0}%
                    </span>
                    <span className="text-[10px] uppercase text-stone-500">Win Rate</span>
                  </div>
                  <div className="flex flex-col items-center bg-panel p-2">
                    <span className="text-sm font-bold text-stone-300">
                      {status.matches.filter((m) => m.win).length}W{" "}
                      {status.matches.filter((m) => !m.win).length}L
                    </span>
                    <span className="text-[10px] uppercase text-stone-500">Record</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="text-lg font-bold text-stone-300">{rankLabel}</span>
                {!maintenanceMode && !status.player.isPlaced ? (
                  <div className="w-full mt-2">
                    <div className="flex justify-between text-xs text-stone-400 mb-1">
                      <span>Placement Progress</span>
                      <span>{status.mmr.mayhemGames} / 10</span>
                    </div>
                    <div className="flex gap-1">
                      {[...Array(10)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 flex-1 rounded-sm ${
                            i < status.mmr.mayhemGames ? "bg-gold" : "bg-stone-700"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                {!maintenanceMode && (
                  <div className="mt-3 w-full rounded border border-gold/30 bg-gold/10 p-3 text-left">
                    <p className="text-sm font-semibold text-gold">Finish placements faster</p>
                    <p className="mt-1 text-xs leading-5 text-stone-300">
                      Download the Companion to upload games automatically while you play and get
                      placed sooner.
                    </p>
                    <Link
                      href="/companion"
                      className="mt-3 hidden items-center gap-2 text-xs font-bold text-gold hover:underline md:inline-flex"
                    >
                      Download the Companion
                      <ExternalLink size={13} />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 rounded-lg border border-line bg-panel/95 p-3 shadow-xl shadow-black/20 sm:p-5">
          {recentSummary && (
            <div className="mb-5 border-b border-line pb-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Recent Games</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-[180px_1fr_1.2fr]">
                <div className="flex items-center justify-center gap-4 sm:justify-start">
                  <div
                    className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
                    style={{
                      background: `conic-gradient(rgb(96 165 250) 0 ${recentSummary.winrate}%, rgb(248 113 113) ${recentSummary.winrate}% 100%)`
                    }}
                  >
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-panel text-lg font-black text-white">
                      {recentSummary.winrate}%
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold text-sky-300">
                      {recentSummary.wins}W {recentSummary.losses}L
                    </div>
                    <div className="mt-1 text-xs text-stone-500">Win rate</div>
                  </div>
                </div>
                <div className="flex items-center justify-center text-center">
                  <div>
                    <div className="text-sm text-stone-300">
                      <span>{recentSummary.avgKills.toFixed(1)}</span>
                      <span className="text-stone-500"> / </span>
                      <span className="text-red-300">{recentSummary.avgDeaths.toFixed(1)}</span>
                      <span className="text-stone-500"> / </span>
                      <span>{recentSummary.avgAssists.toFixed(1)}</span>
                    </div>
                    <div className="text-2xl font-black text-white sm:text-3xl">
                      {formatKda(
                        recentSummary.avgKills,
                        recentSummary.avgDeaths,
                        recentSummary.avgAssists
                      )}
                      :1
                    </div>
                    <div className="text-xs font-bold text-red-300">
                      P/Kill {recentSummary.avgKp}%
                    </div>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs text-stone-500">Recent played champions</div>
                  <div className="space-y-2">
                    {recentSummary.champions.map((champion) => (
                      <div key={champion.championId} className="flex items-center gap-3 text-xs">
                        <ChampionAvatar
                          image={champion.championImage}
                          name={champion.championName}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-stone-200">
                            {champion.championName}
                          </div>
                          <div className="text-stone-500">
                            {Math.round((champion.wins / champion.games) * 100)}% ({champion.wins}W /{" "}
                            {champion.games - champion.wins}L)
                          </div>
                        </div>
                        <div className="font-mono font-bold text-sky-300">
                          {formatKda(champion.kills, champion.deaths, champion.assists)}:1
                        </div>
                      </div>
                      ))}
                      </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 flex gap-6 overflow-x-auto border-b border-line">
            {["matches", "champions"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`pb-2 text-sm font-bold uppercase tracking-widest ${
                  tab === item
                    ? "border-b-2 border-gold text-white"
                    : "text-stone-500 hover:text-stone-300"
                }`}
              >
                {item === "matches" ? "Match History" : "Champions"}
              </button>
            ))}
          </div>

          {tab === "matches" ? (
            <div className="space-y-2">
              {status.matches.slice(0, matchesToDisplay).map((match) => {
                const viewedParticipant = match.match.participants.find((p) => {
                  const pName = p.player?.riotIdName ?? p.playerRiotIdName;
                  const pTag = p.player?.riotIdTag ?? p.playerRiotIdTag;
                  return (
                    pName === status.player.riotIdName && pTag === status.player.riotIdTag
                  );
                });
                const kp = viewedParticipant
                  ? getKillParticipation(viewedParticipant, match.match.participants)
                  : 0;
                const maxDamage = Math.max(
                  ...match.match.participants.map((p) => p.damageToChampions),
                  1
                );
                const maxHealing = Math.max(
                  ...match.match.participants.map((p) => p.healingDone),
                  1
                );

                const matchParticipants = match.match.participants;
                const sortedParticipants = [...matchParticipants].sort((a, b) => b.performanceScore - a.performanceScore);
                const performanceRank = sortedParticipants.findIndex(p => p.id === viewedParticipant?.id) + 1;

                const matchData = {
                  id: match.id,
                  win: match.win,
                  kills: match.kills,
                  deaths: match.deaths,
                  assists: match.assists,
                  lpDelta: match.lpDelta,
                  isPlacement: match.isPlacement,
                  championName: match.championName,
                  championImage: match.championImage,
                  match: {
                    gameDate: match.match.gameDate,
                    durationSeconds: match.match.durationSeconds,
                    team100AvgMmr: match.match.team100AvgMmr,
                    team200AvgMmr: match.match.team200AvgMmr
                  },
                  individualPlayerMmr: viewedParticipant?.rankSignalMmr ?? 1500,
                  myTeamAvgMmr: viewedParticipant?.team === 100 ? match.match.team100AvgMmr : match.match.team200AvgMmr,
                  opposingTeamAvgMmr: viewedParticipant?.team === 100 ? match.match.team200AvgMmr : match.match.team100AvgMmr,
                  kp,
                  viewedParticipant: viewedParticipant
                    ? {
                        itemsJson: viewedParticipant.itemsJson,
                        spell1Id: viewedParticipant.spell1Id,
                        spell2Id: viewedParticipant.spell2Id,
                        augmentsJson: viewedParticipant.augmentsJson,
                        consecutiveStreak: viewedParticipant.consecutiveStreak // Add this field
                      }
                    : undefined,
                  ddragonVersion: ddragonVersion,
                  performanceRank: performanceRank > 0 ? performanceRank : undefined
                };

                const matchKey = match.id;
                const isExpanded = expandedMatchId === matchKey;
                
                // Identify the losing team ID based on the team that has participants with win: false.
                const losingTeamId = matchParticipants.find(p => !p.win)?.team ?? 0;
                const losingTeamParticipants = matchParticipants.filter(p => p.team === losingTeamId && p.team !== 0);
                const maxScoreLosingTeam = losingTeamParticipants.length > 0 ? Math.max(...losingTeamParticipants.map(p => p.performanceScore)) : -1;
                
                // Debug log
                // console.log("Match:", match.id, "Losing Team:", losingTeamId, "Max Score:", maxScoreLosingTeam, "Participants:", matchParticipants.map(p => ({id: p.id, win: p.win, score: p.performanceScore, team: p.team})));

                return (
                  // id added here so the ?match= scroll target works
                  <div key={match.id} id={`match-${matchKey}`}>
                      <div onClick={() => setExpandedMatchId(isExpanded ? null : matchKey)}>
                        <MatchRow match={matchData} initiallyExpanded={isExpanded} />
                      </div>

                    {isExpanded && (
                      <div className="overflow-x-auto border-t border-line/70 bg-black/10 rounded-b-lg">
                        {[100, 200].map((teamId) => {
                          const avgMmr = teamId === 100 ? match.match.team100AvgMmr : match.match.team200AvgMmr;
                          return (
                          <div
                            key={teamId}
                            className={`min-w-[720px] p-3 ${teamId === 100 ? 'bg-blue-950/20' : 'bg-red-950/20'}`}
                          >
                            <div className={`flex justify-center items-center gap-2 px-4 py-2 border-b border-line/50 text-[11px] font-normal text-stone-400 mb-2`}>
                              <span className="uppercase tracking-widest">{teamId === 100 ? "Blue" : "Red"} Team Average Rank</span>
                              <span className="font-bold text-stone-200 uppercase tracking-widest">{avgMmr ? getTierLabel(avgMmr).label.toUpperCase() : "Unranked"}</span>
                            </div>
                            <div className="grid grid-cols-[160px_70px_60px_1fr_80px] items-center gap-2 px-3 pb-1 text-[10px] uppercase tracking-widest text-stone-500">
                              <span>Player</span>
                              <span className="text-center">KDA</span>
                              <span className="text-center">KP %</span>
                              <span className="text-left">Loadout</span>
                              <span className="text-right">Stats</span>
                            </div>
                            {matchParticipants
                              .filter((p) => p.team === teamId)
                              .map((p) => {
                                console.log("Participant:", p.id, "Score:", p.performanceScore, "Win:", p.win, "Team:", p.team);
                                const rank = sortedParticipants.findIndex(sp => sp.id === p.id) + 1;
                                const isAce = !p.win && p.performanceScore === maxScoreLosingTeam;
                                return (
                                <div
                                  key={p.id}
                                  className="grid grid-cols-[160px_70px_60px_1fr_80px] items-center gap-2 rounded px-3 py-1.5 text-xs bg-black/20"
                                >
                                  <div className="font-bold text-white truncate text-[11px] flex items-center gap-2 min-w-0">
                                    {(() => {
                                      const playerName =
                                        p.player?.riotIdName ?? p.playerRiotIdName;
                                      const playerTag =
                                        p.player?.riotIdTag ?? p.playerRiotIdTag;
                                      const displayName = playerName
                                        ? `${playerName}${playerTag ? `#${playerTag}` : ""}`
                                        : "Unknown name";
                                      const rankAtMatch = maintenanceMode
                                        ? "Under Maintenance"
                                        : (p.rankLabelAtMatch ?? "Unknown rank");
                                      const isLinked = Boolean(
                                        p.player && playerName && playerTag
                                      );

                                      return isLinked ? (
                                        <Link
                                          href={`/player/${encodeURIComponent(playerName!)}/${encodeURIComponent(playerTag!)}?match=${matchKey}`}
                                          className="flex min-w-0 items-center gap-2 font-semibold text-white hover:text-gold"
                                        >
                                          <ChampionAvatar
                                            image={p.championImage}
                                            name={p.championName ?? "Unknown"}
                                            size="sm"
                                          />
                                          <span className="min-w-0">
                                            <span className="block truncate">{displayName}</span>
                                            <div className="flex items-center gap-1">
                                              <span
                                                className={`text-[11px] font-normal ${
                                                  rankAtMatch === "Unknown rank"
                                                    ? "text-stone-500"
                                                    : "text-gold/80"
                                                }`}
                                              >
                                                {rankAtMatch}
                                              </span>
                                              {p.performanceScore > 0 && (
                                                <PerformanceBadge place={rank} isAce={isAce} />
                                              )}
                                            </div>
                                          </span>
                                        </Link>
                                      ) : (
                                        <div className="flex min-w-0 items-center gap-2 font-semibold text-stone-400">
                                          <ChampionAvatar
                                            image={p.championImage}
                                            name={p.championName ?? "Unknown"}
                                            size="sm"
                                          />
                                          <span className="min-w-0">
                                            <span className="block truncate">{displayName}</span>
                                            <div className="flex items-center gap-1">
                                              <span
                                                className={`text-[11px] font-normal ${
                                                  rankAtMatch === "Unknown rank"
                                                    ? "text-stone-500"
                                                    : "text-gold/80"
                                                }`}
                                              >
                                                {rankAtMatch}
                                              </span>
                                              {p.performanceScore > 0 && (
                                                <PerformanceBadge place={rank} isAce={isAce} />
                                              )}
                                            </div>
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <span className="text-center font-mono text-stone-300 w-12">
                                    {p.kills}/{p.deaths}/{p.assists}
                                  </span>
                                  <span className="text-center font-mono text-stone-300 w-12">
                                    {getKillParticipation(p, matchParticipants)}% KP
                                  </span>
                                  <div className="flex justify-start min-w-0">
                                    <LoadoutRow
                                      items={
                                        Array.isArray(p.itemsJson)
                                          ? (p.itemsJson as number[])
                                          : []
                                      }
                                      spell1Id={p.spell1Id}
                                      spell2Id={p.spell2Id}
                                      augments={
                                        Array.isArray(p.augmentsJson)
                                          ? (p.augmentsJson as number[])
                                          : []
                                      }
                                      version={ddragonVersion}
                                      size="sm"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-0.5 items-end">
                                    <StatBar
                                      value={p.damageToChampions}
                                      max={maxDamage}
                                      color="damage"
                                    />
                                    <StatBar
                                      value={p.healingDone}
                                      max={maxHealing}
                                      color="healing"
                                    />
                                  </div>
                                </div>
                                );
                              })}
                              </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {matchesToDisplay < status.matches.length && (
                <button
                  onClick={() => setMatchesToDisplay((prev) => prev + 20)}
                  className="w-full rounded-lg border border-line bg-panel p-3 text-center text-sm font-bold text-gold hover:bg-black/20"
                >
                  Load More
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-stone-500 uppercase tracking-widest text-xs">
                    <th
                      className="p-3 cursor-pointer hover:text-white"
                      onClick={() => handleSort("name")}
                    >
                      Champion
                    </th>
                    <th
                      className="p-3 text-right cursor-pointer hover:text-white"
                      onClick={() => handleSort("games")}
                    >
                      Games
                    </th>
                    <th
                      className="p-3 text-right cursor-pointer hover:text-white"
                      onClick={() => handleSort("winrate")}
                    >
                      Winrate
                    </th>
                    <th
                      className="p-3 text-right cursor-pointer hover:text-white"
                      onClick={() => handleSort("kda")}
                    >
                      KDA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentSummary?.allChampions.map((c) => (
                    <tr key={c.championId} className="border-t border-line/50">
                      <td className="p-3 font-semibold text-white">
                        <div className="flex items-center gap-3">
                          <ChampionAvatar
                            image={c.championImage}
                            name={c.championName}
                            size="sm"
                          />
                          {c.championName}
                        </div>
                      </td>
                      <td className="p-3 text-right text-stone-300">{c.games}</td>
                      <td className="p-3 text-right text-stone-300">
                        {Math.round((c.wins / c.games) * 100)}%
                      </td>
                      <td className="p-3 text-right text-stone-300">
                        {((c.kills + c.assists) / Math.max(c.deaths, 1)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
