"use client";

import { useEffect, useState } from "react";

interface TickerData {
  forex: Record<string, number>;
  crypto: Record<string, number>;
  marketCount: number;
}

const POLL_INTERVAL = 60_000; // 60s

function formatBRL(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatUSD(value: number) {
  return `US$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatCryptoUSD(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function buildTickerItems(data: TickerData | null) {
  if (!data) {
    return [
      { label: "Mercados", badge: "—", isBadge: true },
      { label: "BTC", value: "..." },
      { label: "ETH", value: "..." },
      { label: "USD/BRL", value: "..." },
      { label: "EUR/BRL", value: "..." },
      { label: "EUR/USD", value: "..." },
    ];
  }

  return [
    { label: "Mercados", badge: String(data.marketCount), isBadge: true },
    { label: "BTC", value: formatCryptoUSD(data.crypto.BTC) },
    { label: "ETH", value: formatCryptoUSD(data.crypto.ETH) },
    { label: "USD/BRL", value: formatBRL(data.forex["USD/BRL"]) },
    { label: "EUR/BRL", value: formatBRL(data.forex["EUR/BRL"]), highlight: true },
    { label: "EUR/USD", value: formatUSD(data.forex["EUR/USD"]) },
  ];
}

export default function MarketTicker() {
  const [data, setData] = useState<TickerData | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchTicker() {
      try {
        const res = await fetch("/api/ticker");
        if (!res.ok) return;
        const json = await res.json();
        if (active) setData(json);
      } catch {}
    }

    fetchTicker();
    const interval = setInterval(fetchTicker, POLL_INTERVAL);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const tickerItems = buildTickerItems(data);

  return (
    <div className="bg-[hsl(0,0%,4%)] border-b border-[hsl(0,0%,18%)] overflow-hidden py-1.5">
      <div className="flex animate-ticker-scroll whitespace-nowrap">
        {[...Array(4)].map((_, repeat) => (
          <div key={repeat} className="flex items-center gap-6 px-4">
            {tickerItems.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                {item.isBadge ? (
                  <>
                    <span className="text-[hsl(0,0%,55%)]">{item.label}</span>
                    <span className="bg-[#80FF00] text-[#0a0a0a] text-[10px] font-bold px-1.5 py-0.5 rounded">{item.badge}</span>
                  </>
                ) : (
                  <>
                    <span className="text-[hsl(0,0%,55%)]">{item.label}</span>
                    <span className={`font-semibold ${item.highlight ? 'text-[hsl(0,84%,60%)]' : 'text-[hsl(0,0%,95%)]'}`}>{item.value}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
