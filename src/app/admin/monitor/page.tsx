"use client";

import { useEffect, useState } from "react";
import { getMarkets, getBets, getAlerts, initializeStore, tickAllMarkets } from "@/lib/engines/store";
import { generateRiskSnapshot } from "@/lib/engines/risk-engine";
import { CATEGORY_META } from "@/lib/engines/types";
import type { PredictionMarket, Bet, RiskAlert, RiskSnapshot, MarketCategory } from "@/lib/engines/types";

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
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <h2 className="font-headline font-black text-2xl tracking-tight">Live Monitor</h2>
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#FF6B5A] animate-pulse" /><span className="text-xs text-[#8B95A8] font-bold">REAL-TIME 2s</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {openMarkets.map((m) => {
          const snap = snapshots[m.id];
          if (!snap) return null;
          const liabPct = snap.max_liability > 0 ? (snap.pool_total / snap.max_liability) * 100 : 0;
          const isHighRisk = snap.imbalance_ratio > 0.6 || liabPct > 80;
          const meta = CATEGORY_META[m.category as MarketCategory];

          return (
            <div key={m.id} className={`bg-[#0f1729] rounded-2xl p-5 border ${isHighRisk ? "border-[#FF6B5A]/40" : "border-white/5"}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-sm" style={{ color: meta?.color }}>{meta?.icon}</span>
                    <span className="text-[10px] font-bold text-[#8B95A8] uppercase tracking-widest">{meta?.label}</span>
                  </div>
                  <h4 className="font-bold font-headline text-sm">{m.title}</h4>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${m.status === "open" ? "bg-[#00D4AA]/10 text-[#00D4AA]" : "bg-[#FFB800]/10 text-[#FFB800]"}`}>{m.status}</span>
              </div>

              {/* Outcome bars */}
              <div className="space-y-1.5 mb-3">
                {m.outcomes.map((o) => {
                  const pct = m.pool_total > 0 ? (o.pool / m.pool_total) * 100 : 0;
                  return (
                    <div key={o.key} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold w-16 truncate" style={{ color: o.color }}>{o.label}</span>
                      <div className="flex-1 h-2 bg-[#212e4a] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: o.color }} />
                      </div>
                      <span className="text-[10px] font-mono text-[#8B95A8] w-20 text-right">R$ {o.pool.toFixed(0)} ({o.payout_per_unit.toFixed(2)}x)</span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-[10px] text-[#8B95A8] uppercase font-bold">Exposicao</p><p className={`font-headline font-black text-sm ${liabPct > 80 ? "text-[#FF6B5A]" : "text-white"}`}>{liabPct.toFixed(1)}%</p></div>
                <div><p className="text-[10px] text-[#8B95A8] uppercase font-bold">Desequilibrio</p><p className={`font-headline font-black text-sm ${snap.imbalance_ratio > 0.6 ? "text-[#FFB800]" : "text-white"}`}>{(snap.imbalance_ratio * 100).toFixed(1)}%</p></div>
                <div><p className="text-[10px] text-[#8B95A8] uppercase font-bold">Usuarios</p><p className="font-headline font-black text-sm text-white">{snap.unique_users}</p></div>
              </div>

              {snap.top_user_concentration > 0.2 && (
                <div className="mt-3 bg-[#FFB800]/10 rounded-xl p-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FFB800] text-sm">warning</span>
                  <span className="text-[10px] text-[#FFB800] font-bold">Concentracao top user: {(snap.top_user_concentration * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>
          );
        })}
        {openMarkets.length === 0 && <div className="col-span-2 text-center py-12 text-[#8B95A8]">Nenhum mercado aberto</div>}
      </div>

      {/* Bet Feed */}
      <div className="bg-[#0f1729] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5"><h3 className="font-headline font-bold text-sm uppercase tracking-wider">Feed de Apostas ({bets.length} total)</h3></div>
        <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
          {recentBets.length === 0 ? <p className="p-6 text-center text-[#8B95A8] text-sm">Nenhuma aposta</p> : recentBets.map((b) => (
            <div key={b.id} className="p-3 flex items-center justify-between hover:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black bg-[#141d30]" style={{ color: "#00D4AA" }}>{b.outcome_key.slice(0, 2)}</div>
                <div><p className="text-xs font-bold">{b.outcome_label}</p><p className="text-[10px] text-[#8B95A8]">{b.user_id.slice(0, 12)}... - {new Date(b.created_at).toLocaleTimeString("pt-BR")}</p></div>
              </div>
              <div className="text-right"><p className="text-sm font-black font-headline">R$ {b.amount.toFixed(2)}</p><p className="text-[10px] text-[#8B95A8]">Est: R$ {b.payout_at_entry.toFixed(2)}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
