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
  // Unified field for display
  _type: "market" | "camera";
  _cameraData?: {
    final_count: number;
    threshold: number;
    result: "over" | "under";
    highway: string;
    city: string;
    round_number: number;
    pool_over: number;
    pool_under: number;
  };
}

/* ── Fake bettors for social proof ── */
const FAKE_NAMES = [
  "Lucas M.", "Pedro S.", "Mari P.", "Ana C.", "Carol B.", "Bia R.", "Julia F.",
  "Joao V.", "Bruno L.", "Rafael K.", "Vini S.", "Duda M.", "Leo T.", "Matheus G.",
  "Amanda S.", "Luiza N.", "Alice F.", "Nath R.", "Gabriel O.", "Renata L.",
  "Thiago C.", "Camila D.", "Bruna A.", "Felipe B.", "Fernanda S.", "Diego M.",
  "Patricia V.", "Rodrigo N.", "Larissa T.", "Giovanna K.", "Daniel A.", "Leticia R.",
  "Miguel C.", "Kaua P.", "Emerson F.", "Elaine B.", "Daniela M.", "Pedro C.",
];

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 16807 + 0) % 2147483647;
    return (h & 0x7fffffff) / 0x7fffffff;
  };
}

function getFakeBettors(marketId: string, count: number) {
  const rng = seededRandom(marketId);
  const used = new Set<number>();
  const bettors: { name: string; avatar: string; amount: number }[] = [];
  const total = Math.min(count, 8);
  for (let i = 0; i < total; i++) {
    let idx = Math.floor(rng() * FAKE_NAMES.length);
    while (used.has(idx)) idx = (idx + 1) % FAKE_NAMES.length;
    used.add(idx);
    const name = FAKE_NAMES[idx];
    const amount = Math.floor(rng() * 180) + 10;
    const avatar = rng() < 0.4
      ? `https://i.pravatar.cc/32?u=${encodeURIComponent(name + marketId)}`
      : `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(name + marketId)}&backgroundColor=transparent`;
    bettors.push({ name, avatar, amount });
  }
  return bettors;
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
  camera: { icon: "videocam", label: "Cameras" },
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

/* ── Camera evidence badge ── */
function CameraEvidenceBadge({ data }: { data: NonNullable<ResolvedMarket["_cameraData"]> }) {
  const isOver = data.result === "over";
  const diff = data.final_count - data.threshold;
  return (
    <div className="space-y-1.5">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isOver ? "bg-[#10B981]/5 border-[#10B981]/20" : "bg-[#FF5252]/5 border-[#FF5252]/20"}`}>
        <span className={`material-symbols-outlined text-base ${isOver ? "text-[#10B981]" : "text-[#FF5252]"}`}>
          {isOver ? "trending_up" : "trending_down"}
        </span>
        <div className="flex items-baseline gap-2">
          <span className={`text-xs font-bold ${isOver ? "text-[#10B981]" : "text-[#FF5252]"}`}>
            {data.final_count} veiculos
          </span>
          <span className="text-[10px] text-white/40">
            {isOver ? ">" : "<"} {data.threshold} (linha)
          </span>
          <span className={`text-[10px] font-bold ${isOver ? "text-[#10B981]" : "text-[#FF5252]"}`}>
            {diff > 0 ? `+${diff}` : diff}
          </span>
        </div>
      </div>
      <p className="text-[10px] text-white/30 px-1">
        Contagem automatica via camera • {data.highway} • {data.city}
      </p>
    </div>
  );
}

/* ── Bettors avatar stack ── */
function BettorsStack({ marketId, betCount }: { marketId: string; betCount: number }) {
  const displayCount = Math.max(betCount, 5 + Math.floor(seededRandom(marketId + "_c")() * 15));
  const bettors = getFakeBettors(marketId, displayCount);
  const showMax = 5;
  const remaining = displayCount - showMax;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {bettors.slice(0, showMax).map((b, i) => (
          <img
            key={i}
            src={b.avatar}
            alt={b.name}
            className="w-6 h-6 rounded-full border-2 border-[#0D0B14] object-cover bg-white/10"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(b.name)}&backgroundColor=transparent`;
            }}
          />
        ))}
        {remaining > 0 && (
          <div className="w-6 h-6 rounded-full border-2 border-[#0D0B14] bg-white/10 flex items-center justify-center">
            <span className="text-[8px] font-bold text-white/60">+{remaining}</span>
          </div>
        )}
      </div>
      <span className="text-[10px] text-white/40">{displayCount} {displayCount === 1 ? "aposta" : "apostas"}</span>
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

    // Fetch regular resolved markets
    let regularQuery = supabase
      .from("prediction_markets")
      .select("id, title, category, outcomes, winning_outcome_key, pool_total, house_fee_percent, resolution_evidence, resolved_at, close_at, created_at, banner_url, source_config")
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false });

    if (filter !== "all" && filter !== "camera") {
      regularQuery = regularQuery.eq("category", filter);
    }

    // Fetch camera round results
    const cameraQuery = supabase
      .from("camera_rounds")
      .select("id, market_id, round_number, final_count, threshold, resolved_at, total_pool, pool_over, pool_under")
      .not("resolved_at", "is", null)
      .gt("final_count", 0)
      .order("resolved_at", { ascending: false })
      .limit(50);

    // Fetch camera market titles
    const cameraMarketsQuery = supabase
      .from("camera_markets")
      .select("id, title, highway, city, thumbnail_url");

    const [regularRes, cameraRes, cameraMarketsRes] = await Promise.all([
      filter === "camera" ? Promise.resolve({ data: [] }) : regularQuery,
      filter !== "all" && filter !== "camera" ? Promise.resolve({ data: [] }) : cameraQuery,
      cameraMarketsQuery,
    ]);

    const regularData = (regularRes.data || []).map((m: Record<string, unknown>) => ({
      ...m,
      _type: "market" as const,
    })) as ResolvedMarket[];

    // Build camera markets lookup
    const cmLookup = new Map<string, { title: string; highway: string; city: string; thumbnail_url: string | null }>();
    for (const cm of cameraMarketsRes.data || []) {
      cmLookup.set(cm.id, cm);
    }

    // Transform camera rounds into unified format
    const cameraData = (cameraRes.data || []).map((cr: Record<string, unknown>) => {
      const cm = cmLookup.get(cr.market_id as string);
      const finalCount = cr.final_count as number;
      const threshold = cr.threshold as number;
      const isOver = finalCount > threshold;
      const totalPool = Number(cr.pool_over || 0) + Number(cr.pool_under || 0);
      const fakePool = totalPool > 0 ? totalPool : 800 + Math.floor(seededRandom(cr.id as string)() * 3000);

      return {
        id: cr.id as string,
        title: cm ? `${cm.title} — Rodada #${cr.round_number}` : `Camera Rodada #${cr.round_number}`,
        category: "camera",
        outcomes: [
          { key: "over", label: "Acima", color: "#10B981", pool: Number(cr.pool_over || fakePool * 0.55), bet_count: 0 },
          { key: "under", label: "Abaixo", color: "#FF5252", pool: Number(cr.pool_under || fakePool * 0.45), bet_count: 0 },
        ],
        winning_outcome_key: isOver ? "over" : "under",
        pool_total: fakePool,
        house_fee_percent: 0.05,
        resolution_evidence: null,
        resolved_at: cr.resolved_at as string,
        close_at: cr.resolved_at as string,
        created_at: cr.resolved_at as string,
        banner_url: cm?.thumbnail_url || null,
        source_config: null,
        _type: "camera" as const,
        _cameraData: {
          final_count: finalCount,
          threshold,
          result: isOver ? "over" as const : "under" as const,
          highway: cm?.highway || "",
          city: cm?.city || "",
          round_number: cr.round_number as number,
          pool_over: Number(cr.pool_over || 0),
          pool_under: Number(cr.pool_under || 0),
        },
      } as ResolvedMarket;
    });

    // Merge and sort by resolved_at
    const all = [...regularData, ...cameraData]
      .sort((a, b) => new Date(b.resolved_at).getTime() - new Date(a.resolved_at).getTime())
      .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    setMarkets(all);
    setLoading(false);
  }, [filter, page]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  // Realtime: auto-refresh when new markets are resolved
  useEffect(() => {
    const channel = supabase
      .channel("resultados-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "prediction_markets", filter: "status=eq.resolved" },
        () => { fetchMarkets(); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "camera_rounds" },
        () => { fetchMarkets(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchMarkets]);

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

  const categories = ["all", "crypto", "forex", "weather", "stocks", "sports", "entertainment", "camera"];

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
              const catMeta = CATEGORY_META[m.category] || CATEGORY_META[m._type === "camera" ? "camera" : "entertainment"];
              const totalBets = m.outcomes.reduce((s, o) => s + (o.bet_count || 0), 0);
              const isCamera = m._type === "camera";

              return (
                <Link
                  key={m.id}
                  href={isCamera ? `/camera/${m._cameraData?.highway ? m.id.split("_").slice(1, 3).join("_") : m.id}` : `/evento/${m.id}`}
                  className="block bg-[#0D0B14] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.12] transition-all group"
                >
                  {/* Header */}
                  <div className="flex items-start gap-3 p-4 pb-3">
                    {/* Category icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isCamera ? "bg-[#FF4444]/10" : "bg-white/[0.04]"
                    }`}>
                      <span className={`material-symbols-outlined text-lg ${isCamera ? "text-[#FF4444]" : "text-white/40"}`}>
                        {catMeta?.icon || "category"}
                      </span>
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
                      <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                        isCamera
                          ? m.winning_outcome_key === "over"
                            ? "bg-[#10B981]/10 border-[#10B981]/30"
                            : "bg-[#FF5252]/10 border-[#FF5252]/30"
                          : "bg-[#80FF00]/10 border-[#80FF00]/30"
                      }`}>
                        <span className={`material-symbols-outlined text-sm ${
                          isCamera
                            ? m.winning_outcome_key === "over" ? "text-[#10B981]" : "text-[#FF5252]"
                            : "text-[#80FF00]"
                        }`}>
                          {isCamera ? (m.winning_outcome_key === "over" ? "trending_up" : "trending_down") : "emoji_events"}
                        </span>
                        <span className={`text-xs font-black ${
                          isCamera
                            ? m.winning_outcome_key === "over" ? "text-[#10B981]" : "text-[#FF5252]"
                            : "text-[#80FF00]"
                        }`}>
                          {winOutcome.label}
                        </span>
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
                              isWinner
                                ? isCamera
                                  ? o.key === "over" ? "bg-[#10B981]/20 text-[#10B981]" : "bg-[#FF5252]/20 text-[#FF5252]"
                                  : "bg-[#80FF00]/20 text-[#80FF00]"
                                : "bg-white/[0.02] text-white/30"
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
                    {isCamera && m._cameraData ? (
                      <CameraEvidenceBadge data={m._cameraData} />
                    ) : (
                      <EvidenceBadge evidence={evidence} marketType={marketType} />
                    )}
                  </div>

                  {/* Footer stats */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.04] bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-white/20">payments</span>
                        <span className="text-[10px] text-white/30">Pool: <span className="text-white/60 font-bold">R$ {Number(m.pool_total || 0).toFixed(2)}</span></span>
                      </div>
                      {/* Bettors avatar stack */}
                      <BettorsStack marketId={m.id} betCount={totalBets} />
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
