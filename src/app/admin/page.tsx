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
          user_name: usersMap[b.user_id]?.name || "\u2014",
          user_email: usersMap[b.user_id]?.email || "\u2014",
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
          user_name: usersMap[b.user_id]?.name || "\u2014",
          user_email: usersMap[b.user_id]?.email || "\u2014",
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

  if (!stats) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/10 border-t-[#10b981] rounded-full animate-spin" />
        <p className="text-sm text-white/40 tracking-wide">Carregando...</p>
      </div>
    </div>
  );

  const pendingPix = pixTransactions.filter(p => p.status === "pending").length;
  const winnersToday = wonBets.filter(b => {
    const d = new Date(b.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const kpis = [
    { label: "Volume Hoje", value: `R$ ${stats.volumeToday.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: "trending_up", color: "#10b981" },
    { label: "Receita (Fee)", value: `R$ ${stats.feeToday.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: "payments", color: "#f59e0b" },
    { label: "Depositos Hoje", value: `R$ ${todayDeposits.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: "account_balance", color: "#6366f1" },
    { label: "Exposicao Aberta", value: `R$ ${stats.totalExposure.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: "shield", color: stats.totalExposure > 100000 ? "#ef4444" : "#10b981" },
    { label: "Mercados Abertos", value: String(stats.openMarkets), icon: "storefront", color: "#6366f1" },
    { label: "Apostas Hoje", value: String(stats.totalBetsToday), icon: "confirmation_number", color: "#10b981" },
    { label: "Ganhadores Hoje", value: String(winnersToday), icon: "emoji_events", color: "#f59e0b" },
    { label: "Usuarios", value: String(userCount || stats.totalUsers), icon: "group", color: "#6366f1" },
    { label: "PIX Pendentes", value: String(pendingPix), icon: "hourglass_top", color: pendingPix > 0 ? "#f59e0b" : "#10b981" },
    { label: "Alertas", value: String(stats.activeAlerts), icon: "notification_important", color: stats.activeAlerts > 0 ? "#ef4444" : "#10b981" },
  ];

  const now = new Date();
  const greeting = `${now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-8 max-w-7xl pb-12">

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-white/40 mt-1 capitalize">{greeting}</p>
        </div>
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-[#12101A] border border-white/[0.06]">
          <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs text-white/50 font-medium tracking-wide">Ao vivo &middot; {timeStr}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="relative group rounded-2xl p-5 border border-white/[0.06] overflow-hidden transition-all duration-300 hover:border-white/[0.12] hover:shadow-lg"
            style={{
              background: `linear-gradient(135deg, #111827 0%, ${k.color}08 100%)`,
            }}
          >
            {/* Subtle glow */}
            <div
              className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-[0.07] group-hover:opacity-[0.12] transition-opacity"
              style={{ backgroundColor: k.color }}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{k.label}</span>
                <span
                  className="material-symbols-outlined text-lg opacity-60"
                  style={{ color: k.color }}
                >
                  {k.icon}
                </span>
              </div>
              <p
                className="text-2xl sm:text-[1.7rem] font-bold tracking-tight"
                style={{ color: k.color, fontVariantNumeric: "tabular-nums" }}
              >
                {k.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Winners + PIX side-by-side */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Recent Winners */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#12101A] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#f59e0b]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-base text-[#f59e0b]" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Ganhadores Recentes</h3>
              <p className="text-[11px] text-white/30">{wonBets.length} resultados</p>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {wonBets.length === 0 ? (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined text-3xl text-white/10 block mb-2">emoji_events</span>
                <p className="text-sm text-white/30">Nenhum ganhador ainda</p>
              </div>
            ) : wonBets.slice(0, 15).map((b, i) => (
              <div
                key={b.id}
                className="px-6 py-4 hover:bg-white/[0.02] transition-colors"
                style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f59e0b]/20 to-[#f59e0b]/5 flex items-center justify-center shrink-0 ring-1 ring-[#f59e0b]/20">
                      <span className="text-sm font-bold text-[#f59e0b]">
                        {(b.user_name || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{b.user_name}</p>
                      <p className="text-[11px] text-white/30 truncate">{b.user_email}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#10b981]" style={{ fontVariantNumeric: "tabular-nums" }}>
                      +R$ {Number(b.final_payout).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-white/30" style={{ fontVariantNumeric: "tabular-nums" }}>
                      apostou R$ {Number(b.amount).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <span className="text-[11px] bg-[#10b981]/10 text-[#10b981] px-2.5 py-1 rounded-full font-medium">
                    {b.outcome_label}
                  </span>
                  <span className="text-[11px] text-white/25">
                    {new Date(b.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PIX Deposits */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#12101A] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#6366f1]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-base text-[#6366f1]">pix</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Depositos PIX</h3>
              <p className="text-[11px] text-white/30">{pixTransactions.length} transacoes</p>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {pixTransactions.length === 0 ? (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined text-3xl text-white/10 block mb-2">pix</span>
                <p className="text-sm text-white/30">Nenhum deposito ainda</p>
              </div>
            ) : pixTransactions.slice(0, 15).map((tx, i) => (
              <div
                key={tx.id}
                className="px-6 py-4 hover:bg-white/[0.02] transition-colors"
                style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{tx.user_email}</p>
                    <p className="text-[11px] text-white/20 font-mono mt-0.5">{tx.id.slice(0, 20)}...</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p
                      className="text-sm font-bold"
                      style={{
                        color: tx.status === "paid" ? "#10b981" : "#f59e0b",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      R$ {Number(tx.amount).toFixed(2)}
                    </p>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                        tx.status === "paid"
                          ? "bg-[#10b981]/10 text-[#10b981]"
                          : "bg-[#f59e0b]/10 text-[#f59e0b]"
                      }`}
                    >
                      {tx.status === "paid" ? "Pago" : "Pendente"}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-white/25 mt-1.5">
                  {new Date(tx.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Breakdown -- horizontally scrollable on mobile */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#12101A] p-6">
        <h3 className="text-sm font-semibold text-white mb-5">Volume por Categoria</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
          {Object.entries(stats.catBreakdown).map(([cat, data]) => {
            const meta = CATEGORY_META[cat as MarketCategory];
            return (
              <div
                key={cat}
                className="snap-start shrink-0 w-[140px] lg:w-auto rounded-xl p-4 text-center border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                style={{
                  background: `linear-gradient(180deg, ${meta?.color || "#8B95A8"}08 0%, transparent 100%)`,
                }}
              >
                <span
                  className="material-symbols-outlined text-2xl mb-2 block"
                  style={{ color: meta?.color || "#8B95A8" }}
                >
                  {meta?.icon || "category"}
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">
                  {meta?.label || cat}
                </p>
                <p className="text-lg font-bold text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {data.count} <span className="text-xs font-normal text-white/30">mkts</span>
                </p>
                <p className="text-[11px] text-white/30 mt-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>
                  R$ {data.volume.toFixed(0)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Markets -- Table on desktop, Cards on mobile */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#12101A] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex justify-between items-center">
          <h3 className="text-sm font-semibold text-white">Mercados Ativos</h3>
          <span className="text-[11px] text-white/30 font-medium">
            {stats.markets.filter(m => !["resolved", "cancelled", "draft"].includes(m.status)).length} abertos
          </span>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Mercado</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Cat.</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Pool</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Outcomes</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Resolucao</th>
                <th className="text-center px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.markets.filter(m => !["resolved", "cancelled", "draft"].includes(m.status)).map((m) => {
                const meta = CATEGORY_META[m.category];
                const stColor: Record<string, string> = {
                  open: "bg-[#10b981]/10 text-[#10b981]",
                  frozen: "bg-[#f59e0b]/10 text-[#f59e0b]",
                  closed: "bg-[#ef4444]/10 text-[#ef4444]",
                  awaiting_resolution: "bg-[#f59e0b]/10 text-[#f59e0b]",
                  scheduled: "bg-[#6366f1]/10 text-[#6366f1]",
                };
                return (
                  <tr key={m.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white truncate max-w-[280px]">{m.title}</div>
                      <div className="text-[11px] text-white/30 mt-0.5 truncate max-w-[280px]">{m.short_description}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm" style={{ color: meta?.color }}>{meta?.icon}</span>
                        <span className="text-xs text-white/50">{meta?.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-white/80" style={{ fontVariantNumeric: "tabular-nums" }}>
                      R$ {m.pool_total.toFixed(0)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        {m.outcomes.map((o) => (
                          <span
                            key={o.key}
                            className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: o.color + "15", color: o.color }}
                          >
                            {o.label}: {o.payout_per_unit.toFixed(2)}x
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-[11px] font-semibold uppercase ${
                        m.resolution_type === "automatic" ? "text-[#10b981]" : m.resolution_type === "manual" ? "text-[#ef4444]" : "text-[#f59e0b]"
                      }`}>
                        {m.resolution_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full ${stColor[m.status] || "bg-white/5 text-white/40"}`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-white/[0.04]">
          {stats.markets.filter(m => !["resolved", "cancelled", "draft"].includes(m.status)).map((m) => {
            const meta = CATEGORY_META[m.category];
            const stColor: Record<string, string> = {
              open: "bg-[#10b981]/10 text-[#10b981]",
              frozen: "bg-[#f59e0b]/10 text-[#f59e0b]",
              closed: "bg-[#ef4444]/10 text-[#ef4444]",
              awaiting_resolution: "bg-[#f59e0b]/10 text-[#f59e0b]",
              scheduled: "bg-[#6366f1]/10 text-[#6366f1]",
            };
            return (
              <div key={m.id} className="px-5 py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{m.title}</p>
                    <p className="text-[11px] text-white/30 mt-0.5 truncate">{m.short_description}</p>
                  </div>
                  <span className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full shrink-0 ${stColor[m.status] || "bg-white/5 text-white/40"}`}>
                    {m.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm" style={{ color: meta?.color }}>{meta?.icon}</span>
                    <span className="text-white/40">{meta?.label}</span>
                  </div>
                  <span className="text-white/60 font-mono font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                    R$ {m.pool_total.toFixed(0)}
                  </span>
                  <span className={`font-semibold uppercase ${
                    m.resolution_type === "automatic" ? "text-[#10b981]" : m.resolution_type === "manual" ? "text-[#ef4444]" : "text-[#f59e0b]"
                  }`}>
                    {m.resolution_type}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {m.outcomes.map((o) => (
                    <span
                      key={o.key}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: o.color + "15", color: o.color }}
                    >
                      {o.label}: {o.payout_per_unit.toFixed(2)}x
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Bets + Risk Alerts */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Recent Bets */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#12101A] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#10b981]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-base text-[#10b981]">receipt_long</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Apostas Recentes</h3>
              <p className="text-[11px] text-white/30">{recentBets.length} apostas</p>
            </div>
          </div>

          {/* Desktop list */}
          <div className="hidden sm:block max-h-[420px] overflow-y-auto">
            {recentBets.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-white/30">Nenhuma aposta</p>
              </div>
            ) : recentBets.slice(0, 15).map((b, i) => (
              <div
                key={b.id}
                className="px-6 py-4 hover:bg-white/[0.02] transition-colors"
                style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {b.user_name}
                      <span className="text-white/25 font-normal text-[11px] ml-2">{b.user_email}</span>
                    </p>
                    <p className="text-[11px] text-white/30 mt-0.5">{b.outcome_label}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
                      R$ {Number(b.amount).toFixed(2)}
                    </p>
                    <span className={`text-[11px] font-semibold ${
                      b.status === "won" ? "text-[#10b981]" : b.status === "lost" ? "text-[#ef4444]" : "text-[#f59e0b]"
                    }`}>
                      {b.status === "won" ? "Ganhou" : b.status === "lost" ? "Perdeu" : "Ativa"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden max-h-[420px] overflow-y-auto p-4 space-y-3">
            {recentBets.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-white/30">Nenhuma aposta</p>
              </div>
            ) : recentBets.slice(0, 15).map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-white/[0.06] p-4 space-y-2"
                style={{
                  background: `linear-gradient(135deg, #111827 0%, ${
                    b.status === "won" ? "#10b981" : b.status === "lost" ? "#ef4444" : "#f59e0b"
                  }06 100%)`,
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white truncate">{b.user_name}</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    b.status === "won"
                      ? "bg-[#10b981]/10 text-[#10b981]"
                      : b.status === "lost"
                        ? "bg-[#ef4444]/10 text-[#ef4444]"
                        : "bg-[#f59e0b]/10 text-[#f59e0b]"
                  }`}>
                    {b.status === "won" ? "Ganhou" : b.status === "lost" ? "Perdeu" : "Ativa"}
                  </span>
                </div>
                <p className="text-[11px] text-white/30">{b.outcome_label}</p>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-white/25">{b.user_email}</p>
                  <p className="text-sm font-bold text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
                    R$ {Number(b.amount).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Alerts */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#12101A] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#ef4444]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-base text-[#ef4444]">warning</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Alertas de Risco</h3>
              <p className="text-[11px] text-white/30">{stats.alerts.length} alertas</p>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {stats.alerts.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-[#10b981]/10 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-xl text-[#10b981]">verified_user</span>
                </div>
                <p className="text-sm font-medium text-white/50">Tudo limpo</p>
                <p className="text-[11px] text-white/25 mt-1">Sem alertas ativos</p>
              </div>
            ) : stats.alerts.map((a, i) => {
              const severityStyles: Record<string, { border: string; bg: string; icon: string; color: string }> = {
                critical: { border: "border-l-[#ef4444]", bg: "bg-[#ef4444]/[0.03]", icon: "error", color: "#ef4444" },
                high: { border: "border-l-[#f59e0b]", bg: "bg-[#f59e0b]/[0.03]", icon: "warning", color: "#f59e0b" },
                medium: { border: "border-l-[#6366f1]", bg: "bg-[#6366f1]/[0.03]", icon: "info", color: "#6366f1" },
              };
              const style = severityStyles[a.severity] || severityStyles.medium;
              return (
                <div
                  key={a.id}
                  className={`px-6 py-4 border-l-[3px] ${style.border} ${style.bg}`}
                  style={{ borderBottom: i < stats.alerts.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-base mt-0.5" style={{ color: style.color }}>
                      {style.icon}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{a.message}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: style.color + "15", color: style.color }}
                        >
                          {a.severity}
                        </span>
                        <span className="text-[11px] text-white/25">{a.type}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
