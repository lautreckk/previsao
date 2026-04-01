"use client";

import { useState, useEffect, useRef } from "react";
import type { PredictionMarket } from "@/lib/engines/types";
import { CATEGORY_META } from "@/lib/engines/types";
import Link from "next/link";
import { calcImpliedProbabilities } from "@/lib/engines/parimutuel";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import { ENTITY_MAP } from "@/lib/entity-map";

/* Mini round history from Supabase */
function RoundHistoryDots({ marketId }: { marketId: string }) {
  const [results, setResults] = useState<boolean[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.from("camera_rounds").select("final_count, threshold").eq("market_id", marketId)
      .not("resolved_at", "is", null).order("round_number", { ascending: false }).limit(5)
      .then(({ data }) => { if (cancelled || !data || data.length === 0) return; setResults(data.reverse().map((r) => (r.final_count || 0) > (r.threshold || 0))); });
    return () => { cancelled = true; };
  }, [marketId]);
  if (!results) return null;
  return (
    <div className="px-3 pb-1 flex items-center gap-1">
      <span className="text-[9px] text-white/30 font-bold mr-1">Ultimos</span>
      {results.map((isOver, i) => (
        <div key={i} className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black text-white ${isOver ? "bg-[#10B981]" : "bg-[#FF5252]"}`}>
          {isOver ? "▲" : "▼"}
        </div>
      ))}
    </div>
  );
}

/* ── Live bet flash on an outcome row ── */
interface LiveBetFlash {
  outcomeKey: string;
  amount: number;
  userName: string;
  ts: number;
}

export default function MarketCard({ market }: { market: PredictionMarket }) {
  const meta = CATEGORY_META[market.category];
  const isCamera = !!market.stream_url || market.id.startsWith("cam_");
  const isClosed = ["resolved", "cancelled"].includes(market.status) || (!isCamera && market.close_at <= Date.now());
  const isLive = market.status === "open" && (market.close_at > Date.now() || isCamera);
  const now = Date.now();

  // Timer with live update
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isLive) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [isLive]);

  const remaining = market.close_at - Date.now();
  let timeStr = "";
  if (remaining <= 0) timeStr = isCamera ? "AO VIVO" : "Encerrado";
  else if (remaining < 3600000) { const m = Math.floor(remaining / 60000); const s = Math.floor((remaining % 60000) / 1000); timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; }
  else if (remaining < 86400000) { const h = Math.floor(remaining / 3600000); const m = Math.floor((remaining % 3600000) / 60000); timeStr = `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`; }
  else if (remaining < 604800000) timeStr = `${Math.floor(remaining / 86400000)}d`;
  else timeStr = `${Math.floor(remaining / 604800000)} sem.`;

  // ── Realtime state ──
  const [liveOutcomes, setLiveOutcomes] = useState(market.outcomes);
  const [livePool, setLivePool] = useState(market.pool_total);
  const [flash, setFlash] = useState<LiveBetFlash | null>(null);
  const [prevPools, setPrevPools] = useState<Record<string, number>>({});
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync when market prop changes
  useEffect(() => {
    setLiveOutcomes(market.outcomes);
    setLivePool(market.pool_total);
  }, [market.outcomes, market.pool_total]);

  // Subscribe to realtime broadcasts
  useEffect(() => {
    if (!isLive) return;

    const channel = supabase.channel(`card-${market.id}`)
      .on("broadcast", { event: "odds.update" }, (msg) => {
        const p = msg.payload;
        if (p?.outcomes) {
          setLiveOutcomes((prev) => {
            // Save previous pools for strikethrough animation
            const old: Record<string, number> = {};
            for (const o of prev) old[o.key] = Number(o.pool) || 0;
            setPrevPools(old);
            return p.outcomes;
          });
        }
        if (p?.pool_total != null) setLivePool(p.pool_total);
      })
      .on("broadcast", { event: "bet.placed" }, (msg) => {
        const p = msg.payload;
        if (!p) return;
        // Trigger flash animation
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        setFlash({
          outcomeKey: p.outcome_key,
          amount: p.amount,
          userName: p.user_name || "Alguem",
          ts: Date.now(),
        });
        flashTimeoutRef.current = setTimeout(() => {
          setFlash(null);
          setPrevPools({});
        }, 2500);
      })
      .subscribe();

    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [market.id, isLive]);

  const probs = calcImpliedProbabilities(liveOutcomes);

  // Default odds when pool is 0
  const getOdds = (o: typeof liveOutcomes[0]) =>
    o.payout_per_unit > 0 ? o.payout_per_unit : liveOutcomes.length * 0.95;

  return (
    <Link
      href={isClosed ? "#" : isCamera ? `/camera/${market.id}` : `/evento/${market.id}`}
      className={`block group ${isClosed ? "pointer-events-none" : ""}`}
    >
      <div className={`relative rounded-2xl border overflow-hidden h-full flex flex-col transition-all duration-200 ${
        isClosed
          ? "bg-[hsl(0,0%,11%)]/60 border-[hsl(0,0%,18%)]/40 opacity-50"
          : "bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] shadow-[0_2px_12px_rgba(0,0,0,0.3)] hover:border-[#80FF00]/30 hover:shadow-xl hover:scale-[1.02]"
      }`}>

        {/* Subtle category gradient at top */}
        {!isClosed && (
          <div
            className="absolute top-0 left-0 right-0 h-16 pointer-events-none"
            style={{
              background: `linear-gradient(180deg, ${(meta?.color || "#888")}10 0%, transparent 100%)`
            }}
          />
        )}

        {/* ── Category Badge ── */}
        <div className="px-3 pt-3 flex items-center justify-between">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1"
            style={{ backgroundColor: (meta?.color || "#888") + "15", color: meta?.color || "#888" }}
          >
            {meta?.icon && <Icon name={meta.icon} size={11} weight="duotone" />}
            {meta?.label || market.category}
          </span>
          {/* Live pulse or timer */}
          {isLive && remaining > 0 && remaining < 600000 && (
            <span className="text-[10px] font-mono font-bold text-[#A0FF40] animate-pulse">{timeStr}</span>
          )}
        </div>

        {/* ── Title + Thumbnail ── */}
        <div className="px-3 pt-2 pb-2 flex items-start gap-2.5">
          {(() => {
            // Try banner_url first (skip placeholder avatars), then entity map fallback, then emoji
            const hasBanner = market.banner_url && !market.banner_url.includes("ui-avatars.com");
            const imgUrl = (hasBanner ? market.banner_url : "") || (() => {
              const norm = market.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              for (const entity of ENTITY_MAP) {
                for (const alias of entity.aliases) {
                  if (norm.includes(alias.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
                    return entity.image_url;
                  }
                }
              }
              return "";
            })();

            if (imgUrl) {
              return <img src={imgUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 mt-0.5 ring-1 ring-white/[0.06]" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }} />;
            }

            // Emoji fallback for abstract topics
            const t = market.title.toLowerCase();
            let emoji = "🎯";
            if (t.includes("dolar") || t.includes("dólar")) emoji = "💵";
            else if (t.includes("clima") || t.includes("°c") || t.includes("chove") || t.includes("maxima") || t.includes("atinge")) emoji = "🌡️";
            else if (t.includes("rodovia") || t.includes("carro") || t.includes("veiculo")) emoji = "🚗";
            else if (t.includes("petroleo") || t.includes("barril")) emoji = "🛢️";
            else if (t.includes("acao") || t.includes("ação") || t.includes("retorno")) emoji = "📊";
            else if (market.category === "weather") emoji = "☀️";
            else if (market.category === "economy") emoji = "💹";
            else if (market.category === "sports") emoji = "⚽";
            else if (market.category === "entertainment") emoji = "🎬";
            else if (market.category === "politics") emoji = "🏛️";

            return (
              <div className="w-9 h-9 rounded-lg shrink-0 mt-0.5 flex items-center justify-center text-xl" style={{ backgroundColor: (meta?.color || "#888") + "20" }}>
                {emoji}
              </div>
            );
          })()}
          <h4 className="text-[13px] font-bold leading-snug text-white line-clamp-2 group-hover:text-[#80FF00] transition-colors">
            {market.title}
          </h4>
        </div>

        {isCamera && <RoundHistoryDots marketId={market.id} />}

        {/* ── Outcomes ── */}
        <div className="px-3 pb-2.5 flex-1 space-y-1">
          {liveOutcomes.slice(0, 3).map((o) => {
            const prob = probs.find((p) => p.key === o.key);
            const pct = prob ? Math.round(prob.probability * 100) : Math.round(100 / liveOutcomes.length);
            const odds = getOdds(o);
            const isFlashing = flash?.outcomeKey === o.key;
            const prevPool = prevPools[o.key];
            const currPool = Number(o.pool) || 0;
            const showPrevPool = isFlashing && prevPool != null && prevPool !== currPool;

            return (
              <div
                key={o.key}
                className={`flex items-center gap-1.5 rounded-md px-1 -mx-1 transition-all duration-300 ${
                  isFlashing ? "bg-white/[0.06]" : ""
                }`}
                style={isFlashing ? {
                  boxShadow: `inset 0 0 12px ${o.color}15`,
                } : undefined}
              >
                {/* Color dot with pulse on flash */}
                <div className="relative w-1.5 h-1.5 shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${isFlashing ? "animate-ping absolute inset-0" : ""}`} style={{ backgroundColor: o.color, opacity: isFlashing ? 0.6 : 1 }} />
                  <div className="w-1.5 h-1.5 rounded-full relative" style={{ backgroundColor: o.color }} />
                </div>
                {/* Label */}
                <span className="text-[11px] text-white/80 truncate min-w-0 font-medium">{o.label}</span>

                {/* Live bet amount indicator */}
                {showPrevPool && (
                  <span className="text-[9px] font-bold text-[#80FF00] animate-pulse shrink-0 ml-auto">
                    +R${flash!.amount.toFixed(0)}
                  </span>
                )}

                {/* Odds */}
                <span className={`text-[11px] font-mono shrink-0 tabular-nums font-bold transition-all duration-300 ${
                  isFlashing ? "text-[#80FF00] scale-110" : odds >= 3 ? "text-[#80FF00]" : "text-white/50"
                } ${!showPrevPool ? "ml-auto" : ""}`}>
                  {odds.toFixed(2)}x
                </span>
                {/* Percentage badge with glow */}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[38px] text-center shrink-0 transition-all duration-300 ${
                    isFlashing ? "scale-105 ring-1" : ""
                  }`}
                  style={{
                    backgroundColor: o.color + "25",
                    color: o.color,
                    boxShadow: isFlashing ? `0 0 10px ${o.color}40` : `0 0 6px ${o.color}20`,
                    ringColor: isFlashing ? o.color : undefined,
                  }}
                >
                  {pct}%
                </span>
              </div>
            );
          })}
          {liveOutcomes.length > 3 && (
            <p className="text-[10px] text-white/20 pl-3">+{liveOutcomes.length - 3} opcoes</p>
          )}
        </div>

        {/* ── Live bet toast ── */}
        {flash && (
          <div className="px-3 pb-1.5 overflow-hidden">
            <div className="flex items-center gap-1.5 text-[9px] text-white/50 animate-[fadeSlideIn_0.3s_ease-out]">
              <div className="w-3 h-3 rounded-full bg-[#80FF00]/20 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[#80FF00]" />
              </div>
              <span className="truncate">
                <span className="text-white/70 font-bold">{flash.userName.split(" ")[0]}</span>
                {" apostou "}
                <span className="text-[#80FF00] font-bold">R$ {flash.amount.toFixed(2)}</span>
              </span>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="px-3 pb-2.5 pt-1.5 flex items-center justify-between border-t border-white/[0.04]">
          {isLive && remaining > 0 ? (
            <div className="flex items-center gap-1.5">
              <div className="relative w-2 h-2">
                <div className="absolute inset-0 rounded-full bg-[#FF4444] animate-ping opacity-75" />
                <div className="relative w-2 h-2 rounded-full bg-[#FF4444]" />
              </div>
              <span className="text-[10px] font-black text-[#FF4444] uppercase tracking-wider">AO VIVO</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Icon name="check_circle" size={12} className="text-white/20" />
              <span className="text-[10px] font-bold text-white/20">Encerrado</span>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            {livePool > 0 && (
              <div className="flex items-center gap-1">
                <Icon name="bar_chart" size={11} className="text-white/25" />
                <span className={`text-[10px] font-bold font-mono tabular-nums transition-all duration-300 ${
                  flash ? "text-[#80FF00]" : "text-white/30"
                }`}>
                  R$ {livePool >= 1000 ? (livePool / 1000).toFixed(1) + "k" : livePool.toFixed(0)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Icon name="schedule" size={11} className="text-white/25" />
              <span className={`text-[10px] font-bold font-mono tabular-nums ${
                remaining > 0 && remaining < 600000 ? "text-[#A0FF40]" : remaining > 0 ? "text-white/30" : "text-white/15"
              }`}>
                {timeStr}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
