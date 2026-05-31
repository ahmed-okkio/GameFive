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
  division: string | null | undefined,
  median: number | null = DEFAULT_MEDIAN_MMR
) {
  if (!tier) {
    return median;
  }

  const normalizedTier = tier.toUpperCase();
  const base = TIER_BASE[normalizedTier];

  if (base === undefined) {
    return median;
  }

  if (normalizedTier === "MASTER" || normalizedTier === "GRANDMASTER" || normalizedTier === "CHALLENGER") {
    return base;
  }

  return base + DIVISION_OFFSET[(division ?? "IV").toUpperCase()];
}

export function bestRankedMmr(
  soloDuoTier: string | null | undefined,
  soloDuoDivision: string | null | undefined,
  flexTier: string | null | undefined,
  flexDivision: string | null | undefined,
  median: number | null = DEFAULT_MEDIAN_MMR
) {
  const solo = rankedToMmr(soloDuoTier, soloDuoDivision, null);
  if (solo !== null) return solo;

  const flex = rankedToMmr(flexTier, flexDivision, null);
  if (flex !== null) return flex;

  return median;
}
