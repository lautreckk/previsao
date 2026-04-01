"use client";

const tickerItems = [
  { label: "Mercados", badge: "14", isBadge: true },
  { label: "BTC", value: "$87,420" },
  { label: "ETH", value: "$2,024" },
  { label: "USD/BRL", value: "R$ 5,24" },
  { label: "EUR/BRL", value: "R$ 6,03", highlight: true },
  { label: "EUR/USD", value: "US$ 1,14" },
];

export default function MarketTicker() {
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
