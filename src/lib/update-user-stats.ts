import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAchievements } from "./achievements";

/**
 * Update user stats after bet settlement (win or loss).
 * Increments total_wins/losses, total_returns, win_streak/best_streak.
 * Also checks and grants new achievements.
 * Non-blocking — errors are logged but don't affect settlement.
 */
const CASHBACK_RATE = 0.05; // 5% cashback on losses

export async function updateUserStats(
  supabase: SupabaseClient,
  userId: string,
  isWinner: boolean,
  payout: number,
  betAmount?: number
): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("total_predictions, total_wins, total_losses, total_returns, total_wagered, win_streak, best_streak, cashback_balance, cashback_total_earned")
      .eq("id", userId)
      .maybeSingle();

    if (!user) return;

    const totalWins = (user.total_wins || 0) + (isWinner ? 1 : 0);
    const totalLosses = (user.total_losses || 0) + (isWinner ? 0 : 1);
    const totalReturns = Number(user.total_returns || 0) + payout;
    const winStreak = isWinner ? (user.win_streak || 0) + 1 : 0;
    const bestStreak = Math.max(user.best_streak || 0, winStreak);

    await supabase.from("users").update({
      total_wins: totalWins,
      total_losses: totalLosses,
      total_returns: totalReturns,
      win_streak: winStreak,
      best_streak: bestStreak,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);

    // Accumulate cashback on losses (5% of bet amount)
    if (!isWinner && betAmount && betAmount > 0) {
      const cashback = betAmount * CASHBACK_RATE;
      await supabase.from("users").update({
        cashback_balance: Number(user.cashback_balance || 0) + cashback,
        cashback_total_earned: Number(user.cashback_total_earned || 0) + cashback,
      }).eq("id", userId);
    }

    // Check achievements with updated stats (non-blocking)
    checkAchievements(supabase, userId, {
      total_predictions: user.total_predictions || 0,
      total_wins: totalWins,
      total_losses: totalLosses,
      total_returns: totalReturns,
      total_wagered: Number(user.total_wagered || 0),
      win_streak: winStreak,
      best_streak: bestStreak,
    });
  } catch (err) {
    console.error(`[stats] Failed to update stats for user ${userId}:`, err);
  }
}
