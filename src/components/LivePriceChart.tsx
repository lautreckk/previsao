"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

interface LivePriceChartProps {
  symbol: string;
  category: string;
  openPrice?: number;
  height?: number;
}

interface Point {
  time: number; // timestamp ms
  price: number;
}

const UP_COLOR = "#00FFB8";
const DOWN_COLOR = "#FF5252";
const GRID_COLOR = "rgba(255,255,255,0.04)";
const AXIS_COLOR = "rgba(255,255,255,0.2)";
const BG_COLOR = "#111827";

const MAX_POINTS = 120; // 10 minutes of data at 5s intervals
const SCROLL_SPEED = 40; // pixels per second the chart scrolls

const formatBRL = (v: number) =>
  v >= 100
    ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `R$ ${v.toFixed(4)}`;

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function LivePriceChart({ symbol, category, openPrice, height = 220 }: LivePriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const animTargetRef = useRef<number>(0); // target price for smooth interpolation
  const animCurrentRef = useRef<number>(0); // current animated price
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [firstPrice, setFirstPrice] = useState<number>(0);
  const [initialized, setInitialized] = useState(false);

  // Fetch price from API
  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}&category=${encodeURIComponent(category)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.price || data.price <= 0) return;

      const now = Date.now();
      const price = data.price;

      // Set first price on init
      if (!initialized) {
        setFirstPrice(price);
        animCurrentRef.current = price;
        animTargetRef.current = price;
        // Seed initial points
        for (let i = 0; i < 20; i++) {
          pointsRef.current.push({
            time: now - (20 - i) * 5000,
            price: price + (Math.random() - 0.5) * price * 0.0005,
          });
        }
        setInitialized(true);
      }

      // Push real point
      pointsRef.current.push({ time: now, price });
      if (pointsRef.current.length > MAX_POINTS) {
        pointsRef.current = pointsRef.current.slice(-MAX_POINTS);
      }

      animTargetRef.current = price;
      setCurrentPrice(price);
    } catch { /* ignore */ }
  }, [symbol, category, initialized]);

  // Start polling
  useEffect(() => {
    fetchPrice();
    pollingRef.current = setInterval(fetchPrice, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchPrice]);

  // Canvas animation loop (60fps)
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

      // Delta time for smooth animation
      const dt = lastFrameRef.current ? (timestamp - lastFrameRef.current) / 1000 : 0.016;
      lastFrameRef.current = timestamp;

      // Smooth interpolation toward target price (lerp)
      const lerpSpeed = 4; // higher = snappier
      animCurrentRef.current += (animTargetRef.current - animCurrentRef.current) * Math.min(1, lerpSpeed * dt);

      // Add interpolated point for smooth line
      const now = Date.now();
      const points = pointsRef.current;
      const lastPoint = points[points.length - 1];
      const displayPoints = [...points];

      // Add a virtual "now" point with interpolated price
      if (lastPoint && now - lastPoint.time > 500) {
        displayPoints.push({ time: now, price: animCurrentRef.current });
      }

      if (displayPoints.length < 2) { rafRef.current = requestAnimationFrame(render); return; }

      // Layout
      const padLeft = 12;
      const padRight = 80;
      const padTop = 10;
      const padBottom = 24;
      const chartW = w - padLeft - padRight;
      const chartH = h - padTop - padBottom;

      // Price range
      const prices = displayPoints.map(p => p.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice || maxPrice * 0.001;
      const pMin = minPrice - priceRange * 0.1;
      const pMax = maxPrice + priceRange * 0.1;

      // Time range: show last ~5 minutes, scrolling
      const timeWindowMs = 5 * 60 * 1000;
      const tMax = now;
      const tMin = tMax - timeWindowMs;

      const toX = (t: number) => padLeft + ((t - tMin) / (tMax - tMin)) * chartW;
      const toY = (p: number) => padTop + (1 - (p - pMin) / (pMax - pMin)) * chartH;

      // Clear
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, w, h);

      // Grid lines (horizontal)
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

      // Open price dashed line
      if (openPrice || firstPrice) {
        const refPrice = openPrice || firstPrice;
        const refY = toY(refPrice);
        if (refY >= padTop && refY <= padTop + chartH) {
          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(padLeft, refY);
          ctx.lineTo(padLeft + chartW, refY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Filter visible points
      const visible = displayPoints.filter(p => p.time >= tMin - 10000);
      if (visible.length < 2) { rafRef.current = requestAnimationFrame(render); return; }

      // Determine color
      const isUp = animCurrentRef.current >= (openPrice || firstPrice);
      const lineColor = isUp ? UP_COLOR : DOWN_COLOR;

      // Draw filled area
      ctx.beginPath();
      ctx.moveTo(toX(visible[0].time), toY(visible[0].price));
      for (let i = 1; i < visible.length; i++) {
        const prev = visible[i - 1];
        const curr = visible[i];
        // Smooth curve using bezier
        const mx = (toX(prev.time) + toX(curr.time)) / 2;
        ctx.bezierCurveTo(mx, toY(prev.price), mx, toY(curr.price), toX(curr.time), toY(curr.price));
      }
      // Close area to bottom
      ctx.lineTo(toX(visible[visible.length - 1].time), padTop + chartH);
      ctx.lineTo(toX(visible[0].time), padTop + chartH);
      ctx.closePath();

      // Gradient fill
      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
      grad.addColorStop(0, isUp ? "rgba(0,255,184,0.12)" : "rgba(255,82,82,0.12)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fill();

      // Draw line
      ctx.beginPath();
      ctx.moveTo(toX(visible[0].time), toY(visible[0].price));
      for (let i = 1; i < visible.length; i++) {
        const prev = visible[i - 1];
        const curr = visible[i];
        const mx = (toX(prev.time) + toX(curr.time)) / 2;
        ctx.bezierCurveTo(mx, toY(prev.price), mx, toY(curr.price), toX(curr.time), toY(curr.price));
      }
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Pulsing dot at current price
      const lastVis = visible[visible.length - 1];
      const dotX = toX(lastVis.time);
      const dotY = toY(lastVis.price);
      const pulse = 1 + Math.sin(timestamp / 300) * 0.3;

      ctx.beginPath();
      ctx.arc(dotX, dotY, 4 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dotX, dotY, 8 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = isUp ? "rgba(0,255,184,0.15)" : "rgba(255,82,82,0.15)";
      ctx.fill();

      // Y-axis labels (right side)
      ctx.fillStyle = AXIS_COLOR;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      for (let i = 0; i <= gridSteps; i++) {
        const p = pMax - (i / gridSteps) * (pMax - pMin);
        const y = padTop + (i / gridSteps) * chartH;
        ctx.fillText(formatBRL(p), padLeft + chartW + 6, y + 3);
      }

      // X-axis labels (bottom)
      ctx.textAlign = "center";
      const timeSteps = 5;
      for (let i = 0; i <= timeSteps; i++) {
        const t = tMin + (i / timeSteps) * (tMax - tMin);
        const x = toX(t);
        ctx.fillText(formatTime(t), x, h - 4);
      }

      // Current price label on right edge
      ctx.fillStyle = lineColor;
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      const priceLabel = formatBRL(animCurrentRef.current);
      const labelY = Math.max(padTop + 12, Math.min(dotY, padTop + chartH - 4));
      // Background pill
      ctx.fillStyle = isUp ? "rgba(0,255,184,0.15)" : "rgba(255,82,82,0.15)";
      const metrics = ctx.measureText(priceLabel);
      ctx.fillRect(padLeft + chartW + 2, labelY - 9, metrics.width + 8, 16);
      ctx.fillStyle = lineColor;
      ctx.fillText(priceLabel, padLeft + chartW + 6, labelY + 3);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [initialized, height, openPrice, firstPrice]);

  // Stats
  const ref = openPrice || firstPrice;
  const priceChange = currentPrice - ref;
  const pctChange = ref ? (priceChange / ref) * 100 : 0;
  const isUp = priceChange >= 0;
  const color = isUp ? UP_COLOR : DOWN_COLOR;

  if (!initialized) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#111827] p-4" style={{ height: height + 48 }}>
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
          <span className="font-mono text-sm text-white/60 tabular-nums">{formatBRL(ref)}</span>
        </div>

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
          isUp ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          <span>{isUp ? "Alvo ▲" : "Alvo ▼"}</span>
          <span>{pctChange >= 0 ? "+" : ""}{pctChange.toFixed(2)}%</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Preco Atual</span>
          <span className="font-mono text-base font-bold tabular-nums" style={{ color }}>{formatBRL(currentPrice)}</span>
        </div>
      </div>

      {/* Canvas Chart */}
      <div ref={containerRef} className="w-full" style={{ height }}>
        <canvas ref={canvasRef} className="block w-full" style={{ height }} />
      </div>
    </div>
  );
}
