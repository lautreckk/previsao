"use client";

import { useEffect, useState } from "react";
import { getMarkets, getBets, getAlerts, initializeStore, tickAllMarkets } from "@/lib/engines/store";
import { generateRiskSnapshot } from "@/lib/engines/risk-engine";
import { CATEGORY_META } from "@/lib/engines/types";
import type { PredictionMarket, Bet, RiskAlert, RiskSnapshot, MarketCategory } from "@/lib/engines/types";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}m atras`;
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function RiskPill({ value, thresholds, format = "pct" }: { value: number; thresholds: [number, number]; format?: "pct" | "raw" }) {
  const color =
    value > thresholds[1] ? "bg-[#ef4444]/10 text-[#ef4444]" :
    value > thresholds[0] ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
    "bg-[#10b981]/10 text-[#10b981]";
  const label = format === "pct" ? `${value.toFixed(1)}%` : value.toFixed(1);
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tight ${color}`}>
      {label}
    </span>
  );
}

export default function AdminMonitor() {
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, RiskSnapshot>>({});

  useEffect(() => {
    initializeStore();
    const refresh = () => {
      const mkts = tickAllMarkets();
      const allBets = getBets();
      setMarkets(mkts); setBets(allBets); setAlerts(getAlerts());
      const snaps: Record<string, RiskSnapshot> = {};
      mkts.filter(m => ["open", "frozen"].includes(m.status)).forEach(m => { snaps[m.id] = generateRiskSnapshot(m, allBets); });
      setSnapshots(snaps);
    };
    refresh();
    const iv = setInterval(refresh, 2000);
    return () => clearInterval(iv);
  }, []);

  const openMarkets = markets.filter(m => ["open", "frozen"].includes(m.status));
  const recentBets = [...bets].sort((a, b) => b.created_at - a.created_at).slice(0, 30);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0f1a" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-tight text-white">
              Live Monitor
            </h1>
            <p className="text-[13px] text-white/40 mt-0.5">
              {openMarkets.length} mercado{openMarkets.length !== 1 ? "s" : ""} ativo{openMarkets.length !== 1 ? "s" : ""} &middot; {bets.length} apostas
            </p>
          </div>
          <div className="flex items-center gap-2.5 bg-[#12101A] border border-white/[0.06] rounded-full px-3.5 py-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]" />
            </span>
            <span className="text-[11px] text-white/50 font-medium tracking-wide uppercase">Tempo real</span>
          </div>
        </div>

        {/* Market Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {openMarkets.map((m) => {
            const snap = snapshots[m.id];
            if (!snap) return null;
            const liabPct = snap.max_liability > 0 ? (snap.pool_total / snap.max_liability) * 100 : 0;
            const isHighRisk = snap.imbalance_ratio > 0.6 || liabPct > 80;
            const meta = CATEGORY_META[m.category as MarketCategory];

            return (
              <div
                key={m.id}
                className="group relative rounded-2xl border transition-all duration-300"
                style={{
                  backgroundColor: "#111827",
                  borderColor: isHighRisk ? "rgba(239, 68, 68, 0.25)" : "rgba(255, 255, 255, 0.06)",
                }}
              >
                {/* Subtle glow on high risk */}
                {isHighRisk && (
                  <div className="absolute inset-0 rounded-2xl opacity-20 pointer-events-none"
                    style={{ boxShadow: "inset 0 0 40px rgba(239, 68, 68, 0.08)" }} />
                )}

                <div className="relative p-5 sm:p-6">
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="material-symbols-outlined text-[15px]"
                          style={{ color: meta?.color }}
                        >
                          {meta?.icon}
                        </span>
                        <span className="text-[11px] font-medium text-white/35 uppercase tracking-widest">
                          {meta?.label}
                        </span>
                      </div>
                      <h3 className="text-[15px] font-semibold text-white leading-snug truncate">
                        {m.title}
                      </h3>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full tracking-wider ${
                        m.status === "open"
                          ? "bg-[#10b981]/10 text-[#10b981]"
                          : "bg-[#f59e0b]/10 text-[#f59e0b]"
                      }`}
                    >
                      {m.status === "open" ? "Aberto" : "Congelado"}
                    </span>
                  </div>

                  {/* Outcome Distribution Bars */}
                  <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6 pb-1">
                    <div className="space-y-2.5 min-w-[280px] mb-5">
                      {m.outcomes.map((o) => {
                        const pct = m.pool_total > 0 ? (o.pool / m.pool_total) * 100 : 0;
                        return (
                          <div key={o.key} className="flex items-center gap-3">
                            <span
                              className="text-[11px] font-medium w-[72px] truncate shrink-0"
                              style={{ color: o.color }}
                            >
                              {o.label}
                            </span>
                            <div className="flex-1 h-[7px] bg-white/[0.04] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                  width: `${Math.max(pct, 1)}%`,
                                  backgroundColor: o.color,
                                  opacity: 0.8,
                                }}
                              />
                            </div>
                            <div className="text-right shrink-0 w-[88px]">
                              <span className="text-[11px] font-medium text-white/50 tabular-nums">
                                R$ {o.pool.toFixed(0)}
                              </span>
                              <span className="text-[10px] text-white/25 ml-1.5 tabular-nums">
                                {o.payout_per_unit.toFixed(2)}x
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Risk Indicators */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-xl px-3 py-2">
                      <span className="text-[10px] text-white/30 uppercase tracking-wide font-medium">Exposicao</span>
                      <RiskPill value={liabPct} thresholds={[50, 80]} />
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-xl px-3 py-2">
                      <span className="text-[10px] text-white/30 uppercase tracking-wide font-medium">Desequilibrio</span>
                      <RiskPill value={snap.imbalance_ratio * 100} thresholds={[40, 60]} />
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-xl px-3 py-2">
                      <span className="text-[10px] text-white/30 uppercase tracking-wide font-medium">Usuarios</span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tight bg-[#3b82f6]/10 text-[#3b82f6]">
                        {snap.unique_users}
                      </span>
                    </div>
                  </div>

                  {/* Top User Concentration Warning */}
                  {snap.top_user_concentration > 0.2 && (
                    <div className="mt-4 flex items-center gap-2.5 bg-[#f59e0b]/[0.06] border border-[#f59e0b]/10 rounded-xl px-3.5 py-2.5">
                      <span className="material-symbols-outlined text-[#f59e0b] text-[16px]">warning</span>
                      <span className="text-[11px] text-[#f59e0b]/80 font-medium">
                        Concentracao de usuario: {(snap.top_user_concentration * 100).toFixed(1)}% do pool
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {openMarkets.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-white/20 text-xl">monitoring</span>
              </div>
              <p className="text-[13px] text-white/30 font-medium">Nenhum mercado aberto</p>
            </div>
          )}
        </div>

        {/* Bet Feed */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "#111827", borderColor: "rgba(255, 255, 255, 0.06)" }}
        >
          {/* Feed Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-white tracking-tight">
              Feed de Apostas
            </h2>
            <span className="text-[11px] text-white/30 font-medium tabular-nums">
              {bets.length} total
            </span>
          </div>

          {/* Bet Cards */}
          <div className="max-h-[480px] overflow-y-auto">
            {recentBets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <p className="text-[13px] text-white/25 font-medium">Nenhuma aposta registrada</p>
              </div>
            ) : (
              <div className="p-3 sm:p-4 space-y-2">
                {recentBets.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors duration-200 hover:bg-white/[0.02]"
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.015)" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0"
                        style={{
                          backgroundColor: "rgba(16, 185, 129, 0.08)",
                          color: "#10b981",
                        }}
                      >
                        {b.outcome_key.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-white truncate">
                          {b.outcome_label}
                        </p>
                        <p className="text-[11px] text-white/25 mt-0.5">
                          {b.user_id.slice(0, 8)}&hellip; &middot; {formatTime(b.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-4">
                      <p className="text-[14px] font-semibold text-white tabular-nums">
                        R$ {b.amount.toFixed(2)}
                      </p>
                      <p className="text-[11px] text-white/25 mt-0.5 tabular-nums">
                        Est. R$ {b.payout_at_entry.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
