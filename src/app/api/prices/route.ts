export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// In-memory cache to avoid rate limits on free APIs
const priceCache = new Map<string, { data: Record<string, unknown>; expires: number }>();

/**
 * GET /api/prices — Public price endpoint (no auth required)
 * Used by frontend components to display live prices
 * Cached for 10 seconds to avoid rate limits on CoinGecko/AwesomeAPI
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "BTC";
  const category = searchParams.get("category") || "crypto";

  // Check cache first (10s TTL)
  const cacheKey = `${symbol}_${category}`;
  const cached = priceCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
    });
  }

  try {
    let price = 0;
    let change = 0;
    let changePct = 0;
    let source = "";

    if (category === "crypto") {
      const cgIds: Record<string, string> = {
        BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
        XRP: "ripple", ADA: "cardano", DOGE: "dogecoin", AVAX: "avalanche-2",
        LINK: "chainlink", DOT: "polkadot",
      };
      const cgId = cgIds[symbol.toUpperCase()] || symbol.toLowerCase();

      // Try CoinGecko first
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&ids=${cgId}&sparkline=false&price_change_percentage=24h`
        );
        if (res.ok) {
          const data = await res.json();
          const coin = data[0];
          if (coin) {
            price = coin.current_price;
            change = coin.price_change_24h || 0;
            changePct = coin.price_change_percentage_24h || 0;
            source = "coingecko";
          }
        }
      } catch { /* fall through */ }

      // Fallback 1: CoinGecko simple price (lighter endpoint, less likely to rate limit)
      if (!price) {
        try {
          const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=brl&include_24hr_change=true`);
          if (res.ok) {
            const data = await res.json();
            if (data[cgId]) {
              price = data[cgId].brl || 0;
              changePct = data[cgId].brl_24h_change || 0;
              source = "coingecko-simple";
            }
          }
        } catch { /* fall through */ }
      }

      // Fallback 2: AwesomeAPI crypto (always works for BTC, ETH)
      if (!price) {
        try {
          const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${symbol}-BRL`);
          if (res.ok) {
            const data = await res.json();
            const key = `${symbol}BRL`;
            if (data[key]) {
              price = parseFloat(data[key].bid);
              change = parseFloat(data[key].varBid || "0");
              changePct = parseFloat(data[key].pctChange || "0");
              source = "awesomeapi";
            }
          }
        } catch { /* fall through */ }
      }

      // Fallback 3: Coinbase via proxy-free endpoint
      if (!price) {
        try {
          const res = await fetch(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot`);
          if (res.ok) {
            const data = await res.json();
            const usdPrice = parseFloat(data.data?.amount || "0");
            // Rough BRL conversion
            price = usdPrice * 5.2;
            source = "coinbase";
          }
        } catch { /* ignore */ }
      }
    } else if (category === "forex") {
      const pair = symbol.replace("/", "-");
      // Try AwesomeAPI first
      try {
        const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${pair}`);
        if (res.ok) {
          const data = await res.json();
          const key = pair.replace("-", "");
          const entry = data[key];
          if (entry) {
            price = parseFloat(entry.bid);
            change = parseFloat(entry.varBid || "0");
            changePct = parseFloat(entry.pctChange || "0");
            source = "awesomeapi";
          }
        }
      } catch { /* fall through */ }
      // Fallback: Coinbase for USD
      if (!price && (pair.startsWith("USD") || pair.includes("USD"))) {
        try {
          const res = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=USD");
          if (res.ok) {
            const data = await res.json();
            const brlRate = parseFloat(data.data?.rates?.BRL || "0");
            if (brlRate > 0) {
              price = brlRate;
              source = "coinbase";
            }
          }
        } catch { /* ignore */ }
      }
    } else if (category === "stocks") {
      const token = process.env.BRAPI_TOKEN || "";
      const url = token
        ? `https://brapi.dev/api/quote/${symbol}?token=${token}`
        : `https://brapi.dev/api/quote/${symbol}`;
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const stock = data.results?.[0];
          if (stock) {
            price = stock.regularMarketPrice;
            change = stock.regularMarketChange;
            changePct = stock.regularMarketChangePercent;
            source = "brapi";
          }
        }
      } catch { /* ignore */ }
    } else if (category === "weather") {
      const owKey = process.env.OPENWEATHER_API_KEY;
      if (owKey) {
        const cities: Record<string, number> = {
          "sao paulo": 3448439, "rio de janeiro": 3451190, "brasilia": 3469058,
          "curitiba": 3464975, "belo horizonte": 3470127, "porto alegre": 3452925,
          "fortaleza": 3399415, "salvador": 3450554, "florianopolis": 3463237,
        };
        const cityId = cities[symbol.toLowerCase()] || 3448439;
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?id=${cityId}&appid=${owKey}&units=metric&lang=pt_br`
        );
        if (res.ok) {
          const data = await res.json();
          price = data.main.temp;
          change = data.main.temp - data.main.feels_like;
          changePct = 0;
          source = "openweather";
        }
      }
    }

    const result = {
      symbol,
      category,
      price,
      change_24h: change,
      change_pct_24h: changePct,
      currency: category === "weather" ? "°C" : "BRL",
      source,
      updated_at: new Date().toISOString(),
    };

    // Cache for 10 seconds
    if (price > 0) {
      priceCache.set(cacheKey, { data: result, expires: Date.now() + 10000 });
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
    });
  } catch (err) {
    // Return cached data on error if available
    const stale = priceCache.get(cacheKey);
    if (stale) return NextResponse.json(stale.data);
    return NextResponse.json({ error: String(err), symbol, price: 0 }, { status: 502 });
  }
}
