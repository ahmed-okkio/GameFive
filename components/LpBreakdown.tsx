import React from 'react';
import { Info } from 'lucide-react';

type LpBreakdownProps = {
  individualPlayerMmr: number;
  myTeamAvgMmr: number | null;
  opposingTeamAvgMmr: number | null;
  lobbyAvgFallback: number | null;
  consecutiveStreak: number;
  win: boolean;
  delta: number;
};

export const LpBreakdown = ({ 
    individualPlayerMmr, 
    myTeamAvgMmr, 
    opposingTeamAvgMmr, 
    lobbyAvgFallback,
    consecutiveStreak,
    win,
    delta 
}: LpBreakdownProps) => {
  const BASE_LP = 25;
  const myTeam = myTeamAvgMmr ?? lobbyAvgFallback ?? 1500;
  const opposingTeam = opposingTeamAvgMmr ?? lobbyAvgFallback ?? 1500;

  const absStreak = Math.abs(consecutiveStreak);
  const effectiveStreak = absStreak >= 3 ? Math.min(absStreak, 10) : 0;
  const streakContribution = Math.round((effectiveStreak / 10) * 6);
  const disparityContribution = Math.round(Math.abs(delta) - BASE_LP - streakContribution);

  if (delta === 0) {
    return (
      <div className="bg-black/40 p-4 rounded-lg border border-line text-xs text-stone-500 italic text-center mt-2">
        LP is not tracked during placement games.
      </div>
    );
  }

  const getDifficultySentence = () => {
    const individualGap = individualPlayerMmr - opposingTeam;
    const teamGap = myTeam - opposingTeam;
    const buffer = 50;

    const isIndivHigher = individualGap > buffer;
    const isIndivLower = individualGap < -buffer;
    const isTeamHigher = teamGap > buffer;
    const isTeamLower = teamGap < -buffer;

    // Handle the "Zero Adjustment" cases first with specific explanations
    if (disparityContribution === 0) {
      if (isIndivHigher && isTeamLower) return "Your higher individual rank was balanced by your team's underdog status.";
      if (isIndivLower && isTeamHigher) return "Your lower individual rank was balanced by your team's favored status.";
      if (isIndivHigher || isTeamHigher) return "The lobby was slightly easier than average, but not enough to reduce your LP.";
      if (isIndivLower || isTeamLower) return "The lobby was slightly harder than average, but not enough to grant bonus LP.";
      return "The lobby skill levels were closely matched, so no adjustment was applied.";
    }

    // Determine State for non-zero adjustments
    if (isIndivHigher && isTeamHigher) {
      return win 
        ? "You and your team were both favored in this lobby, resulting in reduced LP gains."
        : "You and your team were both favored in this lobby, resulting in a heavier LP penalty.";
    }
    if (isIndivLower && isTeamLower) {
      return win
        ? "You were personally outranked in an underdog team, granting you substantial bonus LP."
        : "You were personally outranked in an underdog team, resulting in a smaller LP penalty.";
    }
    if (isIndivHigher && isTeamLower) {
      return "As the highest-ranked player on an underdog team, your skill gap reduced your personal win bonus.";
    }
    if (isIndivLower && isTeamHigher) {
      return win
        ? "While your team was favored, your own lower rank compared to opponents provided a personal LP boost."
        : "While your team was favored, your own lower rank helped mitigate the team's loss penalty.";
    }
    if (isIndivHigher) {
      return win
        ? "You were ranked higher than the lobby average, resulting in a personal LP reduction."
        : "You were ranked higher than the lobby average, resulting in a heavier LP penalty.";
    }
    if (isIndivLower) {
      return win
        ? "You earned extra LP for competing against a lobby ranked higher than your individual position."
        : "Your lower rank compared to the lobby average resulted in a smaller LP penalty.";
    }
    if (isTeamHigher) {
      return win
        ? "Your team was favored to win this match, resulting in a small LP reduction."
        : "Your team was favored to win this match, resulting in a slightly heavier loss penalty.";
    }
    if (isTeamLower) {
      return win
        ? "Your team was the underdog in this lobby, granting you a small LP bonus."
        : "Your team was the underdog in this lobby, resulting in a smaller LP penalty.";
    }

    return "This match was perfectly balanced for your rank, resulting in standard LP gains.";
  };

  return (
    <div className="bg-black/40 p-4 rounded-lg border border-line text-xs space-y-3 mt-2">
      <div className="flex justify-between border-b border-line pb-2 mb-2">
        <span className="font-bold text-stone-200">LP Calculation Breakdown</span>
        <span className="font-bold text-gold">{delta > 0 ? '+' : ''}{delta} LP</span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-stone-400">
          <span>Base LP</span>
          <span className="text-stone-200">{win ? '' : '-'}{BASE_LP}</span>
        </div>
        <div className="flex justify-between text-stone-400">
          <span>{consecutiveStreak >= 0 ? 'Win Streak' : 'Loss Streak'} ({absStreak >= 3 ? (absStreak >= 10 ? '10 MAX' : absStreak) : 'None'})</span>
          <span className={streakContribution === 0 ? "text-stone-300" : (win ? "text-sky-300" : "text-red-400")}>
            {streakContribution === 0 ? '+0' : (win ? `+${streakContribution}` : `-${streakContribution}`)} LP
          </span>
        </div>
        <div className="flex justify-between text-stone-400 items-center group relative">
          <span className="flex items-center gap-1">
            Match Difficulty
            <Info size={12} className="text-stone-600 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-black border border-line rounded text-[10px] hidden group-hover:block z-10 space-y-3">
              <p className="font-bold text-gold uppercase tracking-wider">
                Match Difficulty
              </p>
              
              <div className="space-y-1 text-stone-300 leading-relaxed">
                <p>{getDifficultySentence()}</p>
              </div>
            </div>
          </span>
          <span className={
            disparityContribution === 0 
              ? "text-stone-300" 
              : (win 
                  ? (disparityContribution > 0 ? "text-sky-300" : "text-red-400")
                  : (disparityContribution > 0 ? "text-red-400" : "text-sky-300")
                )
          }>
            {disparityContribution === 0 ? '' : (
              win 
                ? (disparityContribution > 0 ? '+' : '') 
                : (disparityContribution > 0 ? '-' : '+')
            )}{win ? disparityContribution : -disparityContribution} LP
          </span>
        </div>
      </div>
    </div>
  );
};
