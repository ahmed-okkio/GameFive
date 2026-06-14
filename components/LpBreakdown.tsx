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
  performanceRank?: number;
};

export const LpBreakdown = ({ 
    individualPlayerMmr, 
    myTeamAvgMmr, 
    opposingTeamAvgMmr, 
    lobbyAvgFallback,
    consecutiveStreak,
    win,
    delta,
    performanceRank
}: LpBreakdownProps) => {
  const BASE_LP = 25;
  const myTeam = myTeamAvgMmr ?? lobbyAvgFallback ?? 1500;
  const opposingTeam = opposingTeamAvgMmr ?? lobbyAvgFallback ?? 1500;

  // 1. Mirror Server-Side Disparity Logic
  const individualDisparity = individualPlayerMmr - opposingTeam;
  const teamDisparity = myTeam - opposingTeam;
  const blendedDisparity = 0.6 * individualDisparity + 0.4 * teamDisparity;
  
  // 2. Mirror Server-Side Streak Logic
  const absStreak = Math.abs(consecutiveStreak);
  const effectiveStreak = absStreak >= 3 ? Math.min(absStreak, 10) : 0;
  const streakBonus = (effectiveStreak / 10) * 6;
  const rawStreakContribution = Math.round(streakBonus);

  // 3. Ensure Math Adds Up
  // Because the server might have rounded (Base + Difficulty + Streak) as a whole, 
  // or rounded components individually, we adjust the difficulty component 
  // in the UI to ensure the displayed math always sums perfectly to the 'delta' prop.
  
  // For simplicity in the UI display logic below, we'll just use the raw values 
  // and handle the rounding error adjustment specifically on the difficulty line.
  const expectedDifficultyContribution = delta - (win ? BASE_LP : -BASE_LP) - (win ? rawStreakContribution : -rawStreakContribution);
  const displayDifficultyContribution = win ? expectedDifficultyContribution : Math.abs(expectedDifficultyContribution);

  const getPerformanceAdjustment = (rank: number) => {
    switch (rank) {
      case 1: return { delta: 2, color: "text-[#b6983e]" }; // MVP (Gold-ish)
      case 2: return { delta: 1, color: "text-[#C0C0C0]" }; // Silver
      case 9: return { delta: -1, color: "text-[#804A00]" }; // Deep Bronze
      case 10: return { delta: -2, color: "text-[#7A2E2E]" }; // Darker, Redder Bronze
      default: return { delta: 0, color: "text-stone-300" }; // Iron/Default
    }
  };

  const perfData = performanceRank ? getPerformanceAdjustment(performanceRank) : { delta: 0, color: "text-stone-300" };

  if (delta === 0) {
    return (
      <div className="bg-black/40 p-4 rounded-lg border border-line text-xs text-stone-500 italic text-center mt-2">
        LP is not tracked during placement games.
      </div>
    );
  }

  const getDifficultySentence = () => {
    const buffer = 50;
    const isIndivHigher = individualDisparity > buffer;
    const isIndivLower = individualDisparity < -buffer;
    const isTeamHigher = teamDisparity > buffer;
    const isTeamLower = teamDisparity < -buffer;

    const isFavored = blendedDisparity > buffer;
    const isUnderdog = blendedDisparity < -buffer;

    if (!isFavored && !isUnderdog) {
      return "The lobby skill levels were closely matched, so no significant adjustment was applied.";
    }

    if (isFavored) {
      if (isIndivHigher && isTeamHigher) {
        return win 
          ? "You and your team were both favored in this lobby, resulting in reduced LP gains."
          : "You and your team were both favored in this lobby, resulting in a heavier LP penalty.";
      }
      return win
        ? "You were favored to win this match, resulting in reduced LP gains."
        : "You were favored to win this match, resulting in a heavier LP penalty.";
    } else {
      if (isIndivLower && isTeamLower) {
        return win
          ? "You were personally outranked in an underdog team, granting you substantial bonus LP."
          : "You were personally outranked in an underdog team, resulting in a smaller LP penalty.";
      }
      return win
        ? "You were the underdog in this lobby, granting you a bonus LP adjustment."
        : "You were the underdog in this lobby, resulting in a smaller LP penalty.";
    }
  };

  return (
    <div className="p-4 rounded-lg border border-line text-xs space-y-3 mt-2">
      <div className="flex justify-between border-b border-line pb-2 mb-2">
        <span className="font-bold text-stone-200">LP Calculation Breakdown</span>
        <span className="font-bold text-gold">{delta > 0 ? '+' : ''}{delta} LP</span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-stone-400">
          <span>Base LP</span>
          <span className="text-stone-200">{win ? '' : '-'}{BASE_LP}</span>
        </div>
        
        {rawStreakContribution !== 0 && (
          <div className="flex justify-between text-stone-400">
            <span>{consecutiveStreak >= 0 ? 'Win Streak' : 'Loss Streak'} ({absStreak >= 10 ? '10 MAX' : absStreak})</span>
            <span className={win ? "text-sky-300" : "text-red-400"}>
              {win ? '+' : '-'}{rawStreakContribution} LP
            </span>
          </div>
        )}

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
            displayDifficultyContribution === 0 
              ? "text-stone-300" 
              : (win 
                  ? (displayDifficultyContribution > 0 ? "text-sky-300" : "text-red-400")
                  : (displayDifficultyContribution > 0 ? "text-red-400" : "text-sky-300")
                )
          }>
            {displayDifficultyContribution === 0 ? '0 LP' : (
              win 
                ? (displayDifficultyContribution > 0 ? `+${displayDifficultyContribution}` : `${displayDifficultyContribution}`) 
                : (displayDifficultyContribution > 0 ? `-${displayDifficultyContribution}` : `+${Math.abs(displayDifficultyContribution)}`)
            )} LP
          </span>
        </div>

        <div className="flex justify-between text-stone-400/50 items-center group relative border-t border-line/20 pt-1 mt-1">
          <span className="flex items-center gap-1">
            Performance Adjustment
            <Info size={12} className="text-stone-600 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-black border border-line rounded text-[10px] hidden group-hover:block z-10 space-y-3 opacity-100">
              <p className="font-bold text-gold uppercase tracking-wider">
                Performance Bonus
              </p>
              
              <div className="space-y-1 text-stone-300 leading-relaxed">
                <p>This is a hypothetical adjustment based on your performance rank (1-10) in this match lobby. Performance-based LP modifiers are currently in development and do not affect your actual LP gains yet.</p>
              </div>
            </div>
          </span>
          <span className={`${perfData.color} opacity-50`}>
            {perfData.delta === 0 ? '0 LP' : (perfData.delta > 0 ? `+${perfData.delta} LP` : `${perfData.delta} LP`)}
          </span>
        </div>
      </div>
    </div>
  );
};
