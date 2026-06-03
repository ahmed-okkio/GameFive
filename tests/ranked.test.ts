import { describe, expect, it } from "vitest";
import { calculatePlacementMmr, calculateLpDelta } from "@/lib/mmr/calculate";
import { rankedToMmr } from "@/lib/mmr/ranked";

describe("calculatePlacementMmr", () => {
  it("uses fallback when no lobby MMR exists", () => {
    const mmr = calculatePlacementMmr({
      mayhemWins: 5,
      placementLobbyAvgMmr: null
    });
    // 5 wins - 5 = 0 bonus => 1400 (GOLD_3_MMR)
    expect(mmr).toBe(1400);
  });

  it("adjusts MMR based on win rate and lobby average", () => {
    const mmr = calculatePlacementMmr({
      mayhemWins: 6,
      placementLobbyAvgMmr: 1500
    });
    // 6 wins => +100 bonus (1500 + 100 = 1600)
    expect(mmr).toBe(1600);
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
