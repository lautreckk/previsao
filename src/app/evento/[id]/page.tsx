"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { useChat, avatarColor } from "@/lib/ChatContext";
import { initializeStore, getMarket, placeBetFull, tickAllMarkets } from "@/lib/engines/store";
import { simulateBet, calcImpliedProbabilities } from "@/lib/engines/parimutuel";
import { CATEGORY_META } from "@/lib/engines/types";
import BottomNav from "@/components/BottomNav";
import { LivePriceDisplay } from "@/components/LivePriceDisplay";
import LivePriceChart from "@/components/LivePriceChart";
import { MarketResultBanner } from "@/components/MarketResultBanner";
import LiveRoundCycle from "@/components/LiveRoundCycle";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import type { PredictionMarket } from "@/lib/engines/types";

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3444] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#00D4AA]/10 flex items-center justify-center"><span className="material-symbols-outlined text-[#00D4AA] text-sm">forum</span></div>
          <div>
            <span className="text-xs font-black text-white uppercase tracking-wider">CHAT AO VIVO</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4AA] opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00D4AA]" /></span>
              <span className="text-[9px] text-[#00D4AA] font-bold">{onlineCount} online</span>
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
                <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(msg.user)} flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5`}>{msg.user.replace("@", "").charAt(0).toUpperCase()}</div>
              ) : <div className="w-7 shrink-0" />}
              <div className="min-w-0 flex-1">
                {!grouped && <div className="flex items-center gap-1.5 mb-0.5"><span className="text-[#00D4AA] font-bold text-[11px] truncate">{msg.user}</span></div>}
                <p className="text-[12px] text-gray-300 break-words leading-relaxed">{msg.text}</p>
              </div>
            </div>
          );
        })}
      </div>
      {!isAtBottom && unread > 0 && (
        <button onClick={() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); setIsAtBottom(true); setUnread(0); }}
          className="absolute bottom-[56px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-[#00D4AA] text-[#003D2E] px-2.5 py-1 rounded-full text-[10px] font-black shadow-[0_4px_12px_rgba(0,212,170,0.4)] animate-bounce">
          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>keyboard_arrow_down</span>{unread} novas
        </button>
      )}
      <div className="px-3 py-2.5 border-t border-[#2a3444] shrink-0 bg-[#0a1020]">
        <div className="flex items-center gap-2 bg-[#1a2332] rounded-xl border border-[#2a3444] focus-within:border-[#00D4AA]/40 transition-colors px-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Enviar mensagem..." className="flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder-[#5A6478]" />
          <button className="text-[#5A6478] hover:text-white transition-colors p-1"><span className="material-symbols-outlined text-lg">mood</span></button>
          <button onClick={send} className="text-[#5A6478] hover:text-[#00D4AA] transition-colors p-1"><span className="material-symbols-outlined text-lg">send</span></button>
        </div>
        <p className="text-[10px] text-[#3a4a5a] mt-1 text-center">Seja respeitoso. Siga as <span className="text-[#00D4AA]/70">regras da comunidade</span></p>
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
    // Weather: detect city from title
    if (t.includes("°c") || t.includes("chove") || t.includes("maxima") || m.category === "weather") {
      const cities = ["sao paulo", "rio de janeiro", "brasilia", "curitiba", "belo horizonte", "porto alegre", "fortaleza", "salvador", "florianopolis", "recife", "manaus"];
      const found = cities.find((c) => t.includes(c));
      return { symbol: found || "sao paulo", category: "weather" };
    }
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
      .on("broadcast", { event: "market.resolved" }, (payload: { payload?: { winning_outcome_key?: string } }) => {
        setIsResolved(true);
        if (payload.payload?.winning_outcome_key) {
          setMarket((prev) => prev ? { ...prev, status: "resolved" as const, winning_outcome_key: payload.payload?.winning_outcome_key } : prev);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [market?.id]);

  if (!market) return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-white">
      <div className="text-center"><span className="material-symbols-outlined text-5xl text-[#8B95A8]">error</span><p className="mt-2 text-[#8B95A8]">Mercado nao encontrado</p><button onClick={() => router.push("/")} className="mt-4 text-[#00D4AA] font-bold">Voltar</button></div>
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
    if (isSupabaseMarket) {
      try {
        const res = await fetch("/api/markets/bet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market_id: market.id, outcome_key: selected.key, outcome_label: selected.label, amount, user_id: user.id }) });
        const data = await res.json();
        if (!res.ok || data.error) { setError(data.error || "Erro ao apostar"); setPlacing(false); return; }
        if (data.market) setMarket({ ...market, ...data.market, outcomes: data.market.outcomes || market.outcomes });
        legacyPlaceBet({ marketId: market.id, marketTitle: market.title, optionId: selected.key, optionName: selected.label, amount, odds: selected.payout_per_unit, potentialWin: amount * selected.payout_per_unit });
        refreshUser();
      } catch { setError("Erro de conexao"); setPlacing(false); return; }
    } else {
      const result = placeBetFull(user.id, market.id, selected.key, amount, user.balance);
      if (!result.success) { setError(result.error || "Erro"); setPlacing(false); return; }
      legacyPlaceBet({ marketId: market.id, marketTitle: market.title, optionId: selected.key, optionName: selected.label, amount, odds: selected.payout_per_unit, potentialWin: amount * selected.payout_per_unit });
      setMarket(result.market || market);
    }
    setBetPlaced(true); setShowConfirm(false); setSelectedOutcome(null); setBetAmount(""); setPlacing(false);
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
          <header className="flex items-center justify-between px-4 py-3 border-b border-[#1a2a3a] bg-[#0d1525] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/" className="text-[#00D4AA] shrink-0"><span className="material-symbols-outlined">arrow_back</span></Link>
              <img src="/logo.png" alt="Winify" className="h-8 w-auto" />
            </div>
            {user && <Link href="/perfil" className="bg-[#1a2332] border border-[#2a3444] px-3 py-1.5 rounded-lg text-sm font-bold text-[#00D4AA]">R$ {user.balance.toFixed(2)}</Link>}
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
              {market.subcategory && <span className="text-[10px] text-[#5A6478]">/ {market.subcategory}</span>}
            </div>
            <h1 className="text-xl lg:text-2xl font-black leading-tight mb-1 line-clamp-2 lg:line-clamp-none">{market.title}</h1>
            {market.short_description && <p className="text-sm text-[#8B95A8] mb-3">{market.short_description}</p>}
            {!isLiveRound && (
              <div className="flex items-center gap-3 flex-wrap mb-4">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${isOpen ? "bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/30" : "bg-[#FF5252]/10 text-[#FF5252] border border-[#FF5252]/30"}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-[#00D4AA] animate-pulse" : "bg-[#FF5252]"}`} /> {market.status.toUpperCase()}
                </div>
                <span className="text-xs text-[#8B95A8] font-bold tabular-nums">{timeStr}</span>
                <span className="text-xs text-[#5A6478]">Pool: R$ {market.pool_total.toFixed(0)}</span>
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
                  />
                </div>
              )}

              {/* Probability bars (like Palpitano chart area) */}
              <div className="px-5 mb-4">
                <div className="bg-[#0d1525] rounded-xl border border-[#1a2a3a] p-4">
                  <div className="flex items-center gap-3 flex-wrap mb-4">
                    {market.outcomes.map((o) => {
                      const prob = probabilities.find((p) => p.key === o.key);
                      return (
                        <div key={o.key} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: o.color }} />
                          <span className="text-xs text-[#8B95A8]">{o.label}: <span className="text-white font-bold">{prob ? (prob.probability * 100).toFixed(1) : "0"}%</span></span>
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

              {/* Outcomes list (like Palpitano rows with Sim/Nao buttons) */}
              <div className="px-5 pb-6 space-y-2">
                {market.outcomes.map((o) => {
                  const prob = probabilities.find((p) => p.key === o.key);
                  const isActive = selectedOutcome === o.key;
                  return (
                    <div key={o.key} className={`bg-[#0d1525] rounded-xl border p-3 transition-all ${isActive ? "border-[#00D4AA]/50 bg-[#00D4AA]/5" : "border-[#1a2a3a] hover:border-[#2a3a4a]"}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0" style={{ backgroundColor: o.color + "15", color: o.color }}>
                          {o.key.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-sm block truncate">{o.label}</span>
                          <span className="text-[10px] text-[#5A6478]">{prob ? (prob.probability * 100).toFixed(0) : "0"}% chance</span>
                        </div>
                        <button className="text-[#5A6478] hover:text-white transition-colors hidden lg:block"><span className="material-symbols-outlined text-lg">expand_more</span></button>
                      </div>
                      {/* Action buttons - row on desktop, full width on mobile */}
                      <div className="flex gap-2 mt-2.5">
                        <button
                          onClick={() => { if (!isOpen) return; setSelectedOutcome(o.key); setError(""); }}
                          disabled={!isOpen}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all ${isActive ? "bg-[#00D4AA] text-[#003D2E]" : "bg-[#00D4AA]/10 text-[#00D4AA] hover:bg-[#00D4AA]/20"} disabled:opacity-40 ${flashKeys[o.key] === "up" ? "ring-2 ring-[#00D4AA] bg-[#00D4AA]/30" : ""} ${flashKeys[o.key] === "down" ? "ring-2 ring-[#FF5252] bg-[#FF5252]/20" : ""}`}
                          style={flashKeys[o.key] ? { transition: "all 0.15s ease-out" } : undefined}
                        >
                          <span className="block">Sim</span>
                          <span className="block text-[10px] font-bold opacity-80">{o.payout_per_unit > 0 ? o.payout_per_unit.toFixed(2) + "x" : "—"}</span>
                        </button>
                        <button
                          disabled={!isOpen}
                          className={`flex-1 py-2.5 rounded-lg text-xs font-black bg-[#FF5252]/10 text-[#FF5252] hover:bg-[#FF5252]/20 transition-all disabled:opacity-40 ${flashKeys[o.key] === "down" ? "ring-2 ring-[#FF5252] bg-[#FF5252]/30" : ""} ${flashKeys[o.key] === "up" ? "ring-2 ring-[#00D4AA] bg-[#00D4AA]/20" : ""}`}
                          style={flashKeys[o.key] ? { transition: "all 0.15s ease-out" } : undefined}
                        >
                          <span className="block">Nao</span>
                          <span className="block text-[10px] font-bold opacity-80">{o.payout_per_unit > 0 ? ((market.pool_total * 0.95) / Math.max((market.pool_total - o.pool) || 1, 1)).toFixed(2) + "x" : "—"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ─── MIDDLE: Bet form + Positions ─── */}
        <div className="w-full lg:w-[340px] lg:border-l border-t lg:border-t-0 border-[#1a2a3a] flex flex-col bg-[#0a1222] overflow-hidden lg:max-h-screen">
          {selected ? (
            <div className="flex-1 overflow-y-auto">
              {/* Bet header */}
              <div className="px-4 py-3 border-b border-[#1a2a3a] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: selected.color + "15" }}>
                    <span className="text-xs font-black" style={{ color: selected.color }}>{selected.key.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#8B95A8]">Sim</span>
                    <span className="block text-sm font-black" style={{ color: selected.color }}>{selected.label}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedOutcome(null)} className="text-[#5A6478] hover:text-white"><span className="material-symbols-outlined text-sm">close</span></button>
              </div>

              <div className="p-4 space-y-4">
                {/* Comprar / Vender tabs */}
                <div className="flex gap-1 bg-[#111827] rounded-lg p-1">
                  <button className="flex-1 py-2 rounded-md text-xs font-black bg-[#1a2a3a] text-white">Comprar</button>
                  <button className="flex-1 py-2 rounded-md text-xs font-black text-[#5A6478]">Vender</button>
                  <button className="py-2 px-3 rounded-md text-[#5A6478] hover:text-white"><span className="material-symbols-outlined text-sm">sync_alt</span> <span className="text-[10px]">A mercado</span></button>
                </div>

                {/* Outcome buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {market.outcomes.slice(0, 2).map((o) => (
                    <button key={o.key} onClick={() => { setSelectedOutcome(o.key); setError(""); }}
                      className={`py-3 rounded-xl text-sm font-black transition-all ${selectedOutcome === o.key ? "text-white" : "text-white/70 hover:opacity-80"}`}
                      style={{ backgroundColor: selectedOutcome === o.key ? o.color : o.color + "30" }}
                    >
                      {o.label} ({o.payout_per_unit > 0 ? o.payout_per_unit.toFixed(2) + "x" : "—"})
                    </button>
                  ))}
                </div>

                {/* Amount */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#8B95A8] font-bold">Quantia</span>
                    {user && <span className="text-[10px] text-[#5A6478]">Saldo: R$ {user.balance.toFixed(2)}</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => { const v = Math.max(0, (parseFloat(betAmount) || 0) - 1); setBetAmount(v > 0 ? String(v) : ""); }} className="w-10 h-10 rounded-lg bg-[#1a2a3a] text-[#8B95A8] hover:text-white flex items-center justify-center text-lg font-bold">-</button>
                    <div className="flex-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-[#8B95A8] text-lg font-bold">R$</span>
                        <input type="number" value={betAmount} onChange={(e) => { setBetAmount(e.target.value); setError(""); }} placeholder="0" className="bg-transparent text-center text-2xl sm:text-3xl font-black text-white outline-none w-24 sm:w-32 tabular-nums" />
                      </div>
                    </div>
                    <button onClick={() => setBetAmount(String((parseFloat(betAmount) || 0) + 1))} className="w-10 h-10 rounded-lg bg-[#1a2a3a] text-[#8B95A8] hover:text-white flex items-center justify-center text-lg font-bold">+</button>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 10, 50, 100].map((v) => (
                      <button key={v} onClick={() => setBetAmount(String(v))} className={`py-2.5 rounded-lg text-xs font-bold transition-all ${betAmount === String(v) ? "bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/40" : "bg-[#1a2a3a] text-[#8B95A8] hover:text-white"}`}>{v}</button>
                    ))}
                    <button onClick={() => user && setBetAmount(String(Math.floor(user.balance)))} className="py-2.5 rounded-lg text-xs font-bold bg-[#1a2a3a] text-[#8B95A8] hover:text-white">MAX</button>
                  </div>
                </div>

                {/* Potential win */}
                <div className="flex items-center justify-between py-3 border-t border-[#1a2a3a]">
                  <span className="text-sm text-[#8B95A8]">Para ganhar</span>
                  <div className="text-right">
                    <span className="text-xl font-black text-[#00D4AA]">R$ {potentialWin.toFixed(2)}</span>
                    <span className="block text-[10px] text-[#5A6478]">{potentialPayout.toFixed(2)}x</span>
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
                  <Link href="/login" className="block w-full py-4 rounded-xl bg-[#00D4AA] text-[#003D2E] font-black text-sm text-center uppercase tracking-wider">Faca login para apostar</Link>
                ) : (
                  <button onClick={() => {
                    const amt = parseFloat(betAmount);
                    if (!amt || amt <= 0) { setError("Valor invalido"); return; }
                    if (user.balance < amt) { setError("Saldo insuficiente"); return; }
                    setShowConfirm(true);
                  }} disabled={!betAmount || parseFloat(betAmount) <= 0}
                    className="w-full py-4 rounded-xl bg-[#00D4AA] text-[#003D2E] font-black text-sm uppercase tracking-wider active:scale-[0.98] transition-all disabled:opacity-40 shadow-[0_4px_20px_rgba(0,212,170,0.3)]"
                  >
                    Comprar {selected.label}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* No outcome selected — show positions */
            <>
              <div className="flex border-b border-[#1a2a3a]">
                {(["posicoes", "aberto", "encerradas"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${tab === t ? "text-[#00D4AA] border-b-2 border-[#00D4AA]" : "text-[#5A6478]"}`}>
                    {t === "posicoes" ? "Posicoes" : t === "aberto" ? "Em aberto" : "Encerradas"}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="text-center text-[#5A6478] py-8">
                  {!user ? (
                    <>
                      <p className="text-sm">Faca login para visualizar suas posicoes.</p>
                      <Link href="/login" className="text-[#00D4AA] text-sm font-bold mt-2 inline-block">Entrar</Link>
                    </>
                  ) : (
                    <p className="text-xs">Selecione um resultado para fazer sua previsao.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ─── RIGHT: Chat ─── */}
        <div className="w-full lg:w-[340px] border-l border-[#1a2a3a] flex flex-col bg-[#0d1525] overflow-hidden hidden lg:flex">
          <EventChat />
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && selected && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-[#0d1525] rounded-2xl p-6 w-full max-w-sm border border-[#2a3444]">
            <h3 className="text-lg font-black mb-4 text-center uppercase">Confirmar Previsao</h3>
            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between"><span className="text-[#5A6478]">Mercado</span><span className="font-bold text-right max-w-[200px] truncate">{market.title}</span></div>
              <div className="flex justify-between"><span className="text-[#5A6478]">Resultado</span><span className="font-bold" style={{ color: selected.color }}>{selected.label}</span></div>
              <div className="flex justify-between"><span className="text-[#5A6478]">Valor</span><span className="font-bold">R$ {parseFloat(betAmount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-[#5A6478]">Payout est.</span><span className="font-bold">{potentialPayout.toFixed(2)}x</span></div>
              <div className="flex justify-between border-t border-[#1a2a3a] pt-2"><span className="text-[#5A6478]">Retorno est.</span><span className="font-black text-[#00D4AA]">R$ {potentialWin.toFixed(2)}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 rounded-xl bg-[#1a2a3a] text-[#8B95A8] font-bold">Cancelar</button>
              <button onClick={handleBet} disabled={placing} className="flex-1 py-3 rounded-xl bg-[#00D4AA] text-[#003D2E] font-black uppercase disabled:opacity-50">{placing ? "Enviando..." : "Confirmar"}</button>
            </div>
          </div>
        </div>
      )}

      {betPlaced && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-[#00D4AA] text-[#003D2E] px-6 py-3 rounded-xl font-black text-sm shadow-[0_4px_20px_rgba(0,212,170,0.4)]">Previsao realizada!</div>}

      <div className="lg:hidden"><BottomNav /></div>
    </div>
  );
}
