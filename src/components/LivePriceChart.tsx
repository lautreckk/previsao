"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

interface LivePriceChartProps {
  symbol: string;
  category: string;
  openPrice?: number;
  entryPrice?: number;
  height?: number;
}

interface Point {
  time: number;
  price: number;
}

const UP_COLOR = "#10B981";
const DOWN_COLOR = "#FF5252";
const GRID_COLOR = "rgba(255,255,255,0.04)";
const AXIS_COLOR = "rgba(255,255,255,0.2)";
const BG_COLOR = "#111827";
const ENTRY_COLOR = "#FFD700";
const MAX_POINTS = 300;

const formatBRL = (v: number) =>
  v >= 100
    ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `R$ ${v.toFixed(4)}`;

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function LivePriceChart({ symbol, category, openPrice, entryPrice, height = 220 }: LivePriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Price tracking for micro-tick generation
  const realPriceRef = useRef<number>(0);
  const simulatedPriceRef = useRef<number>(0);
  const volatilityRef = useRef<number>(0);
  const trendRef = useRef<number>(0);

  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [firstPrice, setFirstPrice] = useState<number>(0);
  const [initialized, setInitialized] = useState(false);

  // Fetch real price from API
  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}&category=${encodeURIComponent(category)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.price || data.price <= 0) return;

      const price = data.price;
      const prevReal = realPriceRef.current;

      if (!initialized) {
        setFirstPrice(price);
        realPriceRef.current = price;
        simulatedPriceRef.current = price;
        volatilityRef.current = price * 0.00008;
        const now = Date.now();
        const vol = price * 0.00008;
        let p = price;
        for (let i = 0; i < 60; i++) {
          p += (Math.random() - 0.5) * vol * 1.2;
          pointsRef.current.push({ time: now - (60 - i) * 1000, price: p });
        }
        setInitialized(true);
      }

      // Update volatility estimate from real price change
      if (prevReal > 0) {
        const change = Math.abs(price - prevReal);
        volatilityRef.current = volatilityRef.current * 0.7 + change * 0.3;
        const minVol = price * 0.00002;
        const maxVol = price * 0.0004;
        volatilityRef.current = Math.max(minVol, Math.min(maxVol, volatilityRef.current));
      }

      realPriceRef.current = price;
      setCurrentPrice(price);
    } catch { /* ignore */ }
  }, [symbol, category, initialized]);

  // Start API polling (every 5s)
  useEffect(() => {
    fetchPrice();
    pollingRef.current = setInterval(fetchPrice, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchPrice]);

  // Main animation loop: generates micro-ticks + renders at 60fps
  useEffect(() => {
    if (!initialized) return;

    const render = (timestamp: number) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) { rafRef.current = requestAnimationFrame(render); return; }

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const now = Date.now();

      // ---- MICRO-TICK GENERATION (every ~150ms = ~7 ticks/sec) ----
      if (now - lastTickRef.current >= 150) {
        lastTickRef.current = now;
        const vol = volatilityRef.current;
        const real = realPriceRef.current;
        const sim = simulatedPriceRef.current;

        // Mean-reversion toward real price + random walk
        const reversion = (real - sim) * 0.08;
        // Brownian motion with reduced amplitude
        const noise = (Math.random() - 0.5) * vol * 0.6;
        trendRef.current = trendRef.current * 0.5 + noise * 0.5;
        const newSim = sim + reversion + trendRef.current;

        simulatedPriceRef.current = newSim;

        pointsRef.current.push({ time: now, price: newSim });
        if (pointsRef.current.length > MAX_POINTS) {
          pointsRef.current = pointsRef.current.slice(-MAX_POINTS);
        }
      }

      // ---- SMOOTH INTERPOLATION between ticks ----
      const dt = lastFrameRef.current ? (timestamp - lastFrameRef.current) / 1000 : 0.016;
      lastFrameRef.current = timestamp;
      const lerpAmount = Math.min(1, 8 * dt);
      const points = pointsRef.current;
      let displayPoints: Point[];
      if (points.length > 0) {
        const lastPt = points[points.length - 1];
        const interpPrice = lastPt.price + (simulatedPriceRef.current - lastPt.price) * lerpAmount;
        displayPoints = [...points, { time: now, price: interpPrice }];
      } else {
        displayPoints = [...points];
      }

      if (displayPoints.length < 2) { rafRef.current = requestAnimationFrame(render); return; }

      // ---- LAYOUT ----
      const padLeft = 4;
      const padRight = 70;
      const padTop = 4;
      const padBottom = 20;
      const chartW = w - padLeft - padRight;
      const chartH = h - padTop - padBottom;

      // Price range (with padding)
      const prices = displayPoints.map(p => p.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice || maxPrice * 0.001;
      const pMin = minPrice - priceRange * 0.15;
      const pMax = maxPrice + priceRange * 0.15;

      // Time window: 5 minutes scrolling
      const timeWindowMs = 5 * 60 * 1000;
      const tMax = now;
      const tMin = tMax - timeWindowMs;

      const toX = (t: number) => padLeft + ((t - tMin) / (tMax - tMin)) * chartW;
      const toY = (p: number) => padTop + (1 - (p - pMin) / (pMax - pMin)) * chartH;

      // ---- CLEAR ----
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, w, h);

      // ---- GRID ----
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 1;
      const gridSteps = 4;
      for (let i = 0; i <= gridSteps; i++) {
        const y = padTop + (i / gridSteps) * chartH;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + chartW, y);
        ctx.stroke();
      }

      // ---- OPEN PRICE REFERENCE LINE ----
      const refPrice = openPrice || firstPrice;
      if (refPrice && !entryPrice) {
        const refY = toY(refPrice);
        if (refY >= padTop && refY <= padTop + chartH) {
          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padLeft, refY);
          ctx.lineTo(padLeft + chartW, refY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // ---- ENTRY PRICE LINE ----
      if (entryPrice) {
        const entryY = toY(entryPrice);
        if (entryY >= padTop && entryY <= padTop + chartH) {
          ctx.strokeStyle = ENTRY_COLOR;
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(padLeft, entryY);
          ctx.lineTo(padLeft + chartW, entryY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Label on the right
          const entryLabel = `Sua entrada ${formatBRL(entryPrice)}`;
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "left";
          const entryMetrics = ctx.measureText(entryLabel);
          ctx.fillStyle = "rgba(255,215,0,0.15)";
          ctx.fillRect(padLeft + chartW + 2, entryY - 8, entryMetrics.width + 6, 14);
          ctx.fillStyle = ENTRY_COLOR;
          ctx.fillText(entryLabel, padLeft + chartW + 5, entryY + 3);
        }
      }

      // ---- FILTER VISIBLE ----
      const visible = displayPoints.filter(p => p.time >= tMin - 5000);
      if (visible.length < 2) { rafRef.current = requestAnimationFrame(render); return; }

      // ---- COLOR ----
      const colorRef = entryPrice || refPrice || firstPrice;
      const isUp = simulatedPriceRef.current >= colorRef;
      const lineColor = isUp ? UP_COLOR : DOWN_COLOR;

      // ---- FILLED AREA ----
      ctx.beginPath();
      ctx.moveTo(toX(visible[0].time), toY(visible[0].price));
      for (let i = 1; i < visible.length; i++) {
        const prev = visible[i - 1];
        const curr = visible[i];
        const mx = (toX(prev.time) + toX(curr.time)) / 2;
        ctx.bezierCurveTo(mx, toY(prev.price), mx, toY(curr.price), toX(curr.time), toY(curr.price));
      }
      ctx.lineTo(toX(visible[visible.length - 1].time), padTop + chartH);
      ctx.lineTo(toX(visible[0].time), padTop + chartH);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
      grad.addColorStop(0, isUp ? "rgba(16,185,129,0.10)" : "rgba(255,82,82,0.10)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fill();

      // ---- LINE ----
      ctx.beginPath();
      ctx.moveTo(toX(visible[0].time), toY(visible[0].price));
      for (let i = 1; i < visible.length; i++) {
        const prev = visible[i - 1];
        const curr = visible[i];
        const mx = (toX(prev.time) + toX(curr.time)) / 2;
        ctx.bezierCurveTo(mx, toY(prev.price), mx, toY(curr.price), toX(curr.time), toY(curr.price));
      }
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ---- PULSING DOT ----
      const lastVis = visible[visible.length - 1];
      const dotX = toX(lastVis.time);
      const dotY = toY(lastVis.price);
      const pulse = 1 + Math.sin(timestamp / 250) * 0.35;

      ctx.beginPath();
      ctx.arc(dotX, dotY, 4 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dotX, dotY, 10 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = isUp ? "rgba(16,185,129,0.12)" : "rgba(255,82,82,0.12)";
      ctx.fill();

      // ---- Y-AXIS LABELS ----
      ctx.fillStyle = AXIS_COLOR;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      for (let i = 0; i <= gridSteps; i++) {
        const p = pMax - (i / gridSteps) * (pMax - pMin);
        const y = padTop + (i / gridSteps) * chartH;
        ctx.fillText(formatBRL(p), padLeft + chartW + 4, y + 3);
      }

      // ---- X-AXIS LABELS ----
      ctx.textAlign = "center";
      for (let i = 0; i <= 5; i++) {
        const t = tMin + (i / 5) * (tMax - tMin);
        ctx.fillText(formatTime(t), toX(t), h - 2);
      }

      // ---- CURRENT PRICE LABEL ----
      const labelPrice = simulatedPriceRef.current;
      const priceLabel = formatBRL(labelPrice);
      const labelY = Math.max(padTop + 12, Math.min(dotY, padTop + chartH - 4));
      ctx.fillStyle = isUp ? "rgba(16,185,129,0.15)" : "rgba(255,82,82,0.15)";
      const metrics = ctx.measureText(priceLabel);
      ctx.fillRect(padLeft + chartW + 2, labelY - 9, metrics.width + 8, 16);
      ctx.fillStyle = lineColor;
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(priceLabel, padLeft + chartW + 4, labelY + 3);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [initialized, height, openPrice, entryPrice, firstPrice]);

  // Stats for header
  const colorRefPrice = entryPrice || openPrice || firstPrice;
  const priceChange = currentPrice - colorRefPrice;
  const pctChange = colorRefPrice ? (priceChange / colorRefPrice) * 100 : 0;
  const isUp = priceChange >= 0;
  const color = isUp ? UP_COLOR : DOWN_COLOR;

  if (!initialized) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#12101A] p-4" style={{ height: height + 48 }}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin w-6 h-6 border-2 border-white/20 border-t-[#E09520] rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#12101A] overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">
            {entryPrice ? "Sua Entrada" : "Preco Inicial"}
          </span>
          <span className="font-mono text-sm text-white/60 tabular-nums">
            {formatBRL(entryPrice || (openPrice || firstPrice))}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
          isUp ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          {entryPrice ? (
            <span>
              {isUp ? "+" : ""}{formatBRL(Math.abs(priceChange))} ({pctChange >= 0 ? "+" : ""}{pctChange.toFixed(2)}%)
            </span>
          ) : (
            <>
              <span>{isUp ? "Alvo \u25B2" : "Alvo \u25BC"}</span>
              <span>{pctChange >= 0 ? "+" : ""}{pctChange.toFixed(2)}%</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Preco Atual</span>
          <span className="font-mono text-base font-bold tabular-nums" style={{ color }}>{formatBRL(currentPrice)}</span>
        </div>
      </div>
      <div ref={containerRef} className="w-full" style={{ height }}>
        <canvas ref={canvasRef} className="block w-full" style={{ height }} />
      </div>
    </div>
  );
}
