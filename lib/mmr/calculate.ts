export type PlacementInput = {
  mayhemWins: number;
  placementLobbyAvgMmr: number | null;
};

export function calculatePlacementMmr(input: PlacementInput): number {
  const { mayhemWins, placementLobbyAvgMmr } = input;
  const GOLD_3_MMR = 1400;

  // Requirement: Anchor is lobby average -> Gold III fallback
  const anchorMmr = placementLobbyAvgMmr ?? GOLD_3_MMR;

  const winRateBonus = (mayhemWins - 5) * 100; 
  return anchorMmr + winRateBonus;
}

export type LpDeltaInput = {
  individualPlayerMmr: number;
  myTeamAvgMmr: number | null;
  opposingTeamAvgMmr: number | null;
  lobbyAvgFallback: number | null;
  consecutiveStreak: number;
  win: boolean;
};

export function calculateLpDelta(input: LpDeltaInput): number {
  if (input.individualPlayerMmr === input.myTeamAvgMmr) {
      console.warn("calculateLpDelta: individualPlayerMmr equals myTeamAvgMmr. Is this intended?");
  }

  const BASE_LP = 25;

  const myTeam = input.myTeamAvgMmr ?? input.lobbyAvgFallback;
  const opposingTeam = input.opposingTeamAvgMmr ?? input.lobbyAvgFallback;

  let opponentFactor = 1.0;
  if (myTeam !== null && opposingTeam !== null) {
    // 1. Blended disparity: 70% individual, 30% team
    const individualDisparity = input.individualPlayerMmr - opposingTeam;
    const teamDisparity = myTeam - opposingTeam;
    const disparity = 0.6 * individualDisparity + 0.4 * teamDisparity;

    // For a WIN: 
    // If we are stronger (positive disparity), we gain LESS LP -> subtract disparity
    // For a LOSS:
    // If we are stronger (positive disparity), we lose MORE LP -> add disparity
    const sign = input.win ? -1 : 1;

    // Win: 600 MMR difference = 0.3 factor shift
    // Loss: 1000 MMR difference = 0.3 factor shift
    const divisor = 1000;
    const adjustment = (sign * disparity / divisor) * 0.3;

    // Apply adjustment and clamp to 0.7 - 1.3 range
    opponentFactor = Math.min(1.3, Math.max(0.7, 1 + adjustment));
  }

  const absStreak = Math.abs(input.consecutiveStreak);
  const effectiveStreak = absStreak >= 3 ? Math.min(absStreak, 10) : 0;
  const streakBonus = (effectiveStreak / 10) * 6;

  const difficultyAdjustment = Math.round(BASE_LP * (opponentFactor - 1));
  const streakAdjustment = Math.round(streakBonus);

  return BASE_LP + difficultyAdjustment + streakAdjustment;
}
