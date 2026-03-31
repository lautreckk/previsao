"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import LivePriceChart from "@/components/LivePriceChart";
import { LivePriceDisplay } from "@/components/LivePriceDisplay";

/* ─── Types ─── */

type RoundPhase = "betting" | "observation" | "result" | "next_round";

interface LiveRound {
  id: string;
  symbol: string;
  open_price: number | null;
  close_price: number | null;
  betting_ends_at: string;
  ends_at: string;
  created_at: string;
  status: "open" | "observation" | "resolved" | "cancelled";
  winning_outcome: string | null;
  payout_multiplier: number | null;
}

interface HistoryEntry {
  winning_outcome: string | null;
  close_price: number | null;
  open_price: number | null;
}

interface LiveRoundCycleProps {
  marketId: string;
  symbol: string;
  category: string;
  outcomes: { key: string; label: string; color: string; pool: number }[];
  poolTotal: number;
  houseFee: number;
  isOpen: boolean;
  onSelectOutcome: (key: string) => void;
  selectedOutcome: string | null;
  flashKeys: Record<string, "up" | "down">;
}

/* ─── Helpers ─── */

function formatTimer(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ─── History Dots ─── */

function HistoryDots({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-white/30 font-semibold mr-1">Ultimos:</span>
      {history.map((h, i) => {
        const isUp = h.winning_outcome === "up" || h.winning_outcome === "sobe";
        return (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              isUp ? "bg-[#00D4AA]" : "bg-[#FF5252]"
            }`}
            title={isUp ? "Subiu" : "Desceu"}
          />
        );
      })}
    </div>
  );
}

/* ─── Phase Badge ─── */

function PhaseBadge({ phase, timeLeft }: { phase: RoundPhase; timeLeft: string }) {
  if (phase === "betting") {
    return (
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4AA] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D4AA]" />
          </span>
          AO VIVO
        </div>
        <span className="font-mono text-sm font-bold text-white tabular-nums">{timeLeft}</span>
      </div>
    );
  }

  if (phase === "observation") {
    return (
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FFB800]/10 text-[#FFB800] border border-[#FFB800]/30">
          <span className="material-symbols-outlined text-xs">hourglass_top</span>
          OBSERVACAO
        </div>
        <span className="font-mono text-sm font-bold text-white tabular-nums">{timeLeft}</span>
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/30">
        <span className="material-symbols-outlined text-xs">emoji_events</span>
        RESULTADO
      </div>
    );
  }

  // next_round
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/5 text-white/60 border border-white/10">
      <div className="animate-spin w-3 h-3 border-2 border-white/20 border-t-[#00D4AA] rounded-full" />
      PROXIMA RODADA
    </div>
  );
}

/* ─── Result Overlay ─── */

function ResultOverlay({
  winnerLabel,
  winnerColor,
  payout,
  openPrice,
  closePrice,
}: {
  winnerLabel: string;
  winnerColor: string;
  payout: number;
  openPrice: number;
  closePrice: number;
}) {
  const diff = closePrice - openPrice;
  const pct = openPrice > 0 ? (diff / openPrice) * 100 : 0;
  const sign = pct >= 0 ? "+" : "";

  return (
    <div className="rounded-2xl border-2 p-6 text-center animate-in fade-in zoom-in duration-300"
      style={{ borderColor: winnerColor, backgroundColor: winnerColor + "10" }}>
      <span className="material-symbols-outlined text-4xl mb-2 block" style={{ color: winnerColor }}>
        emoji_events
      </span>
      <h3 className="text-xl font-black uppercase mb-1" style={{ color: winnerColor }}>
        {winnerLabel} Venceu!
      </h3>
      <p className="text-lg font-bold text-white mb-2">
        Payout: {payout.toFixed(2)}x
      </p>
      <p className="text-sm text-white/60 font-mono tabular-nums">
        {formatBRL(openPrice)} &rarr; {formatBRL(closePrice)} ({sign}{pct.toFixed(2)}%)
      </p>
    </div>
  );
}

/* ─── Next Round Progress ─── */

function NextRoundProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 5000; // 5 seconds
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
    }, 50);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111827] p-6 text-center">
      <p className="text-sm font-bold text-white/60 mb-3">Proxima previsao...</p>
      <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#00D4AA] to-[#00FFB8] rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[10px] text-white/30 mt-2 font-mono tabular-nums">
        {Math.round(progress)}%
      </p>
    </div>
  );
}

/* ─── Odds Buttons ─── */

function OddsButtons({
  outcomes,
  poolTotal,
  houseFee,
  canBet,
  onSelect,
  selectedOutcome,
  flashKeys,
}: {
  outcomes: LiveRoundCycleProps["outcomes"];
  poolTotal: number;
  houseFee: number;
  canBet: boolean;
  onSelect: (key: string) => void;
  selectedOutcome: string | null;
  flashKeys: Record<string, "up" | "down">;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {outcomes.map((o) => {
        const pct = poolTotal > 0 ? (o.pool / poolTotal) * 100 : 50;
        const payout =
          poolTotal > 0 && o.pool > 0
            ? (poolTotal * (1 - houseFee)) / o.pool
            : 0;
        const isSelected = selectedOutcome === o.key;
        const isUp = o.key === "up" || o.key === "sobe";

        const baseColor = isUp ? "#00D4AA" : "#FF5252";
        const flash = flashKeys[o.key];

        return (
          <button
            key={o.key}
            onClick={() => canBet && onSelect(o.key)}
            disabled={!canBet}
            className={`relative overflow-hidden rounded-xl border p-4 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
              isSelected
                ? "border-white/30 ring-1 ring-white/20"
                : "border-white/[0.06] hover:border-white/10"
            } ${flash === "up" ? "ring-2 ring-[#00D4AA]/50" : ""} ${
              flash === "down" ? "ring-2 ring-[#FF5252]/50" : ""
            }`}
            style={{ backgroundColor: baseColor + "08" }}
          >
            {/* Background fill showing pool % */}
            <div
              className="absolute inset-0 opacity-10 transition-all duration-500"
              style={{
                width: `${Math.max(pct, 5)}%`,
                backgroundColor: baseColor,
              }}
            />

            <div className="relative z-10">
              <span
                className="block text-lg font-black mb-0.5"
                style={{ color: baseColor }}
              >
                {o.label}
              </span>
              <span
                className="block text-xl font-black font-mono tabular-nums mb-1"
                style={{ color: baseColor }}
              >
                {payout > 0 ? payout.toFixed(2) + "x" : "--"}
              </span>
              {/* Pool bar */}
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(pct, 5)}%`,
                    backgroundColor: baseColor,
                  }}
                />
              </div>
              <span className="block text-[10px] text-white/40 mt-1 font-mono tabular-nums">
                {pct.toFixed(0)}%
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT: LiveRoundCycle
   ═══════════════════════════════════════════════════ */

export default function LiveRoundCycle({
  marketId,
  symbol,
  category,
  outcomes,
  poolTotal,
  houseFee,
  isOpen,
  onSelectOutcome,
  selectedOutcome,
  flashKeys,
}: LiveRoundCycleProps) {
  const [round, setRound] = useState<LiveRound | null>(null);
  const [phase, setPhase] = useState<RoundPhase>("betting");
  const [timeLeft, setTimeLeft] = useState("05:00");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [resultData, setResultData] = useState<{
    winnerLabel: string;
    winnerColor: string;
    payout: number;
    openPrice: number;
    closePrice: number;
  } | null>(null);

  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextRoundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Fetch current round ─── */
  const fetchCurrentRound = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("live_rounds")
        .select("*")
        .eq("symbol", symbol)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setRound(data as LiveRound);
      }
    } catch {
      // No round found — stay in current state
    }
  }, [symbol]);

  /* ─── Fetch history ─── */
  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("live_rounds")
        .select("winning_outcome, close_price, open_price")
        .eq("symbol", symbol)
        .eq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) {
        setHistory(data as HistoryEntry[]);
      }
    } catch {
      // ignore
    }
  }, [symbol]);

  /* ─── Initial fetch ─── */
  useEffect(() => {
    fetchCurrentRound();
    fetchHistory();
  }, [fetchCurrentRound, fetchHistory]);

  /* ─── Calculate phase from round data ─── */
  const calculatePhase = useCallback((): {
    phase: RoundPhase;
    remaining: number;
  } => {
    if (!round) return { phase: "betting", remaining: 0 };

    const now = Date.now();
    const bettingEnd = new Date(round.betting_ends_at).getTime();
    const roundEnd = new Date(round.ends_at).getTime();

    if (round.status === "resolved") {
      return { phase: "result", remaining: 0 };
    }

    if (now < bettingEnd) {
      return { phase: "betting", remaining: bettingEnd - now };
    }

    if (now < roundEnd) {
      return { phase: "observation", remaining: roundEnd - now };
    }

    // Past end time but not resolved yet — still show observation with 00:00
    return { phase: "observation", remaining: 0 };
  }, [round]);

  /* ─── Timer that updates every second ─── */
  useEffect(() => {
    if (!round) return;

    function tick() {
      const { phase: newPhase, remaining } = calculatePhase();
      setPhase(newPhase);
      setTimeLeft(formatTimer(remaining));
    }

    tick(); // immediate
    phaseTimerRef.current = setInterval(tick, 1000);

    return () => {
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    };
  }, [round, calculatePhase]);

  /* ─── Handle result phase → next_round transition ─── */
  useEffect(() => {
    if (phase === "result" && round?.status === "resolved") {
      // Build result data
      const winKey = round.winning_outcome;
      const winOutcome = outcomes.find(
        (o) => o.key === winKey || o.label.toLowerCase() === winKey
      );

      setResultData({
        winnerLabel: winOutcome?.label || winKey || "?",
        winnerColor: winOutcome?.color || "#00D4AA",
        payout: round.payout_multiplier || 0,
        openPrice: round.open_price || 0,
        closePrice: round.close_price || 0,
      });

      // After 3 seconds, switch to next_round
      resultTimerRef.current = setTimeout(() => {
        setPhase("next_round");
        setResultData(null);

        // After 5 more seconds, fetch the new round
        nextRoundTimerRef.current = setTimeout(() => {
          fetchCurrentRound();
          fetchHistory();
        }, 5000);
      }, 3000);
    }

    return () => {
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      if (nextRoundTimerRef.current) clearTimeout(nextRoundTimerRef.current);
    };
  }, [phase, round, outcomes, fetchCurrentRound, fetchHistory]);

  /* ─── Supabase Realtime subscription ─── */
  useEffect(() => {
    const channel = supabase
      .channel(`live-round-${marketId}`)
      .on(
        "broadcast",
        { event: "market.resolved" },
        (payload: {
          payload?: {
            winning_outcome?: string;
            payout_multiplier?: number;
            open_price?: number;
            close_price?: number;
          };
        }) => {
          const p = payload.payload;
          if (!p) return;

          // Update the round state
          setRound((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: "resolved" as const,
              winning_outcome: p.winning_outcome || null,
              payout_multiplier: p.payout_multiplier || null,
              open_price: p.open_price ?? prev.open_price,
              close_price: p.close_price ?? prev.close_price,
            };
          });
        }
      )
      .on(
        "broadcast",
        { event: "round.new" },
        () => {
          // New round started — fetch it
          fetchCurrentRound();
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId, fetchCurrentRound, fetchHistory]);

  /* ─── Derived state ─── */
  const canBet = phase === "betting" && isOpen;
  const roundLabel = `${symbol} (5min)`;

  /* ─── Render ─── */
  return (
    <div className="space-y-4">
      {/* ─── Phase Header ─── */}
      <div className="flex items-center justify-between px-5 pt-3">
        <PhaseBadge phase={phase} timeLeft={timeLeft} />
        <span className="text-xs text-white/40 font-semibold">{roundLabel}</span>
      </div>

      {/* ─── History Dots ─── */}
      {history.length > 0 && (
        <div className="px-5">
          <HistoryDots history={history} />
        </div>
      )}

      {/* ─── Observation Notice ─── */}
      {phase === "observation" && (
        <div className="mx-5 rounded-xl border border-[#FFB800]/20 bg-[#FFB800]/5 px-4 py-2.5 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#FFB800] text-sm">
            lock
          </span>
          <span className="text-xs text-[#FFB800] font-semibold">
            Previsoes encerradas &mdash; aguarde o resultado
          </span>
        </div>
      )}

      {/* ─── Result Overlay ─── */}
      {phase === "result" && resultData && (
        <div className="px-5">
          <ResultOverlay {...resultData} />
        </div>
      )}

      {/* ─── Next Round Progress ─── */}
      {phase === "next_round" && (
        <div className="px-5">
          <NextRoundProgress />
        </div>
      )}

      {/* ─── Price Display + Chart (always visible except next_round) ─── */}
      {phase !== "next_round" && (
        <div className="px-5 space-y-3">
          <LivePriceDisplay symbol={symbol} category={category} />
          <LivePriceChart
            symbol={symbol}
            category={category}
            openPrice={round?.open_price ?? undefined}
          />
        </div>
      )}

      {/* ─── Odds Buttons (betting + observation) ─── */}
      {(phase === "betting" || phase === "observation") && (
        <div className="px-5">
          <OddsButtons
            outcomes={outcomes}
            poolTotal={poolTotal}
            houseFee={houseFee}
            canBet={canBet}
            onSelect={onSelectOutcome}
            selectedOutcome={selectedOutcome}
            flashKeys={flashKeys}
          />
        </div>
      )}
    </div>
  );
}
