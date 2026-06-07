"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import Image from "next/image";
import { ChampionAvatar } from "@/components/ChampionAvatar";
import { LoadoutRow } from "@/components/LoadoutRow";

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
  };
  player?: {
    name: string;
    tag?: string;
    profileIconUrl?: string | null;
  };
  kp?: number;
  viewedParticipant?: {
    itemsJson: unknown;
    spell1Id: number | null;
    spell2Id: number | null;
    augmentsJson: unknown;
  } | null;
  ddragonVersion?: string | null;
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

export function MatchRow({ match }: { match: MatchData }) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const isNavigable = Boolean(match.player?.name && match.player?.tag);

  const handleRowClick = () => {
    if (isNavigable) {
      router.push(
        `/player/${encodeURIComponent(match.player!.name)}/${encodeURIComponent(match.player!.tag!)}?match=${match.id}`
      );
    } else {
      setExpanded(!expanded);
    }
  };

  return (
    <div
      className={`overflow-hidden ${match.player ? "" : "rounded-lg border"} ${
        match.win ? "border-sky-500/30 bg-sky-950/20" : "border-red-500/30 bg-red-950/20"
      }`}
    >
      <div
        className={`flex flex-col gap-3 p-3 text-sm md:flex-row md:items-center md:justify-between cursor-pointer hover:bg-black/20`}
        onClick={handleRowClick}
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
          <div
            className={`font-black text-right whitespace-nowrap ${
              match.lpDelta >= 0 ? "text-sky-300" : "text-red-400"
            }`}
          >
            {match.isPlacement ? "Placement" : `${match.lpDelta >= 0 ? "+" : ""}${match.lpDelta} LP`}
          </div>
          {/* Only show chevron for non-navigable (profile page) rows */}
          {!isNavigable && (expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
        </div>
      </div>
    </div>
  );
}