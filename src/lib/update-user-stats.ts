import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Update user stats after bet settlement (win or loss).
 * Increments total_wins/losses, total_returns, win_streak/best_streak.
 * Non-blocking — errors are logged but don't affect settlement.
 */
export async function updateUserStats(
  supabase: SupabaseClient,
  userId: string,
  isWinner: boolean,
  payout: number
): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("total_wins, total_losses, total_returns, win_streak, best_streak")
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
  } catch (err) {
    console.error(`[stats] Failed to update stats for user ${userId}:`, err);
  }
}
