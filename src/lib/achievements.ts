import type { SupabaseClient } from "@supabase/supabase-js";

export interface AchievementDef {
  key: string;
  label: string;
  description: string;
  icon: string;
  check: (stats: UserStats) => boolean;
}

interface UserStats {
  total_predictions: number;
  total_wins: number;
  total_losses: number;
  total_returns: number;
  total_wagered: number;
  win_streak: number;
  best_streak: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Prediction milestones
  { key: "first_bet", label: "Primeira Aposta", description: "Fez sua primeira previsao", icon: "🎯", check: (s) => s.total_predictions >= 1 },
  { key: "bets_10", label: "Iniciante", description: "10 previsoes feitas", icon: "📊", check: (s) => s.total_predictions >= 10 },
  { key: "bets_50", label: "Frequente", description: "50 previsoes feitas", icon: "🔥", check: (s) => s.total_predictions >= 50 },
  { key: "bets_100", label: "Centenario", description: "100 previsoes feitas", icon: "💯", check: (s) => s.total_predictions >= 100 },
  { key: "bets_500", label: "Veterano", description: "500 previsoes feitas", icon: "🏆", check: (s) => s.total_predictions >= 500 },

  // Win milestones
  { key: "first_win", label: "Primeiro Acerto", description: "Ganhou sua primeira previsao", icon: "✅", check: (s) => s.total_wins >= 1 },
  { key: "wins_10", label: "Visionario", description: "10 previsoes certas", icon: "👁️", check: (s) => s.total_wins >= 10 },
  { key: "wins_50", label: "Oraculo", description: "50 previsoes certas", icon: "🔮", check: (s) => s.total_wins >= 50 },
  { key: "wins_100", label: "Profeta", description: "100 previsoes certas", icon: "⚡", check: (s) => s.total_wins >= 100 },

  // Streak achievements
  { key: "streak_3", label: "Hat-trick", description: "3 acertos seguidos", icon: "🎩", check: (s) => s.best_streak >= 3 },
  { key: "streak_5", label: "Em Chamas", description: "5 acertos seguidos", icon: "🔥", check: (s) => s.best_streak >= 5 },
  { key: "streak_10", label: "Imparavel", description: "10 acertos seguidos", icon: "💎", check: (s) => s.best_streak >= 10 },
  { key: "streak_20", label: "Lendario", description: "20 acertos seguidos", icon: "👑", check: (s) => s.best_streak >= 20 },

  // Profit milestones
  { key: "profit_100", label: "Lucrativo", description: "R$ 100 de lucro acumulado", icon: "💰", check: (s) => (s.total_returns - s.total_wagered) >= 100 },
  { key: "profit_1000", label: "Investidor", description: "R$ 1.000 de lucro acumulado", icon: "💎", check: (s) => (s.total_returns - s.total_wagered) >= 1000 },
  { key: "profit_10000", label: "Magnata", description: "R$ 10.000 de lucro acumulado", icon: "🏦", check: (s) => (s.total_returns - s.total_wagered) >= 10000 },

  // Volume milestones
  { key: "wagered_500", label: "Apostador", description: "R$ 500 apostados no total", icon: "🎰", check: (s) => s.total_wagered >= 500 },
  { key: "wagered_5000", label: "High Roller", description: "R$ 5.000 apostados no total", icon: "🃏", check: (s) => s.total_wagered >= 5000 },
];

/**
 * Check and grant new achievements for a user.
 * Called after stats are updated. Non-blocking.
 */
export async function checkAchievements(
  supabase: SupabaseClient,
  userId: string,
  stats: UserStats
): Promise<string[]> {
  const newlyUnlocked: string[] = [];

  try {
    // Get already unlocked achievements
    const { data: existing } = await supabase
      .from("user_achievements")
      .select("achievement_key")
      .eq("user_id", userId);

    const unlocked = new Set((existing || []).map((a: { achievement_key: string }) => a.achievement_key));

    // Check each achievement
    const toInsert: { user_id: string; achievement_key: string }[] = [];
    for (const achievement of ACHIEVEMENTS) {
      if (unlocked.has(achievement.key)) continue;
      if (achievement.check(stats)) {
        toInsert.push({ user_id: userId, achievement_key: achievement.key });
        newlyUnlocked.push(achievement.key);
      }
    }

    if (toInsert.length > 0) {
      await supabase.from("user_achievements").insert(toInsert);
    }
  } catch (err) {
    console.error(`[achievements] Error checking for user ${userId}:`, err);
  }

  return newlyUnlocked;
}
