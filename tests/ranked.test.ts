import { describe, expect, it } from "vitest";
import { calculatePlacementMmr, calculateLpDelta } from "@/lib/mmr/calculate";
import { rankedToMmr } from "@/lib/mmr/ranked";

describe("calculatePlacementMmr", () => {
  it("uses 100% Mayhem win rate weighting when no ranked history exists", () => {
    const mmr = calculatePlacementMmr({
      mayhemWins: 5,
      globalMedianMmr: 1500
    });
    // 5 wins - 5 = 0 bonus => 1500
    expect(mmr).toBe(1500);
  });

  it("adjusts MMR based on win rate and best ranked signal", () => {
    const mmr = calculatePlacementMmr({
      soloDuoTier: "GOLD",
      soloDuoDivision: "II",
      mayhemWins: 6,
      globalMedianMmr: 1500
    });
    // Gold II = 1500. 6 wins => +100 bonus (Mayhem MMR = 1600).
    // SoloDuo (50%) + FlexFallback (20%) + Mayhem (30%)
    // (1500 * 0.5) + (1500 * 0.2) + (1600 * 0.3)
    // 750 + 300 + 480 = 1530
    expect(mmr).toBe(1530);
  });
});

describe("calculateLpDelta", () => {
  it("calculates correct LP delta for a win", () => {
    const delta = calculateLpDelta({
      playerCurrentMmr: 1600,
      lobbyAvgMmr: 1600,
      consecutiveStreak: 0,
      win: true
    });
    expect(delta).toBe(25); // base 25 * 1.0 * 1.0
  });

  it("applies streak multiplier", () => {
    const delta = calculateLpDelta({
      playerCurrentMmr: 1600,
      lobbyAvgMmr: 1600,
      consecutiveStreak: 5,
      win: true
    });
    expect(delta).toBe(31.25); // 25 * 1.0 * 1.25
  });
});
