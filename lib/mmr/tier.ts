export type TierLabel = {
  tier: string;
  division: string | null;
  label: string;
  lp: number | null;
};

const STATIC_BOUNDARIES = [
  ["Iron", "IV", 0],
  ["Iron", "III", 100],
  ["Iron", "II", 200],
  ["Iron", "I", 300],
  ["Bronze", "IV", 400],
  ["Bronze", "III", 550],
  ["Bronze", "II", 700],
  ["Bronze", "I", 850],
  ["Silver", "IV", 1000],
  ["Silver", "III", 1125],
  ["Silver", "II", 1250],
  ["Silver", "I", 1375],
  ["Gold", "IV", 1500],
  ["Gold", "III", 1625],
  ["Gold", "II", 1750],
  ["Gold", "I", 1875],
  ["Platinum", "IV", 2000],
  ["Platinum", "III", 2100],
  ["Platinum", "II", 2200],
  ["Platinum", "I", 2300],
  ["Emerald", "IV", 2400],
  ["Emerald", "III", 2500],
  ["Emerald", "II", 2600],
  ["Emerald", "I", 2700],
  ["Diamond", "IV", 2800],
  ["Diamond", "III", 2875],
  ["Diamond", "II", 2950],
  ["Diamond", "I", 3025],
  ["Master", null, 3100],
  ["Grandmaster", null, 3250],
  ["Challenger", null, 3400]
] as const;

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
