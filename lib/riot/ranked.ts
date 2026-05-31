import { RANKED_QUEUES } from "@/lib/riot/constants";
import type { RiotLeagueEntry } from "@/lib/riot/types";

export type RankedSnapshot = {
  soloDuoTier: string | null;
  soloDuoDivision: string | null;
  flexTier: string | null;
  flexDivision: string | null;
};

export function extractRankedSnapshot(entries: RiotLeagueEntry[]): RankedSnapshot {
  const soloDuo = entries.find((entry) => entry.queueType === RANKED_QUEUES.SOLO_DUO);
  const flex = entries.find((entry) => entry.queueType === RANKED_QUEUES.FLEX);

  return {
    soloDuoTier: soloDuo?.tier ?? null,
    soloDuoDivision: soloDuo?.rank ?? null,
    flexTier: flex?.tier ?? null,
    flexDivision: flex?.rank ?? null
  };
}
