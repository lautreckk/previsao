"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface PixTx { id: string; user_email: string; amount: number; status: string; created_at: string; }
interface Bet { id: string; user_id: string; market_id: string; outcome_key: string; outcome_label: string; amount: number; payout_at_entry: number; final_payout: number; status: string; created_at: string; market_title?: string; }
interface UserMap { [id: string]: { name: string; email: string } }

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [volume, setVolume] = useState(0);
  const [fee, setFee] = useState(0);
  const [deposits, setDeposits] = useState(0);
  const [exposure, setExposure] = useState(0);
  const [openMarkets, setOpenMarkets] = useState(0);
  const [betsCount, setBetsCount] = useState(0);
  const [winnersCount, setWinnersCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [pendingPix, setPendingPix] = useState(0);
  const [wonBets, setWonBets] = useState<(Bet & { user_name?: string })[]>([]);
  const [pixList, setPixList] = useState<PixTx[]>([]);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");

  const fetchAll = useCallback(async () => {
    const now = new Date();
    const periodStart = period === "7d" ? new Date(now.getTime() - 7 * 86400000) : period === "30d" ? new Date(now.getTime() - 30 * 86400000) : new Date("2020-01-01");

    // Users
    const { data: users } = await supabase.from("users").select("id, name, email").eq("is_bot", false);
    const uMap: UserMap = {};
    (users || []).forEach((u: { id: string; name: string; email: string }) => { uMap[u.id] = { name: u.name, email: u.email }; });
    setUsersCount((users || []).length);

    // All bets in period
    const { data: bets } = await supabase.from("prediction_bets").select("id, user_id, amount, status, payout_at_entry, final_payout, outcome_label, created_at").gte("created_at", periodStart.toISOString()).order("created_at", { ascending: false }).limit(500);
    const betsList = bets || [];
    const vol = betsList.reduce((s, b) => s + Number(b.amount), 0);
    setVolume(vol);
    setFee(vol * 0.05);
    setBetsCount(betsList.length);
    const exp = betsList.filter(b => b.status === "pending").reduce((s, b) => s + Number(b.amount) * Number(b.payout_at_entry || 1), 0);
    setExposure(exp);

    // Winners
    const won = betsList.filter(b => b.status === "won");
    setWinnersCount(won.length);
    setWonBets(won.slice(0, 15).map(b => ({ ...b, user_name: uMap[b.user_id]?.name || "—", market_id: "", outcome_key: "", market_title: "" } as Bet & { user_name?: string })));

    // PIX
    const { data: pix } = await supabase.from("pix_transactions").select("id, user_email, amount, status, created_at").gte("created_at", periodStart.toISOString()).order("created_at", { ascending: false }).limit(50);
    const pixData = pix || [];
    setPixList(pixData as PixTx[]);
    const paidDeposits = pixData.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
    setDeposits(paidDeposits);
    setPendingPix(pixData.filter(p => p.status === "pending").length);

    // Open markets
    const { data: mkts } = await supabase.from("prediction_markets").select("id").eq("status", "open").gt("close_at", now.toISOString());
    setOpenMarkets((mkts || []).length);

    setLoading(false);
  }, [period]);

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, 15000); return () => clearInterval(iv); }, [fetchAll]);

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const kpis = [
    { label: "VOLUME", value: fmt(volume), icon: "trending_up", color: "#80FF00" },
    { label: "RECEITA (FEE)", value: fmt(fee), icon: "payments", color: "#f59e0b" },
    { label: "DEPÓSITOS", value: fmt(deposits), icon: "account_balance", color: "#6366f1" },
    { label: "EXPOSIÇÃO ABERTA", value: fmt(exposure), icon: "shield", color: exposure > 100000 ? "#ef4444" : "#f59e0b" },
    { label: "MERCADOS ABERTOS", value: String(openMarkets), icon: "storefront", color: "#6366f1" },
  ];

  const kpis2 = [
    { label: "APOSTAS", value: String(betsCount), icon: "confirmation_number", color: "#80FF00" },
    { label: "GANHADORES", value: String(winnersCount), icon: "emoji_events", color: "#f59e0b" },
    { label: "USUÁRIOS", value: String(usersCount), icon: "group", color: "#6366f1" },
    { label: "PIX PENDENTES", value: String(pendingPix), icon: "hourglass_top", color: pendingPix > 0 ? "#f59e0b" : "#80FF00" },
    { label: "ALERTAS", value: "0", icon: "notification_important", color: "#80FF00" },
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-white/10 border-t-[#80FF00] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl pb-12">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-white/30 mb-1">Admin / Dashboard</p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Dashboard</h1>
          <p className="text-sm text-white/40 mt-0.5 capitalize">{dateStr}</p>
        </div>
        <div className="flex items-center gap-1 bg-[#12101A] border border-white/[0.06] rounded-lg p-1">
          {(["7d", "30d", "all"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${period === p ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"}`}>
              {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "Tudo"}
            </button>
          ))}
          <div className="flex items-center gap-1.5 px-3 py-1.5 ml-1">
            <div className="w-2 h-2 rounded-full bg-[#80FF00] animate-pulse" />
            <span className="text-xs text-white/40">Ao vivo</span>
          </div>
        </div>
      </div>

      {/* KPI Row 1 — Big cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl p-4 border border-white/[0.06] bg-[#12101A] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-[0.07]" style={{ backgroundColor: k.color }} />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{k.label}</span>
              <span className="material-symbols-outlined text-lg" style={{ color: k.color, fontVariationSettings: "'FILL' 1" }}>{k.icon}</span>
            </div>
            <p className="text-xl font-black" style={{ color: k.color, fontVariantNumeric: "tabular-nums" }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* KPI Row 2 — Small cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis2.map(k => (
          <div key={k.label} className="rounded-xl p-4 border border-white/[0.06] bg-[#12101A] relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{k.label}</span>
              <span className="material-symbols-outlined text-lg" style={{ color: k.color, fontVariationSettings: "'FILL' 1" }}>{k.icon}</span>
            </div>
            <p className="text-xl font-black" style={{ color: k.color, fontVariantNumeric: "tabular-nums" }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Winners + PIX */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Ganhadores Recentes */}
        <div className="rounded-xl border border-white/[0.06] bg-[#12101A] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#f59e0b] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
            <div>
              <h3 className="text-sm font-bold">Ganhadores Recentes</h3>
              <p className="text-[10px] text-white/30">{winnersCount} resultados</p>
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y divide-white/[0.04]">
            {wonBets.length === 0 ? (
              <div className="py-10 text-center text-white/20 text-sm">Nenhum ganhador no período</div>
            ) : wonBets.map(b => (
              <div key={b.id} className="px-5 py-3 hover:bg-white/[0.02] flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{b.user_name}</p>
                  <p className="text-[10px] text-white/30">{b.outcome_label} — {new Date(b.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className="text-sm font-bold text-[#80FF00] tabular-nums">{fmt(Number(b.final_payout || b.amount))}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Depósitos PIX */}
        <div className="rounded-xl border border-white/[0.06] bg-[#12101A] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6366f1] text-lg">pix</span>
            <div>
              <h3 className="text-sm font-bold">Depósitos PIX</h3>
              <p className="text-[10px] text-white/30">{pixList.length} transações</p>
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y divide-white/[0.04]">
            {pixList.length === 0 ? (
              <div className="py-10 text-center">
                <span className="material-symbols-outlined text-3xl text-white/10 block mb-2">pix</span>
                <p className="text-sm text-white/20">Nenhum depósito no período</p>
              </div>
            ) : pixList.map(tx => (
              <div key={tx.id} className="px-5 py-3 hover:bg-white/[0.02] flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tx.user_email}</p>
                  <p className="text-[10px] text-white/30">{new Date(tx.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold tabular-nums" style={{ color: tx.status === "paid" ? "#80FF00" : "#f59e0b" }}>{fmt(Number(tx.amount))}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${tx.status === "paid" ? "bg-[#80FF00]/10 text-[#80FF00]" : "bg-[#f59e0b]/10 text-[#f59e0b]"}`}>
                    {tx.status === "paid" ? "Pago" : "Pendente"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
