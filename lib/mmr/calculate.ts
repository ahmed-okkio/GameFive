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
  playerCurrentMmr: number;
  myTeamAvgMmr: number | null;
  opposingTeamAvgMmr: number | null;
  lobbyAvgFallback: number | null;
  consecutiveStreak: number;
  win: boolean;
};

export function calculateLpDelta(input: LpDeltaInput): number {
  const BASE_LP = 20;
  
  const myTeam = input.myTeamAvgMmr ?? input.lobbyAvgFallback;
  const opposingTeam = input.opposingTeamAvgMmr ?? input.lobbyAvgFallback;

  let opponentFactor = 1.0;
  if (myTeam !== null && opposingTeam !== null) {
    const diff = input.win 
      ? (opposingTeam - myTeam) // Winning against stronger team
      : (myTeam - opposingTeam); // Losing against weaker team

    // Win: 600 MMR difference = 0.3 factor shift
    // Loss: 1000 MMR difference = 0.3 factor shift
    const divisor = input.win ? 1000 : 1500;
    const adjustment = (diff / divisor) * 0.3;
    
    // Apply adjustment and clamp to 0.7 - 1.3 range
    opponentFactor = Math.min(1.3, Math.max(0.7, 1 + adjustment));
  }
  
  const streakMultiplier = 1 + (0.05 * Math.min(input.consecutiveStreak, 5));
  
  let delta = BASE_LP * opponentFactor * streakMultiplier;

  // Apply bias:
  if (input.win) {
    // For wins, ensure the gain is at least 16 (if we were gaining less)
    delta = Math.max(16, delta);
  } else {
    // For losses, ensure the penalty is no more than 25 (if we were losing more)
    delta = Math.min(25, delta);
  }
  
  return Math.round(delta);
}
