export type TierLabel = {
  tier: string;
  division: string | null;
  label: string;
  lp: number | null;
};

export const TIER_ORDER = [
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Emerald",
  "Diamond",
  "Master",
  "Grandmaster",
  "Challenger"
] as const;

const STATIC_BOUNDARIES = [
  ["Iron", "IV", 0],
  ["Iron", "III", 100],
  ["Iron", "II", 200],
  ["Iron", "I", 300],
  ["Bronze", "IV", 400],
  ["Bronze", "III", 500],
  ["Bronze", "II", 600],
  ["Bronze", "I", 700],
  ["Silver", "IV", 800],
  ["Silver", "III", 900],
  ["Silver", "II", 1000],
  ["Silver", "I", 1100],
  ["Gold", "IV", 1200],
  ["Gold", "III", 1300],
  ["Gold", "II", 1400],
  ["Gold", "I", 1500],
  ["Platinum", "IV", 1600],
  ["Platinum", "III", 1700],
  ["Platinum", "II", 1800],
  ["Platinum", "I", 1900],
  ["Emerald", "IV", 2000],
  ["Emerald", "III", 2100],
  ["Emerald", "II", 2200],
  ["Emerald", "I", 2300],
  ["Diamond", "IV", 2400],
  ["Diamond", "III", 2500],
  ["Diamond", "II", 2600],
  ["Diamond", "I", 2700],
  ["Master", null, 2800],
  ["Grandmaster", null, 2900],
  ["Challenger", null, 3000]
] as const;

export function getTierBoundary(tier: string, division: string | null = "IV") {
  return [...STATIC_BOUNDARIES].find(([boundaryTier, boundaryDivision]) => boundaryTier === tier && boundaryDivision === division) ?? null;
}

export function getNextTier(tier: string): string | null {
  const index = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number]);
  if (index === -1 || index === TIER_ORDER.length - 1) {
    return null;
  }

  return TIER_ORDER[index + 1];
}

export function getTierLabel(displayedMmr: number): TierLabel {
  const boundary = [...STATIC_BOUNDARIES]
    .reverse()
    .find(([, , minMmr]) => displayedMmr >= minMmr);

  const [tier, division, minMmr] = boundary ?? STATIC_BOUNDARIES[0];

  if (!division) {
    const lp = Math.max(0, Math.round(displayedMmr - minMmr));
    return {
      tier,
      division,
      label: `${tier} ${lp.toLocaleString()} LP`,
      lp
    };
  }

  return {
    tier,
    division,
    label: `${tier} ${division}`,
    lp: null
  };
}
