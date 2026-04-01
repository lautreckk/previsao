// ============================================================
// WINIFY - PARIMUTUEL PRICING ENGINE (MULTI-OUTCOME)
// ============================================================
// Supports ANY number of outcomes (binary, multi, etc.)
// Zero structural loss for the house.
// ============================================================

import { PredictionMarket, MarketOutcome } from "./types";

export function calcDistributablePool(poolTotal: number, houseFeePercent: number): number {
  return poolTotal * (1 - houseFeePercent);
}

export function calcHouseFee(poolTotal: number, houseFeePercent: number): number {
  return poolTotal * houseFeePercent;
}

/**
 * Calculate payout per unit for each outcome
 */
export function calcPayoutsForOutcomes(
  outcomes: MarketOutcome[],
  poolTotal: number,
  houseFeePercent: number
): MarketOutcome[] {
  const distributable = calcDistributablePool(poolTotal, houseFeePercent);
  return outcomes.map((o) => ({
    ...o,
    payout_per_unit: o.pool > 0 ? distributable / o.pool : 0,
  }));
}

/**
 * Calculate implied probability for each outcome
 * Uses virtual seed (R$100 per outcome) so probabilities shift with first bet
 */
export function calcImpliedProbabilities(
  outcomes: MarketOutcome[]
): { key: string; probability: number }[] {
  // Virtual seed: pretend each outcome has R$100 base pool
  // This way, when someone bets R$10 on "Sim", probability goes from 50% to 52.4%
  const SEED = 100;
  const pools = outcomes.map((o) => (o.pool || 0) + SEED);
  const total = pools.reduce((s, p) => s + p, 0);
  return outcomes.map((o, i) => ({ key: o.key, probability: pools[i] / total }));
}

/**
 * Simulate adding a bet to a specific outcome
 */
export function simulateBet(
  market: PredictionMarket,
  outcomeKey: string,
  amount: number
): {
  newOutcomes: MarketOutcome[];
  newPoolTotal: number;
  estimatedReturn: number;
  estimatedPayout: number;
} {
  const newOutcomes = market.outcomes.map((o) => ({
    ...o,
    pool: o.key === outcomeKey ? o.pool + amount : o.pool,
  }));
  const newPoolTotal = market.pool_total + amount;
  const withPayouts = calcPayoutsForOutcomes(newOutcomes, newPoolTotal, market.house_fee_percent);
  const target = withPayouts.find((o) => o.key === outcomeKey);
  const estimatedPayout = target ? target.payout_per_unit : 0;
  const estimatedReturn = amount * estimatedPayout;

  return { newOutcomes: withPayouts, newPoolTotal, estimatedReturn, estimatedPayout };
}

/**
 * Calculate final settlement for a winning outcome
 */
export function settleMarket(
  market: PredictionMarket,
  winningOutcomeKey: string
): {
  winningPool: number;
  losingPool: number;
  distributablePool: number;
  houseFee: number;
  payoutPerUnit: number;
  totalPayout: number;
} {
  const winningOutcome = market.outcomes.find((o) => o.key === winningOutcomeKey);
  const winningPool = winningOutcome?.pool ?? 0;
  const losingPool = market.pool_total - winningPool;
  const distributablePool = calcDistributablePool(market.pool_total, market.house_fee_percent);
  const houseFee = calcHouseFee(market.pool_total, market.house_fee_percent);
  const payoutPerUnit = winningPool > 0 ? distributablePool / winningPool : 0;

  return {
    winningPool,
    losingPool,
    distributablePool,
    houseFee,
    payoutPerUnit,
    totalPayout: distributablePool,
  };
}

/**
 * Recalculate all derived fields on a market
 */
export function recalcMarket(market: PredictionMarket): PredictionMarket {
  const poolTotal = market.outcomes.reduce((s, o) => s + o.pool, 0);
  const distributablePool = calcDistributablePool(poolTotal, market.house_fee_percent);
  const outcomes = calcPayoutsForOutcomes(market.outcomes, poolTotal, market.house_fee_percent);

  return {
    ...market,
    outcomes,
    pool_total: poolTotal,
    distributable_pool: distributablePool,
    volume: poolTotal,
  };
}
