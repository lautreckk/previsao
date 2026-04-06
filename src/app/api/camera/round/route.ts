export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { updateUserStats } from "@/lib/update-user-stats";

const IS_DEV = process.env.NODE_ENV === "development";
const PHASE_DURATION_MS = IS_DEV ? 30_000 : 150_000; // dev: 30s, prod: 2:30

// Fire-and-forget broadcast — subscribe first, then send, then clean up
function broadcast(marketId: string, event: string, payload: Record<string, unknown>) {
  const channelName = `cars-stream-${marketId}`;
  const channel = supabase.channel(channelName);
  channel.subscribe((status: string) => {
    if (status === "SUBSCRIBED") {
      channel.send({ type: "broadcast", event, payload })
        .catch(() => {})
        .finally(() => { supabase.removeChannel(channel); });
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      supabase.removeChannel(channel);
    }
  });
}

async function getLastRounds(marketId: string, limit: number) {
  const { data } = await supabase
    .from("camera_rounds")
    .select("final_count")
    .eq("market_id", marketId)
    .not("final_count", "is", null)
    .order("round_number", { ascending: false })
    .limit(limit);
  return data || [];
}

// Each camera market has a fixed camera_id — no rotation needed

function calculateThreshold(history: { final_count: number }[]): number {
  const validHistory = history.filter((r) => (r.final_count || 0) > 0);
  const avg =
    validHistory.length > 0
      ? Math.round(validHistory.reduce((s, r) => s + r.final_count, 0) / validHistory.length)
      : 50;
  const variation = Math.max(Math.floor(avg * 0.1), 1);
  return Math.max(1, avg + Math.floor(Math.random() * variation * 2) - variation);
}

export async function POST(request: NextRequest) {
  try {
    const { market_id, secret } = await request.json();

    // Accept worker secret (server calls) or allow client calls (round tick is idempotent)
    const hasWorkerAuth = !!process.env.WORKER_SECRET && secret === process.env.WORKER_SECRET;
    // Client calls without secret are allowed but this endpoint only advances rounds
    // when conditions are met (phase expired, etc.) — safe to call without auth
    void hasWorkerAuth;
    if (!market_id) {
      return NextResponse.json({ error: "market_id required" }, { status: 400 });
    }

    const { data: market } = await supabase
      .from("camera_markets")
      .select("*")
      .eq("id", market_id)
      .maybeSingle();

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Don't process closed/disabled cameras
    if (market.status === "closed" || market.status === "disabled") {
      return NextResponse.json({ error: "Market is closed", status: market.status }, { status: 403 });
    }

    const now = new Date();
    const phaseEndsAt = market.phase_ends_at ? new Date(market.phase_ends_at) : null;

    // State machine
    if (market.phase === "waiting") {
      const history = await getLastRounds(market_id, 3);
      const threshold = calculateThreshold(history);
      const newRoundNumber = (market.round_number || 0) + 1;
      const roundId = `cr_${market_id}_${newRoundNumber}`;
      const phaseEnd = new Date(now.getTime() + PHASE_DURATION_MS);

      await supabase.from("camera_rounds").insert({
        id: roundId,
        market_id,
        round_number: newRoundNumber,
        started_at: now.toISOString(),
        ended_at: new Date(now.getTime() + PHASE_DURATION_MS * 2).toISOString(),
        threshold,
        phase: "betting",
        pool_over: 0,
        pool_under: 0,
        total_pool: 0,
      });

      // Keep existing camera_id, title, etc — each market has a fixed camera
      await supabase
        .from("camera_markets")
        .update({
          phase: "betting",
          phase_ends_at: phaseEnd.toISOString(),
          current_threshold: threshold,
          round_number: newRoundNumber,
          current_count: 0,
          status: "open",
          updated_at: now.toISOString(),
        })
        .eq("id", market_id);

      broadcast(market_id, "round.start", {
        round_id: roundId,
        round_number: newRoundNumber,
        threshold,
        phase: "betting",
        phase_ends_at: phaseEnd.toISOString(),
        camera_id: market.camera_id,
        highway: market.highway,
        city: market.city,
      });

      return NextResponse.json({
        action: "round_started",
        round_id: roundId,
        round_number: newRoundNumber,
        threshold,
        phase: "betting",
        phase_ends_at: phaseEnd.toISOString(),
      });
    }

    if (market.phase === "betting" && phaseEndsAt && now >= phaseEndsAt) {
      const phaseEnd = new Date(now.getTime() + PHASE_DURATION_MS);
      const roundId = `cr_${market_id}_${market.round_number}`;

      await supabase.from("camera_rounds").update({ phase: "observation" }).eq("id", roundId);

      await supabase
        .from("camera_markets")
        .update({
          phase: "observation",
          phase_ends_at: phaseEnd.toISOString(),
          status: "open",
          updated_at: now.toISOString(),
        })
        .eq("id", market_id);

      broadcast(market_id, "phase.change", {
        phase: "observation",
        phase_ends_at: phaseEnd.toISOString(),
      });

      return NextResponse.json({
        action: "phase_changed",
        phase: "observation",
        phase_ends_at: phaseEnd.toISOString(),
      });
    }

    if (market.phase === "observation" && phaseEndsAt && now >= phaseEndsAt) {
      const roundId = `cr_${market_id}_${market.round_number}`;
      const finalCount = market.current_count || 0;
      const threshold = market.current_threshold || 0;
      const result = finalCount > threshold ? "over" : "under";

      const { data: round } = await supabase.from("camera_rounds").select("*").eq("id", roundId).maybeSingle();

      const totalPool = Number(round?.total_pool || 0);
      const poolOver = Number(round?.pool_over || 0);
      const poolUnder = Number(round?.pool_under || 0);
      const winningPool = result === "over" ? poolOver : poolUnder;
      const distributable = totalPool * 0.95;
      const payoutMultiplier = winningPool > 0 ? distributable / winningPool : 0;

      const { data: predictions } = await supabase
        .from("camera_predictions")
        .select("*")
        .eq("round_id", roundId)
        .eq("status", "open");

      let winnersCount = 0;
      if (predictions && predictions.length > 0) {
        for (const pred of predictions) {
          const isWinner = pred.prediction_type === result;
          const payout = isWinner ? Number(pred.amount_brl) * payoutMultiplier : 0;

          await supabase.from("camera_predictions").update({
            status: isWinner ? "won" : "lost",
            payout: isWinner ? payout : 0,
          }).eq("id", pred.id);
          updateUserStats(supabase, pred.user_id, isWinner, payout, Number(pred.amount_brl));

          if (isWinner && payout > 0) {
            winnersCount++;
            const { data: user } = await supabase.from("users").select("balance").eq("id", pred.user_id).maybeSingle();
            if (user) {
              const newBal = Number(user.balance) + payout;
              await supabase.from("users").update({ balance: newBal, updated_at: now.toISOString() }).eq("id", pred.user_id);
              await supabase.from("ledger").insert({
                id: `ldg_camwin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                user_id: pred.user_id,
                type: "bet_won",
                amount: payout,
                balance_after: newBal,
                reference_id: pred.id,
                description: `Camera ${result.toUpperCase()}: ${finalCount} veiculos (threshold ${threshold}) ${payoutMultiplier.toFixed(2)}x`,
              });
            }
          }
        }
      }

      await supabase.from("camera_rounds").update({ resolved_at: now.toISOString(), final_count: finalCount }).eq("id", roundId);

      await supabase
        .from("camera_markets")
        .update({ phase: "waiting", phase_ends_at: null, status: "waiting", updated_at: now.toISOString() })
        .eq("id", market_id);

      broadcast(market_id, "round.resolved", {
        final_count: finalCount,
        threshold,
        result,
        payout_multiplier: payoutMultiplier,
        winners: winnersCount,
        total_bets: predictions?.length || 0,
      });

      return NextResponse.json({
        action: "round_resolved",
        round_id: roundId,
        final_count: finalCount,
        threshold,
        result,
        payout_multiplier: payoutMultiplier,
        winners: winnersCount,
      });
    }

    return NextResponse.json({
      action: "no_op",
      phase: market.phase,
      phase_ends_at: market.phase_ends_at,
      remaining_ms: phaseEndsAt ? phaseEndsAt.getTime() - now.getTime() : null,
    });
  } catch (error) {
    console.error("[camera/round] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const marketId = request.nextUrl.searchParams.get("market_id");
  if (!marketId) return NextResponse.json({ error: "market_id required" }, { status: 400 });

  const { data: market } = await supabase
    .from("camera_markets")
    .select("phase, phase_ends_at, current_threshold, round_number, current_count")
    .eq("id", marketId)
    .maybeSingle();

  if (!market) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const roundId = `cr_${marketId}_${market.round_number}`;
  const { data: round } = await supabase.from("camera_rounds").select("*").eq("id", roundId).maybeSingle();

  return NextResponse.json({ market, round });
}
