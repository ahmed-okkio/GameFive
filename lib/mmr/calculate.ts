import { rankedToMmr } from "@/lib/mmr/ranked";

export type MmrGame = {
  gameDate: Date;
  win: boolean;
  performanceScore?: number; // No longer used, but kept for type compatibility during transition
  lobbyAvgMmr: number | null;
  gameMode: "MAYHEM";
};

export type PlacementInput = {
  soloDuoTier?: string | null;
  soloDuoDivision?: string | null;
  flexTier?: string | null;
  flexDivision?: string | null;
  historicalTier?: string | null;
  historicalDivision?: string | null;
  mayhemWins: number;
  globalMedianMmr: number;
};

export function calculatePlacementMmr(input: PlacementInput): number {
  const { globalMedianMmr, mayhemWins } = input;
  
  // Resolve ranked signals
  const soloDuoMmr = rankedToMmr(input.soloDuoTier, input.soloDuoDivision, null);
  const flexMmr = rankedToMmr(input.flexTier, input.flexDivision, null);
  const historicalMmr = rankedToMmr(input.historicalTier, input.historicalDivision, null);

  const bestCurrentRanked = soloDuoMmr ?? flexMmr ?? historicalMmr;
  
  // Win rate component (30% weight usually)
  // Win rate anchored around the best available ranked signal, or global median
  const anchorMmr = bestCurrentRanked ?? globalMedianMmr;
  const winRateBonus = (mayhemWins - 5) * 100; // +100 for each win above 5, -100 for each below
  const mayhemMmr = anchorMmr + winRateBonus;

  if (soloDuoMmr !== null) {
    // Standard weights: 50% Solo, 20% Flex, 30% Mayhem
    const flexComponent = flexMmr ?? soloDuoMmr; // Use solo as fallback for flex if solo exists
    return soloDuoMmr * 0.5 + flexComponent * 0.2 + mayhemMmr * 0.3;
  } else if (flexMmr !== null || historicalMmr !== null) {
    // No Solo/Duo: 30% Flex/Historical, 70% Mayhem (wait, spec says "total Mayhem win rate becomes 50%")
    // Spec: "Redistribute Solo/Duo's 50% as: Flex 30%, Mayhem win rate 20% (total Mayhem win rate becomes 50%)"
    const bestFlexHist = flexMmr ?? historicalMmr!;
    return bestFlexHist * (0.2 + 0.3) + mayhemMmr * (0.3 + 0.2); // 50% Flex/Hist, 50% Mayhem
  } else {
    // No ranked data at all: 100% Mayhem
    return mayhemMmr;
  }
}

export type LpDeltaInput = {
  playerCurrentMmr: number;
  lobbyAvgMmr: number;
  consecutiveStreak: number;
  win: boolean;
};

export function calculateLpDelta(input: LpDeltaInput): number {
  const BASE_LP = 25;
  
  let opponentFactor = input.lobbyAvgMmr / Math.max(input.playerCurrentMmr, 1);
  opponentFactor = Math.min(2.0, Math.max(0.5, opponentFactor));
  
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
