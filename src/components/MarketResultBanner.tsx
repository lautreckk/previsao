"use client";

import { useState, useEffect, useMemo } from "react";
import type { PredictionMarket } from "@/lib/engines/types";

interface UserBet {
  outcome_key: string;
  amount: number;
  final_payout: number;
  status: string;
}

interface MarketResultBannerProps {
  market: PredictionMarket;
  userBet?: UserBet;
}

export function MarketResultBanner({
  market,
  userBet,
}: MarketResultBannerProps) {
  const [visible, setVisible] = useState(false);
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; color: string; delay: number }[]
  >([]);

  const isResolved = market.status === "resolved";
  const winningKey = market.winning_outcome_key;

  const winningOutcome = useMemo(() => {
    if (!winningKey) return null;
    return market.outcomes.find((o) => o.key === winningKey) ?? null;
  }, [market.outcomes, winningKey]);

  const userWon = userBet
    ? userBet.outcome_key === winningKey && userBet.status === "won"
    : null;

  const userProfit = userBet
    ? userWon
      ? userBet.final_payout - userBet.amount
      : -userBet.amount
    : 0;

  const payoutMultiplier = winningOutcome
    ? winningOutcome.payout_per_unit
    : null;

  // Animate in
  useEffect(() => {
    if (!isResolved) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, [isResolved]);

  // Generate confetti particles
  useEffect(() => {
    if (!isResolved || !userWon) return;

    const confettiColors = [
      "#80FF00",
      "#80FF00",
      "#5B9DFF",
      "#E040FB",
      "#FF6B5A",
      "#A0FF40",
    ];
    const generated = Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: confettiColors[i % confettiColors.length],
      delay: Math.random() * 0.8,
    }));
    setParticles(generated);
  }, [isResolved, userWon]);

  if (!isResolved || !winningOutcome) return null;

  const formatBRL = (value: number): string => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });
  };

  const bgClass =
    userBet === undefined
      ? "from-blue-600/30 to-blue-800/20 border-blue-500/30"
      : userWon
        ? "from-emerald-600/30 to-emerald-800/20 border-emerald-500/30"
        : "from-red-600/30 to-red-800/20 border-red-500/30";

  const iconColor =
    userBet === undefined
      ? "text-blue-400"
      : userWon
        ? "text-emerald-400"
        : "text-red-400";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-r transition-all duration-500 ${bgClass} ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
      }`}
    >
      {/* Confetti particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="pointer-events-none absolute h-1.5 w-1.5 animate-bounce rounded-full opacity-80"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: "1.5s",
          }}
        />
      ))}

      <div className="relative z-10 px-5 py-4">
        {/* Main result line */}
        <div className="flex items-center gap-3">
          <span className={`text-xl ${iconColor}`}>
            {userBet === undefined ? "\u2714" : userWon ? "\uD83C\uDFC6" : "\u2716"}
          </span>
          <div>
            <p className="text-sm font-semibold text-white">
              Resultado:{" "}
              <span
                className="font-bold"
                style={{ color: winningOutcome.color || "#80FF00" }}
              >
                {winningOutcome.label}
              </span>{" "}
              venceu!
              {payoutMultiplier !== null && payoutMultiplier > 0 && (
                <span className="ml-2 text-white/50">
                  Payout: {payoutMultiplier.toFixed(2)}x
                </span>
              )}
            </p>
          </div>
        </div>

        {/* User bet result */}
        {userBet && (
          <div className="mt-2 pl-9">
            {userWon ? (
              <p className="text-sm font-medium text-emerald-300">
                Voce ganhou {formatBRL(userProfit)}!
              </p>
            ) : (
              <p className="text-sm font-medium text-red-300">
                Voce perdeu {formatBRL(Math.abs(userProfit))}
              </p>
            )}
            <p className="mt-0.5 text-xs text-white/30">
              Aposta: {formatBRL(userBet.amount)} em{" "}
              {market.outcomes.find((o) => o.key === userBet.outcome_key)
                ?.label ?? userBet.outcome_key}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
