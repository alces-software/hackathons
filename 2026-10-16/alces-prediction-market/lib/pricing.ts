export const PRICE_FLOOR_MB = 0.5;


const SEED_STAKE_MB = 50;


export function priceMbForMarket(
  outcomeStake: number,
  totalStaked: number,
  outcomeCount: number,
): number {
  if (!Number.isFinite(outcomeCount) || outcomeCount < 1) return PRICE_FLOOR_MB;
  const virtualTotal = Math.max(0, totalStaked) + SEED_STAKE_MB * outcomeCount;
  const stakeShare = (Math.max(0, outcomeStake) + SEED_STAKE_MB) / virtualTotal;
  const raw = (PRICE_FLOOR_MB * (1 - 1 / outcomeCount)) / (1 - Math.min(stakeShare, 0.999));
  return Math.max(PRICE_FLOOR_MB, raw);
}

export const PLATFORM_FEE_RATE = 0.02;

export function platformFeeMb(cost: number): number {
  return Number((Math.max(0, cost) * PLATFORM_FEE_RATE).toFixed(2));
}

export function poolContributionMb(cost: number): number {
  return Number((Math.max(0, cost) - platformFeeMb(cost)).toFixed(2));
}

export function payoutPerShareMb(poolMb: number, winningShares: number): number {
  if (winningShares <= 0) return 0;
  return Number((poolMb / winningShares).toFixed(2));
}