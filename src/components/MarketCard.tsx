"use client";

import { useState, useEffect, useRef } from "react";
import type { PredictionMarket } from "@/lib/engines/types";
import { CATEGORY_META } from "@/lib/engines/types";
import Link from "next/link";
import { calcImpliedProbabilities } from "@/lib/engines/parimutuel";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import { ENTITY_MAP } from "@/lib/entity-map";
import { useCameraPreview } from "@/hooks/useCameraPreview";

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
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-white/30 font-bold mr-1">Ultimos</span>
      {results.map((isOver, i) => (
        <div key={i} className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black text-white ${isOver ? "bg-[#10B981]" : "bg-[#FF5252]"}`}>
          {isOver ? "▲" : "▼"}
        </div>
      ))}
    </div>
  );
}

/* Live camera preview panel (shown in floating popover on hover) */
function CameraLivePreview({ marketId }: { marketId: string }) {
  const data = useCameraPreview(marketId, true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-4 h-4 border-2 border-[#80FF00]/40 border-t-[#80FF00] rounded-full animate-spin" />
      </div>
    );
  }

  const { currentCount, threshold, phase, phaseEndsAt } = data;
  const diff = currentCount - threshold;
  const pct = threshold > 0 ? Math.min((currentCount / threshold) * 100, 150) : 0;
  const isOver = currentCount > threshold;

  let phaseTimeStr = "";
  if (phaseEndsAt) {
    const remaining = phaseEndsAt - Date.now();
    if (remaining > 0) {
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      phaseTimeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
  }

  const phaseLabel = phase === "observation" ? "Contando" : phase === "betting" ? "Apostas abertas" : "Aguardando";
  const phaseColor = phase === "observation" ? "#FF4444" : phase === "betting" ? "#80FF00" : "#888";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: phaseColor }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: phaseColor }}>{phaseLabel}</span>
        </div>
        {phaseTimeStr && (
          <span className="text-[11px] font-mono font-bold text-white/60">{phaseTimeStr}</span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-white/40 font-medium">Contagem atual</p>
          <p className="text-2xl font-black text-white tabular-nums leading-none mt-0.5">{currentCount}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/40 font-medium">Linha</p>
          <p className="text-lg font-bold text-white/60 tabular-nums leading-none mt-0.5">{threshold}</p>
        </div>
      </div>

      <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: isOver ? "#10B981" : pct > 80 ? "#FBBF24" : "#80FF00",
          }}
        />
        <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: `${Math.min(100, (threshold / Math.max(currentCount, threshold)) * 100)}%` }} />
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold ${isOver ? "text-[#10B981]" : diff === 0 ? "text-white/40" : "text-[#FF5252]"}`}>
          {diff > 0 ? `+${diff} acima` : diff < 0 ? `${Math.abs(diff)} faltam` : "Na linha"}
        </span>
        {data.poolOver + data.poolUnder > 0 && (
          <span className="text-[10px] text-white/30 font-mono">
            R$ {(data.poolOver + data.poolUnder).toFixed(0)} no pool
          </span>
        )}
      </div>
    </div>
  );
}

/* Generic market preview (shown in floating popover on hover) */
function MarketLivePreview({ market }: { market: PredictionMarket }) {
  const probs = calcImpliedProbabilities(market.outcomes);
  const topOutcome = probs.reduce((a, b) => (a.probability > b.probability ? a : b), probs[0]);

  return (
    <div className="space-y-2">
      {market.outcomes.slice(0, 4).map((o) => {
        const prob = probs.find((p) => p.key === o.key);
        const pct = prob ? Math.round(prob.probability * 100) : Math.round(100 / market.outcomes.length);
        return (
          <div key={o.key} className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/70 font-medium truncate">{o.label}</span>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: o.color }}>{pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: o.color + "CC" }}
              />
            </div>
          </div>
        );
      })}

      {topOutcome && (
        <p className="text-[10px] text-white/40 mt-1">
          <span className="text-white/60 font-semibold">{market.outcomes.find(o => o.key === topOutcome.key)?.label}</span> lidera com {Math.round(topOutcome.probability * 100)}% de probabilidade
        </p>
      )}
    </div>
  );
}

export default function MarketCard({ market }: { market: PredictionMarket }) {
  const meta = CATEGORY_META[market.category];
  const isCamera = !!market.stream_url || market.id.startsWith("cam_");
  const isClosed = ["resolved", "cancelled"].includes(market.status) || (!isCamera && market.close_at <= Date.now());
  const isLive = market.status === "open" && (market.close_at > Date.now() || isCamera);
  const [hovered, setHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [popoverSide, setPopoverSide] = useState<"bottom" | "top">("bottom");

  // Delay before showing preview (prevents flash on quick mouse-overs)
  const handleMouseEnter = () => {
    if (isClosed) return;
    setHovered(true);
    hoverTimeout.current = setTimeout(() => {
      // Decide if popover should go up or down based on card position
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setPopoverSide(spaceBelow < 220 ? "top" : "bottom");
      }
      setShowPreview(true);
    }, 400);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setShowPreview(false);
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
  };

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

  const probs = calcImpliedProbabilities(market.outcomes);

  const getOdds = (o: typeof market.outcomes[0]) =>
    o.payout_per_unit > 0 ? o.payout_per_unit : market.outcomes.length * 0.95;

  return (
    <div
      ref={cardRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href={isClosed ? "#" : isCamera ? `/camera/${market.id}` : `/evento/${market.id}`}
        className={`block group ${isClosed ? "pointer-events-none" : ""}`}
      >
        <div className={`relative rounded-2xl border overflow-hidden h-full flex flex-col transition-all duration-300 ease-out ${
          isClosed
            ? "bg-[hsl(0,0%,11%)]/60 border-[hsl(0,0%,18%)]/40 opacity-50"
            : hovered
              ? "bg-[hsl(0,0%,12%)] border-[#80FF00]/30 shadow-[0_4px_24px_rgba(128,255,0,0.08)] scale-[1.02]"
              : "bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
        }`}>

          {/* Top accent line */}
          {!isClosed && isLive && (
            <div
              className="h-[2px] w-full"
              style={{
                background: isCamera
                  ? "linear-gradient(90deg, #FF4444, #FF6B6B, #FF4444)"
                  : `linear-gradient(90deg, transparent, ${meta?.color || "#80FF00"}, transparent)`,
              }}
            />
          )}

          {/* Category gradient overlay */}
          {!isClosed && (
            <div
              className="absolute top-0 left-0 right-0 h-20 pointer-events-none"
              style={{
                background: `linear-gradient(180deg, ${(meta?.color || "#888")}12 0%, transparent 100%)`
              }}
            />
          )}

          {/* ── Category Badge + Timer ── */}
          <div className="px-3 pt-3 flex items-center justify-between">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1"
              style={{ backgroundColor: (meta?.color || "#888") + "15", color: meta?.color || "#888" }}
            >
              {meta?.icon && <Icon name={meta.icon} size={11} weight="duotone" />}
              {meta?.label || market.category}
            </span>
            <div className="flex items-center gap-2">
              {isLive && remaining > 0 && remaining < 600000 && (
                <span className="text-[10px] font-mono font-bold text-[#A0FF40] animate-pulse">{timeStr}</span>
              )}
              {isCamera && isLive && (
                <span className="flex items-center gap-1 bg-red-500/15 px-1.5 py-0.5 rounded">
                  <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[8px] font-black text-red-400 uppercase">Live</span>
                </span>
              )}
            </div>
          </div>

          {/* ── Title + Thumbnail ── */}
          <div className="px-3 pt-2 pb-2 flex items-start gap-2.5">
            {(() => {
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

          {isCamera && (
            <div className="px-3 pb-1">
              <RoundHistoryDots marketId={market.id} />
            </div>
          )}

          {/* ── Outcomes ── */}
          <div className="px-3 pb-2.5 flex-1 space-y-1">
            {market.outcomes.slice(0, 3).map((o) => {
              const prob = probs.find((p) => p.key === o.key);
              const pct = prob ? Math.round(prob.probability * 100) : Math.round(100 / market.outcomes.length);
              const odds = getOdds(o);
              return (
                <div key={o.key} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                  <span className="text-[11px] text-white/80 truncate flex-1 min-w-0 font-medium">{o.label}</span>
                  <span className={`text-[11px] font-mono shrink-0 tabular-nums font-bold ${odds >= 3 ? "text-[#80FF00]" : "text-white/50"}`}>
                    {odds.toFixed(2)}x
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[38px] text-center shrink-0"
                    style={{
                      backgroundColor: o.color + "25",
                      color: o.color,
                      boxShadow: `0 0 6px ${o.color}20`,
                    }}
                  >
                    {pct}%
                  </span>
                </div>
              );
            })}
            {market.outcomes.length > 3 && (
              <p className="text-[10px] text-white/20 pl-3">+{market.outcomes.length - 3} opcoes</p>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-3 pb-2.5 pt-1.5 flex items-center justify-between border-t border-white/[0.04]">
            {isLive && (remaining > 0 || isCamera) ? (
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
              {market.pool_total > 0 && (
                <div className="flex items-center gap-1">
                  <Icon name="bar_chart" size={11} className="text-white/25" />
                  <span className="text-[10px] text-white/30 font-bold font-mono tabular-nums">
                    R$ {market.pool_total >= 1000 ? (market.pool_total / 1000).toFixed(1) + "k" : market.pool_total.toFixed(0)}
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

      {/* ── Floating Preview Popover ── */}
      {showPreview && !isClosed && (
        <div
          className={`absolute left-0 right-0 z-50 pointer-events-none animate-in fade-in duration-200 ${
            popoverSide === "top" ? "bottom-full mb-2 slide-in-from-bottom-2" : "top-full mt-2 slide-in-from-top-2"
          }`}
        >
          <div className="pointer-events-auto rounded-xl border border-[#80FF00]/20 bg-[#141a22] shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(128,255,0,0.05)] backdrop-blur-xl p-3">
            {/* Arrow indicator */}
            <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-[#80FF00]/20 bg-[#141a22] ${
              popoverSide === "top"
                ? "bottom-[-5px] border-r border-b"
                : "top-[-5px] border-l border-t"
            }`} />

            {/* Header */}
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/[0.06]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#80FF00] animate-pulse" />
              <span className="text-[10px] font-bold text-[#80FF00] uppercase tracking-wider">
                {isCamera ? "Status ao vivo" : "Distribuicao de odds"}
              </span>
            </div>

            {/* Content */}
            {isCamera ? (
              <CameraLivePreview marketId={market.id} />
            ) : (
              <MarketLivePreview market={market} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
