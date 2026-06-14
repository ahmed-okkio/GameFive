"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import Image from "next/image";
import { ChampionAvatar } from "@/components/ChampionAvatar";
import { LoadoutRow } from "@/components/LoadoutRow";
import { LpBreakdown } from "@/components/LpBreakdown";
import { appConfig } from "@/lib/config";

type MatchData = {
  id: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  lpDelta: number;
  isPlacement: boolean;
  championName: string;
  championImage: string | null;
  match: {
    gameDate: string;
    durationSeconds: number;
    team100AvgMmr?: number | null;
    team200AvgMmr?: number | null;
  };
  player?: {
    name: string;
    tag?: string;
    profileIconUrl?: string | null;
    rawMmr?: number;
  };
  kp?: number;
  viewedParticipant?: {
    itemsJson: unknown;
    spell1Id: number | null;
    spell2Id: number | null;
    augmentsJson: unknown;
    consecutiveStreak?: number;
  } | null;
  ddragonVersion?: string | null;
  individualPlayerMmr?: number;
  myTeamAvgMmr?: number | null;
  opposingTeamAvgMmr?: number | null;
  performanceRank?: number;
  context?: 'home' | 'profile';
};

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

export function MatchRow({ match, initiallyExpanded = false }: { match: MatchData; initiallyExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [showLpBreakdown, setShowLpBreakdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  // Sync with prop if it changes (for pre-expanded matches)
  useEffect(() => {
    if (initiallyExpanded) {
        setExpanded(true);
    }
  }, [initiallyExpanded]);

  const isNavigable = Boolean(match.player?.name && match.player?.tag);

  const handleRowClick = () => {
    // If in profile view, toggle expansion regardless of navigability
    if (match.context === 'profile') {
      setExpanded(!expanded);
    } else if (isNavigable) {
      router.push(
        `/player/${encodeURIComponent(match.player!.name)}/${encodeURIComponent(match.player!.tag!)}?match=${match.id}`
      );
    }
  };
  
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/player/${encodeURIComponent(match.player?.name ?? 'Unknown')}/${encodeURIComponent(match.player?.tag ?? 'Unknown')}?match=${match.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isNewPatch = new Date(match.match.gameDate) >= appConfig.patchDate;

  return (
    <div
      onClick={handleRowClick}
      className={`overflow-hidden cursor-pointer ${match.context === 'profile' ? "rounded-lg border" : ""} ${
        match.win ? "border-sky-500/30 bg-sky-950/20" : "border-red-500/30 bg-red-950/20"
      }`}
    >
      <div
        className={`flex flex-col gap-3 p-3 text-sm md:flex-row md:items-center md:justify-between hover:bg-black/20`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {match.player?.profileIconUrl && (
            <div className="h-10 w-10 shrink-0 rounded-full bg-black/30 overflow-hidden">
              <Image
                src={match.player.profileIconUrl}
                alt="Profile Icon"
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="w-20 shrink-0">
            <div className={`font-bold ${match.win ? "text-sky-300" : "text-red-400"}`}>
              {match.win ? "Victory" : "Defeat"}
            </div>
            <div className="text-xs text-stone-500">{formatTimeAgo(match.match.gameDate)}</div>
            <div className="mt-2 text-xs text-stone-400">{formatDuration(match.match.durationSeconds)}</div>
          </div>
          <div className="flex items-center gap-3">
            <ChampionAvatar image={match.championImage} name={match.championName} size="lg" />
            <div className="flex flex-col gap-1 min-w-0">
              <div className="font-semibold text-white truncate">
                {match.player?.name ?? match.championName}
              </div>
              {match.viewedParticipant && match.ddragonVersion && (
                <LoadoutRow
                  items={
                    Array.isArray(match.viewedParticipant.itemsJson)
                      ? (match.viewedParticipant.itemsJson as number[])
                      : []
                  }
                  spell1Id={match.viewedParticipant.spell1Id}
                  spell2Id={match.viewedParticipant.spell2Id}
                  augments={
                    Array.isArray(match.viewedParticipant.augmentsJson)
                      ? (match.viewedParticipant.augmentsJson as number[])
                      : []
                  }
                  version={match.ddragonVersion}
                  size="md"
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 md:justify-end">
          <div className="min-w-0 text-right whitespace-nowrap">
            <div className="font-mono font-black text-white text-sm">
              {match.kills}/<span className="text-red-300">{match.deaths}</span>/{match.assists}
            </div>
            <div className="text-[11px] text-stone-400">
              {formatKda(match.kills, match.deaths, match.assists)}:1{" "}
              {match.kp !== undefined ? `· ${match.kp}% KP` : ""}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div
              className={`font-black text-right whitespace-nowrap ${
                match.lpDelta >= 0 ? "text-sky-300" : "text-red-400"
              }`}
            >
              {match.isPlacement ? "Placement" : `${match.lpDelta >= 0 ? "+" : ""}${match.lpDelta} LP`}
            </div>
          </div>
          {/* Only show chevron if in profile view */}
          {match.context === 'profile' && (expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
        </div>
      </div>

      {/* Expanded Section */}
      {expanded && (
        <div className={``}>
          <div className="px-3 py-1.5 flex items-center justify-between gap-4">
            {match.context === 'profile' && !match.isPlacement && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowLpBreakdown(!showLpBreakdown); }}
                className={`text-[9px] font-bold transition-all uppercase tracking-widest flex items-center gap-1.5 !shadow-none ${
                  showLpBreakdown ? "text-gold" : "text-stone-500 hover:text-stone-300"
                }`}
              >
                {showLpBreakdown ? "Hide LP Breakdown" : "View LP Breakdown"}
              </button>
            )}
            
            <button
              onClick={handleCopy}
              className={`text-[9px] font-bold transition-all uppercase tracking-widest flex items-center gap-1.5 !shadow-none ${
                  copied ? "text-green-400" : "text-stone-500 hover:text-stone-300"
              }`}
            >
              {copied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  Copy Link
                </>
              )}
            </button>
          </div>

          {/* LP Breakdown Component */}
          {showLpBreakdown && (
            <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                {isNewPatch ? (
                  <LpBreakdown 
                    individualPlayerMmr={match.individualPlayerMmr ?? 0}
                    myTeamAvgMmr={match.myTeamAvgMmr ?? null}
                    opposingTeamAvgMmr={match.opposingTeamAvgMmr ?? null}
                    lobbyAvgFallback={null}
                    consecutiveStreak={match.viewedParticipant?.consecutiveStreak ?? 0}
                    win={match.win} 
                    delta={match.lpDelta}
                    performanceRank={match.performanceRank}
                  />
                ) : (
                  <div className="bg-black/20 p-4 rounded-lg border border-line/50 text-xs text-stone-500 italic text-center">
                    Detailed breakdown unavailable for games played before June 11th patch.
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}