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
  lobbyAvgMmr: number | null; // Allow null
  consecutiveStreak: number;
  win: boolean;
};

export function calculateLpDelta(input: LpDeltaInput): number {
  const BASE_LP = 20;
  
  let opponentFactor = 1.0;
  if (input.lobbyAvgMmr !== null) {
    if (input.win) {
        // Win: Gain more for higher lobby MMR
        opponentFactor = input.lobbyAvgMmr / Math.max(input.playerCurrentMmr, 1);
    } else {
        // Loss: Lose less for higher lobby MMR (mitigation)
        opponentFactor = input.playerCurrentMmr / Math.max(input.lobbyAvgMmr, 1);
    }
    // Clamp to reasonable range (0.7x to 1.3x)
    opponentFactor = Math.min(1.3, Math.max(0.7, opponentFactor));
  }
  
  const streakMultiplier = 1 + (0.05 * Math.min(input.consecutiveStreak, 5));
  
  return BASE_LP * opponentFactor * streakMultiplier;
}

// Kept for backward compatibility during transition if needed, but will be removed
export function calculateMmr() {
    return {
        rawMmr: 0,
        displayedMmr: 0,
        uncertainty: 0,
        decayAmount: 0,
        mayhemGames: 0,
        aramGames: 0
    };
}
