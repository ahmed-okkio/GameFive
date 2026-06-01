"use client";

import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ProgressScreen } from "@/components/ProgressScreen";
import { getLatestDDragonVersion, getProfileIconUrl } from "@/lib/riot/ddragon";

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
        isPlaced: boolean;
        profileIconId: number | null;
      };
      mmr: {
        currentLp: number;
        mayhemGames: number;
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
          participants: Array<{
            id: string;
            championName: string | null;
            kills: number;
            deaths: number;
            assists: number;
            win: boolean;
            player: { riotIdName: string; riotIdTag: string; };
          }>
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

type ProfileClientProps = {
  gameName: string;
  tagLine: string;
  initialStatus?: StatusResponse;
};

export function ProfileClient({ gameName, tagLine, initialStatus }: ProfileClientProps) {
  const [status, setStatus] = useState<StatusResponse | null>(initialStatus ?? null);
  const [tab, setTab] = useState("matches");
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [ddragonVersion, setDdragonVersion] = useState<string | null>(null);
  const [refreshState, setRefreshState] = useState<{ loading: boolean; message: string | null; error: string | null }>({
    loading: false,
    message: null,
    error: null
  });

  useEffect(() => {
      getLatestDDragonVersion().then(setDdragonVersion);
  }, []);

  async function refresh() {
    setRefreshState({ loading: true, message: null, error: null });
    try {
      const response = await fetch(`/api/players/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/refresh`, { method: "POST" });
      if (!response.ok) throw new Error("Refresh failed.");
      
      const statusResponse = await fetch(`/api/players/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/status`, { cache: "no-store" });
      setStatus(await statusResponse.json());
      setRefreshState({ loading: false, message: "Profile updated.", error: null });
    } catch {
      setRefreshState({ loading: false, message: null, error: "Refresh failed." });
    }
  }

  if (!status || status.state === "awaiting") {
    return <ProgressScreen gameName={gameName} tagLine={tagLine} status="loading" completedSteps={0} totalSteps={100} />;
  }

  const rankLabel = status.player.isPlaced ? status.tier.label : "Unranked";
    
  const getTierIcon = (tierName: string) => {
    const formattedTier = tierName.charAt(0).toUpperCase() + tierName.slice(1).toLowerCase();
    return `/tiers/Season_2023_-_${formattedTier}.png`;
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-lg border border-line bg-panel p-5">
            <div className="flex flex-col items-center text-center">
                <div className="h-24 w-24 rounded-full bg-black/30 flex items-center justify-center mb-4 overflow-hidden">
                     {ddragonVersion && status.player.profileIconId ? (
                         <img 
                            src={getProfileIconUrl(status.player.profileIconId, ddragonVersion)} 
                            alt="Profile Icon" 
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
                {status.player.isPlaced ? (
                    <div className="flex flex-col items-center gap-2">
                        <img src={getTierIcon(status.tier.tier)} alt={status.tier.tier} className="h-24 w-24 object-contain" />
                        <span className="text-lg font-bold text-gold">{rankLabel}</span>
                        <span className="text-sm text-stone-300">{status.mmr.currentLp} LP</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-lg font-bold text-stone-300">Unranked</span>
                        <div className="w-full mt-2">
                            <div className="flex justify-between text-xs text-stone-400 mb-1">
                                <span>Placement Progress</span>
                                <span>{status.mmr.mayhemGames} / 10</span>
                            </div>
                            <div className="flex gap-1">
                                {[...Array(10)].map((_, i) => (
                                    <div key={i} className={`h-2 flex-1 rounded-sm ${i < status.mmr.mayhemGames ? "bg-gold" : "bg-stone-700"}`} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <button
                onClick={refresh}
                disabled={refreshState.loading}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded border border-line px-3 py-2 text-sm text-stone-200 hover:border-gold disabled:opacity-50"
            >
                <RefreshCw className={refreshState.loading ? "animate-spin" : ""} size={16} />
                {refreshState.loading ? "Refreshing..." : "Refresh Profile"}
            </button>
            {refreshState.message && (
              <p className="mt-3 text-xs text-jade">{refreshState.message}</p>
            )}
            {refreshState.error && (
              <p className="mt-3 text-xs text-red-400">{refreshState.error}</p>
            )}
        </aside>

        <div className="rounded-lg border border-line bg-panel p-5">
            <div className="flex gap-6 border-b border-line mb-4">
                {["matches", "champions"].map((item) => (
                    <button
                        key={item}
                        onClick={() => setTab(item)}
                        className={`pb-2 text-sm font-bold uppercase tracking-widest ${
                        tab === item ? "border-b-2 border-gold text-white" : "text-stone-500 hover:text-stone-300"
                        }`}
                    >
                        {item === "matches" ? "Match History" : "Champions"}
                    </button>
                ))}
            </div>

            {tab === "matches" ? (
                <div className="space-y-2">
                    {status.matches.map((match) => (
                      <div key={match.id}>
                        <div 
                          className="flex items-center justify-between rounded border border-line bg-black/20 p-3 text-sm cursor-pointer hover:bg-black/30"
                          onClick={() => setExpandedMatchId(expandedMatchId === match.id ? null : match.id)}
                        >
                            <div className="flex items-center gap-4">
                                <span className={`w-16 font-bold ${match.win ? "text-jade" : "text-red-400"}`}>
                                    {match.win ? "WIN" : "LOSS"}
                                </span>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-white">{match.championName}</span>
                                    <span className="text-xs text-stone-400">{new Date(match.match.gameDate).toLocaleDateString()}</span>
                                </div>
                                <span className="text-stone-300 w-20 text-center">{match.kills}/{match.deaths}/{match.assists}</span>
                                <div className="text-xs text-stone-400 w-32">
                                    <p>Damage: {match.damageToChampions.toLocaleString()}</p>
                                    <p>Healing: {match.healingDone.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-gold">
                                    {match.isPlacement ? "Placement" : (match.lpDelta >= 0 ? `+${match.lpDelta} LP` : `${match.lpDelta} LP`)}
                                </span>
                                {expandedMatchId === match.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                        </div>
                        {expandedMatchId === match.id && (
                          <div className="bg-black/10 p-4 border-x border-b border-line rounded-b-lg">
                              {match.match.participants.map(p => (
                                  <div key={p.id} className="flex justify-between py-1 text-sm border-t border-line/50 first:border-0">
                                      <Link href={`/player/${encodeURIComponent(p.player.riotIdName)}/${encodeURIComponent(p.player.riotIdTag)}`} className="text-white hover:text-gold">
                                        {p.player.riotIdName}#{p.player.riotIdTag} - {p.championName}
                                      </Link>
                                      <span className="text-stone-300">{p.kills}/{p.deaths}/{p.assists}</span>
                                  </div>
                              ))}
                          </div>
                        )}
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
