const TIER_BASE: Record<string, number> = {
  IRON: 100,
  BRONZE: 500,
  SILVER: 900,
  GOLD: 1300,
  PLATINUM: 1700,
  EMERALD: 2100,
  DIAMOND: 2500,
  MASTER: 2900,
  GRANDMASTER: 3000,
  CHALLENGER: 3100
};

const DIVISION_OFFSET: Record<string, number> = {
  IV: 0,
  III: 100,
  II: 200,
  I: 300
};

export const DEFAULT_MEDIAN_MMR = 1500;

export function rankedToMmr(
  tier: string | null | undefined,
  division: string | null | undefined
): number | null {
  if (!tier) {
    return null;
  }

  const normalizedTier = tier.toUpperCase();
  const base = TIER_BASE[normalizedTier];

  if (base === undefined) {
    return null;
  }

  if (normalizedTier === "MASTER" || normalizedTier === "GRANDMASTER" || normalizedTier === "CHALLENGER") {
    return base;
  }

  return base + (DIVISION_OFFSET[division?.toUpperCase() ?? "IV"] ?? 0);
}

export function bestRankedMmr(
  soloDuoTier: string | null | undefined,
  soloDuoDivision: string | null | undefined,
  flexTier: string | null | undefined,
  flexDivision: string | null | undefined
): number | null {
  const solo = rankedToMmr(soloDuoTier, soloDuoDivision);
  const flex = rankedToMmr(flexTier, flexDivision);

  if (solo !== null && flex !== null) return Math.max(solo, flex);
  return solo ?? flex;
}
