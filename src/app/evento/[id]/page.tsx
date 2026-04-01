"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { useChat } from "@/lib/ChatContext";
import { initializeStore, getMarket, placeBetFull, tickAllMarkets } from "@/lib/engines/store";
import { simulateBet, calcImpliedProbabilities } from "@/lib/engines/parimutuel";
import { CATEGORY_META } from "@/lib/engines/types";
import BottomNav from "@/components/BottomNav";
import LiveChat from "@/components/LiveChat";
import { LivePriceDisplay } from "@/components/LivePriceDisplay";
import LivePriceChart from "@/components/LivePriceChart";
import { MarketResultBanner } from "@/components/MarketResultBanner";
import LiveRoundCycle from "@/components/LiveRoundCycle";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import type { PredictionMarket } from "@/lib/engines/types";
import { createBotEngine, type LiveBet } from "@/lib/bot-engine";

/* ─── Chat (uses global ChatContext) ─── */
function EventChat() {
  const { messages: msgs, sendMessage, onlineCount } = useChat();
  const [input, setInput] = useState("");
  const { user } = useUser();
  const chatRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unread, setUnread] = useState(0);
  const prevCount = useRef(msgs.length);

  useEffect(() => {
    if (msgs.length > prevCount.current && !isAtBottom) {
      setUnread((c) => c + (msgs.length - prevCount.current));
    }
    prevCount.current = msgs.length;
    if (isAtBottom) chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, isAtBottom]);

  const handleScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    const at = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setIsAtBottom(at);
    if (at) setUnread(0);
  }, []);

  const send = () => {
    if (!input.trim()) return;
    const username = user ? `@${user.name.split(" ")[0].toLowerCase()}` : "@voce";
    sendMessage(input.trim(), username);
    setInput(""); setIsAtBottom(true);
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#F5A623]/10 flex items-center justify-center"><span className="material-symbols-outlined text-[#F5A623] text-sm">forum</span></div>
          <div>
            <span className="text-xs font-black text-white uppercase tracking-wider">CHAT AO VIVO</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F5A623] opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#F5A623]" /></span>
              <span className="text-[9px] text-[#F5A623] font-bold">{onlineCount} online</span>
            </div>
          </div>
        </div>
      </div>
      <div ref={chatRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 min-h-0">
        {msgs.map((msg, idx) => {
          const prev = idx > 0 ? msgs[idx - 1] : null;
          const grouped = prev?.user === msg.user;
          return (
            <div key={msg.id} className={`group flex gap-2 px-2 py-1 rounded-lg hover:bg-[#1a2a3a]/50 transition-colors ${grouped ? "" : "mt-1.5"}`}>
              {!grouped ? (
                <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(msg.user)}&backgroundColor=transparent`} alt={msg.user} className="w-7 h-7 rounded-full bg-white/[0.06] shrink-0 mt-0.5" />
              ) : <div className="w-7 shrink-0" />}
              <div className="min-w-0 flex-1">
                {!grouped && <div className="flex items-center gap-1.5 mb-0.5"><span className="text-[#F5A623] font-bold text-[11px] truncate">{msg.user}</span></div>}
                <p className="text-[12px] text-gray-300 break-words leading-relaxed">{msg.text}</p>
              </div>
            </div>
          );
        })}
      </div>
      {!isAtBottom && unread > 0 && (
        <button onClick={() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); setIsAtBottom(true); setUnread(0); }}
          className="absolute bottom-[56px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-[#F5A623] text-[#1A0E00] px-2.5 py-1 rounded-full text-[10px] font-black shadow-[0_4px_12px_rgba(245,166,35,0.4)] animate-bounce">
          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>keyboard_arrow_down</span>{unread} novas
        </button>
      )}
      <div className="px-3 py-2.5 border-t border-white/[0.06] shrink-0 bg-[#0a1020]">
        {user ? (
          <>
            <div className="flex items-center gap-2 bg-[#1A1722] rounded-xl border border-white/[0.06] focus-within:border-[#F5A623]/40 transition-colors px-3">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Enviar mensagem..." className="flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder-[#5A6478]" />
              <button className="text-white/30 hover:text-white transition-colors p-1"><span className="material-symbols-outlined text-lg">mood</span></button>
              <button onClick={send} className="text-white/30 hover:text-[#F5A623] transition-colors p-1"><span className="material-symbols-outlined text-lg">send</span></button>
            </div>
            <p className="text-[10px] text-[#3a4a5a] mt-1 text-center">Seja respeitoso. Siga as <span className="text-[#F5A623]/70">regras da comunidade</span></p>
          </>
        ) : (
          <div className="text-center py-1.5">
            <p className="text-[11px] text-white/30">Faca <a href="/login" className="text-[#F5A623] font-bold">login</a> para participar do chat</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function EventoPage() {
  const params = useParams();
  const router = useRouter();
  const { user, placeBet: legacyPlaceBet, refreshUser } = useUser();
  const [market, setMarket] = useState<PredictionMarket | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [betPlaced, setBetPlaced] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"posicoes" | "aberto" | "encerradas">("posicoes");
  const [placing, setPlacing] = useState(false);
  const [flashKeys, setFlashKeys] = useState<Record<string, "up" | "down">>({});
  const [isResolved, setIsResolved] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  // Live activity feed
  const [liveBets, setLiveBets] = useState<LiveBet[]>([]);
  const [betToast, setBetToast] = useState<LiveBet | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botEngineRef = useRef<ReturnType<typeof createBotEngine> | null>(null);

  const addLiveBet = useCallback((bet: LiveBet) => {
    setLiveBets((prev) => [bet, ...prev].slice(0, 15));
    // Show toast
    setBetToast(bet);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setBetToast(null), 3500);
  }, []);

  // User bets for this market (from prediction_bets)
  interface UserBet {
    id: string;
    outcome_key: string;
    outcome_label: string;
    amount: number;
    payout_at_entry: number;
    status: string;
    created_at: string;
    entry_price?: number;
  }
  const [userBets, setUserBets] = useState<UserBet[]>([]);
  const [betsLoading, setBetsLoading] = useState(false);

  // All user bets across all markets (for EM ABERTO / ENCERRADAS tabs)
  interface AllUserBet extends UserBet {
    market_id: string;
    market_title?: string;
  }
  const [allUserBets, setAllUserBets] = useState<AllUserBet[]>([]);

  const fetchUserBets = useCallback(async (marketId: string, userId: string) => {
    setBetsLoading(true);
    try {
      // Fetch bets for THIS market (POSICOES tab)
      const { data, error: err } = await supabase
        .from("prediction_bets")
        .select("*")
        .eq("market_id", marketId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (!err && data) {
        setUserBets(data.map((b: Record<string, unknown>) => ({
          id: b.id as string,
          outcome_key: b.outcome_key as string,
          outcome_label: b.outcome_label as string,
          amount: Number(b.amount),
          payout_at_entry: Number(b.payout_at_entry),
          status: (b.status as string) || "pending",
          created_at: b.created_at as string,
          entry_price: b.entry_price ? Number(b.entry_price) : undefined,
        })));
      }

      // Fetch ALL user bets (EM ABERTO / ENCERRADAS tabs)
      const { data: allData } = await supabase
        .from("prediction_bets")
        .select("*, prediction_markets(title)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (allData) {
        setAllUserBets(allData.map((b: Record<string, unknown>) => ({
          id: b.id as string,
          market_id: b.market_id as string,
          market_title: (b.prediction_markets as Record<string, string> | null)?.title || "",
          outcome_key: b.outcome_key as string,
          outcome_label: b.outcome_label as string,
          amount: Number(b.amount),
          payout_at_entry: Number(b.payout_at_entry),
          status: (b.status as string) || "pending",
          created_at: b.created_at as string,
          entry_price: b.entry_price ? Number(b.entry_price) : undefined,
        })));
      }
    } catch {
      // silently fail
    }
    setBetsLoading(false);
  }, []);

  // Fetch user bets on mount and when user/market changes
  useEffect(() => {
    if (user?.id && market?.id) {
      fetchUserBets(market.id, user.id);
    }
  }, [user?.id, market?.id, fetchUserBets]);

  // Derive live price symbol from market title
  const getLivePriceInfo = useCallback((m: PredictionMarket | null) => {
    if (!m) return null;
    const t = m.title.toLowerCase();
    if (t.includes("bitcoin") || t.includes("btc")) return { symbol: "BTC", category: "crypto" };
    if (t.includes("ethereum") || t.includes("eth")) return { symbol: "ETH", category: "crypto" };
    if (t.includes("solana") || t.includes("sol:")) return { symbol: "SOL", category: "crypto" };
    if (t.includes("dolar") || t.includes("dólar") || t.includes("usd")) return { symbol: "USD-BRL", category: "forex" };
    if (t.includes("petr4")) return { symbol: "PETR4", category: "stocks" };
    if (t.includes("vale3")) return { symbol: "VALE3", category: "stocks" };
    if (t.includes("itub4")) return { symbol: "ITUB4", category: "stocks" };
    // Weather: show temperature but NO chart (doesn't make sense for weather)
    // Return null — weather markets don't get LivePriceDisplay/Chart
    return null;
  }, []);

  useEffect(() => {
    const id = params.id as string;
    initializeStore();
    tickAllMarkets();
    const local = getMarket(id);
    if (local) { setMarket(local); } else {
      supabase.from("prediction_markets").select("*").eq("id", id).single().then(({ data }) => {
        if (data) setMarket({
          ...data,
          created_at: new Date(data.created_at).getTime(), open_at: new Date(data.open_at).getTime(),
          freeze_at: data.freeze_at ? new Date(data.freeze_at).getTime() : 0, close_at: new Date(data.close_at).getTime(),
          resolve_at: data.resolve_at ? new Date(data.resolve_at).getTime() : 0,
          resolved_at: data.resolved_at ? new Date(data.resolved_at).getTime() : undefined,
          pool_total: Number(data.pool_total) || 0, distributable_pool: Number(data.distributable_pool) || 0,
          house_fee_percent: Number(data.house_fee_percent) || 0.05, min_bet: Number(data.min_bet) || 1,
          max_bet: Number(data.max_bet) || 10000, max_payout: Number(data.max_payout) || 100000,
          max_liability: Number(data.max_liability) || 500000, volume: Number(data.pool_total) || 0,
          tags: data.tags || [], outcomes: data.outcomes || [],
          source_config: data.source_config || { source_name: "", requires_manual_confirmation: false, requires_evidence_upload: false },
          resolution_rule: data.resolution_rule || { expression: "", variables: [], outcome_map: {}, description: "" },
          language: data.language || "pt-BR", country: data.country || "BR",
        });
      });
    }
    const iv = setInterval(() => { const m2 = getMarket(id); if (m2) setMarket(m2); }, 3000);
    return () => clearInterval(iv);
  }, [params.id]);

  // Supabase Realtime: live odds & resolution updates
  useEffect(() => {
    if (!market?.id) return;
    const channel = supabase.channel(`market-${market.id}`)
      .on("broadcast", { event: "odds.update" }, (payload: { payload?: { outcomes?: typeof market.outcomes; pool_total?: number } }) => {
        if (payload.payload?.outcomes) {
          const newOutcomes = payload.payload.outcomes;
          setMarket((prev) => {
            if (!prev) return prev;
            // Determine flash direction per outcome
            const flashes: Record<string, "up" | "down"> = {};
            newOutcomes.forEach((no) => {
              const old = prev.outcomes.find((o) => o.key === no.key);
              if (old && no.payout_per_unit !== old.payout_per_unit) {
                flashes[no.key] = no.payout_per_unit > old.payout_per_unit ? "up" : "down";
              }
            });
            if (Object.keys(flashes).length > 0) {
              setFlashKeys(flashes);
              setTimeout(() => setFlashKeys({}), 600);
            }
            return {
              ...prev,
              outcomes: newOutcomes,
              pool_total: payload.payload?.pool_total ?? prev.pool_total,
            };
          });
        }
      })
      .on("broadcast", { event: "bet.placed" }, (payload: { payload?: LiveBet }) => {
        if (payload.payload) {
          addLiveBet(payload.payload);
        }
      })
      .on("broadcast", { event: "market.resolved" }, (payload: { payload?: { winning_outcome_key?: string } }) => {
        setIsResolved(true);
        if (payload.payload?.winning_outcome_key) {
          setMarket((prev) => prev ? { ...prev, status: "resolved" as const, winning_outcome_key: payload.payload?.winning_outcome_key } : prev);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [market?.id, addLiveBet]);

  // Bot engine: auto-bet with bots when market is truly open (not past close_at)
  useEffect(() => {
    if (!market?.id || market.status !== "open") return;
    if (new Date(market.close_at).getTime() <= Date.now()) return;
    const engine = createBotEngine(market.id, addLiveBet);
    botEngineRef.current = engine;
    engine.start(market.outcomes);
    return () => { engine.stop(); botEngineRef.current = null; };
  }, [market?.id, market?.status, market?.close_at, addLiveBet]);

  // Update bot engine with fresh outcomes
  useEffect(() => {
    if (botEngineRef.current && market?.outcomes) {
      botEngineRef.current.updateOutcomes(market.outcomes);
    }
  }, [market?.outcomes]);

  if (!market) return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-white">
      <div className="text-center"><span className="material-symbols-outlined text-5xl text-white/50">error</span><p className="mt-2 text-white/50">Mercado nao encontrado</p><button onClick={() => router.push("/")} className="mt-4 text-[#F5A623] font-bold">Voltar</button></div>
    </div>
  );

  const meta = CATEGORY_META[market.category];
  const selected = market.outcomes.find((o) => o.key === selectedOutcome);
  const simulation = selected && betAmount ? simulateBet(market, selected.key, parseFloat(betAmount) || 0) : null;
  const probabilities = calcImpliedProbabilities(market.outcomes);
  const isOpen = market.status === "open";
  const livePriceInfo = getLivePriceInfo(market);
  const now = Date.now();
  const timeLeft = market.close_at - now;
  const isSupabaseMarket = market.id.startsWith("mkt_");
  const isLiveRound = market.outcome_type === "up_down" && (market.category === "crypto" || market.category === "economy");

  let timeStr = "";
  if (timeLeft <= 0) timeStr = "Encerrado";
  else if (timeLeft < 3600000) { const m = Math.floor(timeLeft / 60000); const s = Math.floor((timeLeft % 60000) / 1000); timeStr = `${m}:${String(s).padStart(2, "0")}`; }
  else if (timeLeft < 86400000) timeStr = `${Math.floor(timeLeft / 3600000)}h ${Math.floor((timeLeft % 3600000) / 60000)}m`;
  else timeStr = `${Math.floor(timeLeft / 86400000)}d`;

  const handleBet = async () => {
    setError(""); setPlacing(true);
    if (!user) { router.push("/login"); return; }
    if (!selected || !betAmount) return;
    const amount = parseFloat(betAmount);
    // Try Supabase API first (works for all mkt_ markets in DB)
    try {
      const res = await fetch("/api/markets/bet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market_id: market.id, outcome_key: selected.key, outcome_label: selected.label, amount, user_id: user.id }) });
      const data = await res.json();
      if (res.ok && !data.error) {
        if (data.market) setMarket({ ...market, ...data.market, outcomes: data.market.outcomes || market.outcomes });
        await refreshUser();
      } else if (data.error === "Mercado nao encontrado") {
        // Fallback: market exists only in local store (legacy seed)
        const result = placeBetFull(user.id, market.id, selected.key, amount, user.balance);
        if (!result.success) { setError(result.error || "Erro"); setPlacing(false); return; }
        legacyPlaceBet({ marketId: market.id, marketTitle: market.title, optionId: selected.key, optionName: selected.label, amount, odds: selected.payout_per_unit, potentialWin: amount * selected.payout_per_unit });
        setMarket(result.market || market);
      } else {
        setError(data.error || "Erro ao apostar"); setPlacing(false); return;
      }
    } catch { setError("Erro de conexao"); setPlacing(false); return; }
    setBetPlaced(true); setShowConfirm(false); setSelectedOutcome(null); setBetAmount(""); setPlacing(false);
    setTab("posicoes"); // Switch to positions tab immediately
    // Re-fetch user bets so POSICOES tab updates
    if (user?.id && market?.id) {
      // Small delay to let DB write propagate
      setTimeout(() => fetchUserBets(market.id, user.id), 500);
    }
    setTimeout(() => setBetPlaced(false), 3000);
  };

  const potentialWin = simulation ? simulation.estimatedReturn : 0;
  const potentialPayout = simulation ? simulation.estimatedPayout : 0;

  return (
    <div className="h-screen bg-[#080d1a] text-white overflow-hidden">
      <div className="flex flex-col lg:flex-row h-screen">

        {/* ─── LEFT: Market info + Outcomes ─── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] bg-[#0D0B14] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/" className="text-[#F5A623] shrink-0"><span className="material-symbols-outlined">arrow_back</span></Link>
              <img src="/logo.png" alt="Winify" className="h-8 w-auto" />
            </div>
            {user && <Link href="/perfil" className="bg-[#1A1722] border border-white/[0.06] px-3 py-1.5 rounded-lg text-sm font-bold text-[#F5A623]">R$ {user.balance.toFixed(2)}</Link>}
          </header>

          {/* Result Banner (resolved markets) */}
          {(market.status === "resolved" || isResolved) && (
            <MarketResultBanner market={market} />
          )}

          {/* Banner */}
          {market.banner_url && (
            <div className="relative w-full h-48 lg:h-64 overflow-hidden shrink-0">
              <img src={market.banner_url} alt={market.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080d1a] via-[#080d1a]/40 to-transparent" />
            </div>
          )}

          {/* Title */}
          <div className={`px-5 ${market.banner_url ? "-mt-16 relative z-10" : "pt-4"}`}>
            <div className="flex items-center gap-2 mb-1.5">
              {meta && <span className="material-symbols-outlined text-sm" style={{ color: meta.color }}>{meta.icon}</span>}
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: meta?.color }}>{meta?.label}</span>
              {market.subcategory && <span className="text-[10px] text-white/30">/ {market.subcategory}</span>}
            </div>
            <h1 className="text-xl lg:text-2xl font-black leading-tight mb-1 line-clamp-2 lg:line-clamp-none">{market.title}</h1>
            {market.short_description && !livePriceInfo && <p className="text-sm text-white/50 mb-3">{market.short_description}</p>}
            {!isLiveRound && (
              <div className="flex items-center gap-3 flex-wrap mb-4">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${isOpen ? "bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/30" : "bg-[#FF5252]/10 text-[#FF5252] border border-[#FF5252]/30"}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-[#F5A623] animate-pulse" : "bg-[#FF5252]"}`} /> {market.status.toUpperCase()}
                </div>
                <span className="text-xs text-white/50 font-bold tabular-nums">{timeStr}</span>
                <span className="text-xs text-white/30">Pool: R$ {market.pool_total.toFixed(0)}</span>
              </div>
            )}
          </div>

          {/* ═══ LIVE ROUND CYCLE (crypto/economy up_down markets) ═══ */}
          {isLiveRound && livePriceInfo ? (
            <div className="pb-6">
              <LiveRoundCycle
                marketId={market.id}
                symbol={livePriceInfo.symbol}
                category={livePriceInfo.category}
                outcomes={market.outcomes}
                poolTotal={market.pool_total}
                houseFee={market.house_fee_percent}
                isOpen={isOpen}
                onSelectOutcome={(key) => { setSelectedOutcome(key); setError(""); }}
                selectedOutcome={selectedOutcome}
                flashKeys={flashKeys}
              />
            </div>
          ) : (
            <>
              {/* Live Price (crypto/economy/weather) — non-live-round markets */}
              {livePriceInfo && (
                <div className="px-5 pt-3 space-y-3">
                  <LivePriceDisplay symbol={livePriceInfo.symbol} category={livePriceInfo.category} />
                  <LivePriceChart
                    symbol={livePriceInfo.symbol}
                    category={livePriceInfo.category}
                    openPrice={
                      (market.source_config?.custom_params?.open_price as number) ??
                      undefined
                    }
                    entryPrice={
                      userBets.length > 0
                        ? userBets[0].entry_price
                        : undefined
                    }
                  />
                </div>
              )}

              {/* Probability bars (like Palpitano chart area) */}
              <div className="px-5 mb-4">
                <div className="bg-[#0D0B14] rounded-xl border border-white/[0.04] p-4">
                  <div className="flex items-center gap-3 flex-wrap mb-4">
                    {market.outcomes.map((o) => {
                      const prob = probabilities.find((p) => p.key === o.key);
                      return (
                        <div key={o.key} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: o.color }} />
                          <span className="text-xs text-white/50">{o.label}: <span className="text-white font-bold">{prob ? (prob.probability * 100).toFixed(1) : "0"}%</span></span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Bar chart */}
                  {market.outcomes.map((o) => {
                    const pct = market.pool_total > 0 ? (o.pool / market.pool_total) * 100 : (100 / market.outcomes.length);
                    return (
                      <div key={o.key} className="flex items-center gap-2 mb-2 last:mb-0">
                        <span className="text-[10px] font-bold w-20 truncate" style={{ color: o.color }}>{o.label}</span>
                        <div className="flex-1 h-4 bg-[#1a2a3a] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: o.color + "CC" }} />
                        </div>
                        <span className="text-[10px] font-bold w-10 text-right tabular-nums" style={{ color: o.color }}>{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Outcome buttons — side by side, vibrant */}
              <div className="px-5 pb-6">
                <div className={`grid gap-3 ${market.outcomes.length === 2 ? "grid-cols-2" : market.outcomes.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                  {market.outcomes.map((o, idx) => {
                    const prob = probabilities.find((p) => p.key === o.key);
                    const pct = prob ? Math.round(prob.probability * 100) : Math.round(100 / market.outcomes.length);
                    const odds = (o.payout_per_unit > 0 ? o.payout_per_unit : (market.outcomes.length * 0.95));
                    const isActive = selectedOutcome === o.key;
                    const isPositive = idx === 0 || o.key === "YES" || o.key === "UP" || o.key === "SOBE" || o.key === "HOME";

                    // Emoji based on outcome type
                    const emoji = (() => {
                      const k = o.key.toUpperCase();
                      const l = o.label.toLowerCase();
                      if (k === "UP" || k === "SOBE" || l.includes("sobe") || l.includes("sim") || l.includes("acima") || l.includes("mais")) return "👍";
                      if (k === "DOWN" || k === "DESCE" || l.includes("desce") || l.includes("nao") || l.includes("abaixo") || l.includes("menos") || l.includes("até")) return "👎";
                      if (k === "YES") return "👍";
                      if (k === "NO") return "👎";
                      if (k === "DRAW" || l.includes("empate")) return "🤝";
                      if (k === "HOME" || idx === 0) return "🏠";
                      if (k === "AWAY" || idx === 2) return "✈️";
                      return isPositive ? "👍" : "👎";
                    })();

                    const bgColor = isPositive ? "#10B981" : "#EF4444";
                    const hoverBg = isPositive ? "#059669" : "#DC2626";

                    return (
                      <button
                        key={o.key}
                        onClick={() => { if (!isOpen) return; setSelectedOutcome(o.key); setError(""); }}
                        disabled={!isOpen}
                        className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-200 cursor-pointer active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed ${
                          isActive ? "ring-2 ring-white/40 scale-[1.02] shadow-lg" : "hover:scale-[1.02] hover:shadow-lg"
                        } ${flashKeys[o.key] ? "animate-pulse" : ""}`}
                        style={{
                          backgroundColor: isActive ? bgColor : bgColor + "20",
                          boxShadow: isActive ? `0 8px 24px ${bgColor}40` : undefined,
                        }}
                      >
                        {/* Glow effect */}
                        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
                          style={{ background: `radial-gradient(circle at center, ${bgColor}15 0%, transparent 70%)` }} />

                        {/* Content */}
                        <div className="relative z-10 text-center">
                          <span className="text-2xl block mb-1">{emoji}</span>
                          <span className={`block font-black text-sm ${isActive ? "text-white" : "text-white/90"}`}>
                            {o.label}
                          </span>
                          <span className={`block font-mono font-black text-lg mt-1 ${isActive ? "text-white" : odds >= 3 ? "text-[#FFD700]" : "text-white/80"}`}>
                            {odds.toFixed(2)}x
                          </span>
                          {/* Percentage bar */}
                          <div className="mt-2 h-1.5 rounded-full bg-black/20 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: isActive ? "white" : bgColor }} />
                          </div>
                          <span className={`block text-[10px] font-bold mt-1 ${isActive ? "text-white/80" : "text-white/40"}`}>
                            {pct}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Quick info below buttons */}
                {market.outcomes.length === 2 && (
                  <div className="flex items-center justify-center gap-6 mt-3 text-[10px] text-white/25">
                    <span>Pool: R$ {(market.pool_total || 0).toFixed(0)}</span>
                    <span>•</span>
                    <span>Taxa: {((market.house_fee_percent || 0.05) * 100).toFixed(0)}%</span>
                  </div>
                )}

                {/* ═══ LIVE ACTIVITY FEED ═══ */}
                {liveBets.length > 0 && (
                  <div className="mt-4 bg-[#0D0B14] rounded-xl border border-white/[0.04] overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]">
                      <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F5A623] opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F5A623]" />
                      </div>
                      <span className="text-[10px] font-black text-white/50 uppercase tracking-wider">Apostas ao vivo</span>
                      <span className="text-[10px] text-white/20 ml-auto">{liveBets.length}</span>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto divide-y divide-white/[0.03]">
                      {liveBets.map((bet, idx) => {
                        const ago = Math.floor((Date.now() - bet.ts) / 1000);
                        const timeAgo = ago < 5 ? "agora" : ago < 60 ? `${ago}s` : ago < 3600 ? `${Math.floor(ago / 60)}min` : `${Math.floor(ago / 3600)}h`;
                        return (
                          <div
                            key={bet.id + idx}
                            className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.02] transition-colors"
                            style={{ animation: idx === 0 ? "slideIn 0.3s ease-out" : undefined }}
                          >
                            <img
                              src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(bet.user_name)}&backgroundColor=transparent`}
                              alt=""
                              className="w-7 h-7 rounded-full bg-white/[0.06] shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-white truncate">{bet.user_name}</span>
                                <span className="text-[9px] text-white/20">{timeAgo}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: bet.outcome_color }} />
                                <span className="text-[10px] text-white/40">{bet.outcome_label}</span>
                                <span className="text-[10px] font-bold text-white/70 ml-auto tabular-nums">R$ {bet.amount}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-[#F5A623] font-bold tabular-nums">R$ {bet.potential_win.toFixed(0)}</span>
                              <span className="block text-[8px] text-white/20">potencial</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ─── MIDDLE: Bet form + Positions ─── */}
        <div className="w-full lg:w-[340px] lg:border-l border-t lg:border-t-0 border-white/[0.04] flex flex-col bg-[#0a1222] overflow-hidden lg:max-h-screen">
          {selected ? (
            <div className="flex-1 overflow-y-auto">
              {/* Bet header */}
              <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: selected.color + "15" }}>
                    <span className="text-xs font-black" style={{ color: selected.color }}>{selected.key.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-xs text-white/50">Sim</span>
                    <span className="block text-sm font-black" style={{ color: selected.color }}>{selected.label}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedOutcome(null)} className="text-white/30 hover:text-white"><span className="material-symbols-outlined text-sm">close</span></button>
              </div>

              <div className="p-4 space-y-4">
                {/* Comprar / Vender tabs */}
                <div className="flex gap-1 bg-[#12101A] rounded-lg p-1">
                  <button className="flex-1 py-2 rounded-md text-xs font-black bg-[#1a2a3a] text-white">Comprar</button>
                  <button className="flex-1 py-2 rounded-md text-xs font-black text-white/30">Vender</button>
                  <button className="py-2 px-3 rounded-md text-white/30 hover:text-white"><span className="material-symbols-outlined text-sm">sync_alt</span> <span className="text-[10px]">A mercado</span></button>
                </div>

                {/* Outcome buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {market.outcomes.slice(0, 2).map((o) => (
                    <button key={o.key} onClick={() => { setSelectedOutcome(o.key); setError(""); }}
                      className={`py-3 rounded-xl text-sm font-black transition-all ${selectedOutcome === o.key ? "text-white" : "text-white/70 hover:opacity-80"}`}
                      style={{ backgroundColor: selectedOutcome === o.key ? o.color : o.color + "30" }}
                    >
                      {o.label} ({(o.payout_per_unit > 0 ? o.payout_per_unit : (market.outcomes.length * 0.95)).toFixed(2) + "x"})
                    </button>
                  ))}
                </div>

                {/* Amount */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/50 font-bold">Quantia</span>
                    {user && <span className="text-[10px] text-white/30">Saldo: R$ {user.balance.toFixed(2)}</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => { const v = Math.max(0, (parseFloat(betAmount) || 0) - 1); setBetAmount(v > 0 ? String(v) : ""); }} className="w-10 h-10 rounded-lg bg-[#1a2a3a] text-white/50 hover:text-white flex items-center justify-center text-lg font-bold">-</button>
                    <div className="flex-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-white/50 text-lg font-bold">R$</span>
                        <input type="number" value={betAmount} onChange={(e) => { setBetAmount(e.target.value); setError(""); }} placeholder="0" className="bg-transparent text-center text-2xl sm:text-3xl font-black text-white outline-none w-24 sm:w-32 tabular-nums" />
                      </div>
                    </div>
                    <button onClick={() => setBetAmount(String((parseFloat(betAmount) || 0) + 1))} className="w-10 h-10 rounded-lg bg-[#1a2a3a] text-white/50 hover:text-white flex items-center justify-center text-lg font-bold">+</button>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 10, 50, 100].map((v) => (
                      <button key={v} onClick={() => setBetAmount(String(v))} className={`py-2.5 rounded-lg text-xs font-bold transition-all ${betAmount === String(v) ? "bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40" : "bg-[#1a2a3a] text-white/50 hover:text-white"}`}>{v}</button>
                    ))}
                    <button onClick={() => user && setBetAmount(String(Math.floor(user.balance)))} className="py-2.5 rounded-lg text-xs font-bold bg-[#1a2a3a] text-white/50 hover:text-white">MAX</button>
                  </div>
                </div>

                {/* Potential win */}
                <div className="flex items-center justify-between py-3 border-t border-white/[0.04]">
                  <span className="text-sm text-white/50">Para ganhar</span>
                  <div className="text-right">
                    <span className="text-xl font-black text-[#F5A623]">R$ {potentialWin.toFixed(2)}</span>
                    <span className="block text-[10px] text-white/30">{potentialPayout.toFixed(2)}x</span>
                  </div>
                </div>

                {error && (
                  <div className="bg-[#FF5252]/10 border border-[#FF5252]/30 rounded-lg p-2.5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FF5252] text-sm">warning</span>
                    <p className="text-[#FF5252] text-xs">{error}</p>
                  </div>
                )}

                {/* Confirm button */}
                {!user ? (
                  <Link href="/login" className="block w-full py-4 rounded-xl bg-[#F5A623] text-[#1A0E00] font-black text-sm text-center uppercase tracking-wider">Faca login para apostar</Link>
                ) : (
                  <div>
                    <button onClick={() => {
                      const amt = parseFloat(betAmount);
                      if (!amt || amt <= 0) { setError("Valor invalido"); return; }
                      if (user.balance < amt) { setError("Saldo insuficiente"); return; }
                      setShowConfirm(true);
                    }} disabled={!betAmount || parseFloat(betAmount) <= 0}
                      className="w-full py-4 rounded-xl bg-[#F5A623] text-[#1A0E00] font-black text-sm uppercase tracking-wider active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(245,166,35,0.3)]"
                    >
                      Comprar {selected.label}
                    </button>
                    {(!betAmount || parseFloat(betAmount) <= 0) && (
                      <p className="text-[10px] text-white/30 text-center mt-2 flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>info</span>
                        Insira um valor acima para apostar
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* No outcome selected — show positions */
            <>
              <div className="flex border-b border-white/[0.04]">
                {(["posicoes", "aberto", "encerradas"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${tab === t ? "text-[#F5A623] border-b-2 border-[#F5A623]" : "text-white/30"}`}>
                    {t === "posicoes" ? "Posicoes" : t === "aberto" ? "Em aberto" : "Encerradas"}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {!user ? (
                  <div className="text-center py-8">
                    <div className="bg-[#0D0B14] rounded-xl border border-white/[0.04] p-6">
                      <div className="w-14 h-14 rounded-2xl bg-[#F5A623]/10 flex items-center justify-center mx-auto mb-3">
                        <span className="material-symbols-outlined text-[#F5A623] text-2xl">account_circle</span>
                      </div>
                      <p className="text-sm text-white font-bold mb-1">Faca login para comecar</p>
                      <p className="text-xs text-white/30 mb-4">Veja suas posicoes, historico e gerencie suas previsoes.</p>
                      <Link href="/login" className="inline-block px-6 py-2.5 rounded-lg bg-[#F5A623] text-[#1A0E00] text-sm font-black uppercase tracking-wider hover:bg-[#F5A623]/90 active:scale-95 transition-all">Entrar</Link>
                    </div>
                  </div>
                ) : betsLoading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-[#F5A623]/30 border-t-[#F5A623] rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-white/30 mt-3">Carregando posicoes...</p>
                  </div>
                ) : (() => {
                  // POSICOES = bets on THIS market. EM ABERTO / ENCERRADAS = ALL user bets across all markets
                  const filteredBets = tab === "posicoes"
                    ? userBets
                    : tab === "aberto"
                    ? allUserBets.filter((b) => b.status === "pending")
                    : allUserBets.filter((b) => b.status === "won" || b.status === "lost" || b.status === "settled");

                  if (filteredBets.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <div className="bg-[#12101A] rounded-xl border border-white/[0.06] p-6">
                          <div className="w-14 h-14 rounded-2xl bg-[#1a2a3a] flex items-center justify-center mx-auto mb-3">
                            <span className="material-symbols-outlined text-white/30 text-2xl">
                              {tab === "posicoes" ? "touch_app" : tab === "aberto" ? "hourglass_empty" : "check_circle"}
                            </span>
                          </div>
                          <p className="text-sm text-white font-bold mb-1">
                            {tab === "posicoes" ? "Nenhuma posicao ainda" : tab === "aberto" ? "Nenhuma aposta em aberto" : "Nenhuma aposta encerrada"}
                          </p>
                          <p className="text-xs text-white/30">Selecione um resultado ao lado para fazer sua previsao.</p>
                        </div>
                      </div>
                    );
                  }

                  // Totals summary
                  const totalInvested = filteredBets.reduce((s, b) => s + b.amount, 0);
                  const totalPotential = filteredBets.reduce((s, b) => s + b.amount * b.payout_at_entry, 0);

                  return (
                    <div className="space-y-3">
                      {/* Summary bar */}
                      <div className="bg-[#12101A] rounded-xl border border-white/[0.06] p-3 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Investido</span>
                          <p className="text-sm font-black text-white font-mono">R$ {totalInvested.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Potencial</span>
                          <p className="text-sm font-black text-[#F5A623] font-mono">R$ {totalPotential.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Bet cards */}
                      {filteredBets.map((bet) => {
                        const outcomeObj = market.outcomes.find((o) => o.key === bet.outcome_key);
                        const outcomeColor = outcomeObj?.color || "#F5A623";
                        const isWon = bet.status === "won";
                        const isLost = bet.status === "lost";
                        const isPending = bet.status === "pending";
                        const potentialReturn = bet.amount * bet.payout_at_entry;

                        return (
                          <div key={bet.id} className="bg-[#12101A] rounded-xl border border-white/[0.06] p-3 transition-all hover:border-white/[0.12]">
                            {/* Header: outcome + status */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: outcomeColor + "15" }}>
                                  <span className="text-xs font-black" style={{ color: outcomeColor }}>
                                    {bet.outcome_key === "up" || bet.outcome_key === "sobe" ? "\u25B2" : bet.outcome_key === "down" || bet.outcome_key === "desce" ? "\u25BC" : bet.outcome_key.slice(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-sm font-bold text-white">{bet.outcome_label}</span>
                                  {/* Show market title for bets from other markets */}
                                  {"market_title" in bet && (bet as AllUserBet).market_title && (bet as AllUserBet).market_id !== market.id && (
                                    <span className="block text-[10px] text-[#F5A623] truncate max-w-[140px]">{(bet as AllUserBet).market_title}</span>
                                  )}
                                  <span className="block text-[10px] text-white/30">
                                    {new Date(bet.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              </div>
                              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                isWon ? "bg-[#F5A623]/10 text-[#F5A623]" : isLost ? "bg-[#FF5252]/10 text-[#FF5252]" : "bg-[#FFD700]/10 text-[#FFD700]"
                              }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${isWon ? "bg-[#F5A623]" : isLost ? "bg-[#FF5252]" : "bg-[#FFD700] animate-pulse"}`} />
                                {isWon ? "Ganhou" : isLost ? "Perdeu" : "Em aberto"}
                              </div>
                            </div>

                            {/* Bet details */}
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-white/30">Valor</span>
                                <span className="font-bold text-white font-mono">R$ {bet.amount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/30">Odds</span>
                                <span className="font-bold text-white font-mono">{bet.payout_at_entry.toFixed(2)}x</span>
                              </div>
                              <div className="flex justify-between col-span-2">
                                <span className="text-white/30">Potencial</span>
                                <span className={`font-bold font-mono ${isPending ? "text-[#F5A623]" : isWon ? "text-[#F5A623]" : "text-[#FF5252]"}`}>
                                  {isLost ? "- R$ " + bet.amount.toFixed(2) : "R$ " + potentialReturn.toFixed(2)}
                                </span>
                              </div>
                              {bet.entry_price && (
                                <div className="flex justify-between col-span-2 pt-1.5 border-t border-white/[0.06]">
                                  <span className="text-white/30">Entrada</span>
                                  <span className="font-bold text-white font-mono">R$ {bet.entry_price.toFixed(4)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        {/* ─── RIGHT: Chat ─── */}
        <div className="w-full lg:w-[340px] border-l border-white/[0.04] flex flex-col bg-[#0D0B14] overflow-hidden hidden lg:flex">
          <EventChat />
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && selected && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-[#0D0B14] rounded-2xl p-6 w-full max-w-sm border border-white/[0.06]">
            <h3 className="text-lg font-black mb-4 text-center uppercase">Confirmar Previsao</h3>
            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between"><span className="text-white/30">Mercado</span><span className="font-bold text-right max-w-[200px] truncate">{market.title}</span></div>
              <div className="flex justify-between"><span className="text-white/30">Resultado</span><span className="font-bold" style={{ color: selected.color }}>{selected.label}</span></div>
              <div className="flex justify-between"><span className="text-white/30">Valor</span><span className="font-bold">R$ {parseFloat(betAmount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-white/30">Payout est.</span><span className="font-bold">{potentialPayout.toFixed(2)}x</span></div>
              <div className="flex justify-between border-t border-white/[0.04] pt-2"><span className="text-white/30">Retorno est.</span><span className="font-black text-[#F5A623]">R$ {potentialWin.toFixed(2)}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 rounded-xl bg-[#1a2a3a] text-white/50 font-bold">Cancelar</button>
              <button onClick={handleBet} disabled={placing} className="flex-1 py-3 rounded-xl bg-[#F5A623] text-[#1A0E00] font-black uppercase disabled:opacity-50">{placing ? "Enviando..." : "Confirmar"}</button>
            </div>
          </div>
        </div>
      )}

      {betPlaced && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-[#F5A623] text-[#1A0E00] px-6 py-3 rounded-xl font-black text-sm shadow-[0_4px_20px_rgba(245,166,35,0.4)]">Previsao realizada!</div>}

      {/* Live bet toast */}
      {betToast && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[55] flex items-center gap-2.5 px-4 py-2.5 rounded-xl border backdrop-blur-md shadow-lg"
          style={{
            backgroundColor: "rgba(13, 11, 20, 0.85)",
            borderColor: betToast.outcome_color + "40",
            animation: "slideDown 0.3s ease-out",
          }}
        >
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: betToast.outcome_color }} />
          <img
            src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(betToast.user_name)}&backgroundColor=transparent`}
            alt=""
            className="w-6 h-6 rounded-full bg-white/[0.06]"
          />
          <span className="text-[11px] text-white/80">
            <span className="font-bold text-white">{betToast.user_name}</span>
            {" apostou "}
            <span className="font-bold text-[#F5A623]">R$ {betToast.amount}</span>
            {" em "}
            <span className="font-bold" style={{ color: betToast.outcome_color }}>{betToast.outcome_label}</span>
          </span>
        </div>
      )}

      {/* Inline keyframes */}
      <style jsx global>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -12px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      {/* Mobile chat FAB */}
      <button
        onClick={() => setMobileChatOpen(true)}
        className="lg:hidden fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-[#F5A623] text-[#1A0E00] flex items-center justify-center shadow-[0_4px_20px_rgba(245,166,35,0.4)] hover:scale-105 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-lg">forum</span>
      </button>
      <LiveChat isOpen={mobileChatOpen} onClose={() => setMobileChatOpen(false)} />

      <div className="lg:hidden"><BottomNav /></div>
    </div>
  );
}
