"use client";

import { useState, useEffect } from "react";
import type { PredictionMarket } from "@/lib/engines/types";
import { CATEGORY_META } from "@/lib/engines/types";
import Link from "next/link";
import { calcImpliedProbabilities } from "@/lib/engines/parimutuel";
import { supabase } from "@/lib/supabase";

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

export default function MarketCard({ market }: { market: PredictionMarket }) {
  const meta = CATEGORY_META[market.category];
  const isClosed = ["resolved", "cancelled"].includes(market.status) || market.close_at <= Date.now();
  const isLive = market.status === "open" && market.close_at > Date.now();
  const now = Date.now();
  const timeLeft = market.close_at - now;
  const isCamera = !!market.stream_url || market.id.startsWith("cam_");

  // Timer with live update
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isLive) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [isLive]);

  const remaining = market.close_at - Date.now();
  let timeStr = "";
  if (remaining <= 0) timeStr = "Encerrado";
  else if (remaining < 3600000) { const m = Math.floor(remaining / 60000); const s = Math.floor((remaining % 60000) / 1000); timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; }
  else if (remaining < 86400000) { const h = Math.floor(remaining / 3600000); const m = Math.floor((remaining % 3600000) / 60000); timeStr = `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`; }
  else if (remaining < 604800000) timeStr = `${Math.floor(remaining / 86400000)}d`;
  else timeStr = `${Math.floor(remaining / 604800000)} sem.`;

  const probs = calcImpliedProbabilities(market.outcomes);

  // Default odds when pool is 0
  const getOdds = (o: typeof market.outcomes[0]) =>
    o.payout_per_unit > 0 ? o.payout_per_unit : market.outcomes.length * 0.95;

  return (
    <Link
      href={isClosed ? "#" : isCamera ? `/camera/${market.id}` : `/evento/${market.id}`}
      className={`block group ${isClosed ? "pointer-events-none" : ""}`}
    >
      <div className={`relative rounded-2xl border overflow-hidden h-full flex flex-col transition-all duration-200 ${
        isClosed
          ? "bg-[#12101A]/60 border-white/[0.04] opacity-50"
          : "bg-[#12101A] border-white/[0.06] hover:border-white/[0.15] hover:shadow-lg hover:shadow-black/20 hover:scale-[1.01]"
      }`}>

        {/* ── Category Badge ── */}
        <div className="px-3 pt-3 flex items-center justify-between">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1"
            style={{ backgroundColor: (meta?.color || "#888") + "15", color: meta?.color || "#888" }}
          >
            {meta?.icon && <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>{meta.icon}</span>}
            {meta?.label || market.category}
          </span>
          {/* Live pulse or timer */}
          {isLive && remaining > 0 && remaining < 600000 && (
            <span className="text-[10px] font-mono font-bold text-[#FFB800] animate-pulse">{timeStr}</span>
          )}
        </div>

        {/* ── Title + Thumbnail ── */}
        <div className="px-3 pt-2 pb-2 flex items-start gap-2.5">
          {market.banner_url ? (
            <img src={market.banner_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 mt-0.5 ring-1 ring-white/[0.06]" />
          ) : (
            <div className="w-9 h-9 rounded-lg shrink-0 mt-0.5 flex items-center justify-center text-xl" style={{ backgroundColor: (meta?.color || "#888") + "20" }}>
              {(() => {
                // Category emoji fallback — more visually engaging than material icons
                const t = market.title.toLowerCase();
                if (t.includes("bitcoin") || t.includes("btc")) return "₿";
                if (t.includes("ethereum") || t.includes("eth")) return "⟠";
                if (t.includes("solana") || t.includes("sol")) return "◎";
                if (t.includes("dolar") || t.includes("dólar")) return "💵";
                if (t.includes("petr") || t.includes("vale") || t.includes("itub")) return "📈";
                if (t.includes("clima") || t.includes("°c") || t.includes("chove") || t.includes("maxima")) return "🌡️";
                if (t.includes("futebol") || t.includes("serie a") || t.includes("vs") || t.includes("gol")) return "⚽";
                if (t.includes("bbb") || t.includes("paredao") || t.includes("eliminad")) return "📺";
                if (t.includes("stories") || t.includes("virginia") || t.includes("carlinhos")) return "📱";
                if (t.includes("rodovia") || t.includes("carro")) return "🚗";
                if (t.includes("petroleo") || t.includes("barril")) return "🛢️";
                if (t.includes("ibovespa") || t.includes("acao") || t.includes("ação")) return "📊";
                if (t.includes("champions") || t.includes("copa")) return "🏆";
                if (t.includes("eleicao") || t.includes("presidente") || t.includes("lula") || t.includes("bolsonaro")) return "🗳️";
                if (market.category === "crypto") return "🪙";
                if (market.category === "sports") return "⚽";
                if (market.category === "weather") return "☀️";
                if (market.category === "economy") return "💹";
                if (market.category === "entertainment") return "🎬";
                if (market.category === "politics") return "🏛️";
                if (market.category === "social_media") return "📱";
                return "🎯";
              })()}
            </div>
          )}
          <h4 className="text-[13px] font-bold leading-snug text-white line-clamp-2 group-hover:text-[#F5A623] transition-colors">
            {market.title}
          </h4>
        </div>

        {isCamera && <RoundHistoryDots marketId={market.id} />}

        {/* ── Outcomes ── */}
        <div className="px-3 pb-2.5 flex-1 space-y-1">
          {market.outcomes.slice(0, 3).map((o) => {
            const prob = probs.find((p) => p.key === o.key);
            const pct = prob ? Math.round(prob.probability * 100) : Math.round(100 / market.outcomes.length);
            const odds = getOdds(o);
            return (
              <div key={o.key} className="flex items-center gap-1.5">
                {/* Color dot */}
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                {/* Label */}
                <span className="text-[11px] text-white/80 truncate flex-1 min-w-0 font-medium">{o.label}</span>
                {/* Odds — golden for high odds (3x+) */}
                <span className={`text-[11px] font-mono shrink-0 tabular-nums font-bold ${odds >= 3 ? "text-[#FFD700]" : "text-white/50"}`}>
                  {odds.toFixed(2)}x
                </span>
                {/* Percentage badge with glow */}
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
              <span className="material-symbols-outlined text-white/20" style={{ fontSize: "12px" }}>check_circle</span>
              <span className="text-[10px] font-bold text-white/20">Encerrado</span>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            {market.pool_total > 0 && (
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-white/25" style={{ fontSize: "11px" }}>bar_chart</span>
                <span className="text-[10px] text-white/30 font-bold font-mono tabular-nums">
                  R$ {market.pool_total >= 1000 ? (market.pool_total / 1000).toFixed(1) + "k" : market.pool_total.toFixed(0)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-white/25" style={{ fontSize: "11px" }}>schedule</span>
              <span className={`text-[10px] font-bold font-mono tabular-nums ${
                remaining > 0 && remaining < 600000 ? "text-[#FFB800]" : remaining > 0 ? "text-white/30" : "text-white/15"
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
