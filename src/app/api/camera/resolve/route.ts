export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gqymalmbbtzdnpbneegg.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export async function GET() {
  try {
    const now = new Date().toISOString();

    // Find rounds that ended and not yet resolved
    const { data: rounds } = await supabase
      .from("camera_rounds")
      .select("*")
      .lte("ended_at", now)
      .is("resolved_at", null);

    if (!rounds || rounds.length === 0) {
      return NextResponse.json({ message: "No rounds to resolve", resolved: 0 });
    }

    let totalResolved = 0;

    for (const round of rounds) {
      const finalCount = round.final_count || 0;
      const threshold = round.threshold || 0;
      const result = finalCount > threshold ? "over" : "under";

      // Get all open predictions for this round
      const { data: predictions } = await supabase
        .from("camera_predictions")
        .select("*")
        .eq("round_id", round.id)
        .eq("status", "open");

      if (!predictions || predictions.length === 0) {
        await supabase.from("camera_rounds").update({ resolved_at: now }).eq("id", round.id);
        totalResolved++;
        continue;
      }

      // Calculate pools
      const totalPool = Number(round.total_pool) || predictions.reduce((sum: number, p: { amount_brl: number }) => sum + Number(p.amount_brl), 0);
      const winningPool = predictions
        .filter((p: { prediction_type: string }) => p.prediction_type === result)
        .reduce((sum: number, p: { amount_brl: number }) => sum + Number(p.amount_brl), 0);

      // House fee 5%
      const distributable = totalPool * 0.95;
      const payoutMultiplier = winningPool > 0 ? distributable / winningPool : 0;

      for (const pred of predictions) {
        const isWinner = pred.prediction_type === result;
        const payout = isWinner ? Number(pred.amount_brl) * payoutMultiplier : 0;

        await supabase.from("camera_predictions").update({
          status: isWinner ? "won" : "lost",
          payout: isWinner ? payout : 0,
        }).eq("id", pred.id);

        if (isWinner && payout > 0) {
          const { data: user } = await supabase.from("users").select("balance").eq("id", pred.user_id).maybeSingle();
          if (user) {
            const newBal = Number(user.balance) + payout;
            await supabase.from("users").update({ balance: newBal, updated_at: now }).eq("id", pred.user_id);
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

      await supabase.from("camera_rounds").update({
        resolved_at: now,
        final_count: finalCount,
      }).eq("id", round.id);

      totalResolved++;
      console.log(`[resolve] Round ${round.id}: count=${finalCount}, threshold=${threshold}, result=${result}, pool=R$${totalPool.toFixed(2)}`);
    }

    return NextResponse.json({ resolved: totalResolved });
  } catch (error) {
    console.error("[camera/resolve] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
