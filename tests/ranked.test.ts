import { describe, expect, it } from "vitest";
import { calculatePlacementMmr, calculateLpDelta } from "@/lib/mmr/calculate";
import { bestRankedMmrWithHistoricalFallback, rankedToMmr } from "@/lib/mmr/ranked";
import { extractBestHistoricalRankFromOpggRsc } from "@/lib/riot/opgg";

describe("MMR/LP Integer Integrity", () => {
  it("ensures LP delta results in a roundable value that behaves as an integer", () => {
    const delta = calculateLpDelta({
      individualPlayerMmr: 1600,
      myTeamAvgMmr: 1600,
      opposingTeamAvgMmr: 1700,
      lobbyAvgFallback: 1650,
      consecutiveStreak: 3,
      win: true
    });
    // BASE_LP = 25
    // individualDisparity = 1600 - 1700 = -100
    // teamDisparity = 1600 - 1700 = -100
    // disparity = 0.6*(-100) + 0.4*(-100) = -100
    // sign = -1 (win)
    // adjustment = (-1 * -100 / 1000) * 0.3 = 0.03
    // opponentFactor = 1 + 0.03 = 1.03
    // streakContribution = (3 / 10) * 6 = 1.8
    // delta = (25 * 1.03) + 1.8 = 25.75 + 1.8 = 27.55
    // After Math.round() it should be 28
    const roundedDelta = Math.round(delta);
    expect(Number.isInteger(roundedDelta)).toBe(true);
    expect(roundedDelta).toBe(28);
  });

  it("reproduces the rounding error where components don't sum to total", () => {
    // This test case matches the user's reported scenario:
    // Total LP: +26
    // Base: 25
    // Streak (6): +4
    // Difficulty: -2
    // Sum = 27 (Discrepancy!)
    
    const delta = calculateLpDelta({
      individualPlayerMmr: 1320,
      myTeamAvgMmr: 1320,
      opposingTeamAvgMmr: 1000,
      lobbyAvgFallback: 1160,
      consecutiveStreak: 6,
      win: true
    });
    
    // disparity = 0.6*(320) + 0.4*(320) = 320
    // adjustment = (-1 * 320 / 1000) * 0.3 = -0.096
    // opponentFactor = 0.904
    // streakBonus = (6/10)*6 = 3.6
    // delta_raw = 25 * 0.904 + 3.6 = 22.6 + 3.6 = 26.2
    // Math.round(26.2) is no longer used.
    // Base = 25
    // difficultyAdjustment = round(25 * (0.904 - 1)) = round(-2.4) = -2
    // streakAdjustment = round(3.6) = 4
    // delta = 25 - 2 + 4 = 27
    
    expect(delta).toBe(27);

    // Component calculation (as done in UI)
    const difficultyAdjustment = Math.round(25 * (0.904 - 1)); // -2
    const streakAdjustment = Math.round(3.6); // 4
    const base = 25;
    
    const sum = base + difficultyAdjustment + streakAdjustment;
    expect(sum).toBe(delta); // Should now match perfectly!
  });
});

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
      individualPlayerMmr: 1600,
      myTeamAvgMmr: 1600,
      opposingTeamAvgMmr: 1600,
      lobbyAvgFallback: 1600,
      consecutiveStreak: 0,
      win: true
    });
    expect(delta).toBe(25); // base 25 * 1.0 + 0
  });

  it("applies streak multiplier", () => {
    const delta = calculateLpDelta({
      individualPlayerMmr: 1600,
      myTeamAvgMmr: 1600,
      opposingTeamAvgMmr: 1600,
      lobbyAvgFallback: 1600,
      consecutiveStreak: 5,
      win: true
    });
    // effectiveStreak = 5, streakBonus = (5/10)*6 = 3
    // delta = 25 * 1.0 + 3 = 28
    expect(delta).toBe(28);
  });

  it("handles team disparity", () => {
    const delta = calculateLpDelta({
      individualPlayerMmr: 1600,
      myTeamAvgMmr: 1500,
      opposingTeamAvgMmr: 1800,
      lobbyAvgFallback: 1650,
      consecutiveStreak: 0,
      win: true
    });
    // individualDisparity = 1600 - 1800 = -200
    // teamDisparity = 1500 - 1800 = -300
    // disparity = 0.6*(-200) + 0.4*(-300) = -120 - 120 = -240
    // sign = -1 (win)
    // adjustment = (-1 * -240 / 1000) * 0.3 = 0.24 * 0.3 = 0.072
    // opponentFactor = 1 + 0.072 = 1.072
    // delta = 25 * 1.072 = 26.8 -> rounded to 27
    expect(delta).toBe(27);
  });

  it("handles team disparity (loss mitigation)", () => {
    const delta = calculateLpDelta({
      individualPlayerMmr: 1600,
      myTeamAvgMmr: 1500,
      opposingTeamAvgMmr: 1800,
      lobbyAvgFallback: 1650,
      consecutiveStreak: 0,
      win: false
    });
    // individualDisparity = 1600 - 1800 = -200
    // teamDisparity = 1500 - 1800 = -300
    // disparity = -240
    // sign = 1 (loss)
    // adjustment = (1 * -240 / 1000) * 0.3 = -0.072
    // opponentFactor = 1 - 0.072 = 0.928
    // delta = 25 * 0.928 = 23.2 -> rounded to 23
    expect(delta).toBe(23);
  });

  it("clamps opponent factor", () => {
    const delta = calculateLpDelta({
      individualPlayerMmr: 1600,
      myTeamAvgMmr: 1000,
      opposingTeamAvgMmr: 2000,
      lobbyAvgFallback: 1500,
      consecutiveStreak: 0,
      win: true
    });
    // individualDisparity = 1600 - 2000 = -400
    // teamDisparity = 1000 - 2000 = -1000
    // disparity = 0.6*(-400) + 0.4*(-1000) = -240 - 400 = -640
    // sign = -1 (win)
    // adjustment = (-1 * -640 / 1000) * 0.3 = 0.64 * 0.3 = 0.192
    // opponentFactor = 1.192
    // delta = 25 * 1.192 = 29.8 -> rounded to 30
    expect(delta).toBe(30);
  });
});

describe("rankedToMmr", () => {
  it("accepts OP.GG numeric divisions", () => {
    expect(rankedToMmr("PLATINUM", "3")).toBe(1800);
    expect(rankedToMmr("PLATINUM", "4")).toBe(1700);
  });
});

describe("OP.GG historical ranks", () => {
  it("picks the highest historical season rank from the RSC payload", () => {
    const payload = [
      '0:{"a":"$@1","f":"","b":"1780272246"}',
      '1:{"data":[{"season":"S2025","rank_entries":{"high_rank_info":{"tier":"","lp":null,"tier_image_url":"","tier_mini_image_url":""},"rank_info":{"tier":"gold 3","lp":"65","tier_image_url":"x","tier_mini_image_url":"y"}}},{"season":"S2024 S3","rank_entries":{"high_rank_info":{"tier":"","lp":null,"tier_image_url":"","tier_mini_image_url":""},"rank_info":{"tier":"platinum 4","lp":"16","tier_image_url":"x","tier_mini_image_url":"y"}}}]}'
    ].join("\n");

    const rank = extractBestHistoricalRankFromOpggRsc(payload);

    expect(rank).toEqual({
      season: "S2024 S3",
      tier: "PLATINUM",
      division: "4",
      lp: 16,
      mmr: 1700
    });
  });

  it("uses historical rank as a fallback when current solo/flex data is missing", () => {
    expect(
      bestRankedMmrWithHistoricalFallback({
        soloDuoTier: null,
        soloDuoDivision: null,
        flexTier: null,
        flexDivision: null,
        historicalTier: "PLATINUM",
        historicalDivision: "4"
      })
    ).toBe(1700);
  });
});
