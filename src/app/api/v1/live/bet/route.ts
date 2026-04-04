export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { apiSuccess, apiError, validateApiKey } from "../../_lib/auth";
import { getUserIdFromRequest } from "@/lib/session-token";
import { createClient } from "@supabase/supabase-js";

const sb = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * POST /api/v1/live/bet
 *
 * Place a bet on an active live round.
 * user_id is resolved from session token (for clients) or body (for internal/API key calls).
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return apiError(auth.error!, 401, "UNAUTHORIZED");

  let body: { round_id: string; user_id?: string; outcome: string; amount: number };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const { round_id, outcome, amount } = body;

  // IDOR protection: for internal keys (system/cron/worker), allow body user_id
  // For client API keys, prefer session token
  const isInternalKey = auth.key?.owner_id === "system";
  const session_user_id = getUserIdFromRequest(request);
  const user_id = session_user_id || (isInternalKey ? body.user_id : null) || body.user_id;

  if (!user_id) {
    return apiError("user_id required (via session token or body for internal keys)", 401, "UNAUTHORIZED");
  }

  if (!round_id || !outcome || !amount) {
    return apiError("Required: round_id, outcome, amount", 400);
  }

  if (!["UP", "DOWN"].includes(outcome)) {
    return apiError("outcome must be UP or DOWN", 400);
  }

  if (amount < 1 || amount > 10000) {
    return apiError("amount must be between R$1 and R$10,000", 400);
  }

  const supabase = sb();

  // Verify round is in betting phase
  const { data: round, error: roundErr } = await supabase
    .from("live_rounds")
    .select("*")
    .eq("id", round_id)
    .single();

  if (roundErr || !round) {
    return apiError("Round not found", 404);
  }

  if (round.status !== "betting") {
    return apiError(`Round is in '${round.status}' phase. Betting is closed.`, 400, "BETTING_CLOSED");
  }

  if (new Date(round.betting_ends_at as string).getTime() < Date.now()) {
    return apiError("Betting window has closed", 400, "BETTING_CLOSED");
  }

  // Check user balance
  const { data: user } = await supabase
    .from("users")
    .select("balance")
    .eq("id", user_id)
    .single();

  if (!user) return apiError("User not found", 404);
  if ((user.balance as number) < amount) {
    return apiError(`Insufficient balance: R$${user.balance} < R$${amount}`, 400, "INSUFFICIENT_BALANCE");
  }

  // Calculate current odds
  const poolUp = (round.pool_up as number) + (outcome === "UP" ? amount : 0);
  const poolDown = (round.pool_down as number) + (outcome === "DOWN" ? amount : 0);
  const poolTotal = poolUp + poolDown;
  const distributable = poolTotal * 0.95;
  const myPool = outcome === "UP" ? poolUp : poolDown;
  const estimatedPayout = myPool > 0 ? distributable / myPool : 0;

  // Deduct balance
  const { error: balErr } = await supabase.rpc("decrement_balance", {
    user_id_param: user_id,
    amount_param: amount,
  });
  if (balErr) return apiError(`Balance deduction failed: ${balErr.message}`, 500);

  // Create bet
  const { data: bet, error: betErr } = await supabase
    .from("live_bets")
    .insert({
      round_id,
      user_id,
      outcome,
      amount,
      odds_at_entry: estimatedPayout,
      status: "pending",
    })
    .select()
    .single();

  if (betErr) {
    // Refund on error
    await supabase.rpc("increment_balance", { user_id_param: user_id, amount_param: amount });
    return apiError(`Bet creation failed: ${betErr.message}`, 500);
  }

  // Update round pools
  const poolUpdate = outcome === "UP"
    ? { pool_up: poolUp, pool_total: poolTotal }
    : { pool_down: poolDown, pool_total: poolTotal };

  await supabase.from("live_rounds").update(poolUpdate).eq("id", round_id);

  // Ledger entry
  await supabase.from("ledger").insert({
    user_id,
    type: "bet_placed",
    amount: -amount,
    balance_after: (user.balance as number) - amount,
    reference_id: bet.id,
    description: `Live ${round.symbol}: ${outcome} (${estimatedPayout.toFixed(2)}x)`,
  });

  return apiSuccess({
    bet_id: bet.id,
    round_id,
    outcome,
    amount,
    estimated_payout: parseFloat(estimatedPayout.toFixed(4)),
    estimated_return: parseFloat((amount * estimatedPayout).toFixed(2)),
    round_ends_at: round.ends_at,
    betting_ends_at: round.betting_ends_at,
  });
}
