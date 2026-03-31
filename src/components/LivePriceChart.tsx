"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface LivePriceChartProps {
  symbol: string;
  category: string;
  openPrice?: number;
  height?: number;
}

interface PricePoint {
  price: number;
  time: number;
}

const MAX_POINTS = 60;
const POLL_INTERVAL = 5000;

function formatPriceBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function LivePriceChart({
  symbol,
  category,
  openPrice,
  height = 220,
}: LivePriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(600);
  const animFrameRef = useRef<number>(0);
  const pulseRef = useRef(0);

  // Poll prices
  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/prices?symbol=${encodeURIComponent(symbol)}&category=${encodeURIComponent(category)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.price == null) return;
      const price = Number(data.price);
      if (price === 0) return;
      setPoints((prev) => {
        const next = [...prev, { price, time: Date.now() }];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    } catch {
      // silently ignore fetch errors
    }
  }, [symbol, category]);

  useEffect(() => {
    fetchPrice();
    const iv = setInterval(fetchPrice, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchPrice]);

  // ResizeObserver for responsive width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasWidth(entry.contentRect.width);
      }
    });
    ro.observe(container);
    setCanvasWidth(container.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Canvas rendering with animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const draw = () => {
      if (!running) return;
      pulseRef.current += 0.05;

      const dpr = window.devicePixelRatio || 1;
      const w = canvasWidth;
      const h = height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear
      ctx.clearRect(0, 0, w, h);

      if (points.length < 2) {
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Carregando dados...", w / 2, h / 2);
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const PADDING_LEFT = 12;
      const PADDING_RIGHT = 72;
      const PADDING_TOP = 16;
      const PADDING_BOTTOM = 28;

      const chartW = w - PADDING_LEFT - PADDING_RIGHT;
      const chartH = h - PADDING_TOP - PADDING_BOTTOM;

      // Price range
      const prices = points.map((p) => p.price);
      let minPrice = Math.min(...prices);
      let maxPrice = Math.max(...prices);

      if (openPrice != null) {
        minPrice = Math.min(minPrice, openPrice);
        maxPrice = Math.max(maxPrice, openPrice);
      }

      // Add small padding to price range
      const priceRange = maxPrice - minPrice || maxPrice * 0.001;
      minPrice -= priceRange * 0.1;
      maxPrice += priceRange * 0.1;
      const totalRange = maxPrice - minPrice;

      const toX = (i: number) => PADDING_LEFT + (i / (points.length - 1)) * chartW;
      const toY = (price: number) =>
        PADDING_TOP + (1 - (price - minPrice) / totalRange) * chartH;

      const currentPrice = points[points.length - 1].price;
      const refPrice = openPrice ?? points[0].price;
      const isAbove = currentPrice >= refPrice;
      const lineColor = isAbove ? "#00FFB8" : "#FF5252";

      // Grid lines (horizontal)
      const gridCount = 5;
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= gridCount; i++) {
        const y = PADDING_TOP + (i / gridCount) * chartH;
        ctx.beginPath();
        ctx.moveTo(PADDING_LEFT, y);
        ctx.lineTo(PADDING_LEFT + chartW, y);
        ctx.stroke();
      }

      // Open price dashed line
      if (openPrice != null) {
        const openY = toY(openPrice);
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(PADDING_LEFT, openY);
        ctx.lineTo(PADDING_LEFT + chartW, openY);
        ctx.stroke();
        ctx.restore();
      }

      // Gradient fill under line
      const gradient = ctx.createLinearGradient(0, PADDING_TOP, 0, PADDING_TOP + chartH);
      if (isAbove) {
        gradient.addColorStop(0, "rgba(0,255,184,0.12)");
        gradient.addColorStop(1, "rgba(0,255,184,0.0)");
      } else {
        gradient.addColorStop(0, "rgba(255,82,82,0.12)");
        gradient.addColorStop(1, "rgba(255,82,82,0.0)");
      }

      // Fill area
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(points[0].price));
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(toX(i), toY(points[i].price));
      }
      ctx.lineTo(toX(points.length - 1), PADDING_TOP + chartH);
      ctx.lineTo(toX(0), PADDING_TOP + chartH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Price line with glow
      ctx.save();
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 6;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(points[0].price));
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(toX(i), toY(points[i].price));
      }
      ctx.stroke();
      ctx.restore();

      // Pulsing dot at current price
      const lastX = toX(points.length - 1);
      const lastY = toY(currentPrice);
      const pulseSize = 3 + Math.sin(pulseRef.current) * 1.5;

      ctx.save();
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.arc(lastX, lastY, pulseSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Outer pulse ring
      const ringAlpha = 0.3 + Math.sin(pulseRef.current) * 0.2;
      ctx.strokeStyle = lineColor.replace(")", `,${ringAlpha})`).replace("rgb", "rgba").replace("#", "");
      // Use hex-to-rgba for the ring
      ctx.globalAlpha = ringAlpha;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(lastX, lastY, pulseSize + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Y-axis labels (right side)
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      for (let i = 0; i <= gridCount; i++) {
        const price = maxPrice - (i / gridCount) * totalRange;
        const y = PADDING_TOP + (i / gridCount) * chartH;
        const label =
          category === "weather"
            ? `${price.toFixed(1)}°`
            : `R$ ${price.toFixed(4)}`;
        ctx.fillText(label, w - 4, y + 3);
      }

      // X-axis labels (bottom)
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      const labelInterval = Math.max(1, Math.floor(points.length / 5));
      for (let i = 0; i < points.length; i += labelInterval) {
        const x = toX(i);
        ctx.fillText(formatTime(points[i].time), x, h - 4);
      }
      // Always draw last label
      if (points.length > 1) {
        ctx.fillText(
          formatTime(points[points.length - 1].time),
          toX(points.length - 1),
          h - 4
        );
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [points, canvasWidth, height, openPrice, category]);

  // Derived values for header
  const currentPrice = points.length > 0 ? points[points.length - 1].price : null;
  const refPrice = openPrice ?? (points.length > 0 ? points[0].price : null);
  const priceDiff =
    currentPrice != null && refPrice != null ? currentPrice - refPrice : null;
  const isAbove = priceDiff != null ? priceDiff >= 0 : true;

  const formatDisplay = (val: number) => {
    if (category === "weather") return `${val.toFixed(1)}°C`;
    return formatPriceBRL(val);
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111827] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
        <div className="flex flex-col">
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">
            Preco Inicial
          </span>
          <span className="font-mono text-xs tabular-nums text-white/70">
            {refPrice != null ? formatDisplay(refPrice) : "---"}
          </span>
        </div>

        {priceDiff != null && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black ${
              isAbove
                ? "bg-[#00FFB8]/10 text-[#00FFB8]"
                : "bg-[#FF5252]/10 text-[#FF5252]"
            }`}
          >
            <span>{isAbove ? "Alvo \u25B2" : "Alvo \u25BC"}</span>
            <span className="font-mono tabular-nums">
              {isAbove ? "+" : ""}
              {category === "weather"
                ? priceDiff.toFixed(1) + "°"
                : "R$ " + Math.abs(priceDiff).toFixed(4)}
            </span>
          </div>
        )}

        <div className="flex flex-col items-end">
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">
            Preco Atual
          </span>
          <span
            className={`font-mono text-sm font-bold tabular-nums ${
              isAbove ? "text-[#00FFB8]" : "text-[#FF5252]"
            }`}
          >
            {currentPrice != null ? formatDisplay(currentPrice) : "---"}
          </span>
        </div>
      </div>

      {/* Canvas chart */}
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} style={{ display: "block", height }} />
      </div>
    </div>
  );
}
