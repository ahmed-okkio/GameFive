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
    if (input.win) {
        // Win: Gain more if opposing team is stronger
        opponentFactor = opposingTeam / Math.max(myTeam, 1);
    } else {
        // Loss: Lose less if opposing team is stronger (mitigation)
        opponentFactor = myTeam / Math.max(opposingTeam, 1);
    }
    // Clamp to reasonable range (0.7x to 1.3x)
    opponentFactor = Math.min(1.3, Math.max(0.7, opponentFactor));
  }
  
  const streakMultiplier = 1 + (0.05 * Math.min(input.consecutiveStreak, 5));
  
  return BASE_LP * opponentFactor * streakMultiplier;
}
