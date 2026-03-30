"use client";

import type { PredictionMarket } from "@/lib/engines/types";
import { CATEGORY_META } from "@/lib/engines/types";
import Link from "next/link";
import { calcImpliedProbabilities } from "@/lib/engines/parimutuel";

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

  return (
    <Link href={isClosed ? "#" : market.stream_url ? `/camera` : `/evento/${market.id}`} className={`block ${isClosed ? "pointer-events-none opacity-50" : ""}`}>
      <div className="bg-[#1a2332] rounded-xl border border-[#2a3444] hover:border-[#3a4454] transition-all h-full flex flex-col">
        {/* Category tag */}
        <div className="px-3 pt-3">
          <span className="text-[10px] font-bold bg-[#222e3d] text-[#8B95A8] px-2.5 py-1 rounded inline-block">{meta?.label || market.category}</span>
        </div>

        {/* Title with avatar image */}
        <div className="px-3 pt-2.5 pb-2 flex items-start gap-2.5">
          {market.banner_url && (
            <img src={market.banner_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 mt-0.5" />
          )}
          <h4 className="text-sm font-bold leading-tight text-white line-clamp-2">{market.title}</h4>
        </div>

        {/* Outcomes */}
        <div className="px-3 pb-2 flex-1 space-y-1.5">
          {market.outcomes.slice(0, 3).map((o) => {
            const prob = probs.find((p) => p.key === o.key);
            const pct = prob ? Math.round(prob.probability * 100) : 0;
            const isGreen = pct >= 50;
            return (
              <div key={o.key} className="flex items-center gap-2 text-xs">
                <span className="text-[#8B95A8] truncate flex-1 max-w-[60px]" title={o.label}>{o.label}</span>
                <span className="text-[#8B95A8] font-mono">{o.payout_per_unit > 0 ? o.payout_per_unit.toFixed(2) + "x" : "—"}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[42px] text-center ${isGreen ? "bg-[#00D4AA]/15 text-[#00D4AA]" : "bg-[#FF6B5A]/15 text-[#FF6B5A]"}`}>{pct}%</span>
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
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[#5A6478] text-xs">schedule</span>
            <span className="text-[10px] text-[#5A6478] font-bold">{timeStr}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
