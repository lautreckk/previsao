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
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ageVerified, setAgeVerified] = useState(true);

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

        const allDbRows = [...(openData || []), ...(resolvedData || [])];

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
    <div className="min-h-screen bg-[#121212] pb-16 lg:pb-0">
      {!ageVerified && (
        <AgeVerificationModal onConfirm={handleAgeConfirm} />
      )}

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[85%] max-w-sm bg-[#121212] overflow-y-auto animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between px-4 py-4">
              <h2 className="text-[#80FF00] font-black text-xl tracking-tight">PALPITEX</h2>
              <button onClick={() => setMobileMenuOpen(false)} className="text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)] w-10 h-10 flex items-center justify-center rounded-full bg-[hsl(0,0%,14%)]">
                <X size={20} />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-[hsl(0,0%,55%)] uppercase tracking-wider font-semibold mb-3">Ao Vivo</p>
              <Link href="/camera/cam_highway" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between w-full py-2.5 text-[hsl(0,0%,95%)]">
                <div className="flex items-center gap-3">
                  <Radio size={18} className="text-[hsl(0,0%,55%)]" />
                  <span className="text-sm">Rodovia</span>
                </div>
                <span className="text-xs font-bold text-[hsl(0,84%,60%)] animate-pulse">LIVE</span>
              </Link>
            </div>
            <div className="border-t border-[hsl(0,0%,18%)] mx-4" />
            <div className="px-4 py-3">
              <p className="text-xs text-[hsl(0,0%,55%)] uppercase tracking-wider font-semibold mb-3">Cripto 5 min</p>
              {[
                { icon: "🟠", label: "BTC", change: "+1.2%", positive: true },
                { icon: "💎", label: "ETH", change: "+2.9%", positive: true },
                { icon: "🟣", label: "SOL", change: "+0.8%", positive: true },
                { icon: "⚪", label: "XRP", change: "+1.5%", positive: true },
                { icon: "🟡", label: "DOGE", change: "+1.7%", positive: true },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm text-[hsl(0,0%,95%)] font-medium">{item.label}</span>
                  </div>
                  <span className={`text-sm font-semibold ${item.positive ? 'text-[#80FF00]' : 'text-[hsl(0,84%,60%)]'}`}>
                    {item.change}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-[hsl(0,0%,18%)] mx-4" />
            <div className="px-4 py-3">
              <p className="text-xs text-[hsl(0,0%,55%)] uppercase tracking-wider font-semibold mb-3">Temas</p>
              {[
                { icon: Tv, label: "Entretenimento", count: 22, value: "entertainment" },
                { icon: Trophy, label: "Esportes", count: 80, value: "sports" },
                { icon: Landmark, label: "Política", count: 17, value: "politics" },
                { icon: DollarSign, label: "Financeiro", count: 35, value: "economy" },
                { icon: Cloud, label: "Clima", count: 10, value: "weather" },
                { icon: Bitcoin, label: "Criptomoedas", count: 3273, value: "crypto" },
                { icon: Globe, label: "Geopolítica", count: 118, value: "war" },
              ].map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => { setActiveCategory(cat.value); setMobileMenuOpen(false); }}
                  className={`flex items-center justify-between w-full py-2.5 text-sm ${
                    activeCategory === cat.value ? "text-[#80FF00] font-semibold" : "text-[hsl(0,0%,95%)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <cat.icon size={18} className="text-[hsl(0,0%,55%)]" />
                    <span>{cat.label}</span>
                  </div>
                  <span className="text-xs text-[hsl(0,0%,55%)]">{cat.count}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-[hsl(0,0%,18%)] mx-4" />
            <div className="px-4 py-4 space-y-1">
              <button className="flex items-center gap-3 text-sm text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)] w-full py-2.5">
                <MousePointer size={18} />
                <span>Precisão</span>
              </button>
              <Link href="/como-funciona" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 text-sm text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)] w-full py-2.5">
                <BookOpen size={18} />
                <span>Dúvidas</span>
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Ticker */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <MarketTicker />
      </div>

      {/* Winners Ticker */}
      <div className="fixed top-[30px] left-0 right-0 z-40">
        <WinnersTicker />
      </div>

      {/* Top Nav */}
      <header className="fixed top-[62px] left-0 right-0 z-30 bg-[#121212] border-b border-[hsl(0,0%,18%)]">
        <div className="flex items-center justify-between px-3 lg:px-4 h-14">
          {/* Left: Menu + Logo */}
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-[hsl(0,0%,95%)]" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <Link href="/">
              <img src="/logo.png" alt="PALPITEX" className="h-8 w-auto" />
            </Link>
            {/* Desktop search */}
            <div className="hidden lg:flex items-center gap-2 bg-[hsl(0,0%,14%)] rounded-lg px-3 py-1.5 w-64 ml-2 relative" ref={searchRef}>
              <Search size={14} className="text-[hsl(0,0%,55%)]" />
              <input
                type="text"
                placeholder="Pesquisar por Mercados, Top"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                className="bg-transparent text-xs text-[hsl(0,0%,95%)] placeholder:text-[hsl(0,0%,55%)] outline-none flex-1"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#121212] border border-[hsl(0,0%,18%)] rounded-lg shadow-2xl shadow-black/50 overflow-hidden z-[60]">
                  {searchResults.map((m) => {
                    const isCam = !!m.stream_url || m.id.startsWith("cam_");
                    const href = isCam ? `/camera/${m.id}` : `/evento/${m.id}`;
                    return (
                      <Link
                        key={m.id}
                        href={href}
                        onClick={() => { setSearch(""); setSearchFocused(false); }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(0,0%,14%)] transition-colors"
                      >
                        {m.banner_url ? (
                          <img src={m.banner_url} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-[hsl(0,0%,14%)] flex items-center justify-center shrink-0">
                            <Icon name="monitoring" size={16} className="text-white/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{m.title}</p>
                          <p className="text-xs text-white/30">{CATEGORY_META[m.category as MarketCategory]?.label || m.category}</p>
                        </div>
                        <span className="text-xs text-[#80FF00] font-bold shrink-0">R$ {(m.pool_total || 0).toFixed(2)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Auth buttons */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link href="/deposito" className="kinetic-gradient text-[#0a0a0a] px-4 py-2 rounded-lg text-sm font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(128,255,0,0.3)] hover:shadow-[0_0_25px_rgba(128,255,0,0.5)] hover:scale-105 active:scale-95 transition-all">
                  <Icon name="add" size={18} weight="bold" />Depositar
                </Link>
                <Link href="/perfil" className="bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,18%)] px-3 py-1.5 rounded-lg text-sm font-bold text-[#80FF00]">R$ {user.balance.toFixed(2)}</Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="border border-[hsl(0,0%,18%)] text-[hsl(0,0%,95%)] px-5 py-2 rounded-lg text-sm font-medium hover:bg-[hsl(0,0%,14%)] transition-colors"
                >
                  Entrar
                </Link>
                <Link
                  href="/criar-conta"
                  className="bg-[#80FF00] text-[#0a0a0a] px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  Registrar
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Spacer for fixed header + ticker + winners */}
      <div className="h-[108px]" />

      <div className="flex">
        {/* Desktop Sidebar */}
        <SidebarNav
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />

        {/* Main content */}
        <main className="flex-1 lg:ml-44 px-3 sm:px-4 lg:px-5 py-4 min-w-0 overflow-x-hidden">
          {/* Banner */}
          <div className="relative rounded-xl overflow-hidden mb-4">
            <img
              src="https://ik.imagekit.io/b4wareuuf/images/banner_s_n.png"
              alt="Banner Votações e Previsões"
              className="w-full h-44 sm:h-56 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>

          {/* Category Tabs */}
          <CategoryTabs active={activeCategory} onChange={setActiveCategory} />

          {/* Mobile Search bar */}
          <div className="lg:hidden flex items-center gap-2 bg-[hsl(0,0%,14%)] rounded-lg px-3 py-2.5 mb-5">
            <Search size={16} className="text-[hsl(0,0%,55%)]" />
            <input
              type="text"
              placeholder="Pesquisar mercados..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm text-[hsl(0,0%,95%)] placeholder:text-[hsl(0,0%,55%)] outline-none flex-1"
            />
          </div>

          {/* AO VIVO Card */}
          <LiveCard />

          {/* Market Grid */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-[hsl(0,84%,60%)] animate-pulse" />
              <h2 className="text-lg font-bold text-[hsl(0,0%,95%)]">
                {activeCategory === "all" ? "Todos os Mercados" : CATEGORY_META[activeCategory as MarketCategory]?.label || "Mercados"}
              </h2>
              <span className="text-sm text-[hsl(0,0%,55%)]">({sorted.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {marketsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-[hsl(0,0%,18%)] bg-[hsl(0,0%,11%)] p-4 h-[200px] animate-pulse">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-16 h-5 rounded-md bg-white/[0.06]" />
                    </div>
                    <div className="flex items-start gap-2.5 mb-4">
                      <div className="w-9 h-9 rounded-lg bg-white/[0.06]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 rounded bg-white/[0.06] w-3/4" />
                        <div className="h-3 rounded bg-white/[0.04] w-1/2" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 rounded bg-white/[0.04]" />
                      <div className="h-3 rounded bg-white/[0.04]" />
                    </div>
                  </div>
                ))
              ) : sorted.length > 0 ? (
                sorted.map((m) => <MarketCard key={m.id} market={m} />)
              ) : (
                <div className="col-span-full text-center py-12 text-[hsl(0,0%,55%)]">
                  <Icon name="search_off" size={40} className="mb-2 mx-auto block" />
                  <p>Nenhum mercado encontrado.</p>
                </div>
              )}
            </div>
          </section>
        </main>

        {/* Chat Panel - desktop only */}
        <ChatPanelDesktop isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
      </div>

      {/* Footer */}
      <footer className="border-t border-[hsl(0,0%,18%)] bg-[hsl(0,0%,4%)] mt-8 lg:ml-44">
        <div className="max-w-screen-xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
            <div className="col-span-2 sm:col-span-4 lg:col-span-1">
              <img src="/logo.png" alt="PALPITEX" className="h-8 w-auto mb-3" />
              <p className="text-xs text-[hsl(0,0%,55%)] leading-relaxed max-w-[240px]">A plataforma onde seu conhecimento vira oportunidade. Mercados de previsão em tempo real.</p>
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3">Categorias</h4>
              <ul className="space-y-2">
                {(["Criptomoedas", "Esportes", "Entretenimento", "Política"] as const).map((c) => (
                  <li key={c}><button onClick={() => { setActiveCategory(c === "Criptomoedas" ? "crypto" : c === "Esportes" ? "sports" : c === "Entretenimento" ? "entertainment" : "politics"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xs text-white/50 hover:text-[#80FF00] transition-colors">{c}</button></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3">Mercados</h4>
              <ul className="space-y-2">
                <li><button onClick={() => { setActiveCategory("all"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xs text-white/50 hover:text-[#80FF00] transition-colors">Todos os mercados</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3">Minha conta</h4>
              <ul className="space-y-2">
                <li><Link href="/perfil" className="text-xs text-white/50 hover:text-[#80FF00] transition-colors">Perfil</Link></li>
                <li><Link href="/saldos" className="text-xs text-white/50 hover:text-[#80FF00] transition-colors">Minhas apostas</Link></li>
                <li><Link href="/deposito" className="text-xs text-white/50 hover:text-[#80FF00] transition-colors">Depósito</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3">Suporte</h4>
              <ul className="space-y-2">
                <li><span className="text-xs text-white/50 hover:text-[#80FF00] transition-colors cursor-pointer">FAQ</span></li>
                <li><span className="text-xs text-white/50 hover:text-[#80FF00] transition-colors cursor-pointer">Termos de Uso</span></li>
                <li><span className="text-xs text-white/50 hover:text-[#80FF00] transition-colors cursor-pointer">Privacidade</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/[0.04] mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[10px] text-[hsl(0,0%,30%)]">Todos os direitos reservados | Copyright &copy; 2026 | Powered by Oracore</p>
            <p className="text-[10px] text-[hsl(0,0%,30%)]">Jogue com responsabilidade. +18</p>
          </div>
        </div>
      </footer>

      {/* Mobile Nav */}
      <MobileNavNew />
    </div>
  );
}
