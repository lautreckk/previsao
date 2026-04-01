"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import MarketCard from "@/components/MarketCard";
import BottomNav from "@/components/BottomNav";
import { initializeStore, getMarkets, tickAllMarkets } from "@/lib/engines/store";
import { CATEGORY_META } from "@/lib/engines/types";
import { useUser } from "@/lib/UserContext";
import { useChat, getUserBadge } from "@/lib/ChatContext";
import type { PredictionMarket, MarketCategory } from "@/lib/engines/types";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

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

  // Fetch real winners from Supabase ledger
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
        // Keep fallback winners on error
      }
    }
    fetchWinners();
    const interval = setInterval(fetchWinners, 30000);
    return () => clearInterval(interval);
  }, []);

  // Realtime: new wins appear instantly
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

  // Double the array for seamless loop
  const items = [...winners, ...winners];
  const itemWidth = 280;
  const totalWidth = winners.length * itemWidth;
  const translateX = -(offset % totalWidth);

  return (
    <div className="bg-[#060d18] border-b border-white/[0.04] overflow-hidden h-10 flex items-center">
      <div className="flex items-center gap-0 whitespace-nowrap" style={{ transform: `translateX(${translateX}px)`, transition: "none" }}>
        {items.map((w, i) => (
          <div key={i} className="flex items-center gap-2.5 px-5 shrink-0" style={{ minWidth: `${itemWidth}px` }}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FF8C00] flex items-center justify-center text-[10px] font-black text-white shrink-0">
              {w.name.charAt(0)}
            </div>
            <span className="text-white font-black text-xs">{w.name}</span>
            <span className="text-white/30 text-[10px]">{w.time}</span>
            <span className="text-[#F5A623] font-black text-xs">{typeof w.amount === "number" ? `R$ ${w.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : w.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Chat utilities imported from ChatContext

export default function Home() {
  const { user } = useUser();
  const { messages: chatMsgs, sendMessage, onlineCount } = useChat();
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"closing" | "relampago" | "hot">("closing");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [chatInput, setChatInput] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
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
        // Fetch OPEN markets (active, can bet)
        const { data: openData } = await supabase
          .from("prediction_markets")
          .select("*")
          .eq("status", "open")
          .gt("close_at", new Date().toISOString()) // only future close dates
          .order("close_at", { ascending: true })
          .limit(80);

        // Fetch recently RESOLVED markets (last 6 hours, max 10)
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
          // Deduplicate by title: prefer open+future, then most recent
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
              // Both expired/resolved: keep the most recent
              if (row.close_at > existing.close_at) {
                seen.set(key, row);
              }
            }
          }
          const uniqueRows = Array.from(seen.values());

          // Convert DB format to PredictionMarket
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

          // Sort: truly active (open + future close_at) first, then resolved/expired at the end
          const refreshNow = Date.now();
          dbMarkets.sort((a, b) => {
            const aActive = a.status === "open" && a.close_at > refreshNow ? 0 : 1;
            const bActive = b.status === "open" && b.close_at > refreshNow ? 0 : 1;
            if (aActive !== bActive) return aActive - bActive;
            return a.close_at - b.close_at;
          });

          // Merge: DB markets first, then local (dedup by title)
          const dbTitles = new Set(dbMarkets.map((m) => m.title.toLowerCase()));
          const uniqueLocal = local.filter((m) => !dbTitles.has(m.title.toLowerCase()));
          setMarkets([...dbMarkets, ...uniqueLocal]);
          setMarketsLoading(false);
          return;
        }
      } catch {
        // Supabase not available, fall back to local
      }

      setMarkets(local);
      setMarketsLoading(false);
    }

    refresh();
    const iv = setInterval(refresh, 10000);
    return () => clearInterval(iv);
  }, []);

  // Track unread when new messages arrive and user isn't at bottom
  const prevMsgCount = useRef(chatMsgs.length);
  useEffect(() => {
    if (chatMsgs.length > prevMsgCount.current && !isAtBottom) {
      setUnreadCount((c) => c + (chatMsgs.length - prevMsgCount.current));
    }
    prevMsgCount.current = chatMsgs.length;

    // Auto-scroll if at bottom
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
    const username = user ? `@${user.name.split(" ")[0].toLowerCase()}` : "@voce";
    sendMessage(chatInput.trim(), username, user?.avatar_url || undefined);
    setChatInput("");
    setIsAtBottom(true);
  }, [chatInput, user, sendMessage]);

  const now = Date.now();

  // Determine effective status: if close_at has passed but DB still says "open", treat as expired
  // Camera/stream markets are excluded — they auto-renew rounds and should always show
  const isStreamMarket = (m: PredictionMarket) => !!m.stream_url || m.id.startsWith("cam_");
  const getEffectiveStatus = (m: PredictionMarket) => {
    if (m.status === "open" && m.close_at < now && !isStreamMarket(m)) return "expired";
    return m.status;
  };

  // Active markets: truly open (future close_at) + frozen + awaiting_resolution + stream markets
  const activeMarkets = markets.filter((m) => {
    if (isStreamMarket(m) && m.status === "open") return true;
    const eff = getEffectiveStatus(m);
    return eff === "open" || eff === "frozen" || eff === "awaiting_resolution";
  });

  // For search dropdown, use activeMarkets only (no expired/resolved)
  const openMarkets = activeMarkets;

  const filtered = activeMarkets
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

    // Live camera/stream markets first, then sort by closing time
    const aIsLive = !!a.stream_url || a.id.startsWith("cam_");
    const bIsLive = !!b.stream_url || b.id.startsWith("cam_");
    if (aIsLive !== bIsLive) return aIsLive ? -1 : 1;
    return a.close_at - b.close_at;
  });

  const catEntries = Object.entries(CATEGORY_META) as [MarketCategory, { label: string; icon: string; color: string }][];

  return (
    <div className="min-h-screen bg-[#080d1a] overflow-x-hidden">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#0D0B14]/95 backdrop-blur-xl border-b border-white/[0.04] px-4 lg:px-6 h-14 flex items-center gap-4">
        <Link href="/" className="shrink-0">
          <img src="/logo.png" alt="Winify" className="h-10 w-auto" />
        </Link>
        <div className="flex-1 max-w-lg mx-auto hidden sm:block" ref={searchRef}>
          <div className="relative">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Buscar mercados..."
              className="w-full bg-[#0D0B14] rounded-lg pl-10 pr-4 py-2 text-sm text-white border border-white/[0.06] outline-none focus:border-[#E09520]/40 placeholder-[#5A6478]"
            />
            {search.length > 0 && searchFocused && (() => {
              const results = openMarkets
                .filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
                .slice(0, 6);
              return results.length > 0 ? (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0D0B14] border border-white/[0.06] rounded-lg shadow-2xl shadow-black/50 overflow-hidden z-[60]">
                  {results.map((m) => {
                    const isCam = !!m.stream_url || m.id.startsWith("cam_");
                    const href = isCam ? `/camera/${m.id}` : `/evento/${m.id}`;
                    return (
                      <Link
                        key={m.id}
                        href={href}
                        onClick={() => { setSearch(""); setSearchFocused(false); }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1A1722] transition-colors"
                      >
                        {m.banner_url ? (
                          <img src={m.banner_url} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-[#1A1722] flex items-center justify-center shrink-0">
                            <Icon name="monitoring" size={16} className="text-white/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{m.title}</p>
                          <p className="text-xs text-white/30">{CATEGORY_META[m.category as MarketCategory]?.label || m.category}</p>
                        </div>
                        <span className="text-xs text-[#E09520] font-bold shrink-0">R$ {(m.pool_total || 0).toFixed(2)}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0D0B14] border border-white/[0.06] rounded-lg shadow-2xl shadow-black/50 z-[60] px-4 py-3 text-center text-sm text-white/30">
                  Nenhum mercado encontrado
                </div>
              );
            })()}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href="/deposito" className="kinetic-gradient text-[#1A0E00] px-4 py-2 rounded-lg text-sm font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,166,35,0.3)] hover:shadow-[0_0_25px_rgba(245,166,35,0.5)] hover:scale-105 active:scale-95 transition-all">
                <Icon name="add" size={18} weight="bold" />Depositar
              </Link>
              <Link href="/perfil" className="bg-[#1A1722] border border-white/[0.06] px-3 py-1.5 rounded-lg text-sm font-bold text-[#E09520]">R$ {user.balance.toFixed(2)}</Link>
            </>
          ) : (
            <Link href="/login" className="kinetic-gradient text-[#1A0E00] px-5 py-2 rounded-lg text-sm font-black shadow-[0_0_20px_rgba(224,149,32,0.4)]">Entrar</Link>
          )}
        </div>
      </header>

      {/* MOBILE SEARCH - visible only on small screens */}
      <div className="sm:hidden px-4 pt-3 pb-1">
        <div className="relative" ref={searchRef}>
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="Buscar mercados..."
            className="w-full bg-[#0D0B14] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white border border-white/[0.06] outline-none focus:border-[#E09520]/40 placeholder-[#5A6478]"
          />
          {search.length > 0 && searchFocused && (() => {
            const results = openMarkets
              .filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
              .slice(0, 6);
            return results.length > 0 ? (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#0D0B14] border border-white/[0.06] rounded-lg shadow-2xl shadow-black/50 overflow-hidden z-[60]">
                {results.map((m) => {
                  const isCam = !!m.stream_url || m.id.startsWith("cam_");
                  const href = isCam ? `/camera/${m.id}` : `/evento/${m.id}`;
                  return (
                    <Link
                      key={m.id}
                      href={href}
                      onClick={() => { setSearch(""); setSearchFocused(false); }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1A1722] transition-colors"
                    >
                      {m.banner_url ? (
                        <img src={m.banner_url} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-[#1A1722] flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-white/30 text-sm">monitoring</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{m.title}</p>
                        <p className="text-xs text-white/30">{CATEGORY_META[m.category as MarketCategory]?.label || m.category}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#0D0B14] border border-white/[0.06] rounded-lg shadow-2xl shadow-black/50 z-[60] px-4 py-3 text-center text-sm text-white/30">
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
          <div className="relative w-full rounded-2xl overflow-hidden group cursor-pointer hover:shadow-[0_0_40px_rgba(224,149,32,0.3)] transition-all border border-[#E09520]/20 max-h-[200px] sm:max-h-[260px] lg:max-h-[320px]">
            <img src="/banner-promo.png" alt="Aqui tudo que voce sabe vira dinheiro! Jogue a partir de R$10" className="w-full h-full object-cover rounded-2xl" />
          </div>
        </Link>
      </div>

      <div className="flex">
        {/* MAIN CONTENT */}
        <main className="flex-1 min-w-0">
          {/* Categories row with scroll indicators */}
          <div className="relative border-b border-white/[0.06]">
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
              <button onClick={() => setActiveCategory("all")} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-all ${activeCategory === "all" ? "bg-[#F5A623]/10 border border-[#F5A623]/40 text-[#F5A623]" : "text-white/50 hover:text-white"}`}>
                <Icon name="dashboard" size={16} weight={activeCategory === "all" ? "fill" : "regular"} />Todos
              </button>
              {catEntries.map(([key, meta]) => (
                <button key={key} onClick={() => setActiveCategory(key)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-all ${activeCategory === key ? "bg-[#F5A623]/10 border border-[#F5A623]/40 text-[#F5A623]" : "text-white/50 hover:text-white"}`}>
                  <Icon name={meta.icon} size={16} weight={activeCategory === key ? "fill" : "regular"} />{meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sub tabs — ordenacao */}
          <div className="px-4 lg:px-6 py-2.5 flex items-center gap-2 border-b border-white/[0.06]">
            <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider shrink-0 mr-1">Ordenar</span>
            {([
              { key: "closing" as const, label: "Encerram em breve", icon: null, activeColor: "bg-white/10 text-white border-white/20" },
              { key: "relampago" as const, label: "Relampago", icon: "bolt", activeColor: "bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/30" },
              { key: "hot" as const, label: "Em Alta", icon: "local_fire_department", activeColor: "bg-[#FF6B5A]/10 text-[#FF6B5A] border-[#FF6B5A]/30" },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${activeTab === t.key ? t.activeColor : "border-transparent text-white/30 hover:text-white hover:bg-white/5"}`}
              >
                {t.icon && <Icon name={t.icon} size={14} weight={activeTab === t.key ? "fill" : "regular"} />}
                {t.label}
              </button>
            ))}
          </div>

          {/* GRID - responsive columns */}
          <div className="p-4 lg:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24 lg:pb-6">
            {marketsLoading ? (
              /* Skeleton loading cards */
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-white/[0.06] bg-[#12101A] p-4 h-[200px] animate-pulse">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-16 h-5 rounded-md bg-white/[0.06]" />
                    <div className="flex-1" />
                    <div className="w-10 h-5 rounded bg-white/[0.04]" />
                  </div>
                  <div className="flex items-start gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.06]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 rounded bg-white/[0.06] w-3/4" />
                      <div className="h-3 rounded bg-white/[0.04] w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E09520]/30" />
                      <div className="h-3 rounded bg-white/[0.04] flex-1" />
                      <div className="w-10 h-4 rounded bg-[#E09520]/10" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FF5252]/30" />
                      <div className="h-3 rounded bg-white/[0.04] flex-1" />
                      <div className="w-10 h-4 rounded bg-[#FF5252]/10" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#E09520]/30 animate-ping" />
                      <div className="w-12 h-3 rounded bg-[#E09520]/10" />
                    </div>
                    <div className="w-14 h-3 rounded bg-white/[0.04]" />
                  </div>
                </div>
              ))
            ) : sorted.length > 0 ? (
              sorted.map((m) => <MarketCard key={m.id} market={m} />)
            ) : (
              <div className="col-span-full text-center py-12 text-white/30">
                <Icon name="search_off" size={40} className="mb-2 mx-auto block" />
                <p>Nenhum mercado encontrado.</p>
              </div>
            )}
          </div>
        </main>

        {/* CHAT SIDEBAR - desktop only, collapsible */}
        {chatOpen ? (
          <aside className="hidden xl:flex flex-col w-80 2xl:w-96 border-l border-white/[0.06] bg-[#0D0B14] sticky top-14 h-[calc(100vh-56px)] relative">
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#E09520]/10 flex items-center justify-center">
                    <Icon name="forum" size={18} weight="fill" className="text-[#E09520]" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wider leading-none">Chat ao Vivo</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E09520] opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[#E09520]" /></span>
                      <span className="text-[10px] text-[#E09520] font-bold">{onlineCount} online</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setChatOpen(false)} className="w-8 h-8 rounded-lg bg-[#1A1722] flex items-center justify-center text-white/30 hover:text-white hover:bg-[#2a3444] transition-colors" title="Minimizar chat">
                  <Icon name="chevron_right" size={18} />
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
                  <div key={msg.id} className={`group flex gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#1A1722]/60 transition-colors ${isGrouped ? "mt-0" : "mt-2"}`}>
                    {/* Avatar */}
                    {!isGrouped ? (
                      <img
                        src={msg.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(msg.user)}&backgroundColor=transparent`}
                        alt={msg.user}
                        className="w-8 h-8 rounded-full bg-white/[0.06] shrink-0 mt-0.5 object-cover"
                      />
                    ) : (
                      <div className="w-8 shrink-0" />
                    )}
                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      {!isGrouped && (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[#E09520] font-bold text-xs truncate">{msg.user}</span>
                          {badge && (
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#1A1722] border border-white/[0.06] ${badge.color}`}>
                              <Icon name={badge.icon} size={11} />
                              <span className="text-[9px] font-black uppercase">{badge.label}</span>
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
                className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-[#E09520] text-[#1A0E00] px-3 py-1.5 rounded-full text-xs font-black shadow-[0_4px_12px_rgba(224,149,32,0.4)] hover:shadow-[0_4px_20px_rgba(224,149,32,0.6)] transition-all animate-bounce"
              >
                <Icon name="keyboard_arrow_down" size={16} />
                {unreadCount} {unreadCount === 1 ? "nova mensagem" : "novas mensagens"}
              </button>
            )}

            {/* Chat input */}
            <div className="px-3 py-3 border-t border-white/[0.06] shrink-0 bg-[#0a1020]">
              {user ? (
                <>
                  <div className="flex items-center gap-2 bg-[#1A1722] rounded-xl border border-white/[0.06] focus-within:border-[#E09520]/40 transition-colors px-3">
                    <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Enviar mensagem..." className="flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder-[#5A6478]" />
                    <button className="text-white/30 hover:text-white transition-colors p-1"><Icon name="mood" size={20} /></button>
                    <button onClick={sendChat} className="text-white/30 hover:text-[#E09520] transition-colors p-1"><Icon name="send" size={20} /></button>
                  </div>
                  <p className="text-[10px] text-[#3a4a5a] mt-1.5 text-center">Seja respeitoso. Siga as <span className="text-[#E09520]/70 hover:text-[#E09520] cursor-pointer">regras da comunidade</span></p>
                </>
              ) : (
                <div className="text-center py-2">
                  <p className="text-xs text-white/30 mb-2">Faca login para participar do chat</p>
                  <Link href="/login" className="inline-block px-4 py-2 rounded-lg bg-[#E09520]/10 text-[#E09520] text-xs font-bold border border-[#E09520]/30 hover:bg-[#E09520]/20 transition-colors">Entrar</Link>
                </div>
              )}
            </div>
          </aside>
        ) : null}

        {/* Chat FAB - visible on lg when chat sidebar is hidden, or when collapsed */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`hidden lg:flex ${chatOpen ? "xl:hidden" : ""} fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#E09520] text-[#1A0E00] items-center justify-center shadow-[0_4px_20px_rgba(224,149,32,0.4)] hover:shadow-[0_4px_30px_rgba(224,149,32,0.6)] hover:scale-105 active:scale-95 transition-all`}
        >
          <Icon name={chatOpen ? "close" : "forum"} size={24} weight={chatOpen ? "bold" : "fill"} />
          {!chatOpen && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF5252] rounded-full text-white text-[10px] font-black flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>
          )}
        </button>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.04] bg-[#060d18] mt-8">
        <div className="max-w-screen-xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
            {/* Logo */}
            <div className="col-span-2 sm:col-span-4 lg:col-span-1">
              <img src="/logo.png" alt="Palpitano" className="h-10 w-auto mb-3" />
              <p className="text-xs text-white/30 leading-relaxed max-w-[240px]">A plataforma onde seu conhecimento vira oportunidade. Mercados de previsao em tempo real.</p>
            </div>
            {/* Categorias */}
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3">Categorias</h4>
              <ul className="space-y-2">
                {(["Criptomoedas", "Esportes", "Entretenimento", "Politica"] as const).map((c) => (
                  <li key={c}><button onClick={() => { setActiveCategory(c === "Criptomoedas" ? "crypto" : c === "Esportes" ? "sports" : c === "Entretenimento" ? "entertainment" : "politics"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xs text-white/50 hover:text-[#E09520] transition-colors">{c}</button></li>
                ))}
              </ul>
            </div>
            {/* Mercados */}
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3">Mercados</h4>
              <ul className="space-y-2">
                <li><button onClick={() => { setActiveTab("closing"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xs text-white/50 hover:text-[#E09520] transition-colors">Encerram em breve</button></li>
                <li><button onClick={() => { setActiveTab("hot"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xs text-white/50 hover:text-[#E09520] transition-colors">Em Alta</button></li>
                <li><button onClick={() => { setActiveTab("relampago"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xs text-white/50 hover:text-[#E09520] transition-colors">Relampago</button></li>
                <li><button onClick={() => { setActiveCategory("all"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xs text-white/50 hover:text-[#E09520] transition-colors">Todos os mercados</button></li>
              </ul>
            </div>
            {/* Minha conta */}
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3">Minha conta</h4>
              <ul className="space-y-2">
                <li><Link href="/perfil" className="text-xs text-white/50 hover:text-[#E09520] transition-colors">Perfil</Link></li>
                <li><Link href="/saldos" className="text-xs text-white/50 hover:text-[#E09520] transition-colors">Minhas apostas</Link></li>
                <li><Link href="/deposito" className="text-xs text-white/50 hover:text-[#E09520] transition-colors">Deposito</Link></li>
              </ul>
            </div>
            {/* Suporte */}
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3">Suporte</h4>
              <ul className="space-y-2">
                <li><span className="text-xs text-white/50 hover:text-[#E09520] transition-colors cursor-pointer">FAQ</span></li>
                <li><span className="text-xs text-white/50 hover:text-[#E09520] transition-colors cursor-pointer">Termos de Uso</span></li>
                <li><span className="text-xs text-white/50 hover:text-[#E09520] transition-colors cursor-pointer">Privacidade</span></li>
              </ul>
              <div className="flex items-center gap-3 mt-4">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-[#1A1722] flex items-center justify-center text-white/30 hover:text-[#E09520] hover:bg-[#1A1722]/80 transition-colors">
                  <Icon name="photo_camera" size={18} />
                </a>
              </div>
            </div>
          </div>
          {/* Copyright */}
          <div className="border-t border-white/[0.04] mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[10px] text-[#3a4a5a]">Todos os direitos reservados | Copyright &copy; 2026 | Powered by Oracore</p>
            <p className="text-[10px] text-[#3a4a5a]">Jogue com responsabilidade. +18</p>
          </div>
        </div>
      </footer>

      {/* Mobile only bottom nav */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
