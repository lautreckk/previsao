"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import AdminDateFilter from "@/components/AdminDateFilter";

interface LedgerEntry { id: string; user_id: string; type: string; amount: number; description: string; created_at: string; }
interface Bet { id: string; user_id: string; amount: number; payout_at_entry: number; final_payout: number; status: string; outcome_label: string; created_at: string; }

export default function AdminFinance() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [filter, setFilter] = useState("all");
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const periodStart = new Date(startDate + "T00:00:00").toISOString();
    const periodEnd = new Date(endDate + "T23:59:59").toISOString();

    const [{ data: ledgerData }, { data: betsData }] = await Promise.all([
      supabase.from("ledger").select("*").gte("created_at", periodStart).lte("created_at", periodEnd).order("created_at", { ascending: false }).limit(300),
      supabase.from("prediction_bets").select("*").gte("created_at", periodStart).lte("created_at", periodEnd).order("created_at", { ascending: false }).limit(500),
    ]);
    setLedger((ledgerData as LedgerEntry[]) || []);
    setBets((betsData as Bet[]) || []);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredLedger = filter === "all" ? ledger : ledger.filter(l => l.type === filter);
  const totalDeposits = ledger.filter(l => l.type === "deposit" || l.type === "pix_deposit").reduce((s, l) => s + Math.abs(Number(l.amount)), 0);
  const totalPayouts = ledger.filter(l => l.type === "bet_won").reduce((s, l) => s + Number(l.amount), 0);
  const totalBetVolume = bets.reduce((s, b) => s + Number(b.amount), 0);
  const totalFees = totalBetVolume * 0.05;
  const pendingBets = bets.filter(b => b.status === "pending").length;
  const wonBets = bets.filter(b => b.status === "won").length;

  const typeColors: Record<string, string> = { deposit: "#10b981", pix_deposit: "#10b981", withdrawal: "#ef4444", bet_placed: "#f59e0b", bet_won: "#80FF00", bet_refund: "#3b82f6", fee_collected: "#f59e0b" };
  const typeLabels: Record<string, string> = { all: "Todos", deposit: "Depósitos", pix_deposit: "PIX", bet_placed: "Apostas", bet_won: "Ganhos", bet_refund: "Reembolsos" };
  const fmt = (v: number) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-bold text-2xl tracking-tight">Financeiro</h2>
          <p className="text-sm text-white/40 mt-0.5">Transações, apostas e receitas</p>
        </div>
        <AdminDateFilter startDate={startDate} endDate={endDate} onChangeStart={setStartDate} onChangeEnd={setEndDate} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "VOLUME APOSTADO", value: fmt(totalBetVolume), color: "#f59e0b", icon: "trending_up" },
          { label: "PAYOUTS", value: fmt(totalPayouts), color: "#80FF00", icon: "payments" },
          { label: "RECEITA (FEES)", value: fmt(totalFees), color: "#f59e0b", icon: "account_balance" },
          { label: "DEPÓSITOS", value: fmt(totalDeposits), color: "#6366f1", icon: "savings" },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-white/[0.06] bg-[#12101A] p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-[0.07]" style={{ backgroundColor: k.color }} />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{k.label}</span>
              <span className="material-symbols-outlined text-lg" style={{ color: k.color, fontVariationSettings: "'FILL' 1" }}>{k.icon}</span>
            </div>
            <p className="text-xl font-black" style={{ color: k.color, fontVariantNumeric: "tabular-nums" }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Bet stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-[#12101A] p-4 text-center">
          <p className="text-[10px] text-white/30 uppercase font-bold">Total Apostas</p>
          <p className="text-2xl font-black text-white mt-1">{bets.length}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#12101A] p-4 text-center">
          <p className="text-[10px] text-white/30 uppercase font-bold">Pendentes</p>
          <p className="text-2xl font-black text-[#f59e0b] mt-1">{pendingBets}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#12101A] p-4 text-center">
          <p className="text-[10px] text-white/30 uppercase font-bold">Ganhadores</p>
          <p className="text-2xl font-black text-[#80FF00] mt-1">{wonBets}</p>
        </div>
      </div>

      {/* Ledger filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {Object.entries(typeLabels).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filter === key ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60 bg-white/[0.02]"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Ledger table */}
      <div className="rounded-xl border border-white/[0.06] bg-[#12101A] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-bold">Extrato ({filteredLedger.length})</h3>
        </div>
        {loading ? (
          <div className="py-12 text-center"><div className="w-6 h-6 border-2 border-white/10 border-t-[#80FF00] rounded-full animate-spin mx-auto" /></div>
        ) : filteredLedger.length === 0 ? (
          <div className="py-10 text-center text-white/20 text-sm">Nenhuma transação no período</div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto divide-y divide-white/[0.04]">
            {filteredLedger.map(l => (
              <div key={l.id} className="px-5 py-3 hover:bg-white/[0.02] flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: (typeColors[l.type] || "#888") + "15", color: typeColors[l.type] || "#888" }}>
                      {l.type.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-1 truncate">{l.description || "—"}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-bold tabular-nums" style={{ color: Number(l.amount) >= 0 ? "#80FF00" : "#FF5252" }}>
                    {Number(l.amount) >= 0 ? "+" : ""}{fmt(Number(l.amount))}
                  </p>
                  <p className="text-[10px] text-white/20">{new Date(l.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
