import { rankedToMmr } from "@/lib/mmr/ranked";

export type PlacementInput = {
  soloDuoTier?: string | null;
  soloDuoDivision?: string | null;
  flexTier?: string | null;
  flexDivision?: string | null;
  mayhemWins: number;
  // New input: Average MMR across placement games
  lobbyAnchorMmr: number | null;
};

export function calculatePlacementMmr(input: PlacementInput): number | null {
  const { mayhemWins, lobbyAnchorMmr } = input;
  
  // Resolve ranked signals
  const soloDuoMmr = rankedToMmr(input.soloDuoTier, input.soloDuoDivision, null);
  const flexMmr = rankedToMmr(input.flexTier, input.flexDivision, null);

  // Requirement: Anchor is lobby average -> best current rank -> defer
  const anchorMmr = lobbyAnchorMmr ?? (soloDuoMmr ?? flexMmr);
  
  if (anchorMmr === null) return null; // Defer placement
  
  const winRateBonus = (mayhemWins - 5) * 100; 
  const mayhemMmr = anchorMmr + winRateBonus;

  if (soloDuoMmr !== null) {
    const flexComponent = flexMmr ?? soloDuoMmr;
    return soloDuoMmr * 0.5 + flexComponent * 0.2 + mayhemMmr * 0.3;
  } else if (flexMmr !== null) {
    return flexMmr * 0.5 + mayhemMmr * 0.5;
  } else {
    return mayhemMmr;
  }
}

export type LpDeltaInput = {
  playerCurrentMmr: number;
  lobbyAvgMmr: number | null; // Allow null
  consecutiveStreak: number;
  win: boolean;
};

export function calculateLpDelta(input: LpDeltaInput): number {
  const BASE_LP = 25;
  
  // Requirement: Neutral factor 1.0 if uncalculable
  let opponentFactor = 1.0;
  if (input.lobbyAvgMmr !== null) {
    opponentFactor = input.lobbyAvgMmr / Math.max(input.playerCurrentMmr, 1);
    opponentFactor = Math.min(2.0, Math.max(0.5, opponentFactor));
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
