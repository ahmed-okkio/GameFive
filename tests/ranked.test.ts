import { describe, expect, it } from "vitest";
import { calculatePlacementMmr, calculateLpDelta } from "@/lib/mmr/calculate";
import { bestRankedMmrWithHistoricalFallback, rankedToMmr } from "@/lib/mmr/ranked";
import { extractBestHistoricalRankFromOpggRsc } from "@/lib/riot/opgg";

describe("MMR/LP Integer Integrity", () => {
  it("ensures LP delta results in a roundable value that behaves as an integer", () => {
    const delta = calculateLpDelta({
      playerCurrentMmr: 1600,
      myTeamAvgMmr: 1600,
      opposingTeamAvgMmr: 1700,
      lobbyAvgFallback: 1650,
      consecutiveStreak: 3,
      win: true
    });
    // 20 * (1700/1600=1.0625) * (1 + 0.15 = 1.15) = 24.4375
    // After Math.round() it should be 24
    const roundedDelta = Math.round(delta);
    expect(Number.isInteger(roundedDelta)).toBe(true);
    expect(roundedDelta).toBe(24);
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
      playerCurrentMmr: 1600,
      myTeamAvgMmr: 1600,
      opposingTeamAvgMmr: 1600,
      lobbyAvgFallback: 1600,
      consecutiveStreak: 0,
      win: true
    });
    expect(delta).toBe(20); // base 20 * 1.0 * 1.0
  });

  it("applies streak multiplier", () => {
    const delta = calculateLpDelta({
      playerCurrentMmr: 1600,
      myTeamAvgMmr: 1600,
      opposingTeamAvgMmr: 1600,
      lobbyAvgFallback: 1600,
      consecutiveStreak: 5,
      win: true
    });
    expect(delta).toBe(25); // 20 * 1.0 * 1.25
  });

  it("handles team disparity", () => {
    const delta = calculateLpDelta({
      playerCurrentMmr: 1600,
      myTeamAvgMmr: 1500,
      opposingTeamAvgMmr: 1800,
      lobbyAvgFallback: 1650,
      consecutiveStreak: 0,
      win: true
    });
    // diff = 1800 - 1500 = 300
    // adjustment = (300 / 600) * 0.3 = 0.15
    // factor = 1 + 0.15 = 1.15
    // lp = 20 * 1.15 = 23
    expect(delta).toBe(23);
  });

  it("handles team disparity (loss mitigation)", () => {
    const delta = calculateLpDelta({
      playerCurrentMmr: 1600,
      myTeamAvgMmr: 1500,
      opposingTeamAvgMmr: 1800,
      lobbyAvgFallback: 1650,
      consecutiveStreak: 0,
      win: false
    });
    // diff = 1500 - 1800 = -300
    // adjustment = (-300 / 600) * 0.3 = -0.15
    // factor = 1 - 0.15 = 0.85
    // lp = 20 * 0.85 = 17
    expect(delta).toBe(17);
  });

  it("clamps opponent factor", () => {
    const delta = calculateLpDelta({
      playerCurrentMmr: 1600,
      myTeamAvgMmr: 1000,
      opposingTeamAvgMmr: 2000,
      lobbyAvgFallback: 1500,
      consecutiveStreak: 0,
      win: true
    });
    // factor = 2000 / 1000 = 2.0 -> clamped to 1.3
    // lp = 20 * 1.3 = 26
    expect(delta).toBe(26);
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
