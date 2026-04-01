"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getLevelName } from "@/lib/UserContext";
import BottomNav from "@/components/BottomNav";

type SortKey = "profit" | "wins" | "volume" | "streak";

interface RankedUser {
  id: string;
  name: string;
  avatar_url: string;
  level: number;
  total_predictions: number;
  total_wins: number;
  total_losses: number;
  total_wagered: number;
  total_returns: number;
  best_streak: number;
  rank_position: number;
}

const TABS: { key: SortKey; label: string; icon: string }[] = [
  { key: "profit", label: "Lucro", icon: "trending_up" },
  { key: "wins", label: "Acertos", icon: "check_circle" },
  { key: "volume", label: "Volume", icon: "toll" },
  { key: "streak", label: "Streak", icon: "local_fire_department" },
];

const MEDAL_COLORS = ["#80FF00", "#C0C0C0", "#CD7F32"]; // gold, silver, bronze

export default function RankingPage() {
  const [users, setUsers] = useState<RankedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("profit");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("users")
        .select("id, name, avatar_url, level, total_predictions, total_wins, total_losses, total_wagered, total_returns, best_streak, rank_position")
        .eq("is_public", true)
        .gt("total_predictions", 0)
        .order("total_returns", { ascending: false })
        .limit(200);

      if (data) setUsers(data as RankedUser[]);
      setLoading(false);
    }
    load();
  }, []);

  const sorted = useMemo(() => {
    const copy = [...users];
    switch (sortKey) {
      case "profit":
        return copy.sort((a, b) => (Number(b.total_returns) - Number(b.total_wagered)) - (Number(a.total_returns) - Number(a.total_wagered)));
      case "wins":
        return copy.sort((a, b) => {
          const rateA = a.total_predictions > 0 ? a.total_wins / a.total_predictions : 0;
          const rateB = b.total_predictions > 0 ? b.total_wins / b.total_predictions : 0;
          return rateB - rateA || b.total_wins - a.total_wins;
        });
      case "volume":
        return copy.sort((a, b) => Number(b.total_wagered) - Number(a.total_wagered));
      case "streak":
        return copy.sort((a, b) => b.best_streak - a.best_streak || b.total_wins - a.total_wins);
      default:
        return copy;
    }
  }, [users, sortKey]);

  const top100 = sorted.slice(0, 100);

  function getStatValue(user: RankedUser): string {
    switch (sortKey) {
      case "profit": {
        const p = Number(user.total_returns) - Number(user.total_wagered);
        return `${p >= 0 ? "+" : ""}R$ ${p.toFixed(0)}`;
      }
      case "wins": {
        const rate = user.total_predictions > 0 ? Math.round((user.total_wins / user.total_predictions) * 100) : 0;
        return `${rate}%`;
      }
      case "volume":
        return `R$ ${Number(user.total_wagered).toFixed(0)}`;
      case "streak":
        return `${user.best_streak}x`;
      default:
        return "";
    }
  }

  function getStatColor(user: RankedUser): string {
    if (sortKey === "profit") {
      const p = Number(user.total_returns) - Number(user.total_wagered);
      return p >= 0 ? "#10B981" : "#EF4444";
    }
    return "#80FF00";
  }

  return (
    <div className="min-h-screen bg-[#080d1a] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#080d1a]/90 backdrop-blur-lg border-b border-white/[0.04]">
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#80FF00]/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#80FF00]">leaderboard</span>
          </div>
          <div>
            <h1 className="font-black text-sm uppercase tracking-wider">Ranking</h1>
            <p className="text-[10px] text-white/30">Top 100 previsores</p>
          </div>
        </div>

        {/* Sort tabs */}
        <div className="flex px-2 pb-2 gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSortKey(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                sortKey === t.key
                  ? "bg-[#80FF00]/10 text-[#80FF00] border border-[#80FF00]/20"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              <span className="material-symbols-outlined text-xs">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#80FF00]/30 border-t-[#80FF00] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 py-4">
          {/* Top 3 Podium */}
          {top100.length >= 3 && (
            <div className="flex items-end justify-center gap-3 mb-6 pt-4">
              {[1, 0, 2].map((podiumIdx) => {
                const u = top100[podiumIdx];
                if (!u) return null;
                const pos = podiumIdx + 1;
                const isFirst = pos === 1;
                return (
                  <Link
                    key={u.id}
                    href={`/perfil/${u.id}`}
                    className={`flex flex-col items-center ${isFirst ? "order-2 -mt-4" : pos === 2 ? "order-1" : "order-3"}`}
                  >
                    <div className="relative mb-2">
                      <div
                        className={`rounded-full p-[2px] ${isFirst ? "w-20 h-20" : "w-16 h-16"}`}
                        style={{ background: `linear-gradient(135deg, ${MEDAL_COLORS[podiumIdx]}80, ${MEDAL_COLORS[podiumIdx]})` }}
                      >
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.name} className="w-full h-full rounded-full object-cover border-[2px] border-[#0D0B14]" />
                        ) : (
                          <img
                            src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(u.name)}&backgroundColor=transparent`}
                            alt={u.name}
                            className="w-full h-full rounded-full bg-[#0D0B14] border-[2px] border-[#0D0B14]"
                          />
                        )}
                      </div>
                      <div
                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black"
                        style={{ backgroundColor: MEDAL_COLORS[podiumIdx], color: "#0a0a0a" }}
                      >
                        {pos}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-white truncate max-w-[80px]">{u.name.split(" ")[0]}</span>
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: getStatColor(u) }}>{getStatValue(u)}</span>
                    <span className="text-[8px] text-white/20">{getLevelName(u.level)}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Full list */}
          <div className="bg-[#0D0B14] rounded-2xl border border-white/[0.06] overflow-hidden">
            {top100.map((u, idx) => {
              const pos = idx + 1;
              const isTop3 = pos <= 3;
              return (
                <Link
                  key={u.id}
                  href={`/perfil/${u.id}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors ${idx > 0 ? "border-t border-white/[0.03]" : ""}`}
                >
                  {/* Position */}
                  <div className="w-8 text-center shrink-0">
                    {isTop3 ? (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black mx-auto"
                        style={{ backgroundColor: MEDAL_COLORS[pos - 1], color: "#0a0a0a" }}
                      >
                        {pos}
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-white/30 tabular-nums">{pos}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <img
                      src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(u.name)}&backgroundColor=transparent`}
                      alt={u.name}
                      className="w-9 h-9 rounded-full bg-white/[0.06] shrink-0"
                    />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white truncate">{u.name}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#80FF00]/10 text-[#80FF00] font-bold shrink-0">
                        Lv.{u.level}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/30">
                      {u.total_predictions} previsoes • {u.total_wins}W/{u.total_losses}L
                    </span>
                  </div>

                  {/* Stat */}
                  <div className="text-right shrink-0">
                    <span className="text-sm font-black tabular-nums" style={{ color: getStatColor(u) }}>
                      {getStatValue(u)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {top100.length === 0 && (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-5xl text-white/20">leaderboard</span>
              <p className="mt-2 text-white/30 text-sm">Nenhum usuario no ranking ainda</p>
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
