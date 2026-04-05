"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import MarketCard from "@/components/MarketCard";
import MarketTicker from "@/components/MarketTicker";
import SidebarNav from "@/components/SidebarNav";
import CategoryTabs from "@/components/CategoryTabs";
import LiveCard from "@/components/LiveCard";
// BettingSlip removed for cleaner layout
import ChatPanelDesktop from "@/components/ChatPanelDesktop";
import LiveChat from "@/components/LiveChat";
import MobileNavNew from "@/components/MobileNavNew";
import AgeVerificationModal from "@/components/AgeVerificationModal";
import { initializeStore, getMarkets, tickAllMarkets } from "@/lib/engines/store";
import { CATEGORY_META } from "@/lib/engines/types";
import { useUser } from "@/lib/UserContext";
import type { PredictionMarket, MarketCategory } from "@/lib/engines/types";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import { Search, Menu, X, Tv, Trophy, Landmark, DollarSign, Cloud, Bitcoin, Globe, Radio, MousePointer, BookOpen } from "lucide-react";

// ---- WINNERS TICKER (real data from Supabase) ----
const FALLBACK_WINNERS = [
  { name: "LUCAS", amount: "R$ 2.450,00", time: "12:30" },
  { name: "TIAGO", amount: "R$ 16.432,20", time: "12:15" },
  { name: "ANA CLARA", amount: "R$ 890,50", time: "11:58" },
  { name: "PEDRO H.", amount: "R$ 5.200,00", time: "11:42" },
  { name: "GABRIELA", amount: "R$ 1.320,00", time: "11:30" },
  { name: "MARCOS", amount: "R$ 9.580,20", time: "11:18" },
  { name: "JULIANA", amount: "R$ 3.750,00", time: "10:55" },
  { name: "RAFAELA", amount: "R$ 7.890,00", time: "10:40" },
];

interface WinnerItem {
  name: string;
  amount: string | number;
  time: string;
}

function WinnersTicker() {
  const [winners, setWinners] = useState<WinnerItem[]>(FALLBACK_WINNERS);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    async function fetchWinners() {
      try {
        const { data } = await supabase
          .from("ledger")
          .select("user_id, amount, description, created_at")
          .eq("type", "bet_won")
          .order("created_at", { ascending: false })
          .limit(20);

        if (data && data.length > 0) {
          setWinners(data.map((w) => ({
            name: (w.description?.split(":")[0] || "Usuario").toUpperCase(),
            amount: `R$ ${Number(w.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            time: new Date(w.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          })));
        }
      } catch {
        // Keep fallback
      }
    }
    fetchWinners();
    const interval = setInterval(fetchWinners, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase.channel("winners-ticker")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "ledger",
        filter: "type=eq.bet_won",
      }, (payload) => {
        const row = payload.new as { user_id?: string; amount?: number; description?: string; created_at?: string };
        if (row.amount) {
          const newWinner: WinnerItem = {
            name: (row.description?.split(":")[0] || "Usuario").toUpperCase(),
            amount: `R$ ${Number(row.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            time: new Date(row.created_at || Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          };
          setWinners((prev) => [newWinner, ...prev.slice(0, 19)]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setOffset((o) => o + 1), 30);
    return () => clearInterval(iv);
  }, []);

  const items = [...winners, ...winners];
  const itemWidth = 280;
  const totalWidth = winners.length * itemWidth;
  const translateX = -(offset % totalWidth);

  return (
    <div className="bg-[hsl(0,0%,4%)] border-b border-[hsl(0,0%,18%)]/50 overflow-hidden h-8 flex items-center">
      <div className="flex items-center gap-0 whitespace-nowrap" style={{ transform: `translateX(${translateX}px)`, transition: "none" }}>
        {items.map((w, i) => (
          <div key={i} className="flex items-center gap-2.5 px-5 shrink-0" style={{ minWidth: `${itemWidth}px` }}>
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#80FF00] to-[#60CC00] flex items-center justify-center text-[8px] font-black text-[#0a0a0a] shrink-0">
              {w.name.charAt(0)}
            </div>
            <span className="text-white font-black text-[10px]">{w.name}</span>
            <span className="text-white/30 text-[9px]">{w.time}</span>
            <span className="text-[#80FF00] font-black text-[10px]">{typeof w.amount === "number" ? `R$ ${w.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : w.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useUser();
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ageVerified, setAgeVerified] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  // Check age verification from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const verified = localStorage.getItem("winify_age_verified");
      setAgeVerified(!!verified);
    }
  }, []);

  const handleAgeConfirm = () => {
    setAgeVerified(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("winify_age_verified", "true");
    }
  };

  // Fetch markets from Supabase
  useEffect(() => {
    initializeStore();

    async function refresh() {
      const local = tickAllMarkets();

      try {
        const { data: openData } = await supabase
          .from("prediction_markets")
          .select("*")
          .eq("status", "open")
          .gt("close_at", new Date().toISOString())
          .order("close_at", { ascending: true })
          .limit(80);

        const sixHoursAgo = new Date(Date.now() - 6 * 3600000).toISOString();
        const { data: resolvedData } = await supabase
          .from("prediction_markets")
          .select("*")
          .in("status", ["resolved", "closed", "cancelled"])
          .gt("resolved_at", sixHoursAgo)
          .order("resolved_at", { ascending: false })
          .limit(10);

        // Fetch all active camera markets
        const { data: cameraData } = await supabase
          .from("camera_markets")
          .select("*")
          .in("status", ["waiting", "open"]);

        // Fetch camera round pools for odds
        const camIds = (cameraData || []).map((c: Record<string, unknown>) => `cr_${c.id}_${c.round_number}`);
        const { data: camRounds } = camIds.length > 0
          ? await supabase.from("camera_rounds").select("id, pool_over, pool_under, total_pool").in("id", camIds)
          : { data: [] };
        const camRoundMap: Record<string, { pool_over: number; pool_under: number; total_pool: number }> = {};
        (camRounds || []).forEach((r: Record<string, unknown>) => {
          camRoundMap[r.id as string] = {
            pool_over: Number(r.pool_over) || 0,
            pool_under: Number(r.pool_under) || 0,
            total_pool: Number(r.total_pool) || 0,
          };
        });

        const cameraAsMarkets = (cameraData || []).map((cam: Record<string, unknown>) => {
          const roundId = `cr_${cam.id}_${cam.round_number}`;
          const pools = camRoundMap[roundId] || { pool_over: 0, pool_under: 0, total_pool: 0 };
          return {
          id: cam.id as string,
          title: (cam.title as string) || "Rodovia ao Vivo",
          short_description: `Contagem de veículos — ${cam.city || "SP"}`,
          description: `Preveja se passarão mais ou menos de ${cam.current_threshold} veículos`,
          category: "custom" as const,
          status: (cam.phase === "betting" || cam.phase === "observation") ? "open" : "open",
          stream_url: cam.stream_url as string,
          banner_url: cam.thumbnail_url as string || "",
          is_featured: true,
          created_at: cam.created_at as string,
          open_at: cam.created_at as string,
          freeze_at: null,
          close_at: (cam.phase_ends_at as string) || new Date(Date.now() + 300_000).toISOString(),
          resolve_at: null,
          resolved_at: null,
          pool_total: pools.total_pool,
          distributable_pool: pools.total_pool * 0.95,
          house_fee_percent: 0.05,
          min_bet: 1,
          max_bet: 10000,
          max_payout: 100000,
          max_liability: 500000,
          outcomes: [
            { key: "over", label: `Mais de ${cam.current_threshold}`, pool: pools.pool_over },
            { key: "under", label: `Até ${cam.current_threshold}`, pool: pools.pool_under },
          ],
          tags: ["ao-vivo", "camera"],
          source_config: { source_name: "camera", requires_manual_confirmation: false, requires_evidence_upload: false },
          resolution_rule: { expression: "", variables: [], outcome_map: {}, description: "" },
          language: "pt-BR",
          country: "BR",
        };
        });

        const allDbRows = [...cameraAsMarkets, ...(openData || []), ...(resolvedData || [])];

        if (allDbRows.length > 0) {
          const seen = new Map<string, typeof allDbRows[0]>();
          const nowISO = new Date().toISOString();
          for (const row of allDbRows) {
            const key = row.title.toLowerCase().trim();
            const existing = seen.get(key);
            if (!existing) {
              seen.set(key, row);
              continue;
            }
            const rowIsActiveFuture = row.status === "open" && row.close_at > nowISO;
            const existingIsActiveFuture = existing.status === "open" && existing.close_at > nowISO;
            if (rowIsActiveFuture && !existingIsActiveFuture) {
              seen.set(key, row);
            } else if (!rowIsActiveFuture && !existingIsActiveFuture) {
              if (row.close_at > existing.close_at) {
                seen.set(key, row);
              }
            }
          }
          const uniqueRows = Array.from(seen.values());

          const dbMarkets: PredictionMarket[] = uniqueRows.map((row) => ({
            ...row,
            created_at: new Date(row.created_at).getTime(),
            open_at: new Date(row.open_at).getTime(),
            freeze_at: row.freeze_at ? new Date(row.freeze_at).getTime() : 0,
            close_at: new Date(row.close_at).getTime(),
            resolve_at: row.resolve_at ? new Date(row.resolve_at).getTime() : 0,
            resolved_at: row.resolved_at ? new Date(row.resolved_at).getTime() : undefined,
            pool_total: Number(row.pool_total) || 0,
            distributable_pool: Number(row.distributable_pool) || 0,
            house_fee_percent: Number(row.house_fee_percent) || 0.05,
            min_bet: Number(row.min_bet) || 1,
            max_bet: Number(row.max_bet) || 10000,
            max_payout: Number(row.max_payout) || 100000,
            max_liability: Number(row.max_liability) || 500000,
            volume: Number(row.pool_total) || 0,
            tags: row.tags || [],
            outcomes: row.outcomes || [],
            source_config: row.source_config || { source_name: "", requires_manual_confirmation: false, requires_evidence_upload: false },
            resolution_rule: row.resolution_rule || { expression: "", variables: [], outcome_map: {}, description: "" },
            language: row.language || "pt-BR",
            country: row.country || "BR",
          }));

          const refreshNow = Date.now();
          dbMarkets.sort((a, b) => {
            const aActive = a.status === "open" && a.close_at > refreshNow ? 0 : 1;
            const bActive = b.status === "open" && b.close_at > refreshNow ? 0 : 1;
            if (aActive !== bActive) return aActive - bActive;
            return a.close_at - b.close_at;
          });

          const dbTitles = new Set(dbMarkets.map((m) => m.title.toLowerCase()));
          const uniqueLocal = local.filter((m) => !dbTitles.has(m.title.toLowerCase()));
          setMarkets([...dbMarkets, ...uniqueLocal]);
          setMarketsLoading(false);
          return;
        }
      } catch {
        // fallback
      }

      setMarkets(local);
      setMarketsLoading(false);
    }

    refresh();
    const iv = setInterval(refresh, 10000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const now = Date.now();
  const isStreamMarket = (m: PredictionMarket) => !!m.stream_url || m.id.startsWith("cam_");
  const getEffectiveStatus = (m: PredictionMarket) => {
    if (m.status === "open" && m.close_at < now && !isStreamMarket(m)) return "expired";
    return m.status;
  };

  const activeMarkets = markets.filter((m) => {
    if (isStreamMarket(m) && m.status === "open") return true;
    const eff = getEffectiveStatus(m);
    return eff === "open" || eff === "frozen" || eff === "awaiting_resolution";
  });

  const filtered = activeMarkets
    .filter((m) => activeCategory === "all" || m.category === activeCategory)
    .filter((m) => !search || m.title.toLowerCase().includes(search.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    const aIsLive = !!a.stream_url || a.id.startsWith("cam_");
    const bIsLive = !!b.stream_url || b.id.startsWith("cam_");
    if (aIsLive !== bIsLive) return aIsLive ? -1 : 1;
    return a.close_at - b.close_at;
  });

  // Search results for dropdown
  const searchResults = search.length > 0 && searchFocused
    ? activeMarkets.filter((m) => m.title.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="min-h-screen bg-[#0d1117] pb-20 lg:pb-0">
      {!ageVerified && <AgeVerificationModal onConfirm={handleAgeConfirm} />}

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[80%] max-w-xs bg-[#0d1117] overflow-y-auto scrollbar-hide border-r border-white/[0.06]">
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
              <img src="/logo.png" alt="PALPITEX" className="h-7 w-auto" />
              <button onClick={() => setMobileMenuOpen(false)} className="text-white/40 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04]">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-1">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2">Temas</p>
              <button onClick={() => { setActiveCategory("all"); setMobileMenuOpen(false); }} className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm ${activeCategory === "all" ? "bg-[#80FF00]/10 text-[#80FF00] font-semibold" : "text-white/60"}`}>
                <Search size={16} /> Todos
              </button>
              {[
                { icon: Tv, label: "Entretenimento", value: "entertainment" },
                { icon: Trophy, label: "Esportes", value: "sports" },
                { icon: Landmark, label: "Política", value: "politics" },
                { icon: DollarSign, label: "Financeiro", value: "economy" },
                { icon: Cloud, label: "Clima", value: "weather" },
                { icon: Bitcoin, label: "Criptomoedas", value: "crypto" },
                { icon: Globe, label: "Geopolítica", value: "war" },
              ].map((cat) => (
                <button key={cat.value} onClick={() => { setActiveCategory(cat.value); setMobileMenuOpen(false); }} className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm ${activeCategory === cat.value ? "bg-[#80FF00]/10 text-[#80FF00] font-semibold" : "text-white/60"}`}>
                  <cat.icon size={16} /> {cat.label}
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      {/* Ticker — fixed top */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <MarketTicker />
        <WinnersTicker />
      </div>

      {/* Header */}
      <header className="fixed top-[62px] left-0 lg:left-44 right-0 z-30 bg-[#0d1117]/95 backdrop-blur-xl border-b border-white/[0.04] h-14 flex items-center px-3 lg:px-5 gap-3">
        <button className="lg:hidden text-white/70" onClick={() => setMobileMenuOpen(true)}>
          <Menu size={22} />
        </button>
        <Link href="/" className="shrink-0">
          <img src="/logo.png" alt="PALPITEX" className="h-7 w-auto" />
        </Link>
        {/* Search — desktop */}
        <div className="hidden lg:block flex-1 max-w-md mx-4 relative" ref={searchRef}>
          <div className="flex items-center bg-white/[0.04] rounded-lg border border-white/[0.06] px-3 py-2">
            <Search size={15} className="text-white/30 shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setSearchFocused(true)} placeholder="Pesquisar por Mercados..." className="bg-transparent text-sm text-white placeholder:text-white/30 outline-none flex-1 ml-2" />
          </div>
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#161b22] border border-white/[0.06] rounded-lg shadow-2xl shadow-black/60 overflow-hidden z-[60]">
              {searchResults.map((m) => (
                <Link key={m.id} href={m.stream_url || m.id.startsWith("cam_") ? `/camera/${m.id}` : `/evento/${m.id}`} onClick={() => { setSearch(""); setSearchFocused(false); }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors">
                  {m.banner_url ? <img src={m.banner_url} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" /> : <div className="w-8 h-8 rounded-md bg-white/[0.06] flex items-center justify-center shrink-0"><Icon name="monitoring" size={14} className="text-white/20" /></div>}
                  <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{m.title}</p><p className="text-[11px] text-white/30">{CATEGORY_META[m.category as MarketCategory]?.label || m.category}</p></div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href="/deposito" className="bg-[#80FF00] text-[#0a0a0a] px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-black flex items-center gap-1.5 hover:opacity-90 transition-all">
                <Icon name="add" size={16} weight="bold" />Depositar
              </Link>
              <Link href="/perfil" className="bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-lg text-sm font-bold text-[#80FF00] hidden sm:block">R$ {user.balance.toFixed(2)}</Link>
            </>
          ) : (
            <>
              <Link href="/login" className="text-white/70 px-3 py-2 rounded-lg text-sm font-medium hover:text-white transition-colors hidden sm:block">Entrar</Link>
              <Link href="/criar-conta" className="bg-[#80FF00] text-[#0a0a0a] px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity">Registrar</Link>
            </>
          )}
        </div>
      </header>

      {/* Spacer */}
      <div className="h-[108px]" />

      <div className="flex">
        {/* Sidebar — desktop only */}
        <SidebarNav activeCategory={activeCategory} onCategoryChange={setActiveCategory} />

        {/* Main */}
        <main className={`flex-1 lg:ml-44 px-3 sm:px-4 lg:px-6 py-4 min-w-0 max-w-full overflow-x-hidden transition-all ${chatOpen ? "xl:mr-72" : "xl:mr-8"}`}>
          {/* Banner */}
          <div className="rounded-xl overflow-hidden mb-4">
            <img src="https://ik.imagekit.io/b4wareuuf/images/banner_s_n.png" alt="Banner" className="w-full h-36 sm:h-48 lg:h-56 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>

          {/* Categories */}
          <CategoryTabs active={activeCategory} onChange={setActiveCategory} />

          {/* Search — mobile */}
          <div className="lg:hidden flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 mb-4">
            <Search size={16} className="text-white/30" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar mercados..." className="bg-transparent text-sm text-white placeholder:text-white/30 outline-none flex-1" />
          </div>

          {/* Live Card */}
          <LiveCard />

          {/* Markets */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-base sm:text-lg font-bold text-white">
                {activeCategory === "all" ? "Todos os Mercados" : CATEGORY_META[activeCategory as MarketCategory]?.label || "Mercados"}
              </h2>
              <span className="text-xs sm:text-sm text-white/40">({sorted.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {marketsLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 h-[180px] animate-pulse">
                    <div className="flex items-center gap-2 mb-3"><div className="w-14 h-4 rounded bg-white/[0.06]" /></div>
                    <div className="flex gap-2.5 mb-3"><div className="w-9 h-9 rounded-lg bg-white/[0.06]" /><div className="flex-1 space-y-2"><div className="h-3.5 rounded bg-white/[0.06] w-3/4" /><div className="h-3 rounded bg-white/[0.04] w-1/2" /></div></div>
                    <div className="space-y-1.5"><div className="h-3 rounded bg-white/[0.04]" /><div className="h-3 rounded bg-white/[0.04] w-4/5" /></div>
                  </div>
                ))
              ) : sorted.length > 0 ? (
                sorted.map((m) => <MarketCard key={m.id} market={m} />)
              ) : (
                <div className="col-span-full text-center py-16 text-white/30">
                  <Icon name="search_off" size={36} className="mb-2 mx-auto block" />
                  <p className="text-sm">Nenhum mercado encontrado.</p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className={`border-t border-white/[0.04] bg-[#080c14] lg:ml-44 transition-all ${chatOpen ? "xl:mr-72" : "xl:mr-8"}`}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="col-span-2 sm:col-span-4 lg:col-span-1 mb-4 lg:mb-0">
              <img src="/logo.png" alt="PALPITEX" className="h-7 w-auto mb-3" />
              <p className="text-[11px] text-white/30 leading-relaxed max-w-[240px]">A plataforma onde seu conhecimento vira oportunidade.</p>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-white/50 uppercase tracking-wider mb-3">Categorias</h4>
              <ul className="space-y-1.5">
                {["Criptomoedas", "Esportes", "Entretenimento", "Política"].map((c) => (
                  <li key={c}><button onClick={() => { setActiveCategory(c === "Criptomoedas" ? "crypto" : c === "Esportes" ? "sports" : c === "Entretenimento" ? "entertainment" : "politics"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-[11px] text-white/40 hover:text-[#80FF00] transition-colors">{c}</button></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-white/50 uppercase tracking-wider mb-3">Conta</h4>
              <ul className="space-y-1.5">
                <li><Link href="/perfil" className="text-[11px] text-white/40 hover:text-[#80FF00] transition-colors">Perfil</Link></li>
                <li><Link href="/saldos" className="text-[11px] text-white/40 hover:text-[#80FF00] transition-colors">Apostas</Link></li>
                <li><Link href="/deposito" className="text-[11px] text-white/40 hover:text-[#80FF00] transition-colors">Depósito</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black text-white/50 uppercase tracking-wider mb-3">Suporte</h4>
              <ul className="space-y-1.5">
                <li><span className="text-[11px] text-white/40 hover:text-[#80FF00] transition-colors cursor-pointer">FAQ</span></li>
                <li><span className="text-[11px] text-white/40 hover:text-[#80FF00] transition-colors cursor-pointer">Termos</span></li>
                <li><span className="text-[11px] text-white/40 hover:text-[#80FF00] transition-colors cursor-pointer">Privacidade</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/[0.04] mt-6 pt-4 text-center">
            <p className="text-[10px] text-white/20">Todos os direitos reservados &copy; 2026 PALPITEX | Jogue com responsabilidade. +18</p>
          </div>
        </div>
      </footer>

      {/* Chat — desktop sidebar */}
      <ChatPanelDesktop isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />

      {/* Chat — mobile modal */}
      <LiveChat isOpen={mobileChatOpen} onClose={() => setMobileChatOpen(false)} />

      <MobileNavNew onChatOpen={() => setMobileChatOpen(true)} />
    </div>
  );
}
