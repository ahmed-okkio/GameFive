"use client";

import { RefreshCw } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ProgressScreen } from "@/components/ProgressScreen";

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

type EnrichmentJobSnapshot = {
  status: string;
  depthReached: number;
  callsMade: number;
  totalCallsEstimate: number;
  queuePosition?: number | null;
  completedAt?: string | null;
};

type StatusResponse =
  | {
      state: "awaiting";
      job: ProfileJobSnapshot;
    }
  | {
      state: "ready";
      player: {
        riotIdName: string;
        riotIdTag: string;
        rawMmr: number;
        isPlaced: boolean;
        mayhemGames: number;
        aramGames: number;
        cacheUpdatedAt: string | null;
      };
      mmr: {
        rawMmr: number;
        displayedMmr: number;
        currentLp: number;
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
        isPlacement: boolean;
        championId: number;
        championName: string;
        damageToChampions: number;
        healingDone: number;
        match: {
          gameDate: string;
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
      activeJob?: ProfileJobSnapshot | null;
      enrichment?: EnrichmentJobSnapshot | null;
      latestProfileJob?: ProfileJobSnapshot | null;
      latestEnrichment?: EnrichmentJobSnapshot | null;
    };

type ProfileClientProps = {
  gameName: string;
  tagLine: string;
  initialStatus?: StatusResponse;
};

export function ProfileClient({ gameName, tagLine, initialStatus }: ProfileClientProps) {
  const [status, setStatus] = useState<StatusResponse | null>(initialStatus ?? null);
  const [tab, setTab] = useState("matches");
  const [refreshState, setRefreshState] = useState<{
    loading: boolean;
    message: string | null;
    error: string | null;
  }>({
    loading: false,
    message: null,
    error: null
  });

  const endpoint = useMemo(
    () => `/api/players/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/status`,
    [gameName, tagLine]
  );

  const winRate = useMemo(() => {
    if (!status || status.state !== "ready" || status.matches.length === 0) return 0;
    const wins = status.matches.filter((m) => m.win).length;
    return Math.round((wins / status.matches.length) * 100);
  }, [status]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const response = await fetch(endpoint, { cache: "no-store" });
      const json = (await response.json()) as StatusResponse;

      if (!cancelled) {
        setStatus(json);
      }
    }

    poll();
    const interval = window.setInterval(poll, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [endpoint]);

  async function refresh() {
    setRefreshState({
      loading: true,
      message: null,
      error: null
    });

    try {
      const response = await fetch(`/api/players/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/refresh`, {
        method: "POST"
      });
      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        setRefreshState({
          loading: false,
          message: null,
          error: json.error ?? "Refresh failed."
        });
        return;
      }

      const statusResponse = await fetch(endpoint, { cache: "no-store" });
      const nextStatus = (await statusResponse.json()) as StatusResponse;

      setStatus(nextStatus);
      setRefreshState({
        loading: false,
        message: "Checking for new games.",
        error: null
      });
    } catch {
      setRefreshState({
        loading: false,
        message: null,
        error: "Refresh failed."
      });
    }
  }

  if (!status || status.state === "awaiting") {
    return (
      <ProgressScreen
        gameName={gameName}
        tagLine={tagLine}
        status={status?.state === "awaiting" ? status.job.status : "queued"}
        completedSteps={status?.state === "awaiting" ? status.job.completedSteps : 0}
        totalSteps={status?.state === "awaiting" ? status.job.totalSteps : 1001}
        queuePosition={status?.state === "awaiting" ? status.job.queuePosition : null}
        error={status?.state === "awaiting" ? status.job.error : null}
      />
    );
  }

  const rankLabel = status.player.isPlaced
    ? status.tier.label
    : "Unranked";
    
  const getTierIcon = (tierName: string) => {
    const formattedTier = tierName.charAt(0).toUpperCase() + tierName.slice(1).toLowerCase();
    return `/tiers/Season_2023_-_${formattedTier}.png`;
  };
    
  const placementProgress = Math.min(100, Math.round((status.mmr.mayhemGames / 10) * 100));

  const activeProgress = status.activeJob
    ? Math.min(100, Math.round((status.activeJob.completedSteps / Math.max(status.activeJob.totalSteps, 1)) * 100))
    : 0;
  const activeJobLabel =
    status.activeJob?.status === "queued"
      ? `Number ${status.activeJob.queuePosition ?? "?"} in rank calculation queue`
      : "Calculating real rank";
  const enrichmentProgress = status.enrichment
    ? Math.min(100, Math.round((status.enrichment.callsMade / Math.max(status.enrichment.totalCallsEstimate, 1)) * 100))
    : 0;
  const enrichmentLabel =
    status.enrichment?.status === "processing"
      ? "Refining rank"
      : `Number ${status.enrichment?.queuePosition ?? "?"} in rank refinement queue`;
  const latestProfileJob = status.latestProfileJob ?? status.activeJob ?? null;
  const latestEnrichment = status.latestEnrichment ?? status.enrichment ?? null;
  const rankStatusLabel = status.activeJob
    ? activeJobLabel
    : latestProfileJob?.status === "complete"
      ? "Rank calculation complete"
      : latestProfileJob?.status === "failed"
        ? "Rank calculation failed"
        : "Rank calculation not started";
  const rankStatusDetail = status.activeJob
    ? status.activeJob.message
    : latestProfileJob?.completedAt
      ? `Finished ${formatDateTime(latestProfileJob.completedAt)}`
      : (latestProfileJob?.message ?? "No calculation history yet");

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-2xl">
        {/* Unified Profile Header */}
        <div className="flex flex-col gap-6 border-b border-line p-8 md:flex-row">
            <div className="flex items-center gap-6">
              {status.player.isPlaced ? (
                  <img
                      src={getTierIcon(status.tier.tier)}
                      alt={status.tier.tier}
                      className="h-24 w-24 object-contain"
                  />
              ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-black/30 text-stone-500">
                    <span className="text-4xl font-black">?</span>
                  </div>
              )}
              <div className="flex flex-col">
                  <h1 className="text-4xl font-black text-white">
                    {status.player.riotIdName}
                    <span className="text-stone-500">#{status.player.riotIdTag}</span>
                  </h1>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-xl font-bold text-gold">
                        {status.player.isPlaced ? `${rankLabel} - ${status.mmr.currentLp} LP` : "Placement Matches"}
                    </span>
                    {status.player.isPlaced && (
                      <span className="text-sm text-stone-400">{winRate}% Winrate</span>
                    )}
                  </div>
              </div>
            </div>
            
            {!status.player.isPlaced && (
              <div className="flex flex-1 flex-col justify-center gap-2 md:pl-8">
                  <div className="flex justify-between text-sm font-semibold text-stone-300">
                      <span>Placement Progress</span>
                      <span>{status.mmr.mayhemGames} / 10 Games</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[...Array(10)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-2 flex-1 rounded-full ${i < status.mmr.mayhemGames ? "bg-gold" : "bg-stone-700"}`} 
                      />
                    ))}
                  </div>
              </div>
            )}
        </div>

        {/* Tabbed Content */}
        <div className="p-8">
          <div className="flex gap-6 border-b border-line mb-6">
            {["matches", "champions"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`pb-3 text-sm font-bold uppercase tracking-widest transition-colors ${
                  tab === item ? "border-b-2 border-gold text-white" : "text-stone-500 hover:text-stone-300"
                }`}
              >
                {item === "matches" ? "Match History" : "Champions"}
              </button>
            ))}
          </div>

          {tab === "matches" ? (
            <div className="space-y-3">
                {status.matches.map((match) => (
                    <div key={match.id} className="flex items-center justify-between rounded-lg border border-line bg-black/20 p-4 transition-colors hover:bg-black/30">
                        <div className="flex items-center gap-6">
                            <span className={`w-16 font-black ${match.win ? "text-jade" : "text-red-400"}`}>
                                {match.win ? "VICTORY" : "DEFEAT"}
                            </span>
                            <div className="flex w-32 flex-col">
                                <span className="font-semibold text-white">{match.championName}</span>
                                <span className="text-xs text-stone-500">{new Date(match.match.gameDate).toLocaleDateString()}</span>
                            </div>
                            <span className="w-20 text-center font-mono text-stone-300">
                                {match.kills}/{match.deaths}/{match.assists}
                            </span>
                        </div>
                        <span className="font-mono font-bold text-gold">
                            {match.isPlacement ? "Placement" : (match.lpDelta >= 0 ? `+${match.lpDelta} LP` : `${match.lpDelta} LP`)}
                        </span>
                    </div>
                ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                  <thead>
                      <tr className="text-left text-stone-500 uppercase tracking-widest text-xs">
                          <th className="p-3">Champion</th>
                          <th className="p-3 text-right">Games</th>
                          <th className="p-3 text-right">Winrate</th>
                          <th className="p-3 text-right">KDA</th>
                      </tr>
                  </thead>
                  <tbody>
                      {status.champions.map((c) => (
                          <tr key={c.championId} className="border-t border-line/50">
                              <td className="p-3 font-semibold text-white">{c.championName}</td>
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
