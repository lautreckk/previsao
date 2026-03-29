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
    deposit: "text-[#00D4AA]", withdrawal: "text-[#FF6B5A]", bet_placed: "text-[#FFB800]",
    bet_won: "text-[#00D4AA]", bet_refund: "text-[#5B9DFF]", fee_collected: "text-[#FFB800]",
    affiliate_commission: "text-[#5B9DFF]", admin_adjustment: "text-white", bonus: "text-[#00D4AA]",
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <h2 className="font-headline font-black text-2xl tracking-tight">Financeiro</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Volume Apostado", value: totalBetVolume, color: "#FFB800" },
          { label: "Total Payouts", value: totalPayouts, color: "#00D4AA" },
          { label: "Fees Coletadas", value: totalFees, color: "#FFB800" },
          { label: "Depositos", value: totalDeposits, color: "#5B9DFF" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#0f1729] rounded-2xl p-4 border border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B95A8] mb-1">{kpi.label}</p>
            <p className="font-headline font-black text-xl" style={{ color: kpi.color }}>R$ {kpi.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </div>
        ))}
      </div>

      {/* Settlements */}
      {settlements.length > 0 && (
        <div className="bg-[#0f1729] rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5"><h3 className="font-headline font-bold text-sm uppercase tracking-wider">Liquidacoes</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-[#8B95A8]">
                  <th className="text-left p-3">Mercado</th>
                  <th className="text-center p-3">Vencedor</th>
                  <th className="text-right p-3">Pool</th>
                  <th className="text-right p-3">Fee</th>
                  <th className="text-right p-3">Payout/Unit</th>
                  <th className="text-right p-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id} className="border-b border-white/5">
                    <td className="p-3 font-mono text-xs">{s.market_id.slice(0, 20)}...</td>
                    <td className="p-3 text-center"><span className={`font-bold ${s.winning_outcome === "UP" ? "text-[#00D4AA]" : "text-[#FF6B5A]"}`}>{s.winning_outcome}</span></td>
                    <td className="p-3 text-right font-mono">R$ {s.total_pool.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono text-[#FFB800]">R$ {s.house_fee_collected.toFixed(2)}</td>
                    <td className="p-3 text-right font-mono">{s.payout_per_unit.toFixed(4)}x</td>
                    <td className="p-3 text-right text-[#8B95A8] text-xs">{new Date(s.settled_at).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="bg-[#0f1729] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-headline font-bold text-sm uppercase tracking-wider">Ledger</h3>
          <div className="flex gap-2 flex-wrap">
            {["all", "deposit", "bet_placed", "bet_won", "bet_refund", "fee_collected"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full ${filter === f ? "bg-[#00D4AA]/10 text-[#00D4AA]" : "text-[#8B95A8] hover:text-white"}`}>{f === "all" ? "Todos" : f.replace(/_/g, " ")}</button>
            ))}
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
          {filteredLedger.length === 0 ? (
            <p className="p-6 text-center text-[#8B95A8] text-sm">Nenhuma entrada</p>
          ) : [...filteredLedger].reverse().slice(0, 50).map((l) => (
            <div key={l.id} className="p-3 flex items-center justify-between hover:bg-white/5">
              <div>
                <p className="text-xs font-bold">{l.description}</p>
                <p className="text-[10px] text-[#8B95A8]">{l.type} | {l.user_id.slice(0, 12)}... | {new Date(l.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <p className={`text-sm font-bold font-mono ${typeColors[l.type] || "text-white"}`}>
                {l.amount >= 0 ? "+" : ""}R$ {l.amount.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
