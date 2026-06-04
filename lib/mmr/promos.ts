import { getNextTier, getTierBoundary, getTierLabel } from "@/lib/mmr/tier";

export type PromoState = {
  promoFromTier: string | null;
  promoToTier: string | null;
  promoWins: number;
  promoLosses: number;
};

export type AppliedPromoState = PromoState & {
  rawMmr: number;
};

function nextTierBoundaryMin(tier: string) {
  const boundary = getTierBoundary(tier, "IV");
  return boundary ? boundary[2] : null;
}

export function getPromoLabel(state: PromoState) {
  if (!state.promoFromTier || !state.promoToTier) {
    return null;
  }

  return `${state.promoFromTier} I PROMO (${state.promoWins}W ${state.promoLosses}L)`;
}

export function applyPromoUpdate(input: {
  previousMmr: number;
  updatedMmr: number;
  win: boolean;
  promo: PromoState;
}): AppliedPromoState {
  const before = getTierLabel(input.previousMmr);
  const after = getTierLabel(input.updatedMmr);

  let promo: PromoState = {
    promoFromTier: input.promo.promoFromTier,
    promoToTier: input.promo.promoToTier,
    promoWins: input.promo.promoWins,
    promoLosses: input.promo.promoLosses
  };

  if (!promo.promoFromTier || !promo.promoToTier) {
    if (before.division === "I" && after.tier !== before.tier) {
      const targetTier = getNextTier(before.tier);
      if (targetTier) {
        promo = {
          promoFromTier: before.tier,
          promoToTier: targetTier,
          promoWins: input.win ? 1 : 0,
          promoLosses: input.win ? 0 : 1
        };
      }
    }

    return {
      rawMmr: input.updatedMmr,
      ...promo
    };
  }

  if (input.win) {
    promo.promoWins += 1;
  } else {
    promo.promoLosses += 1;
  }

  if (promo.promoWins >= 3) {
    return {
      rawMmr: input.updatedMmr,
      promoFromTier: null,
      promoToTier: null,
      promoWins: 0,
      promoLosses: 0
    };
  }

  if (promo.promoLosses >= 3) {
    const targetMin = nextTierBoundaryMin(promo.promoToTier);
    return {
      rawMmr: targetMin !== null ? Math.min(input.updatedMmr, targetMin - 1) : input.updatedMmr,
      promoFromTier: null,
      promoToTier: null,
      promoWins: 0,
      promoLosses: 0
    };
  }

  return {
    rawMmr: input.updatedMmr,
    ...promo
  };
}

export function getPromoRankLabel(input: {
  promoFromTier: string | null;
  promoToTier: string | null;
  promoWins: number;
  promoLosses: number;
  rawMmr: number;
}) {
  const promoLabel = getPromoLabel(input);
  if (promoLabel) {
    return promoLabel;
  }

  return getTierLabel(input.rawMmr).label;
}
