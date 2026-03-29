"use client";

import { useEffect, useState } from "react";
import { getDashboardStats, initializeStore, tickAllMarkets } from "@/lib/engines/store";
import { CATEGORY_META } from "@/lib/engines/types";
import type { PredictionMarket, Bet, RiskAlert, MarketCategory } from "@/lib/engines/types";
import { supabase } from "@/lib/supabase";

interface PixTransaction {
  id: string;
  user_id: string | null;
  user_email: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  transaction_id: string;
}

interface SupaBet {
  id: string;
  user_id: string;
  market_id: string;
  outcome_key: string;
  outcome_label: string;
  amount: number;
  payout_at_entry: number;
  final_payout: number;
  status: string;
  created_at: string;
}

interface SupaUser {
  id: string;
  name: string;
  email: string;
  balance: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<ReturnType<typeof getDashboardStats> | null>(null);
  const [pixTransactions, setPixTransactions] = useState<PixTransaction[]>([]);
  const [wonBets, setWonBets] = useState<(SupaBet & { user_name?: string; user_email?: string })[]>([]);
  const [recentBets, setRecentBets] = useState<(SupaBet & { user_name?: string; user_email?: string })[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [todayDeposits, setTodayDeposits] = useState(0);

  useEffect(() => {
    initializeStore();
    const refresh = () => { tickAllMarkets(); setStats(getDashboardStats()); };
    refresh();
    const iv = setInterval(refresh, 3000);
    return () => clearInterval(iv);
  }, []);

  // Fetch Supabase data
  useEffect(() => {
    const fetchData = async () => {
      // Fetch PIX transactions (recent 30)
      const { data: pixData } = await supabase
        .from("pix_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (pixData) setPixTransactions(pixData);

      // Fetch users map
      const { data: usersData } = await supabase.from("users").select("id, name, email, balance");
      const usersMap: Record<string, SupaUser> = {};
      if (usersData) {
        setUserCount(usersData.length);
        usersData.forEach((u: SupaUser) => { usersMap[u.id] = u; });
      }

      // Fetch won bets (recent 20)
      const { data: wonData } = await supabase
        .from("bets")
        .select("*")
        .eq("status", "won")
        .order("created_at", { ascending: false })
        .limit(20);
      if (wonData) {
        setWonBets(wonData.map((b: SupaBet) => ({
          ...b,
          user_name: usersMap[b.user_id]?.name || "—",
          user_email: usersMap[b.user_id]?.email || "—",
        })));
      }

      // Fetch all recent bets (last 30)
      const { data: betsData } = await supabase
        .from("bets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (betsData) {
        setRecentBets(betsData.map((b: SupaBet) => ({
          ...b,
          user_name: usersMap[b.user_id]?.name || "—",
          user_email: usersMap[b.user_id]?.email || "—",
        })));
      }

      // Today's deposits
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: depData } = await supabase
        .from("pix_transactions")
        .select("amount")
        .eq("status", "paid")
        .gte("created_at", todayStart.toISOString());
      if (depData) {
        setTodayDeposits(depData.reduce((s: number, d: { amount: number }) => s + Number(d.amount), 0));
      }
    };

    fetchData();
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, []);

  if (!stats) return <div className="text-center py-20 text-[#8B95A8]">Carregando...</div>;

  const pendingPix = pixTransactions.filter(p => p.status === "pending").length;
  const winnersToday = wonBets.filter(b => {
    const d = new Date(b.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const kpis = [
    { label: "Volume Hoje", value: `R$ ${stats.volumeToday.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: "trending_up", color: "#00FFB8" },
    { label: "Receita (Fee)", value: `R$ ${stats.feeToday.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: "payments", color: "#FFC700" },
    { label: "Depositos Hoje", value: `R$ ${todayDeposits.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: "account_balance", color: "#5B9DFF" },
    { label: "Exposicao Aberta", value: `R$ ${stats.totalExposure.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: "shield", color: stats.totalExposure > 100000 ? "#FF5252" : "#00FFB8" },
    { label: "Mercados Abertos", value: String(stats.openMarkets), icon: "storefront", color: "#5B9DFF" },
    { label: "Apostas Hoje", value: String(stats.totalBetsToday), icon: "confirmation_number", color: "#00FFB8" },
    { label: "Ganhadores Hoje", value: String(winnersToday), icon: "emoji_events", color: "#FFC700" },
    { label: "Usuarios", value: String(userCount || stats.totalUsers), icon: "group", color: "#5B9DFF" },
    { label: "PIX Pendentes", value: String(pendingPix), icon: "hourglass_top", color: pendingPix > 0 ? "#FFC700" : "#00FFB8" },
    { label: "Alertas", value: String(stats.activeAlerts), icon: "notification_important", color: stats.activeAlerts > 0 ? "#FF5252" : "#00FFB8" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-headline font-black text-2xl tracking-tight">Dashboard</h2>
        <div className="flex items-center gap-2 text-xs text-[#8B95A8]"><div className="w-2 h-2 rounded-full bg-[#00FFB8] animate-pulse" />Real-time 3s</div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-[#0a1222] rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8B95A8]">{k.label}</span>
              <span className="material-symbols-outlined text-lg" style={{ color: k.color }}>{k.icon}</span>
            </div>
            <p className="font-headline font-black text-xl" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* WINNERS + PIX DEPOSITS */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Winners */}
        <div className="bg-[#0a1222] rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFC700]" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
            <h3 className="font-headline font-bold text-sm uppercase tracking-wider">Ganhadores Recentes</h3>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
            {wonBets.length === 0 ? (
              <p className="p-6 text-center text-[#8B95A8] text-sm">Nenhum ganhador ainda</p>
            ) : wonBets.slice(0, 15).map((b) => (
              <div key={b.id} className="p-3 hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#FFC700]/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-[#FFC700]">{(b.user_name || "?").charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{b.user_name}</p>
                      <p className="text-[10px] text-[#8B95A8] truncate">{b.user_email}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-[#00FFB8] font-headline">+R$ {Number(b.final_payout).toFixed(2)}</p>
                    <p className="text-[10px] text-[#8B95A8]">apostou R$ {Number(b.amount).toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] bg-[#00FFB8]/10 text-[#00FFB8] px-2 py-0.5 rounded-full font-bold">{b.outcome_label}</span>
                  <span className="text-[10px] text-[#8B95A8]">{new Date(b.created_at).toLocaleString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PIX Deposits */}
        <div className="bg-[#0a1222] rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#5B9DFF]">pix</span>
            <h3 className="font-headline font-bold text-sm uppercase tracking-wider">Depositos PIX</h3>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
            {pixTransactions.length === 0 ? (
              <p className="p-6 text-center text-[#8B95A8] text-sm">Nenhum deposito ainda</p>
            ) : pixTransactions.slice(0, 15).map((tx) => (
              <div key={tx.id} className="p-3 hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{tx.user_email}</p>
                    <p className="text-[10px] text-[#8B95A8] font-mono">{tx.id.slice(0, 20)}...</p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-3">
                    <p className="text-sm font-black font-headline" style={{ color: tx.status === "paid" ? "#00FFB8" : "#FFC700" }}>R$ {Number(tx.amount).toFixed(2)}</p>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${tx.status === "paid" ? "bg-[#00FFB8]/10 text-[#00FFB8]" : "bg-[#FFC700]/10 text-[#FFC700]"}`}>
                      {tx.status === "paid" ? "Pago" : "Pendente"}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-[#8B95A8] mt-1">{new Date(tx.created_at).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-[#0a1222] rounded-2xl border border-white/5 p-5">
        <h3 className="font-headline font-bold text-sm uppercase tracking-wider mb-4">Volume por Categoria</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(stats.catBreakdown).map(([cat, data]) => {
            const meta = CATEGORY_META[cat as MarketCategory];
            return (
              <div key={cat} className="bg-[#0f1729] rounded-xl p-3 text-center">
                <span className="material-symbols-outlined text-2xl mb-1 block" style={{ color: meta?.color || "#8B95A8" }}>{meta?.icon || "category"}</span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B95A8]">{meta?.label || cat}</p>
                <p className="font-headline font-black text-sm">{data.count} mkts</p>
                <p className="text-[10px] text-[#8B95A8]">R$ {data.volume.toFixed(0)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Markets Table */}
      <div className="bg-[#0a1222] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex justify-between items-center">
          <h3 className="font-headline font-bold text-sm uppercase tracking-wider">Mercados Ativos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-[#8B95A8]">
              <th className="text-left p-3">Mercado</th><th className="text-left p-3">Cat.</th><th className="text-right p-3">Pool</th><th className="text-center p-3">Outcomes</th><th className="text-center p-3">Resolucao</th><th className="text-center p-3">Status</th>
            </tr></thead>
            <tbody>
              {stats.markets.filter(m => !["resolved", "cancelled", "draft"].includes(m.status)).map((m) => {
                const meta = CATEGORY_META[m.category];
                const stColor: Record<string, string> = { open: "bg-[#00FFB8]/10 text-[#00FFB8]", frozen: "bg-[#FFC700]/10 text-[#FFC700]", closed: "bg-[#FF5252]/10 text-[#FF5252]", awaiting_resolution: "bg-[#FFC700]/10 text-[#FFC700]", scheduled: "bg-[#5B9DFF]/10 text-[#5B9DFF]" };
                return (
                  <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3"><div className="font-bold truncate max-w-[250px]">{m.title}</div><div className="text-[10px] text-[#8B95A8]">{m.short_description}</div></td>
                    <td className="p-3"><span className="material-symbols-outlined text-sm mr-1" style={{ color: meta?.color }}>{meta?.icon}</span><span className="text-xs">{meta?.label}</span></td>
                    <td className="p-3 text-right font-mono font-bold">R$ {m.pool_total.toFixed(0)}</td>
                    <td className="p-3 text-center">{m.outcomes.map((o) => <span key={o.key} className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mr-1" style={{ backgroundColor: o.color + "20", color: o.color }}>{o.label}: {o.payout_per_unit.toFixed(2)}x</span>)}</td>
                    <td className="p-3 text-center"><span className={`text-[10px] font-bold uppercase ${m.resolution_type === "automatic" ? "text-[#00FFB8]" : m.resolution_type === "manual" ? "text-[#FF5252]" : "text-[#FFC700]"}`}>{m.resolution_type}</span></td>
                    <td className="p-3 text-center"><span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${stColor[m.status] || "bg-[#5A6478]/20 text-[#8B95A8]"}`}>{m.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Bets + Alerts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#0a1222] rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00FFB8]">receipt_long</span>
            <h3 className="font-headline font-bold text-sm uppercase tracking-wider">Apostas Recentes</h3>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
            {recentBets.length === 0 ? <p className="p-4 text-[#8B95A8] text-sm text-center">Nenhuma</p> : recentBets.slice(0, 15).map((b) => (
              <div key={b.id} className="p-3 hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{b.user_name} <span className="text-[#8B95A8] font-normal text-[10px]">{b.user_email}</span></p>
                    <p className="text-[10px] text-[#8B95A8] mt-0.5">{b.outcome_label}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black font-headline">R$ {Number(b.amount).toFixed(2)}</p>
                    <span className={`text-[10px] font-bold ${b.status === "won" ? "text-[#00FFB8]" : b.status === "lost" ? "text-[#FF5252]" : "text-[#FFC700]"}`}>{b.status === "won" ? "Ganhou" : b.status === "lost" ? "Perdeu" : "Ativa"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#0a1222] rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FF5252]">warning</span>
            <h3 className="font-headline font-bold text-sm uppercase tracking-wider">Alertas de Risco</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {stats.alerts.length === 0 ? <div className="p-6 text-center"><span className="material-symbols-outlined text-3xl text-[#00FFB8] mb-2 block">verified_user</span><p className="text-sm text-[#8B95A8]">Sem alertas</p></div>
            : stats.alerts.map((a) => (
              <div key={a.id} className={`p-3 border-b border-white/5 border-l-4 ${a.severity === "critical" ? "border-l-[#FF5252]" : a.severity === "high" ? "border-l-[#FFC700]" : "border-l-[#5B9DFF]"}`}>
                <p className="text-xs font-bold">{a.message}</p><p className="text-[10px] text-[#8B95A8]">{a.type}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
