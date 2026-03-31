"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import MarketCard from "@/components/MarketCard";
import BottomNav from "@/components/BottomNav";
import { initializeStore, getMarkets, tickAllMarkets } from "@/lib/engines/store";
import { CATEGORY_META } from "@/lib/engines/types";
import { useUser } from "@/lib/UserContext";
import type { PredictionMarket, MarketCategory } from "@/lib/engines/types";
import { supabase } from "@/lib/supabase";

// ---- WINNERS TICKER ----
const FAKE_WINNERS = [
  { name: "LUCAS", game: "BBB 26", amount: "R$ 2.450,00" },
  { name: "TIAGO", game: "BTC 5min", amount: "R$ 16.432,20" },
  { name: "ANA CLARA", game: "Dolar Diario", amount: "R$ 890,50" },
  { name: "PEDRO H.", game: "Flamengo", amount: "R$ 5.200,00" },
  { name: "GABRIELA", game: "Clima SP", amount: "R$ 1.320,00" },
  { name: "MARCOS", game: "Rodovia 5min", amount: "R$ 9.580,20" },
  { name: "JULIANA", game: "Anitta", amount: "R$ 3.750,00" },
  { name: "RAFAELA", game: "Petroleo", amount: "R$ 7.890,00" },
  { name: "CARLOS", game: "Shakira", amount: "R$ 4.100,00" },
  { name: "FERNANDA", game: "Champions", amount: "R$ 12.300,00" },
  { name: "DIEGO", game: "IBOVESPA", amount: "R$ 6.540,00" },
  { name: "BRUNA", game: "BBB 26", amount: "R$ 8.200,00" },
  { name: "RODRIGO", game: "Neymar", amount: "R$ 2.100,00" },
  { name: "CAMILA", game: "Virginia", amount: "R$ 1.800,00" },
  { name: "FELIPE", game: "ETH 5min", amount: "R$ 11.250,00" },
  { name: "AMANDA", game: "Carlinhos", amount: "R$ 950,00" },
];

function WinnersTicker() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setOffset((o) => o + 1), 30);
    return () => clearInterval(iv);
  }, []);

  // Double the array for seamless loop
  const items = [...FAKE_WINNERS, ...FAKE_WINNERS];
  const itemWidth = 280; // approx width per item
  const totalWidth = FAKE_WINNERS.length * itemWidth;
  const translateX = -(offset % totalWidth);

  return (
    <div className="bg-[#060d18] border-b border-[#1a2a3a] overflow-hidden h-10 flex items-center">
      <div className="flex items-center gap-0 whitespace-nowrap" style={{ transform: `translateX(${translateX}px)`, transition: "none" }}>
        {items.map((w, i) => (
          <div key={i} className="flex items-center gap-2.5 px-5 shrink-0" style={{ minWidth: `${itemWidth}px` }}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FF8C00] flex items-center justify-center text-[10px] font-black text-white shrink-0">
              {w.name.charAt(0)}
            </div>
            <span className="text-white font-black text-xs">{w.name}</span>
            <span className="text-[#5A6478] text-[10px]">{w.game}</span>
            <span className="text-[#00FFB8] font-black text-xs">{w.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Chat mock data
const chatUsers = [
  "@renandouglas1903", "@victorturito08", "@suelicapela10", "@ronaldopvneto",
  "@moisesmesquita0702", "@allansilsou", "@carvalho280922", "@kaueeduardokj",
  "@pedrohenrique99", "@julianacosta12", "@felipematos_", "@brunasantos777",
];
const chatMessages = [
  "under,gg - 83 previsoes", "Desgeaca de mulher soe for mulher - 1 previsoes",
  "mensagem apagada", "GG - 5 previsoes", "So pesquisar no telegram - 27 previsoes",
  "tu e mlk so 3 prev willian - 68 previsoes", "quem foi de under ta maluko - 135 previsoes",
  "grupo telegram operando 100% acertivo! pesquisem @rodoviasinais",
  "ENTAO EU SOU LOUCO - 55 previsoes", "estamos jogando juntos no grupo do telegram!! entrem @rodoviasinais",
  "bora lucrar galera", "acertei 5 seguidas", "alguem mais ta no btc?",
  "essa do clima ta facil", "quem apostou no flamengo?",
];

// Avatar colors per user (deterministic from name)
const AVATAR_COLORS = [
  "from-[#FF6B6B] to-[#EE5A24]", "from-[#00D4AA] to-[#00B894]",
  "from-[#6C5CE7] to-[#A29BFE]", "from-[#FDCB6E] to-[#F39C12]",
  "from-[#00CEFF] to-[#0984E3]", "from-[#FD79A8] to-[#E84393]",
  "from-[#55E6C1] to-[#58B19F]", "from-[#FF9FF3] to-[#F368E0]",
];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Badge tiers based on fake prediction count
const BADGES: { min: number; icon: string; color: string; label: string }[] = [
  { min: 100, icon: "local_fire_department", color: "text-[#FF6B6B]", label: "Top" },
  { min: 50, icon: "bolt", color: "text-[#FDCB6E]", label: "Ativo" },
  { min: 20, icon: "trending_up", color: "text-[#00D4AA]", label: "Regular" },
];
function getUserBadge(text: string) {
  const match = text.match(/(\d+)\s*previsoes/);
  const count = match ? parseInt(match[1]) : 0;
  return BADGES.find((b) => count >= b.min) || null;
}

export default function Home() {
  const { user } = useUser();
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"closing" | "relampago" | "hot">("closing");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [chatMsgs, setChatMsgs] = useState<{ user: string; text: string; id: number; ts: number }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const onlineCount = useRef(620 + Math.floor(Math.random() * 40));
  const [chatOpen, setChatOpen] = useState(true);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const [catScrollState, setCatScrollState] = useState<{ left: boolean; right: boolean }>({ left: false, right: true });

  useEffect(() => {
    initializeStore();

    async function refresh() {
      // Local markets (legacy seed)
      const local = tickAllMarkets();

      // Supabase markets (AI-generated + admin-created)
      try {
        const { data } = await supabase
          .from("prediction_markets")
          .select("*")
          .in("status", ["open", "frozen", "closed", "awaiting_resolution"])
          .order("close_at", { ascending: true })
          .limit(100);

        if (data && data.length > 0) {
          // Convert DB format to PredictionMarket
          const dbMarkets: PredictionMarket[] = data.map((row) => ({
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

          // Merge: DB markets first, then local (dedup by title)
          const dbTitles = new Set(dbMarkets.map((m) => m.title.toLowerCase()));
          const uniqueLocal = local.filter((m) => !dbTitles.has(m.title.toLowerCase()));
          setMarkets([...dbMarkets, ...uniqueLocal]);
          return;
        }
      } catch {
        // Supabase not available, fall back to local
      }

      setMarkets(local);
    }

    refresh();
    const iv = setInterval(refresh, 10000);
    return () => clearInterval(iv);
  }, []);

  // Seed chat messages
  useEffect(() => {
    const now = Date.now();
    const initial = Array.from({ length: 8 }, (_, i) => ({
      user: chatUsers[i % chatUsers.length],
      text: chatMessages[i % chatMessages.length],
      id: i,
      ts: now - (8 - i) * 30000,
    }));
    setChatMsgs(initial);
  }, []);

  // Auto chat messages
  useEffect(() => {
    const iv = setInterval(() => {
      const u = chatUsers[Math.floor(Math.random() * chatUsers.length)];
      const text = chatMessages[Math.floor(Math.random() * chatMessages.length)];
      setChatMsgs((prev) => [...prev.slice(-50), { user: u, text, id: Date.now(), ts: Date.now() }]);
      if (!isAtBottom) setUnreadCount((c) => c + 1);
    }, 4000 + Math.random() * 6000);
    return () => clearInterval(iv);
  }, [isAtBottom]);

  // Smart auto-scroll: only if user is at bottom
  useEffect(() => {
    if (isAtBottom) {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [chatMsgs, isAtBottom]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChatScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setIsAtBottom(atBottom);
    if (atBottom) setUnreadCount(0);
  }, []);

  const updateCatScroll = useCallback(() => {
    const el = catScrollRef.current;
    if (!el) return;
    setCatScrollState({
      left: el.scrollLeft > 8,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 8,
    });
  }, []);

  useEffect(() => {
    const el = catScrollRef.current;
    if (!el) return;
    updateCatScroll();
    const ro = new ResizeObserver(updateCatScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateCatScroll]);

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatMsgs((prev) => [...prev.slice(-50), { user: user ? `@${user.name.split(" ")[0].toLowerCase()}` : "@voce", text: chatInput.trim(), id: Date.now(), ts: Date.now() }]);
    setChatInput("");
    setIsAtBottom(true);
  }, [chatInput, user]);

  const now = Date.now();
  const openMarkets = markets.filter((m) => ["open", "frozen", "closed", "awaiting_resolution"].includes(m.status));
  const filtered = openMarkets
    .filter((m) => activeCategory === "all" || m.category === activeCategory)
    .filter((m) => !search || m.title.toLowerCase().includes(search.toLowerCase()));

  // Priority categories (gossip/entertainment first)
  const catPriority: Record<string, number> = {
    entertainment: 0, social_media: 1, custom: 2, sports: 3,
    politics: 4, weather: 5, economy: 6, crypto: 7, war: 8,
  };

  // For "Relampago" tab, filter to markets closing within 2 hours
  const TWO_HOURS = 2 * 3600000;
  const displayMarkets = activeTab === "relampago"
    ? filtered.filter((m) => m.close_at - now > 0 && m.close_at - now <= TWO_HOURS)
    : filtered;

  const sorted = [...displayMarkets].sort((a, b) => {
    // Featured always first
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;

    if (activeTab === "hot") {
      return (b.pool_total || 0) - (a.pool_total || 0);
    }

    // "Encerram em breve" and "Relampago": sort by closing time
    const aIsLive = !!a.stream_url || a.id.startsWith("cam_");
    const bIsLive = !!b.stream_url || b.id.startsWith("cam_");
    if (aIsLive !== bIsLive) return aIsLive ? 1 : -1;
    return a.close_at - b.close_at;
  });

  const catEntries = Object.entries(CATEGORY_META) as [MarketCategory, { label: string; icon: string; color: string }][];

  return (
    <div className="min-h-screen bg-[#080d1a] overflow-x-hidden">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#0d1525]/95 backdrop-blur-xl border-b border-[#1a2a3a] px-4 lg:px-6 h-14 flex items-center gap-4">
        <Link href="/" className="shrink-0">
          <img src="/logo.png" alt="Winify" className="h-10 w-auto" />
        </Link>
        <div className="flex-1 max-w-lg mx-auto hidden sm:block" ref={searchRef}>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6478] text-sm">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Buscar mercados..."
              className="w-full bg-[#0d1525] rounded-lg pl-10 pr-4 py-2 text-sm text-white border border-[#2a3444] outline-none focus:border-[#00D4AA]/40 placeholder-[#5A6478]"
            />
            {search.length > 0 && searchFocused && (() => {
              const results = openMarkets
                .filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
                .slice(0, 6);
              return results.length > 0 ? (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1525] border border-[#2a3444] rounded-lg shadow-2xl shadow-black/50 overflow-hidden z-[60]">
                  {results.map((m) => {
                    const isCam = !!m.stream_url || m.id.startsWith("cam_");
                    const href = isCam ? `/camera/${m.id}` : `/evento/${m.id}`;
                    return (
                      <Link
                        key={m.id}
                        href={href}
                        onClick={() => { setSearch(""); setSearchFocused(false); }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1a2332] transition-colors"
                      >
                        {m.image_url ? (
                          <img src={m.image_url} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-[#1a2332] flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[#5A6478] text-sm">monitoring</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{m.title}</p>
                          <p className="text-xs text-[#5A6478]">{CATEGORY_META[m.category as MarketCategory]?.label || m.category}</p>
                        </div>
                        <span className="text-xs text-[#00D4AA] font-bold shrink-0">R$ {(m.pool_total || 0).toFixed(2)}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1525] border border-[#2a3444] rounded-lg shadow-2xl shadow-black/50 z-[60] px-4 py-3 text-center text-sm text-[#5A6478]">
                  Nenhum mercado encontrado
                </div>
              );
            })()}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href="/deposito" className="kinetic-gradient text-[#003D2E] px-4 py-2 rounded-lg text-sm font-black flex items-center gap-1.5 animate-pulse shadow-[0_0_25px_rgba(0,255,184,0.5)] hover:shadow-[0_0_30px_rgba(0,255,184,0.6)] active:scale-95 transition-all">
                <span className="material-symbols-outlined text-base">add</span>Depositar
              </Link>
              <Link href="/perfil" className="bg-[#1a2332] border border-[#2a3444] px-3 py-1.5 rounded-lg text-sm font-bold text-[#00D4AA]">R$ {user.balance.toFixed(2)}</Link>
            </>
          ) : (
            <Link href="/login" className="kinetic-gradient text-[#003D2E] px-5 py-2 rounded-lg text-sm font-black shadow-[0_0_20px_rgba(0,212,170,0.4)]">Entrar</Link>
          )}
        </div>
      </header>

      {/* MOBILE SEARCH - visible only on small screens */}
      <div className="sm:hidden px-4 pt-3 pb-1">
        <div className="relative" ref={searchRef}>
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6478] text-sm">search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="Buscar mercados..."
            className="w-full bg-[#0d1525] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white border border-[#2a3444] outline-none focus:border-[#00D4AA]/40 placeholder-[#5A6478]"
          />
          {search.length > 0 && searchFocused && (() => {
            const results = openMarkets
              .filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
              .slice(0, 6);
            return results.length > 0 ? (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1525] border border-[#2a3444] rounded-lg shadow-2xl shadow-black/50 overflow-hidden z-[60]">
                {results.map((m) => {
                  const isCam = !!m.stream_url || m.id.startsWith("cam_");
                  const href = isCam ? `/camera/${m.id}` : `/evento/${m.id}`;
                  return (
                    <Link
                      key={m.id}
                      href={href}
                      onClick={() => { setSearch(""); setSearchFocused(false); }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1a2332] transition-colors"
                    >
                      {m.image_url ? (
                        <img src={m.image_url} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-[#1a2332] flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[#5A6478] text-sm">monitoring</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{m.title}</p>
                        <p className="text-xs text-[#5A6478]">{CATEGORY_META[m.category as MarketCategory]?.label || m.category}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1525] border border-[#2a3444] rounded-lg shadow-2xl shadow-black/50 z-[60] px-4 py-3 text-center text-sm text-[#5A6478]">
                Nenhum mercado encontrado
              </div>
            );
          })()}
        </div>
      </div>

      {/* WINNERS TICKER */}
      <WinnersTicker />

      {/* PROMO BANNER */}
      <div className="px-4 lg:px-6 py-3 max-w-screen-xl mx-auto">
        <Link href="/criar-conta">
          <div className="relative w-full rounded-2xl overflow-hidden group cursor-pointer hover:shadow-[0_0_40px_rgba(0,212,170,0.3)] transition-all border border-[#00D4AA]/20 max-h-[200px] sm:max-h-[260px] lg:max-h-[320px]">
            <img src="/banner-promo.png" alt="Aqui tudo que voce sabe vira dinheiro! Jogue a partir de R$10" className="w-full h-full object-cover rounded-2xl" />
          </div>
        </Link>
      </div>

      <div className="flex">
        {/* MAIN CONTENT */}
        <main className="flex-1 min-w-0">
          {/* Categories row with scroll indicators */}
          <div className="relative border-b border-[#2a3444]">
            {catScrollState.left && (
              <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0d1525] to-transparent z-10 pointer-events-none" />
            )}
            {catScrollState.right && (
              <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0d1525] to-transparent z-10 pointer-events-none" />
            )}
            <div
              ref={catScrollRef}
              onScroll={updateCatScroll}
              className="px-4 lg:px-6 py-3 flex items-center gap-1 overflow-x-auto no-scrollbar"
            >
              <button onClick={() => setActiveCategory("all")} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-all ${activeCategory === "all" ? "bg-[#00FFB8]/10 border border-[#00FFB8]/40 text-[#00FFB8]" : "text-[#8B95A8] hover:text-white"}`}>
                <span className="material-symbols-outlined text-sm">dashboard</span>Todos
              </button>
              {catEntries.map(([key, meta]) => (
                <button key={key} onClick={() => setActiveCategory(key)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-all ${activeCategory === key ? "bg-[#00FFB8]/10 border border-[#00FFB8]/40 text-[#00FFB8]" : "text-[#8B95A8] hover:text-white"}`}>
                  <span className="material-symbols-outlined text-sm">{meta.icon}</span>{meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sub tabs */}
          <div className="px-4 lg:px-6 py-3 flex gap-6 text-sm border-b border-[#2a3444]">
            <button onClick={() => setActiveTab("closing")} className={`font-semibold pb-1 transition-all ${activeTab === "closing" ? "text-white border-b-2 border-white" : "text-[#5A6478]"}`}>Encerram em breve</button>
            <button onClick={() => setActiveTab("relampago")} className={`font-semibold pb-1 transition-all flex items-center gap-1.5 ${activeTab === "relampago" ? "text-[#FFB800] border-b-2 border-[#FFB800]" : "text-[#5A6478]"}`}>
              <span className="material-symbols-outlined text-sm">bolt</span>Relampago
            </button>
            <button onClick={() => setActiveTab("hot")} className={`font-semibold pb-1 transition-all ${activeTab === "hot" ? "text-white border-b-2 border-white" : "text-[#5A6478]"}`}>Em Alta</button>
          </div>

          {/* GRID - responsive columns */}
          <div className="p-4 lg:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24 lg:pb-6">
            {sorted.map((m) => <MarketCard key={m.id} market={m} />)}
            {sorted.length === 0 && (
              <div className="col-span-full text-center py-12 text-[#5A6478]">
                <span className="material-symbols-outlined text-4xl mb-2 block">search_off</span>
                <p>Nenhum mercado encontrado.</p>
              </div>
            )}
          </div>
        </main>

        {/* CHAT SIDEBAR - desktop only, collapsible */}
        {chatOpen ? (
          <aside className="hidden xl:flex flex-col w-80 2xl:w-96 border-l border-[#2a3444] bg-[#0d1525] sticky top-14 h-[calc(100vh-56px)] relative">
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-[#2a3444] shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#00D4AA]/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#00D4AA] text-base">forum</span>
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wider leading-none">Chat ao Vivo</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4AA] opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D4AA]" /></span>
                      <span className="text-[10px] text-[#00D4AA] font-bold">{onlineCount.current} online</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="w-8 h-8 rounded-lg bg-[#1a2332] flex items-center justify-center text-[#5A6478] hover:text-white hover:bg-[#2a3444] transition-colors" title="Minimizar chat">
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Chat messages */}
            <div ref={chatRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 no-scrollbar relative">
              {chatMsgs.map((msg, idx) => {
                const prevMsg = idx > 0 ? chatMsgs[idx - 1] : null;
                const isGrouped = prevMsg?.user === msg.user;
                const badge = getUserBadge(msg.text);
                const timeAgo = Math.max(0, Math.floor((Date.now() - msg.ts) / 60000));
                const timeStr = timeAgo === 0 ? "agora" : `${timeAgo}min`;

                return (
                  <div key={msg.id} className={`group flex gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#1a2332]/60 transition-colors ${isGrouped ? "mt-0" : "mt-2"}`}>
                    {/* Avatar */}
                    {!isGrouped ? (
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(msg.user)} flex items-center justify-center text-[11px] font-black text-white shrink-0 mt-0.5`}>
                        {msg.user.replace("@", "").charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div className="w-8 shrink-0" />
                    )}
                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      {!isGrouped && (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[#00D4AA] font-bold text-xs truncate">{msg.user}</span>
                          {badge && (
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full bg-[#1a2332] border border-[#2a3444] ${badge.color}`}>
                              <span className="material-symbols-outlined" style={{ fontSize: "10px" }}>{badge.icon}</span>
                              <span className="text-[8px] font-black uppercase">{badge.label}</span>
                            </span>
                          )}
                          <span className="text-[10px] text-[#3a4a5a] ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">{timeStr}</span>
                        </div>
                      )}
                      <p className="text-[13px] text-[#c8cdd4] break-words leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* New messages indicator */}
            {!isAtBottom && unreadCount > 0 && (
              <button
                onClick={() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); setIsAtBottom(true); setUnreadCount(0); }}
                className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-[#00D4AA] text-[#003D2E] px-3 py-1.5 rounded-full text-xs font-black shadow-[0_4px_12px_rgba(0,212,170,0.4)] hover:shadow-[0_4px_20px_rgba(0,212,170,0.6)] transition-all animate-bounce"
              >
                <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
                {unreadCount} {unreadCount === 1 ? "nova mensagem" : "novas mensagens"}
              </button>
            )}

            {/* Chat input */}
            <div className="px-3 py-3 border-t border-[#2a3444] shrink-0 bg-[#0a1020]">
              <div className="flex items-center gap-2 bg-[#1a2332] rounded-xl border border-[#2a3444] focus-within:border-[#00D4AA]/40 transition-colors px-3">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Enviar mensagem..." className="flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder-[#5A6478]" />
                <button className="text-[#5A6478] hover:text-white transition-colors p-1"><span className="material-symbols-outlined text-lg">mood</span></button>
                <button onClick={sendChat} className="text-[#5A6478] hover:text-[#00D4AA] transition-colors p-1"><span className="material-symbols-outlined text-lg">send</span></button>
              </div>
              <p className="text-[10px] text-[#3a4a5a] mt-1.5 text-center">Seja respeitoso. Siga as <span className="text-[#00D4AA]/70 hover:text-[#00D4AA] cursor-pointer">regras da comunidade</span></p>
            </div>
          </aside>
        ) : null}

        {/* Chat FAB - visible on lg when chat sidebar is hidden, or when collapsed */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`hidden lg:flex ${chatOpen ? "xl:hidden" : ""} fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#00D4AA] text-[#003D2E] items-center justify-center shadow-[0_4px_20px_rgba(0,212,170,0.4)] hover:shadow-[0_4px_30px_rgba(0,212,170,0.6)] hover:scale-105 active:scale-95 transition-all`}
        >
          <span className="material-symbols-outlined text-xl">{chatOpen ? "close" : "forum"}</span>
          {!chatOpen && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF5252] rounded-full text-white text-[10px] font-black flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>
          )}
        </button>
      </div>

      {/* Mobile only bottom nav */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
