"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

interface ResolvedMarket {
  id: string;
  title: string;
  category: string;
  outcomes: { key: string; label: string; color: string; pool: number; bet_count: number }[];
  winning_outcome_key: string;
  pool_total: number;
  house_fee_percent: number;
  resolution_evidence: string | null;
  resolved_at: string;
  close_at: string;
  created_at: string;
  banner_url: string | null;
  source_config: { custom_params?: { market_type?: string; params?: Record<string, unknown> } } | null;
}

const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  crypto: { icon: "currency_bitcoin", label: "Cripto" },
  forex: { icon: "currency_exchange", label: "Forex" },
  weather: { icon: "thermostat", label: "Clima" },
  stocks: { icon: "trending_up", label: "Acoes" },
  sports: { icon: "sports_soccer", label: "Esportes" },
  entertainment: { icon: "movie", label: "Entretenimento" },
  politics: { icon: "account_balance", label: "Politica" },
  celebrities: { icon: "star", label: "Celebridades" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function parseEvidence(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function EvidenceBadge({ evidence, marketType }: { evidence: Record<string, unknown> | null; marketType?: string }) {
  if (!evidence) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
        <span className="material-symbols-outlined text-sm text-white/30">help</span>
        <span className="text-[11px] text-white/30">Sem evidencia registrada</span>
      </div>
    );
  }

  const src = evidence.source_data as Record<string, unknown> | undefined;
  const reason = evidence.reason as string | undefined;

  if (marketType === "weather_threshold" && src) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#80FF00]/5 border border-[#80FF00]/20">
          <span className="material-symbols-outlined text-base text-[#80FF00]">thermostat</span>
          <div>
            <span className="text-xs font-bold text-[#80FF00]">{String(src.value)}°C</span>
            <span className="text-[10px] text-white/40 ml-1.5">{String(src.operator)} {String(src.threshold)}°C</span>
          </div>
        </div>
        {reason && <p className="text-[10px] text-white/30 px-1">{reason}</p>}
      </div>
    );
  }

  if ((marketType === "crypto_up_down" || marketType === "forex_up_down") && src) {
    const open = Number(src.open_price);
    const close = Number(src.close_price);
    const diff = close - open;
    const isUp = diff > 0;
    return (
      <div className="space-y-1.5">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isUp ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
          <span className={`material-symbols-outlined text-base ${isUp ? "text-green-400" : "text-red-400"}`}>
            {isUp ? "trending_up" : "trending_down"}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] text-white/40">Abriu</span>
            <span className="text-xs font-bold text-white/70">${open.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            <span className="material-symbols-outlined text-[10px] text-white/30">arrow_forward</span>
            <span className="text-[10px] text-white/40">Fechou</span>
            <span className={`text-xs font-bold ${isUp ? "text-green-400" : "text-red-400"}`}>${close.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
        {reason && <p className="text-[10px] text-white/30 px-1">{reason}</p>}
      </div>
    );
  }

  // Generic fallback
  return (
    <div className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
      {reason && <p className="text-xs text-white/50">{reason}</p>}
      {!reason && <p className="text-[11px] text-white/30">Evidencia registrada</p>}
    </div>
  );
}

export default function ResultadosPage() {
  const { user } = useUser();
  const [markets, setMarkets] = useState<ResolvedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("prediction_markets")
      .select("id, title, category, outcomes, winning_outcome_key, pool_total, house_fee_percent, resolution_evidence, resolved_at, close_at, created_at, banner_url, source_config")
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filter !== "all") {
      query = query.eq("category", filter);
    }

    const { data } = await query;
    setMarkets(data || []);
    setLoading(false);
  }, [filter, page]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#080510] text-white flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-white/20">verified</span>
          <p className="mt-2 text-white/40 mb-4">Faca login para ver os resultados</p>
          <Link href="/login" className="px-6 py-3 rounded-xl kinetic-gradient text-[#0a0a0a] font-black text-sm uppercase">Entrar</Link>
        </div>
      </div>
    );
  }

  const categories = ["all", "crypto", "forex", "weather", "stocks", "sports", "entertainment"];

  return (
    <div className="min-h-screen bg-[#080510] text-white pb-24">
      <Header />

      <div className="max-w-4xl mx-auto px-4 pt-6">
        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#80FF00]/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#80FF00] text-xl">fact_check</span>
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide">Resultados</h1>
            <p className="text-xs text-white/40">Mercados resolvidos com evidencia de verificacao</p>
          </div>
        </div>

        {/* Category filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-1">
          {categories.map((cat) => {
            const meta = CATEGORY_META[cat];
            const isActive = filter === cat;
            return (
              <button
                key={cat}
                onClick={() => { setFilter(cat); setPage(0); }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-[#80FF00]/15 text-[#80FF00] border border-[#80FF00]/30"
                    : "bg-white/[0.04] text-white/50 border border-white/[0.06] hover:bg-white/[0.08]"
                }`}
              >
                <span className="material-symbols-outlined text-sm">{cat === "all" ? "apps" : meta?.icon || "category"}</span>
                {cat === "all" ? "Todos" : meta?.label || cat}
              </button>
            );
          })}
        </div>

        {/* Results list */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : markets.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-white/10">search_off</span>
            <p className="text-white/30 mt-2">Nenhum resultado encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {markets.map((m) => {
              const winOutcome = m.outcomes.find((o) => o.key === m.winning_outcome_key);
              const evidence = parseEvidence(m.resolution_evidence);
              const marketType = m.source_config?.custom_params?.market_type;
              const catMeta = CATEGORY_META[m.category];
              const totalBets = m.outcomes.reduce((s, o) => s + (o.bet_count || 0), 0);

              return (
                <Link
                  key={m.id}
                  href={`/evento/${m.id}`}
                  className="block bg-[#0D0B14] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.12] transition-all group"
                >
                  {/* Header */}
                  <div className="flex items-start gap-3 p-4 pb-3">
                    {/* Category icon */}
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-white/40 text-lg">{catMeta?.icon || "category"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase text-white/30">{catMeta?.label || m.category}</span>
                        <span className="text-[10px] text-white/20">|</span>
                        <span className="text-[10px] text-white/30">{formatDate(m.resolved_at)}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white/90 leading-tight group-hover:text-white transition-colors">{m.title}</h3>
                    </div>
                    {/* Winner badge */}
                    {winOutcome && (
                      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#80FF00]/10 border border-[#80FF00]/30">
                        <span className="material-symbols-outlined text-sm text-[#80FF00]">emoji_events</span>
                        <span className="text-xs font-black text-[#80FF00]">{winOutcome.label}</span>
                      </div>
                    )}
                  </div>

                  {/* Outcomes bar */}
                  <div className="px-4 pb-3">
                    <div className="flex rounded-lg overflow-hidden h-6 bg-white/[0.04]">
                      {m.outcomes.map((o) => {
                        const total = m.outcomes.reduce((s, x) => s + (x.pool || 0), 0);
                        const pct = total > 0 ? ((o.pool || 0) / total) * 100 : 100 / m.outcomes.length;
                        const isWinner = o.key === m.winning_outcome_key;
                        return (
                          <div
                            key={o.key}
                            className={`flex items-center justify-center text-[10px] font-bold transition-all ${
                              isWinner ? "bg-[#80FF00]/20 text-[#80FF00]" : "bg-white/[0.02] text-white/30"
                            }`}
                            style={{ width: `${Math.max(pct, 15)}%` }}
                          >
                            {isWinner && <span className="material-symbols-outlined text-[10px] mr-0.5">check</span>}
                            {o.label} {pct > 0 ? `${pct.toFixed(0)}%` : ""}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Evidence section */}
                  <div className="px-4 pb-3">
                    <EvidenceBadge evidence={evidence} marketType={marketType} />
                  </div>

                  {/* Footer stats */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.04] bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-white/20">payments</span>
                        <span className="text-[10px] text-white/30">Pool: <span className="text-white/60 font-bold">R$ {Number(m.pool_total || 0).toFixed(2)}</span></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-white/20">group</span>
                        <span className="text-[10px] text-white/30">{totalBets} {totalBets === 1 ? "aposta" : "apostas"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-white/20">percent</span>
                        <span className="text-[10px] text-white/30">Taxa: {((m.house_fee_percent || 0.05) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-sm text-white/20 group-hover:text-white/40 transition-colors">chevron_right</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && markets.length > 0 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-white/50 disabled:opacity-30 hover:bg-white/[0.08] transition-all"
            >
              Anterior
            </button>
            <span className="text-xs text-white/30">Pagina {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={markets.length < PAGE_SIZE}
              className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-white/50 disabled:opacity-30 hover:bg-white/[0.08] transition-all"
            >
              Proxima
            </button>
          </div>
        )}
      </div>

      <div className="lg:hidden"><BottomNav /></div>
    </div>
  );
}
