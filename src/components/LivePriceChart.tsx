"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from "recharts";

type DataPoint = { time: string; price: number; isNew: boolean };

interface LivePriceChartProps {
  symbol: string;
  category: string;
  openPrice?: number;
  height?: number;
}

const upColor = "#00FFB8";
const downColor = "#FF5252";
const gridColor = "rgba(255,255,255,0.04)";

const formatBRL = (v: number) =>
  v >= 1000
    ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `R$ ${v.toFixed(4)}`;

const formatTime = (t: string) => {
  const d = new Date(t);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const makeInitialData = (base: number, n = 20): DataPoint[] =>
  Array.from({ length: n }, (_, i) => ({
    time: new Date(Date.now() - (n - 1 - i) * 5000).toISOString(),
    price: base + (Math.random() - 0.5) * base * 0.002,
    isNew: false,
  }));

function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#111827]/90 px-3 py-2 text-xs text-white shadow-xl backdrop-blur">
      <div className="font-medium text-white/60">{formatTime(label || "")}</div>
      <div className="font-mono font-bold">{formatBRL(payload[0]?.value || 0)}</div>
    </div>
  );
}

export default function LivePriceChart({ symbol, category, openPrice, height = 240 }: LivePriceChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [initialized, setInitialized] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pushPoint = useCallback((price: number) => {
    setData((curr) => {
      const updated = curr.map((p) => ({ ...p, isNew: false }));
      return [...updated.slice(Math.max(0, updated.length - 59)), { time: new Date().toISOString(), price, isNew: true }];
    });
  }, []);

  // Initialize + start polling
  useEffect(() => {
    let cancelled = false;

    async function fetchPrice() {
      try {
        const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}&category=${encodeURIComponent(category)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.price) {
            if (!initialized && !cancelled) {
              setData(makeInitialData(json.price));
              setInitialized(true);
            }
            pushPoint(json.price);
          }
        }
      } catch { /* ignore */ }
    }

    fetchPrice();
    pollingRef.current = setInterval(fetchPrice, 5000);

    return () => {
      cancelled = true;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [symbol, category, initialized, pushPoint]);

  const latestPrice = data[data.length - 1]?.price || 0;
  const firstPrice = openPrice || data[0]?.price || latestPrice;
  const priceChange = latestPrice - firstPrice;
  const pctChange = firstPrice ? (priceChange / firstPrice) * 100 : 0;
  const isUp = priceChange >= 0;
  const color = isUp ? upColor : downColor;

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#111827] p-4" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-[#00D4AA] rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111827] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Preco Inicial</span>
          <span className="font-mono text-sm text-white/60 tabular-nums">{formatBRL(firstPrice)}</span>
        </div>

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
          isUp ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          <span>{isUp ? "Alvo ▲" : "Alvo ▼"}</span>
          <span>{pctChange >= 0 ? "+" : ""}{pctChange.toFixed(2)}%</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Preco Atual</span>
          <span className="font-mono text-base font-bold tabular-nums" style={{ color }}>{formatBRL(latestPrice)}</span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }} className="px-2 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.15} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatBRL(v)}
              width={90}
            />
            <ReTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={color}
              fill={`url(#grad-${symbol})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: color, stroke: "#111827", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
