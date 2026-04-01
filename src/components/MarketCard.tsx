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
    supabase
      .from("camera_rounds")
      .select("final_count, threshold")
      .eq("market_id", marketId)
      .not("resolved_at", "is", null)
      .order("round_number", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (cancelled || !data || data.length === 0) return;
        setResults(data.reverse().map((r) => (r.final_count || 0) > (r.threshold || 0)));
      });
    return () => { cancelled = true; };
  }, [marketId]);

  if (!results) return null;

  return (
    <div className="px-3 pb-1.5 flex items-center gap-1.5">
      <span className="text-[9px] text-[#5A6478] font-bold">Ultimos</span>
      <span className="text-[9px] text-[#5A6478]">|</span>
      {results.map((isOver, i) => (
        <div
          key={i}
          className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-black text-white ${
            isOver ? "bg-[#00D4AA]" : "bg-[#FF5252]"
          }`}
        >
          {isOver ? "\u25B2" : "\u25BC"}
        </div>
      ))}
    </div>
  );
}

/* Floating bet animation for live markets — contained to footer area */
function FloatingBets({ active }: { active: boolean }) {
  const [bets, setBets] = useState<{ id: number; value: string; side: "left" | "right" }[]>([]);

  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      if (Math.random() > 0.5) return;
      const values = ["0,50", "1,00", "2,00", "5,00", "10,00", "20,00", "50,00"];
      const val = values[Math.floor(Math.random() * values.length)];
      const side = Math.random() > 0.5 ? "left" : "right";
      const id = Date.now() + Math.random();
      setBets((prev) => [...prev.slice(-2), { id, value: val, side }]);
      setTimeout(() => setBets((prev) => prev.filter((b) => b.id !== id)), 2000);
    }, 4000 + Math.random() * 5000);
    return () => clearInterval(iv);
  }, [active]);

  if (!active || bets.length === 0) return null;

  return (
    <div className="absolute bottom-8 left-0 right-0 h-12 pointer-events-none overflow-hidden z-10">
      {bets.map((b) => (
        <span
          key={b.id}
          className={`absolute text-[9px] font-black text-[#00FFB8]/70 animate-float-up ${
            b.side === "left" ? "left-3" : "right-3"
          }`}
          style={{ bottom: "0" }}
        >
          R$ {b.value}
        </span>
      ))}
    </div>
  );
}

export default function MarketCard({ market }: { market: PredictionMarket }) {
  const meta = CATEGORY_META[market.category];
  const isClosed = ["resolved", "cancelled"].includes(market.status);
  const isLive = market.status === "open" && market.close_at > Date.now();
  const now = Date.now();
  const timeLeft = market.close_at - now;

  let timeStr = "";
  if (timeLeft <= 0) timeStr = "Encerrado";
  else if (timeLeft < 3600000) { const m = Math.floor(timeLeft / 60000); const s = Math.floor((timeLeft % 60000) / 1000); timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; }
  else if (timeLeft < 86400000) { const h = Math.floor(timeLeft / 3600000); const m = Math.floor((timeLeft % 3600000) / 60000); timeStr = `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`; }
  else if (timeLeft < 604800000) timeStr = `${Math.floor(timeLeft / 86400000)}d`;
  else timeStr = `${Math.floor(timeLeft / 604800000)} sem.`;

  const probs = calcImpliedProbabilities(market.outcomes);
  const isCamera = !!market.stream_url || market.id.startsWith("cam_");

  return (
    <Link href={isClosed ? "#" : isCamera ? `/camera/${market.id}` : `/evento/${market.id}`} className={`block ${isClosed ? "pointer-events-none opacity-50" : ""}`}>
      <div className="relative bg-[#1a2332] rounded-xl border border-[#2a3444] hover:border-[#3a4454] transition-all h-full flex flex-col">
        {/* Floating bet animations for live markets */}
        <FloatingBets active={isLive && isCamera} />

        {/* Category tag */}
        <div className="px-3 pt-3">
          <span className="text-[10px] font-bold bg-[#222e3d] text-[#8B95A8] px-2.5 py-1 rounded inline-flex items-center gap-1">
            {meta?.icon && <span className="material-symbols-outlined" style={{ fontSize: "12px", color: meta.color }}>{meta.icon}</span>}
            {meta?.label || market.category}
          </span>
        </div>

        {/* Title with avatar image */}
        <div className="px-3 pt-2.5 pb-2 flex items-start gap-2.5">
          {market.banner_url && (
            <img src={market.banner_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 mt-0.5" />
          )}
          <h4 className="text-sm font-bold leading-tight text-white line-clamp-2">{market.title}</h4>
        </div>

        {/* Mini round history for live camera markets */}
        {isCamera && <RoundHistoryDots marketId={market.id} />}

        {/* Outcomes */}
        <div className="px-3 pb-2 flex-1 space-y-1.5">
          {market.outcomes.slice(0, 3).map((o) => {
            const prob = probs.find((p) => p.key === o.key);
            const pct = prob ? Math.round(prob.probability * 100) : 0;
            const isGreen = pct >= 50;
            return (
              <div key={o.key} className="flex items-center gap-2 text-xs">
                <span className="text-[#8B95A8] truncate flex-1 min-w-0" title={o.label}>{o.label}</span>
                <span className="text-[#8B95A8] font-mono shrink-0">{(o.payout_per_unit > 0 ? o.payout_per_unit : (market.outcomes.length * 0.95)).toFixed(2) + "x"}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[42px] text-center shrink-0 ${isGreen ? "bg-[#00D4AA]/15 text-[#00D4AA]" : "bg-[#FF6B5A]/15 text-[#FF6B5A]"}`}>{pct}%</span>
              </div>
            );
          })}
          {market.outcomes.length > 3 && (
            <p className="text-[10px] text-[#5A6478]">+{market.outcomes.length - 3} opcoes</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 pb-3 pt-1 flex items-center justify-between border-t border-[#2a3444]">
          {isLive && timeLeft > 0 ? (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
              <span className="text-[10px] font-bold text-[#00D4AA]">AO VIVO</span>
            </div>
          ) : timeLeft <= 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#8B95A8] text-xs">check_circle</span>
              <span className="text-[10px] font-bold text-[#8B95A8]">Encerrado</span>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            {market.pool_total > 0 && (
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[#5A6478]" style={{ fontSize: "11px" }}>bar_chart</span>
                <span className="text-[10px] text-[#5A6478] font-bold">R$ {market.pool_total >= 1000 ? (market.pool_total / 1000).toFixed(1) + "k" : market.pool_total.toFixed(0)}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[#5A6478] text-xs">schedule</span>
              <span className="text-[10px] text-[#5A6478] font-bold">{timeStr}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
