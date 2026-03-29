// ============================================================
// WINIFY - RISK ENGINE (Generic Multi-Outcome)
// ============================================================

import { PredictionMarket, Bet, RiskAlert, RiskSnapshot, PlatformConfig, DEFAULT_CONFIG } from "./types";
import { calcDistributablePool } from "./parimutuel";

export interface RiskCheck {
  allowed: boolean;
  reason?: string;
  alert?: Omit<RiskAlert, "id" | "created_at" | "resolved" | "resolved_at" | "resolved_by">;
}

export function validateBet(
  market: PredictionMarket,
  userId: string,
  outcomeKey: string,
  amount: number,
  userBalance: number,
  userBetsInMarket: Bet[],
  config: PlatformConfig = DEFAULT_CONFIG
): RiskCheck {
  if (market.status !== "open") {
    return { allowed: false, reason: `Mercado nao esta aberto (status: ${market.status})` };
  }

  const now = Date.now();
  if (now >= market.freeze_at) return { allowed: false, reason: "Mercado congelado" };
  if (now >= market.close_at) return { allowed: false, reason: "Mercado fechado" };

  const outcome = market.outcomes.find((o) => o.key === outcomeKey);
  if (!outcome) return { allowed: false, reason: "Outcome invalido" };

  if (amount < market.min_bet) return { allowed: false, reason: `Aposta minima: R$ ${market.min_bet.toFixed(2)}` };
  if (amount > market.max_bet) return { allowed: false, reason: `Aposta maxima: R$ ${market.max_bet.toFixed(2)}` };
  if (userBalance < amount) return { allowed: false, reason: `Saldo insuficiente (R$ ${userBalance.toFixed(2)})` };

  // User limit per market
  const userTotal = userBetsInMarket.filter((b) => b.status === "pending").reduce((s, b) => s + b.amount, 0);
  const userMaxPerMarket = market.max_bet * 5;
  if (userTotal + amount > userMaxPerMarket) {
    return { allowed: false, reason: `Limite por usuario neste mercado: R$ ${userMaxPerMarket.toFixed(2)}` };
  }

  // Max liability
  const newPoolTotal = market.pool_total + amount;
  if (newPoolTotal > market.max_liability) {
    return {
      allowed: false,
      reason: "Mercado atingiu limite de exposicao",
      alert: { market_id: market.id, type: "exposure", severity: "high", message: `Liability limit: ${newPoolTotal}/${market.max_liability}`, data: { pool_total: newPoolTotal, max_liability: market.max_liability } },
    };
  }

  // Concentration check - user > 30% of one outcome
  const userOutcomeBets = userBetsInMarket.filter((b) => b.outcome_key === outcomeKey && b.status === "pending").reduce((s, b) => s + b.amount, 0);
  const newUserOutcome = userOutcomeBets + amount;
  const newOutcomePool = outcome.pool + amount;
  if (newOutcomePool > 0 && newUserOutcome / newOutcomePool > 0.3 && newOutcomePool > 500) {
    return {
      allowed: false,
      reason: "Concentracao muito alta neste outcome (>30%)",
      alert: { market_id: market.id, type: "concentration", severity: "medium", message: `User ${userId} concentration > 30% on ${outcomeKey}`, data: { user_id: userId, concentration: newUserOutcome / newOutcomePool } },
    };
  }

  return { allowed: true };
}

export function generateRiskSnapshot(market: PredictionMarket, bets: Bet[]): RiskSnapshot {
  const marketBets = bets.filter((b) => b.market_id === market.id && b.status === "pending");
  const uniqueUsers = new Set(marketBets.map((b) => b.user_id)).size;

  const userAmounts: Record<string, number> = {};
  marketBets.forEach((b) => { userAmounts[b.user_id] = (userAmounts[b.user_id] || 0) + b.amount; });
  const maxUserAmount = Math.max(0, ...Object.values(userAmounts));
  const topConcentration = market.pool_total > 0 ? maxUserAmount / market.pool_total : 0;

  const pools = market.outcomes.map((o) => o.pool);
  const maxPool = Math.max(0, ...pools);
  const minPool = Math.min(Infinity, ...pools);
  const imbalance = market.pool_total > 0 ? (maxPool - minPool) / market.pool_total : 0;

  const distributable = calcDistributablePool(market.pool_total, market.house_fee_percent);

  return {
    market_id: market.id,
    timestamp: Date.now(),
    outcomes: market.outcomes.map((o) => ({ key: o.key, pool: o.pool, payout: o.pool > 0 ? distributable / o.pool : 0 })),
    pool_total: market.pool_total,
    max_liability: market.max_liability,
    imbalance_ratio: imbalance,
    unique_users: uniqueUsers,
    top_user_concentration: topConcentration,
  };
}

export function checkMarketAlerts(market: PredictionMarket, bets: Bet[]): Omit<RiskAlert, "id" | "created_at" | "resolved" | "resolved_at" | "resolved_by">[] {
  const alerts: Omit<RiskAlert, "id" | "created_at" | "resolved" | "resolved_at" | "resolved_by">[] = [];
  const snap = generateRiskSnapshot(market, bets);

  if (snap.imbalance_ratio > 0.7 && market.pool_total > 1000) {
    alerts.push({ market_id: market.id, type: "concentration", severity: "medium", message: `Desequilibrio de pool: ${(snap.imbalance_ratio * 100).toFixed(1)}%`, data: { imbalance: snap.imbalance_ratio } });
  }
  if (snap.top_user_concentration > 0.4) {
    alerts.push({ market_id: market.id, type: "concentration", severity: "high", message: `Top user: ${(snap.top_user_concentration * 100).toFixed(1)}% do pool`, data: { concentration: snap.top_user_concentration } });
  }
  const liabilityPct = market.max_liability > 0 ? market.pool_total / market.max_liability : 0;
  if (liabilityPct > 0.8) {
    alerts.push({ market_id: market.id, type: "exposure", severity: liabilityPct > 0.95 ? "critical" : "high", message: `Exposicao: ${(liabilityPct * 100).toFixed(1)}% do limite`, data: { pool_total: market.pool_total, max_liability: market.max_liability } });
  }

  return alerts;
}
