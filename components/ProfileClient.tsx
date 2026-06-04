"use client";

import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import Image from "next/image";
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
        promoFromTier: string | null;
        promoToTier: string | null;
        promoWins: number;
        promoLosses: number;
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
        championImage: string | null;
        damageToChampions: number;
        healingDone: number;
        match: {
          gameDate: string;
          durationSeconds: number;
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
            player: { riotIdName: string; riotIdTag: string; } | null;
            playerRiotIdName: string | null;
            playerRiotIdTag: string | null;
            rankSignalMmr: number | null;
            rankLabelAtMatch: string;
          }>
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
};

type ReadyStatus = Extract<StatusResponse, { state: "ready" }>;
type ProfileMatch = ReadyStatus["matches"][number];
type MatchParticipant = ProfileMatch["match"]["participants"][number];

function formatKda(kills: number, deaths: number, assists: number) {
  return ((kills + assists) / Math.max(deaths, 1)).toFixed(2);
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

function formatTimeAgo(dateValue: string) {
  const elapsedMs = Date.now() - new Date(dateValue).getTime();
  const minutes = Math.floor(elapsedMs / 60_000);
  const hours = Math.floor(elapsedMs / 3_600_000);
  
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function getTeamKills(participants: MatchParticipant[], team: number) {
  return participants.filter((participant) => participant.team === team).reduce((sum, participant) => sum + participant.kills, 0);
}

function getKillParticipation(participant: Pick<MatchParticipant, "kills" | "assists" | "team">, participants: MatchParticipant[]) {
  const teamKills = getTeamKills(participants, participant.team);
  return teamKills > 0 ? Math.round(((participant.kills + participant.assists) / teamKills) * 100) : 0;
}

function StatBar({ value, max, color }: { value: number; max: number; color: "damage" | "healing" }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  const barColor = color === "damage" ? "bg-red-400" : "bg-emerald-400";
  const label = color === "damage" ? "Damage " : "Healing ";

  return (
    <div className="min-w-0">
      <div className="mb-1 text-right font-mono text-[11px] text-stone-300">
        {label}{value.toLocaleString()}
      </div>
      <div className="h-1.5 w-full rounded bg-stone-700/70">
        <div className={`h-1.5 rounded ${barColor}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ChampionAvatar({ image, name, size = "md" }: { image: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-8 w-8" : "h-11 w-11";

  return (
    <div className={`${sizeClass} shrink-0 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10`}>
      {image ? (
        <Image src={image} alt={name} width={44} height={44} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-black text-stone-500">?</div>
      )}
    </div>
  );
}

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

  const recentSummary = useMemo(() => {
    if (!status || status.state !== "ready") return null;

    const recentMatches = status.matches.slice(0, 20);
    const wins = recentMatches.filter((match) => match.win).length;
    const totals = recentMatches.reduce(
      (acc, match) => {
        const viewedParticipant = match.match.participants.find((participant) => {
          const participantName = participant.player?.riotIdName ?? participant.playerRiotIdName;
          const participantTag = participant.player?.riotIdTag ?? participant.playerRiotIdTag;
          return participantName === status.player.riotIdName && participantTag === status.player.riotIdTag;
        });
        acc.kills += match.kills;
        acc.deaths += match.deaths;
        acc.assists += match.assists;
        acc.kp += viewedParticipant ? getKillParticipation(viewedParticipant, match.match.participants) : 0;
        return acc;
      },
      { kills: 0, deaths: 0, assists: 0, kp: 0 }
    );
    const championMap = new Map<
      number,
      { championId: number; championName: string; championImage: string | null; games: number; wins: number; kills: number; deaths: number; assists: number }
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

    return {
      games: recentMatches.length,
      wins,
      losses: recentMatches.length - wins,
      winrate: recentMatches.length ? Math.round((wins / recentMatches.length) * 100) : 0,
      avgKills: recentMatches.length ? totals.kills / recentMatches.length : 0,
      avgDeaths: recentMatches.length ? totals.deaths / recentMatches.length : 0,
      avgAssists: recentMatches.length ? totals.assists / recentMatches.length : 0,
      avgKp: recentMatches.length ? Math.round(totals.kp / recentMatches.length) : 0,
      champions: [...championMap.values()].sort((a, b) => b.games - a.games).slice(0, 3)
    };
  }, [status]);

  if (!status || status.state === "awaiting") {
    return <ProgressScreen gameName={gameName} tagLine={tagLine} status="loading" completedSteps={0} totalSteps={100} />;
  }

  const promoLabel =
    status.player.promoFromTier && status.player.promoToTier
      ? `${status.player.promoFromTier} I PROMO (${status.player.promoWins}W ${status.player.promoLosses}L)`
      : null;
  const rankLabel = status.player.isPlaced ? (promoLabel ?? status.tier.label) : "Unranked";
    
  const getTierIcon = (tierName: string) => {
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
                {status.player.isPlaced ? (
                    <div className="flex flex-col items-center gap-2">
                        <img src={getTierIcon(status.tier.tier)} alt={status.tier.tier} className="h-24 w-24 object-contain" />
                        <span className="text-lg font-bold text-gold">{rankLabel}</span>
                        {promoLabel ? <span className="text-xs text-stone-400">{status.tier.label}</span> : null}
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

        <div className="min-w-0 rounded-lg border border-line bg-panel/95 p-3 shadow-xl shadow-black/20 sm:p-5">
            {recentSummary && (
              <div className="mb-5 border-b border-line pb-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">Recent Games</h2>
                  <span className="text-xs text-stone-500">Past {recentSummary.games} Mayhem games</span>
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
                      <div className="font-semibold text-sky-300">{recentSummary.wins}W {recentSummary.losses}L</div>
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
                        {formatKda(recentSummary.avgKills, recentSummary.avgDeaths, recentSummary.avgAssists)}:1
                      </div>
                      <div className="text-xs font-bold text-red-300">P/Kill {recentSummary.avgKp}%</div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-xs text-stone-500">Recent played champions</div>
                    <div className="space-y-2">
                      {recentSummary.champions.map((champion) => (
                        <div key={champion.championId} className="flex items-center gap-3 text-xs">
                          <ChampionAvatar image={champion.championImage} name={champion.championName} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-stone-200">{champion.championName}</div>
                            <div className="text-stone-500">
                              {Math.round((champion.wins / champion.games) * 100)}% ({champion.wins}W / {champion.games - champion.wins}L)
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
                        tab === item ? "border-b-2 border-gold text-white" : "text-stone-500 hover:text-stone-300"
                        }`}
                    >
                        {item === "matches" ? "Match History" : "Champions"}
                    </button>
                ))}
            </div>

            {tab === "matches" ? (
                <div className="space-y-2">
                    {status.matches.slice(0, 20).map((match) => {
                      const viewedParticipant = match.match.participants.find((participant) => {
                        const participantName = participant.player?.riotIdName ?? participant.playerRiotIdName;
                        const participantTag = participant.player?.riotIdTag ?? participant.playerRiotIdTag;
                        return participantName === status.player.riotIdName && participantTag === status.player.riotIdTag;
                      });
                      const viewedTeam = viewedParticipant?.team ?? match.match.participants.find((participant) => participant.win === match.win)?.team ?? 0;
                      const kp = viewedParticipant ? getKillParticipation(viewedParticipant, match.match.participants) : 0;
                      const maxDamage = Math.max(...match.match.participants.map((participant) => participant.damageToChampions), 1);
                      const maxHealing = Math.max(...match.match.participants.map((participant) => participant.healingDone), 1);

                      return (
                      <div key={match.id} className={`overflow-hidden rounded-lg border ${match.win ? "border-sky-500/40 bg-sky-950/20" : "border-red-500/40 bg-red-950/20"}`}>
                        <div 
                          className="flex cursor-pointer flex-col gap-3 p-3 text-sm hover:bg-black/20 md:flex-row md:items-center md:justify-between"
                          onClick={() => setExpandedMatchId(expandedMatchId === match.id ? null : match.id)}
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="w-20 shrink-0">
                                  <div className={`font-bold ${match.win ? "text-sky-300" : "text-red-400"}`}>{match.win ? "Victory" : "Defeat"}</div>
                                  <div className="text-xs text-stone-500">{formatTimeAgo(match.match.gameDate)}</div>
                                  <div className="mt-2 text-xs text-stone-400">{formatDuration(match.match.durationSeconds)}</div>
                                </div>
                                <ChampionAvatar image={match.championImage} name={match.championName} size="lg" />
                                <div className="min-w-0">
                                  <div className="font-semibold text-white">{match.championName}</div>
                                  <div className="font-mono text-lg font-black text-white">
                                    {match.kills} / <span className="text-red-300">{match.deaths}</span> / {match.assists}
                                  </div>
                                  <div className="text-xs text-stone-400">
                                    {formatKda(match.kills, match.deaths, match.assists)}:1 KDA <span className="text-red-300">({kp}% KP)</span>
                                  </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 md:justify-end">
                                <span className="font-mono font-bold text-gold">
                                    {match.isPlacement ? "Placement" : (match.lpDelta >= 0 ? `+${match.lpDelta} LP` : `${match.lpDelta} LP`)}
                                </span>
                                {expandedMatchId === match.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                        </div>
                        {expandedMatchId === match.id && (
                          <div className="overflow-x-auto border-t border-line/70">
                              {[100, 200].map(teamId => (
                                <div key={teamId} className={`${teamId === viewedTeam ? "bg-white/[0.03]" : "bg-black/10"} min-w-[720px] p-3`}>
                                    <h4 className={`mb-2 px-1 text-xs font-bold uppercase tracking-widest ${teamId === viewedTeam ? "text-gold" : "text-stone-500"}`}>
                                        {teamId === viewedTeam ? "Your Team" : "Enemy Team"} <span className="font-normal tracking-normal text-stone-500">({teamId === 100 ? "Blue" : "Red"})</span>
                                    </h4>
                                    <div className="grid grid-cols-[minmax(160px,1.5fr)_90px_70px_minmax(80px,1fr)_minmax(80px,1fr)] gap-3 px-3 pb-1 text-[11px] uppercase tracking-widest text-stone-500">
                                      <span>Player</span>
                                      <span className="text-right">KDA</span>
                                      <span className="text-right">KP</span>
                                      <span className="text-right">Damage</span>
                                      <span className="text-right">Healing</span>
                                    </div>
                                    <div className="space-y-1">
                                        {match.match.participants
                                            .filter(p => p.team === teamId)
                                            .map(p => (
                                            <div key={p.id} className="grid grid-cols-[minmax(160px,1.5fr)_90px_70px_minmax(80px,1fr)_minmax(80px,1fr)] items-center gap-3 rounded bg-black/20 px-3 py-2 text-sm">
                                                {(() => {
                                                  const playerName = p.player?.riotIdName ?? p.playerRiotIdName;
                                                  const playerTag = p.player?.riotIdTag ?? p.playerRiotIdTag;
                                                  const displayName = playerName ? `${playerName}${playerTag ? `#${playerTag}` : ""}` : "Unknown name";
                                                  const rankAtMatch = p.rankLabelAtMatch ?? "Unknown rank";
                                                  const isLinked = Boolean(p.player && playerName && playerTag);

                                                  return isLinked ? (
                                                    <Link href={`/player/${encodeURIComponent(playerName!)}/${encodeURIComponent(playerTag!)}`} className="flex min-w-0 items-center gap-2 font-semibold text-white hover:text-gold">
                                                      <ChampionAvatar image={p.championImage} name={p.championName ?? "Unknown"} size="sm" />
                                                      <span className="min-w-0">
                                                        <span className="block truncate">{displayName}</span>
                                                        <span className={`block truncate text-[11px] font-normal ${rankAtMatch === "Unknown rank" ? "text-stone-500" : "text-gold/80"}`}>{rankAtMatch}</span>
                                                      </span>
                                                    </Link>
                                                  ) : (
                                                    <div className="flex min-w-0 items-center gap-2 font-semibold text-stone-400">
                                                      <ChampionAvatar image={p.championImage} name={p.championName ?? "Unknown"} size="sm" />
                                                      <span className="min-w-0">
                                                        <span className="block truncate">{displayName}</span>
                                                        <span className={`block truncate text-[11px] font-normal ${rankAtMatch === "Unknown rank" ? "text-stone-500" : "text-gold/80"}`}>{rankAtMatch}</span>
                                                      </span>
                                                    </div>
                                                  );
                                                })()}
                                                <span className="text-right font-mono text-stone-300">{p.kills}/{p.deaths}/{p.assists}</span>
                                                <span className="text-right font-mono text-stone-300">{getKillParticipation(p, match.match.participants)}%</span>
                                                <StatBar value={p.damageToChampions} max={maxDamage} color="damage" />
                                                <StatBar value={p.healingDone} max={maxHealing} color="healing" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )})}
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
                                    <td className="p-3 font-semibold text-white">
                                      <div className="flex items-center gap-3">
                                        <ChampionAvatar image={c.championImage} name={c.championName} size="sm" />
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
