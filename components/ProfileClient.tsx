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
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="rounded border border-line bg-panel p-5">
          <p className="text-2xl font-black leading-tight text-white">
            {status.player.riotIdName}#{status.player.riotIdTag}
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Estimated Mayhem Rank</p>
          
          {status.player.isPlaced ? (
            <div className="mt-4 flex items-center gap-4">
                <div className="h-20 w-20 flex-shrink-0">
                  <Image
                      src={getTierIcon(status.tier.tier)}
                      alt={status.tier.tier}
                      width={80}
                      height={80}
                      className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex flex-col">
                    <h1 className="text-3xl font-black text-white">{rankLabel}</h1>
                    <p className="text-lg text-gold">{status.mmr.currentLp} LP</p>
                    <p className="text-xs text-stone-400">{winRate}% Winrate ({status.matches.length} games)</p>
                </div>
            </div>
          ) : (
            <h1 className="mt-2 text-4xl font-black text-white">{rankLabel}</h1>
          )}
          
          {!status.player.isPlaced ? (
            <div className="mt-4">
                <p className="text-sm text-stone-300">{status.mmr.mayhemGames} / 10 placement games complete</p>
                <div className="mt-2 h-2 rounded bg-black/40">
                  <div className="h-full rounded bg-gold" style={{ width: `${placementProgress}%` }} />
                </div>
            </div>
          ) : (
            <div className="mt-4 h-2 w-full rounded bg-black/40">
                <div className="h-full rounded bg-gold" style={{ width: `${status.mmr.currentLp}%` }} />
            </div>
          )}
          {status.activeJob ? (
            <div className="mt-3 rounded border border-line bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-stone-300">{activeJobLabel}</span>
                <span className="font-semibold text-gold">{activeProgress}%</span>
              </div>
              <div className="h-2 rounded bg-black/40">
                <div className="h-full rounded bg-gold" style={{ width: `${activeProgress}%` }} />
              </div>
            </div>
          ) : null}
          {status.enrichment ? (
            <div className="mt-3 rounded border border-line bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-stone-300">{enrichmentLabel}</span>
                {status.enrichment.status === "processing" ? (
                  <span className="font-semibold text-gold">{enrichmentProgress}%</span>
                ) : null}
              </div>
              {status.enrichment.status === "processing" ? (
                <div className="h-2 rounded bg-black/40">
                  <div className="h-full rounded bg-jade" style={{ width: `${enrichmentProgress}%` }} />
                </div>
              ) : null}
            </div>
          ) : null}
          {!status.activeJob && !status.enrichment ? (
            <div className="mt-3 rounded border border-line bg-black/20 p-3 text-sm">
              <p className="font-semibold text-stone-200">{rankStatusLabel}</p>
              <p className="mt-1 text-stone-400">{rankStatusDetail}</p>
            </div>
          ) : null}
          <button
            onClick={refresh}
            disabled={refreshState.loading || !!status.activeJob}
            className="mt-5 inline-flex items-center gap-2 rounded border border-line px-3 py-2 text-sm text-stone-200 hover:border-gold disabled:opacity-50"
          >
            <RefreshCw className={refreshState.loading || status.activeJob ? "animate-spin" : ""} size={16} />
            {refreshState.loading || status.activeJob ? "Refreshing..." : "Refresh"}
          </button>
          {refreshState.message ? <p className="mt-2 text-sm text-jade">{refreshState.message}</p> : null}
          {refreshState.error ? <p className="mt-2 text-sm text-red-300">{refreshState.error}</p> : null}
          {status.activeJob ? <p className="mt-2 text-sm text-gold">Automatic update in progress...</p> : null}
        </aside>
        <div className="rounded border border-line bg-panel p-5">
          <div className="flex gap-2 border-b border-line">
            {["matches", "champions"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`px-3 py-2 text-sm font-semibold capitalize ${
                  tab === item ? "border-b-2 border-gold text-gold" : "text-stone-400"
                }`}
              >
                {item === "matches" ? "Match History" : item}
              </button>
            ))}
          </div>
          {tab === "matches" ? (
            <div className="py-5">
                <div className="space-y-2">
                    {status.matches.map((match) => (
                        <div key={match.id} className="flex items-center justify-between rounded border border-line bg-black/20 p-4 text-sm">
                            <div className="flex items-center gap-4">
                                <span className={`font-bold ${match.win ? "text-jade" : "text-red-400"}`}>
                                    {match.win ? "WIN" : "LOSS"}
                                </span>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-white">{match.championName}</span>
                                    <span className="text-xs text-stone-400">{new Date(match.match.gameDate).toLocaleDateString()}</span>
                                </div>
                                <span className="text-stone-300">
                                    {match.kills}/{match.deaths}/{match.assists}
                                </span>
                                <div className="text-xs text-stone-400">
                                    <p>Damage: {match.damageToChampions.toLocaleString()}</p>
                                    <p>Healing: {match.healingDone.toLocaleString()}</p>
                                </div>
                            </div>
                            <span className={`font-mono font-bold ${match.lpDelta >= 0 ? "text-gold" : "text-stone-400"}`}>
                                {match.lpDelta >= 0 ? "+" : ""}{match.lpDelta} LP
                            </span>
                        </div>
                    ))}
                </div>
            </div>
          ) : tab === "champions" ? (
            <div className="py-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-stone-400">
                            <th className="p-3 text-left">Champion</th>
                            <th className="p-3 text-right">Games</th>
                            <th className="p-3 text-right">Winrate</th>
                            <th className="p-3 text-right">KDA</th>
                        </tr>
                    </thead>
                    <tbody>
                        {status.champions.map((c) => (
                            <tr key={c.championId} className="border-t border-line">
                                <td className="p-3 font-semibold text-white">{c.championName}</td>
                                <td className="p-3 text-right">{c.games}</td>
                                <td className="p-3 text-right">
                                    {Math.round((c.wins / c.games) * 100)}%
                                </td>
                                <td className="p-3 text-right">
                                    {((c.kills + c.assists) / Math.max(c.deaths, 1)).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-stone-400">
              This tab will populate after the first calculation stores match data.
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
