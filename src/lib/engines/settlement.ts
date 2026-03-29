// ============================================================
// WINIFY - SETTLEMENT ENGINE (Generic Multi-Outcome)
// ============================================================

import { PredictionMarket, Bet, Settlement, LedgerEntry, ResolutionLog } from "./types";
import { settleMarket } from "./parimutuel";

export interface SettlementResult {
  settlement: Settlement;
  updatedBets: Bet[];
  ledgerEntries: LedgerEntry[];
  updatedMarket: PredictionMarket;
  houseFee: number;
  logs: Omit<ResolutionLog, "id">[];
  errors: string[];
}

export function resolveMarket(
  market: PredictionMarket,
  bets: Bet[],
  winningOutcomeKey: string,
  sourcePayload: Record<string, unknown> = {},
  settledBy: string = "system",
  evidence?: string,
  notes?: string
): SettlementResult {
  const errors: string[] = [];
  const logs: Omit<ResolutionLog, "id">[] = [];

  const winningOutcome = market.outcomes.find((o) => o.key === winningOutcomeKey);
  if (!winningOutcome) {
    errors.push(`Outcome ${winningOutcomeKey} nao encontrado`);
    return { settlement: {} as Settlement, updatedBets: [], ledgerEntries: [], updatedMarket: market, houseFee: 0, logs, errors };
  }

  logs.push({ market_id: market.id, step: "evaluate", payload: { winning_outcome: winningOutcomeKey, source: sourcePayload }, result: winningOutcomeKey, timestamp: Date.now() });

  const math = settleMarket(market, winningOutcomeKey);
  const marketBets = bets.filter((b) => b.market_id === market.id && b.status === "pending");
  const updatedBets: Bet[] = [];
  const ledgerEntries: LedgerEntry[] = [];

  for (const bet of marketBets) {
    const isWinner = bet.outcome_key === winningOutcomeKey;
    const finalPayout = isWinner ? bet.amount * math.payoutPerUnit : 0;

    updatedBets.push({ ...bet, status: isWinner ? "won" : "lost", final_payout: finalPayout });

    if (isWinner && finalPayout > 0) {
      ledgerEntries.push({
        id: `ldg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user_id: bet.user_id, type: "bet_won", amount: finalPayout, balance_after: 0,
        reference_id: bet.id, description: `Ganho: ${market.title} - ${bet.outcome_label} (${math.payoutPerUnit.toFixed(2)}x)`,
        created_at: Date.now(),
      });
    }
  }

  if (math.houseFee > 0) {
    ledgerEntries.push({
      id: `ldg_fee_${Date.now()}`, user_id: "HOUSE", type: "fee_collected",
      amount: math.houseFee, balance_after: 0, reference_id: market.id,
      description: `Taxa: ${market.title} (${(market.house_fee_percent * 100).toFixed(1)}%)`,
      created_at: Date.now(),
    });
  }

  const settlement: Settlement = {
    id: `stl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    market_id: market.id,
    winning_outcome_key: winningOutcomeKey,
    winning_outcome_label: winningOutcome.label,
    resolution_type: market.resolution_type,
    source_payload: sourcePayload,
    rule_applied: market.resolution_rule.expression,
    rule_result: winningOutcomeKey,
    total_pool: market.pool_total,
    distributable_pool: math.distributablePool,
    house_fee_collected: math.houseFee,
    total_winners: updatedBets.filter((b) => b.status === "won").length,
    total_losers: updatedBets.filter((b) => b.status === "lost").length,
    total_payout: math.totalPayout,
    payout_per_unit: math.payoutPerUnit,
    settled_at: Date.now(),
    settled_by: settledBy,
    evidence_url: evidence,
    notes,
    audit_hash: `audit_${Math.abs(hashCode(`${market.id}|${market.pool_total}|${winningOutcomeKey}|${Date.now()}`)).toString(16)}`,
  };

  logs.push({ market_id: market.id, step: "settle", payload: { settlement_id: settlement.id, winners: settlement.total_winners, payout: settlement.total_payout }, result: "success", timestamp: Date.now(), admin_id: settledBy });

  const updatedMarket: PredictionMarket = {
    ...market, status: "resolved", winning_outcome_key: winningOutcomeKey,
    resolved_at: Date.now(), resolved_by: settledBy, resolution_tx: settlement.id,
    resolution_evidence: evidence, resolution_notes: notes,
  };

  return { settlement, updatedBets, ledgerEntries, updatedMarket, houseFee: math.houseFee, logs, errors };
}

export function cancelMarket(market: PredictionMarket, bets: Bet[], reason: string, cancelledBy: string) {
  const marketBets = bets.filter((b) => b.market_id === market.id && b.status === "pending");
  const updatedBets = marketBets.map((b) => ({ ...b, status: "refunded" as const, final_payout: b.amount }));
  const ledgerEntries: LedgerEntry[] = marketBets.map((b) => ({
    id: `ldg_ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    user_id: b.user_id, type: "bet_refund" as const, amount: b.amount, balance_after: 0,
    reference_id: b.id, description: `Reembolso: ${market.title} - ${reason}`,
    created_at: Date.now(), created_by: cancelledBy,
  }));
  return { updatedBets, ledgerEntries, updatedMarket: { ...market, status: "cancelled" as const, resolved_at: Date.now() } };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h;
}
