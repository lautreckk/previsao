"use client";

import { useEffect, useState } from "react";
import { getLedger, getSettlements, getBets, initializeStore } from "@/lib/engines/store";
import type { LedgerEntry, Settlement } from "@/lib/engines/types";

export default function AdminFinance() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    initializeStore();
    setLedger(getLedger());
    setSettlements(getSettlements());
  }, []);

  const filteredLedger = filter === "all" ? ledger : ledger.filter((l) => l.type === filter);
  const totalFees = settlements.reduce((s, st) => s + st.house_fee_collected, 0);
  const totalDeposits = ledger.filter((l) => l.type === "deposit").reduce((s, l) => s + l.amount, 0);
  const totalPayouts = ledger.filter((l) => l.type === "bet_won").reduce((s, l) => s + l.amount, 0);
  const totalBetVolume = ledger.filter((l) => l.type === "bet_placed").reduce((s, l) => s + Math.abs(l.amount), 0);

  const typeColors: Record<string, string> = {
    deposit: "text-[#10b981]", withdrawal: "text-[#ef4444]", bet_placed: "text-[#f59e0b]",
    bet_won: "text-[#10b981]", bet_refund: "text-[#3b82f6]", fee_collected: "text-[#f59e0b]",
    affiliate_commission: "text-[#3b82f6]", admin_adjustment: "text-white", bonus: "text-[#10b981]",
  };

  const filterLabels: Record<string, string> = {
    all: "Todos", deposit: "Depositos", bet_placed: "Apostas", bet_won: "Ganhos",
    bet_refund: "Reembolsos", fee_collected: "Fees",
  };

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div>
        <h2 className="font-semibold text-[28px] tracking-tight text-white">Financeiro</h2>
        <p className="text-sm text-white/40 mt-1">Visao geral de transacoes e liquidacoes</p>
      </div>

      {/* KPI Glass Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: "Volume Apostado", value: totalBetVolume, color: "#f59e0b", icon: "trending_up" },
          { label: "Total Payouts", value: totalPayouts, color: "#10b981", icon: "payments" },
          { label: "Fees Coletadas", value: totalFees, color: "#f59e0b", icon: "account_balance" },
          { label: "Depositos", value: totalDeposits, color: "#3b82f6", icon: "savings" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#12101A]/80 backdrop-blur-xl p-5"
          >
            {/* Subtle glow */}
            <div
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.07] blur-2xl"
              style={{ background: kpi.color }}
            />
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[18px] text-white/30">{kpi.icon}</span>
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{kpi.label}</p>
            </div>
            <p className="font-semibold text-[26px] tracking-tight" style={{ color: kpi.color }}>
              R$ {kpi.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>

      {/* Settlements */}
      {settlements.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-[#12101A]/80 backdrop-blur-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-white/30">gavel</span>
            <h3 className="font-semibold text-[15px] text-white/90">Liquidacoes</h3>
            <span className="ml-auto text-xs text-white/30 font-medium">{settlements.length} registros</span>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Mercado", "Vencedor", "Pool", "Fee", "Payout/Unit", "Data"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-6 py-3 text-[11px] font-medium uppercase tracking-wider text-white/30 ${
                        i === 0 ? "text-left" : i === 1 ? "text-center" : "text-right"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-white/60">{s.market_id.slice(0, 20)}...</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center text-[11px] font-semibold px-3 py-1 rounded-full ${
                          s.winning_outcome === "UP"
                            ? "bg-[#10b981]/10 text-[#10b981]"
                            : "bg-[#ef4444]/10 text-[#ef4444]"
                        }`}
                      >
                        {s.winning_outcome}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-white/80">R$ {s.total_pool.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-[#f59e0b]">R$ {s.house_fee_collected.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-white/80">{s.payout_per_unit.toFixed(4)}x</td>
                    <td className="px-6 py-4 text-right text-xs text-white/30">{new Date(s.settled_at).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-white/[0.04]">
            {settlements.map((s) => (
              <div key={s.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-white/50">{s.market_id.slice(0, 16)}...</span>
                  <span
                    className={`text-[11px] font-semibold px-3 py-1 rounded-full ${
                      s.winning_outcome === "UP"
                        ? "bg-[#10b981]/10 text-[#10b981]"
                        : "bg-[#ef4444]/10 text-[#ef4444]"
                    }`}
                  >
                    {s.winning_outcome}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase">Pool</p>
                    <p className="font-mono text-sm text-white/80">R$ {s.total_pool.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase">Fee</p>
                    <p className="font-mono text-sm text-[#f59e0b]">R$ {s.house_fee_collected.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase">Payout</p>
                    <p className="font-mono text-sm text-white/80">{s.payout_per_unit.toFixed(4)}x</p>
                  </div>
                </div>
                <p className="text-[10px] text-white/20">{new Date(s.settled_at).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#12101A]/80 backdrop-blur-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-white/30">receipt_long</span>
            <h3 className="font-semibold text-[15px] text-white/90">Ledger</h3>
          </div>

          {/* Pill Filter Buttons */}
          <div className="flex gap-2 flex-wrap sm:ml-auto">
            {["all", "deposit", "bet_placed", "bet_won", "bet_refund", "fee_collected"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[11px] font-medium px-4 py-1.5 rounded-full transition-all duration-200 ${
                  filter === f
                    ? "bg-[#10b981]/10 text-[#10b981] ring-1 ring-[#10b981]/20"
                    : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
              >
                {filterLabels[f] || f.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[480px] overflow-y-auto">
          {filteredLedger.length === 0 ? (
            <div className="py-16 text-center">
              <span className="material-symbols-outlined text-[32px] text-white/10 mb-2 block">inbox</span>
              <p className="text-sm text-white/30">Nenhuma entrada</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {[...filteredLedger].reverse().slice(0, 50).map((l) => (
                <div key={l.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0 flex-1 mr-4">
                    <p className="text-sm font-medium text-white/90 truncate">{l.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.04] text-white/30">
                        {l.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-white/20 font-mono">{l.user_id.slice(0, 12)}...</span>
                      <span className="text-[10px] text-white/20">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                  <p className={`text-[15px] font-semibold font-mono whitespace-nowrap ${typeColors[l.type] || "text-white"}`}>
                    {l.amount >= 0 ? "+" : ""}R$ {l.amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
