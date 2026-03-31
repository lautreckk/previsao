"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface LivePriceDisplayProps {
  symbol: string;
  category: string;
  apiKey?: string;
}

interface PriceData {
  price: number;
  change_24h: number;
  change_pct_24h: number;
  currency: string;
}

type FlashDirection = "up" | "down" | null;

export function LivePriceDisplay({
  symbol,
  category,
  apiKey,
}: LivePriceDisplayProps) {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [flash, setFlash] = useState<FlashDirection>(null);
  const [error, setError] = useState<string | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPrice = useCallback(async () => {
    try {
      const endpoint =
        category === "crypto"
          ? `/api/v1/prices/crypto?symbols=${symbol}&currency=BRL`
          : category === "economy"
            ? `/api/v1/prices/forex?symbols=${symbol}&currency=BRL`
            : `/api/v1/prices/stocks?symbols=${symbol}&currency=BRL`;

      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["x-api-key"] = apiKey;
      }

      const res = await fetch(endpoint, { headers });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      // Extract price from response — handle common API shapes
      const entry = data?.data?.[symbol] ?? data?.[symbol] ?? data;
      if (!entry?.price && entry?.price !== 0) return;

      const newPrice = Number(entry.price);
      const prev = prevPriceRef.current;

      if (prev !== null && newPrice !== prev) {
        const direction: FlashDirection = newPrice > prev ? "up" : "down";
        setFlash(direction);

        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setFlash(null), 1200);
      }

      prevPriceRef.current = newPrice;
      setPriceData({
        price: newPrice,
        change_24h: Number(entry.change_24h ?? 0),
        change_pct_24h: Number(entry.change_pct_24h ?? 0),
        currency: "BRL",
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar preco");
    }
  }, [symbol, category, apiKey]);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, 15000);
    return () => {
      clearInterval(interval);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, [fetchPrice]);

  const formatBRL = (value: number): string => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatPct = (value: number): string => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  if (error && !priceData) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3">
        <span className="text-sm text-red-400">{error}</span>
      </div>
    );
  }

  if (!priceData) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-24 animate-pulse rounded bg-white/[0.08]" />
          <div className="h-4 w-16 animate-pulse rounded bg-white/[0.08]" />
        </div>
      </div>
    );
  }

  const isPositive = priceData.change_pct_24h >= 0;

  const flashBg =
    flash === "up"
      ? "bg-emerald-500/20"
      : flash === "down"
        ? "bg-red-500/20"
        : "bg-white/[0.04]";

  return (
    <div
      className={`rounded-xl border border-white/[0.06] px-4 py-3 transition-colors duration-300 ${flashBg}`}
    >
      <div className="flex items-center gap-3">
        {/* Symbol */}
        <span className="text-xs font-medium tracking-wider text-white/40 uppercase">
          {symbol}
        </span>

        {/* Price */}
        <span className="font-mono text-base font-semibold text-white tabular-nums">
          {formatBRL(priceData.price)}
        </span>

        {/* 24h Change */}
        <span
          className={`flex items-center gap-1 font-mono text-xs font-medium tabular-nums ${
            isPositive ? "text-emerald-400" : "text-red-400"
          }`}
        >
          <span className="text-[10px] leading-none">
            {isPositive ? "\u25B2" : "\u25BC"}
          </span>
          {formatPct(priceData.change_pct_24h)}
          <span className="text-white/30">(24h)</span>
        </span>
      </div>
    </div>
  );
}
