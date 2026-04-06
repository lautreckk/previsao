// ============================================================
// WINIFY - AUTO MARKET ENGINE
// Creates real markets with real data and resolves automatically
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { resolveBannerUrl } from "@/lib/banner-resolver";
import { updateUserStats } from "@/lib/update-user-stats";

const sb = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);


// ---- Types ----

interface MarketTemplate {
  id: string;
  title: string;
  short_description: string;
  category: string;
  outcome_type: string;
  outcomes: { key: string; label: string; color: string }[];
  close_hours: number;
  is_featured: boolean;
  resolution_type: "automatic";
  source_type: "api";
  resolution_config: {
    provider: string;
    market_type: string;
    params: Record<string, unknown>;
  };
  image_prompt: string;
  tier: "curto" | "medio" | "longo";
  lat?: number;
  lon?: number;
}

// ---- Crypto Price Helpers (CoinGecko + AwesomeAPI, no Binance) ----

async function getCryptoPrice(cgId: string): Promise<number> {
  // CoinGecko (global, no region block)
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
    if (res.ok) {
      const d = await res.json();
      if (d[cgId]?.usd) return d[cgId].usd;
    }
  } catch { /* fall through */ }

  // Fallback: AwesomeAPI (BRL price, convert back to USD)
  const symbolMap: Record<string, string> = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL" };
  const sym = symbolMap[cgId];
  if (sym) {
    try {
      const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${sym}-USD`);
      if (res.ok) {
        const d = await res.json();
        const key = `${sym}USD`;
        if (d[key]?.bid) return parseFloat(d[key].bid);
      }
    } catch { /* fall through */ }
  }

  // Fallback: Coinbase
  if (sym) {
    try {
      const res = await fetch(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`);
      if (res.ok) {
        const d = await res.json();
        if (d.data?.amount) return parseFloat(d.data.amount);
      }
    } catch { /* fall through */ }
  }

  return 0;
}

async function getBtcPrice(): Promise<number> {
  return getCryptoPrice("bitcoin");
}

async function getEthPrice(): Promise<number> {
  return getCryptoPrice("ethereum");
}

async function getSolPrice(): Promise<number> {
  return getCryptoPrice("solana");
}

async function getUsdBrl(): Promise<number> {
  // AwesomeAPI (free, no key, works globally)
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
    if (res.ok) {
      const d = await res.json();
      return parseFloat(d.USDBRL?.bid || "5.5");
    }
  } catch { /* fall through */ }
  return 5.5; // fallback
}

async function getWeather(cityId: number): Promise<{ temp: number; humidity: number; description: string }> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) throw new Error("OPENWEATHER_API_KEY missing");
  const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?id=${cityId}&appid=${key}&units=metric&lang=pt_br`);
  const d = await res.json();
  return { temp: d.main.temp, humidity: d.main.humidity, description: d.weather?.[0]?.description || "" };
}

// ---- Market Template Generators ----

const CITIES: Record<string, { id: number; name: string; state: string; lat: number; lon: number }> = {
  sp: { id: 3448439, name: "Sao Paulo", state: "SP", lat: -23.5505, lon: -46.6333 },
  rj: { id: 3451190, name: "Rio de Janeiro", state: "RJ", lat: -22.9068, lon: -43.1729 },
  bh: { id: 3470127, name: "Belo Horizonte", state: "MG", lat: -19.9167, lon: -43.9345 },
  ctb: { id: 3464975, name: "Curitiba", state: "PR", lat: -25.4284, lon: -49.2733 },
  bsb: { id: 3469058, name: "Brasilia", state: "DF", lat: -15.7975, lon: -47.8919 },
  poa: { id: 3452925, name: "Porto Alegre", state: "RS", lat: -30.0346, lon: -51.2177 },
  ssa: { id: 3450554, name: "Salvador", state: "BA", lat: -12.9714, lon: -38.5124 },
  for: { id: 3399415, name: "Fortaleza", state: "CE", lat: -3.7172, lon: -38.5433 },
  fln: { id: 3463237, name: "Florianopolis", state: "SC", lat: -27.5954, lon: -48.5480 },
  rec: { id: 3390760, name: "Recife", state: "PE", lat: -8.0476, lon: -34.8770 },
};

export async function generateWeatherMarkets(tier: "curto" | "medio" | "longo"): Promise<MarketTemplate[]> {
  const templates: MarketTemplate[] = [];
  const cityKeys = Object.keys(CITIES);
  const randomCity = cityKeys[Math.floor(Math.random() * cityKeys.length)];
  const city = CITIES[randomCity];

  try {
    const weather = await getWeather(city.id);
    const currentTemp = Math.round(weather.temp);

    if (tier === "curto") {
      // "SP atinge Xº C nas proximas 2h?"
      const threshold = currentTemp + (Math.random() > 0.5 ? 2 : -2);
      templates.push({
        id: `weather_${randomCity}_${tier}_${Date.now()}`,
        title: `${city.name} atinge ${threshold}°C nas proximas 2h?`,
        short_description: `Agora: ${currentTemp}°C em ${city.name}. ${weather.description}.`,
        category: "weather",
        outcome_type: "yes_no",
        outcomes: [
          { key: "YES", label: "Sim", color: "#10B981" },
          { key: "NO", label: "Nao", color: "#FF5252" },
        ],
        close_hours: 2,
        is_featured: true,
        resolution_type: "automatic",
        source_type: "api",
        resolution_config: {
          provider: "openweather",
          market_type: "weather_threshold",
          params: { city: randomCity, city_id: city.id, metric: "temperature", operator: ">=", threshold },
        },
        image_prompt: `Weather thermometer showing ${threshold} degrees celsius in ${city.name} Brazil, dramatic sky, dark cinematic`,
        tier,
        lat: city.lat,
        lon: city.lon,
      });
    } else if (tier === "medio") {
      // "Maxima em SP hoje passa de Xº C?"
      const maxThreshold = currentTemp + 3 + Math.floor(Math.random() * 3);
      templates.push({
        id: `weather_${randomCity}_max_${Date.now()}`,
        title: `Maxima em ${city.name} hoje passa de ${maxThreshold}°C?`,
        short_description: `Atual: ${currentTemp}°C. Previsao de ${weather.description}.`,
        category: "weather",
        outcome_type: "yes_no",
        outcomes: [
          { key: "YES", label: "Sim, passa", color: "#FF5252" },
          { key: "NO", label: "Nao passa", color: "#5B9DFF" },
        ],
        close_hours: 6,
        is_featured: false,
        resolution_type: "automatic",
        source_type: "api",
        resolution_config: {
          provider: "openweather",
          market_type: "weather_threshold",
          params: { city: randomCity, city_id: city.id, metric: "temp_max", operator: ">=", threshold: maxThreshold },
        },
        image_prompt: `Hot sunny day in ${city.name} Brazil, temperature rising, dramatic heat haze, dark cinematic mood`,
        tier,
        lat: city.lat,
        lon: city.lon,
      });
    } else {
      // "Chove em SP amanha?"
      templates.push({
        id: `weather_${randomCity}_rain_${Date.now()}`,
        title: `Chove em ${city.name} amanha?`,
        short_description: `Hoje: ${weather.description}. Temperatura atual: ${currentTemp}°C.`,
        category: "weather",
        outcome_type: "yes_no",
        outcomes: [
          { key: "YES", label: "Sim, chove", color: "#5B9DFF" },
          { key: "NO", label: "Nao chove", color: "#FFB800" },
        ],
        close_hours: 36,
        is_featured: false,
        resolution_type: "automatic",
        source_type: "api",
        resolution_config: {
          provider: "openweather",
          market_type: "weather_threshold",
          params: { city: randomCity, city_id: city.id, metric: "humidity", operator: ">=", threshold: 80 },
        },
        image_prompt: `Rain clouds over ${city.name} Brazil cityscape, dramatic storm, dark moody cinematic`,
        tier,
        lat: city.lat,
        lon: city.lon,
      });
    }
  } catch (err) {
    console.error("[auto-markets] Weather error:", err);
  }

  return templates;
}

export async function generateCryptoMarkets(tier: "curto" | "medio" | "longo"): Promise<MarketTemplate[]> {
  const templates: MarketTemplate[] = [];

  try {
    const usdBrl = await getUsdBrl();

    if (tier === "curto") {
      // BTC Sobe/Desce em 5min
      const btcUsd = await getBtcPrice();
      const btcBrl = Math.round(btcUsd * usdBrl);
      templates.push({
        id: `crypto_btc_5min_${Date.now()}`,
        title: `Bitcoin: sobe ou desce em 5 min?`,
        short_description: `BTC agora: R$ ${btcBrl.toLocaleString("pt-BR")}. Sobe ou desce nos proximos 5 minutos?`,
        category: "crypto",
        outcome_type: "up_down",
        outcomes: [
          { key: "UP", label: "Sobe", color: "#10B981" },
          { key: "DOWN", label: "Desce", color: "#FF5252" },
        ],
        close_hours: 0.083,
        is_featured: true,
        resolution_type: "automatic",
        source_type: "api",
        resolution_config: {
          provider: "binance",
          market_type: "crypto_up_down",
          params: { symbol: "BTC", binance_symbol: "BTCUSDT", open_price: btcUsd },
        },
        image_prompt: "Bitcoin golden coin with green and red arrows, dark futuristic trading background, neon accents",
        tier,
      });

      // ETH 15min
      const ethUsd = await getEthPrice();
      const ethBrl = Math.round(ethUsd * usdBrl);
      templates.push({
        id: `crypto_eth_15min_${Date.now()}`,
        title: `Ethereum: sobe ou desce em 15 min?`,
        short_description: `ETH agora: R$ ${ethBrl.toLocaleString("pt-BR")}`,
        category: "crypto",
        outcome_type: "up_down",
        outcomes: [
          { key: "UP", label: "Sobe", color: "#10B981" },
          { key: "DOWN", label: "Desce", color: "#FF5252" },
        ],
        close_hours: 0.25,
        is_featured: true,
        resolution_type: "automatic",
        source_type: "api",
        resolution_config: {
          provider: "binance",
          market_type: "crypto_up_down",
          params: { symbol: "ETH", binance_symbol: "ETHUSDT", open_price: ethUsd },
        },
        image_prompt: "Ethereum diamond logo with price chart arrows, dark cyberpunk style, neon purple and green",
        tier,
      });
    } else if (tier === "medio") {
      // SOL 1h
      const solUsd = await getSolPrice();
      const solBrl = Math.round(solUsd * usdBrl);
      templates.push({
        id: `crypto_sol_1h_${Date.now()}`,
        title: `Solana: sobe ou desce em 1 hora?`,
        short_description: `SOL agora: R$ ${solBrl.toLocaleString("pt-BR")}`,
        category: "crypto",
        outcome_type: "up_down",
        outcomes: [
          { key: "UP", label: "Sobe", color: "#10B981" },
          { key: "DOWN", label: "Desce", color: "#FF5252" },
        ],
        close_hours: 1,
        is_featured: false,
        resolution_type: "automatic",
        source_type: "api",
        resolution_config: {
          provider: "binance",
          market_type: "crypto_up_down",
          params: { symbol: "SOL", binance_symbol: "SOLUSDT", open_price: solUsd },
        },
        image_prompt: "Solana blockchain logo with trading chart, dark neon style, purple and cyan",
        tier,
      });
    } else {
      // BTC 24h
      const btcUsd = await getBtcPrice();
      const btcBrl = Math.round(btcUsd * usdBrl);
      const threshold = Math.round(btcUsd / 100) * 100; // round to nearest $100
      templates.push({
        id: `crypto_btc_24h_${Date.now()}`,
        title: `BTC fecha acima de US$ ${threshold.toLocaleString()} amanha?`,
        short_description: `BTC agora: R$ ${btcBrl.toLocaleString("pt-BR")} (US$ ${Math.round(btcUsd).toLocaleString()})`,
        category: "crypto",
        outcome_type: "yes_no",
        outcomes: [
          { key: "YES", label: `Sim, acima`, color: "#10B981" },
          { key: "NO", label: `Nao, abaixo`, color: "#FF5252" },
        ],
        close_hours: 24,
        is_featured: false,
        resolution_type: "automatic",
        source_type: "api",
        resolution_config: {
          provider: "binance",
          market_type: "crypto_up_down",
          params: { symbol: "BTC", binance_symbol: "BTCUSDT", open_price: threshold },
        },
        image_prompt: "Bitcoin price prediction chart reaching new highs, dark dramatic financial background",
        tier,
      });
    }
  } catch (err) {
    console.error("[auto-markets] Crypto error:", err);
  }

  return templates;
}

export async function generateForexMarkets(tier: "curto" | "medio" | "longo"): Promise<MarketTemplate[]> {
  const templates: MarketTemplate[] = [];

  try {
    const usdBrl = await getUsdBrl();
    const rounded = Math.round(usdBrl * 100) / 100;

    if (tier === "curto") {
      templates.push({
        id: `forex_usd_30min_${Date.now()}`,
        title: `Dolar: sobe ou desce em 30 min?`,
        short_description: `USD/BRL agora: R$ ${rounded.toFixed(2)}`,
        category: "economy",
        outcome_type: "up_down",
        outcomes: [
          { key: "UP", label: "Sobe", color: "#10B981" },
          { key: "DOWN", label: "Desce", color: "#FF5252" },
        ],
        close_hours: 0.5,
        is_featured: true,
        resolution_type: "automatic",
        source_type: "api",
        resolution_config: {
          provider: "binance",
          market_type: "forex_up_down",
          params: { pair: "USD/BRL", binance_symbol: "USDTBRL", open_price: usdBrl },
        },
        image_prompt: "US Dollar vs Brazilian Real currency exchange, financial chart, dark moody cinematic",
        tier,
      });
    } else if (tier === "medio") {
      const threshold = Math.round(usdBrl * 10) / 10 + 0.1;
      templates.push({
        id: `forex_usd_6h_${Date.now()}`,
        title: `Dolar fecha acima de R$ ${threshold.toFixed(2)} hoje?`,
        short_description: `USD/BRL agora: R$ ${rounded.toFixed(2)}`,
        category: "economy",
        outcome_type: "yes_no",
        outcomes: [
          { key: "YES", label: `Sim, acima de R$ ${threshold.toFixed(2)}`, color: "#FF5252" },
          { key: "NO", label: `Nao, abaixo`, color: "#10B981" },
        ],
        close_hours: 6,
        is_featured: false,
        resolution_type: "automatic",
        source_type: "api",
        resolution_config: {
          provider: "binance",
          market_type: "crypto_up_down",
          params: { symbol: "USDT", binance_symbol: "USDTBRL", open_price: threshold },
        },
        image_prompt: "Brazilian real banknotes with dollar bills, financial district background, dark cinematic",
        tier,
      });
    } else {
      templates.push({
        id: `forex_usd_week_${Date.now()}`,
        title: `Dolar sobe ou desce na semana?`,
        short_description: `USD/BRL inicio da semana: R$ ${rounded.toFixed(2)}`,
        category: "economy",
        outcome_type: "up_down",
        outcomes: [
          { key: "UP", label: "Sobe na semana", color: "#FF5252" },
          { key: "DOWN", label: "Desce na semana", color: "#10B981" },
        ],
        close_hours: 120,
        is_featured: false,
        resolution_type: "automatic",
        source_type: "api",
        resolution_config: {
          provider: "binance",
          market_type: "forex_up_down",
          params: { pair: "USD/BRL", binance_symbol: "USDTBRL", open_price: usdBrl },
        },
        image_prompt: "Weekly financial chart USD BRL, bull and bear, dark dramatic style",
        tier,
      });
    }
  } catch (err) {
    console.error("[auto-markets] Forex error:", err);
  }

  return templates;
}

export async function generateStockMarkets(tier: "curto" | "medio" | "longo"): Promise<MarketTemplate[]> {
  const templates: MarketTemplate[] = [];

  // Only during B3 hours (10-17 BRT, weekdays)
  const now = new Date();
  const spHour = parseInt(now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }));
  const spDay = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();

  if (spDay === 0 || spDay === 6 || spHour < 10 || spHour >= 17) {
    return []; // Outside B3 hours
  }

  try {
    const stocks = ["PETR4", "VALE3", "ITUB4", "BBDC4", "ABEV3"];
    const pick = stocks[Math.floor(Math.random() * stocks.length)];
    const token = process.env.BRAPI_TOKEN || "";
    const url = token ? `https://brapi.dev/api/quote/${pick}?token=${token}` : `https://brapi.dev/api/quote/${pick}`;
    const res = await fetch(url);
    const json = await res.json();
    const stock = json.results?.[0];

    if (!stock) return [];

    const price = stock.regularMarketPrice;
    const name = stock.shortName || pick;

    if (tier === "medio") {
      templates.push({
        id: `stock_${pick}_day_${Date.now()}`,
        title: `${pick}: fecha em alta ou queda hoje?`,
        short_description: `${name} agora: R$ ${price.toFixed(2)} (${stock.regularMarketChangePercent > 0 ? "+" : ""}${stock.regularMarketChangePercent.toFixed(2)}%)`,
        category: "economy",
        outcome_type: "up_down",
        outcomes: [
          { key: "UP", label: "Fecha em alta", color: "#10B981" },
          { key: "DOWN", label: "Fecha em queda", color: "#FF5252" },
        ],
        close_hours: 6,
        is_featured: false,
        resolution_type: "automatic",
        source_type: "api",
        resolution_config: {
          provider: "brapi",
          market_type: "stock_performance",
          params: { symbols: [pick], metric: "change_percent" },
        },
        image_prompt: `${pick} stock trading chart B3 Bovespa, bull market, dark cinematic financial`,
        tier,
      });
    } else if (tier === "longo") {
      // Qual acao sobe mais na semana?
      templates.push({
        id: `stock_race_week_${Date.now()}`,
        title: `Qual acao sobe mais essa semana?`,
        short_description: `PETR4, VALE3, ITUB4 — quem lidera?`,
        category: "economy",
        outcome_type: "multiple_choice",
        outcomes: [
          { key: "PETR4", label: "PETR4", color: "#10B981" },
          { key: "VALE3", label: "VALE3", color: "#FFB800" },
          { key: "ITUB4", label: "ITUB4", color: "#5B9DFF" },
        ],
        close_hours: 120,
        is_featured: false,
        resolution_type: "automatic",
        source_type: "api",
        resolution_config: {
          provider: "brapi",
          market_type: "stock_performance",
          params: { symbols: ["PETR4", "VALE3", "ITUB4"], metric: "change_percent" },
        },
        image_prompt: "Three stocks racing on chart, PETR4 VALE3 ITUB4, dark neon financial style, B3 exchange",
        tier,
      });
    }
  } catch (err) {
    console.error("[auto-markets] Stocks error:", err);
  }

  return templates;
}

export async function generateFootballMarkets(tier: "curto" | "medio" | "longo"): Promise<MarketTemplate[]> {
  const templates: MarketTemplate[] = [];

  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) return [];

  try {
    // Fetch upcoming Brasileirao matches
    const res = await fetch("https://api.football-data.org/v4/competitions/BSA/matches?status=SCHEDULED", {
      headers: { "X-Auth-Token": key },
    });
    if (!res.ok) return [];

    const json = await res.json();
    const matches = json.matches?.slice(0, 5) || [];

    if (matches.length === 0) return [];

    const match = matches[0]; // Next match
    const home = match.homeTeam?.shortName || match.homeTeam?.name || "Time A";
    const away = match.awayTeam?.shortName || match.awayTeam?.name || "Time B";
    const matchDate = new Date(match.utcDate);
    const hoursUntil = Math.max(1, (matchDate.getTime() - Date.now()) / 3600000);

    if (tier === "medio" && hoursUntil <= 6) {
      templates.push({
        id: `football_${match.id}_result_${Date.now()}`,
        title: `${home} x ${away}: quem vence?`,
        short_description: `Brasileirao Serie A — ${matchDate.toLocaleDateString("pt-BR")}`,
        category: "sports",
        outcome_type: "team_win_draw",
        outcomes: [
          { key: "HOME", label: home, color: "#10B981" },
          { key: "DRAW", label: "Empate", color: "#FFB800" },
          { key: "AWAY", label: away, color: "#FF5252" },
        ],
        close_hours: Math.min(hoursUntil - 0.5, 6), // Close 30min before kickoff
        is_featured: true,
        resolution_type: "automatic",
        source_type: "api",
        resolution_config: {
          provider: "football-data",
          market_type: "sport_event",
          params: {
            match_id: match.id,
            stat: "result",
            home_team: home,
            away_team: away,
          },
        },
        image_prompt: `${home} vs ${away} football match, Brazilian football stadium, dark dramatic, neon green pitch lights`,
        tier,
      });
    } else if (tier === "longo") {
      // Multiple match prediction
      if (matches.length >= 3) {
        templates.push({
          id: `football_week_${Date.now()}`,
          title: `Brasileirao: quantos gols na rodada?`,
          short_description: `Mais ou menos gols nos proximos jogos do Brasileirao?`,
          category: "sports",
          outcome_type: "yes_no",
          outcomes: [
            { key: "YES", label: "Mais de 8 gols", color: "#10B981" },
            { key: "NO", label: "8 gols ou menos", color: "#FF5252" },
          ],
          close_hours: 72,
          is_featured: false,
          resolution_type: "automatic",
          source_type: "api",
          resolution_config: {
            provider: "football-data",
            market_type: "sport_event",
            params: {
              match_ids: matches.slice(0, 3).map((m: Record<string, unknown>) => m.id),
              stat: "total_goals",
              condition: ">8",
            },
          },
          image_prompt: "Brazilian football stadium scoreboard with many goals, Serie A, dark dramatic neon",
          tier,
        });
      }
    }
  } catch (err) {
    console.error("[auto-markets] Football error:", err);
  }

  return templates;
}

// ---- Main: Generate all auto markets ----

export async function generateAutoMarkets(tiers?: ("curto" | "medio" | "longo")[]): Promise<{
  created: number;
  markets: Record<string, unknown>[];
  errors: string[];
}> {
  const activeTiers = tiers || ["curto", "medio", "longo"];
  const allTemplates: MarketTemplate[] = [];
  const errors: string[] = [];

  for (const tier of activeTiers) {
    try {
      const [weather, crypto, forex, stocks, football] = await Promise.all([
        generateWeatherMarkets(tier).catch((e) => { errors.push(`weather_${tier}: ${e}`); return []; }),
        generateCryptoMarkets(tier).catch((e) => { errors.push(`crypto_${tier}: ${e}`); return []; }),
        generateForexMarkets(tier).catch((e) => { errors.push(`forex_${tier}: ${e}`); return []; }),
        generateStockMarkets(tier).catch((e) => { errors.push(`stocks_${tier}: ${e}`); return []; }),
        generateFootballMarkets(tier).catch((e) => { errors.push(`football_${tier}: ${e}`); return []; }),
      ]);
      allTemplates.push(...weather, ...crypto, ...forex, ...stocks, ...football);
    } catch (err) {
      errors.push(`tier_${tier}: ${err}`);
    }
  }

  // Insert into prediction_markets (with dedup check)
  const supabase = sb();
  const created: Record<string, unknown>[] = [];

  // Check existing OPEN markets to avoid duplicates
  const { data: existingOpen } = await supabase
    .from("prediction_markets")
    .select("title")
    .eq("status", "open")
    .gt("close_at", new Date().toISOString());
  const existingTitles = new Set((existingOpen || []).map((m) => m.title.toLowerCase()));

  for (const tmpl of allTemplates) {
    // Skip if same title already exists and is open
    if (existingTitles.has(tmpl.title.toLowerCase())) {
      continue;
    }

    try {
      const now = new Date();
      const closeMs = tmpl.close_hours * 3600000;
      const closeAt = new Date(now.getTime() + closeMs);

      const id = `mkt_auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const slug = tmpl.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);

      const outcomes = tmpl.outcomes.map((o, i) => ({
        id: `out_${Date.now()}_${i}`,
        key: o.key,
        label: o.label,
        color: o.color,
        description: "",
        pool: 0,
        bet_count: 0,
        unique_users: 0,
        payout_per_unit: 0,
      }));

      const row = {
        id,
        title: tmpl.title,
        slug,
        short_description: tmpl.short_description,
        full_description: "",
        category: tmpl.category,
        subcategory: tmpl.tier,
        tags: [tmpl.tier, tmpl.category],
        banner_url: await resolveBannerUrl({ title: tmpl.title, category: tmpl.category, image_prompt: tmpl.image_prompt, lat: tmpl.lat, lon: tmpl.lon }).catch(() => ""),
        is_featured: tmpl.is_featured,
        visibility: "public",
        market_type: outcomes.length === 2 ? "binary" : "multi_outcome",
        outcome_type: tmpl.outcome_type,
        outcomes,
        resolution_type: "automatic",
        source_type: "api",
        source_config: {
          source_name: tmpl.resolution_config.provider,
          requires_manual_confirmation: false,
          requires_evidence_upload: false,
          custom_params: tmpl.resolution_config,
        },
        resolution_rule: {
          expression: `${tmpl.resolution_config.market_type}(${JSON.stringify(tmpl.resolution_config.params)})`,
          variables: Object.keys(tmpl.resolution_config.params),
          outcome_map: Object.fromEntries(outcomes.map((o) => [o.key, o.key])),
          description: `Resolucao automatica via ${tmpl.resolution_config.provider}`,
        },
        status: "open",
        open_at: now.toISOString(),
        close_at: closeAt.toISOString(),
        house_fee_percent: 0.05,
        min_bet: 1,
        max_bet: 10000,
        max_payout: 100000,
        max_liability: 500000,
        created_by: "auto_engine",
        ai_generated: false,
        ai_prompt: tmpl.image_prompt,
      };

      console.log(`[auto-markets] Inserting ${id} to ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
      const { data, error } = await supabase.from("prediction_markets").insert(row).select().single();
      if (error) {
        console.error(`[auto-markets] Insert error for ${id}:`, error.message, error.details, error.hint);
        errors.push(`insert_${tmpl.id}: ${error.message}`);
      } else if (!data) {
        console.error(`[auto-markets] Insert returned no data for ${id} (silent failure)`);
        errors.push(`insert_${tmpl.id}: no data returned (possible RLS block)`);
      } else {
        console.log(`[auto-markets] Inserted ${id} successfully`);
        created.push(data);
        // Schedule jobs: close (stop bets) + resolve (pay winners)
        const resolveAt = new Date(closeAt.getTime() + 60000);
        await supabase.from("market_jobs").insert([
          { market_id: id, market_type: "prediction", job_type: "close", execute_at: closeAt.toISOString() },
          { market_id: id, market_type: "prediction", job_type: "resolve", execute_at: resolveAt.toISOString() },
        ]).then(({ error: jobErr }) => {
          if (jobErr) errors.push(`jobs_${id}: ${jobErr.message}`);
        });
      }
    } catch (err) {
      errors.push(`create_${tmpl.id}: ${err}`);
    }
  }

  return { created: created.length, markets: created, errors };
}

// ---- Auto-Resolve: Fallback resolution for markets missed by job dispatcher ----

export async function resolveExpiredMarkets(): Promise<{
  resolved: number;
  results: Record<string, unknown>[];
  errors: string[];
}> {
  const supabase = sb();
  const errors: string[] = [];
  const results: Record<string, unknown>[] = [];
  const nowISO = new Date().toISOString();

  // Step 1: Close + resolve expired automatic markets in one pass
  // Fetch open/frozen expired markets that are automatic — we'll close AND resolve them
  const { data: staleAuto } = await supabase
    .from("prediction_markets")
    .select("*")
    .in("status", ["open", "frozen"])
    .eq("resolution_type", "automatic")
    .lt("close_at", nowISO)
    .order("close_at", { ascending: true })
    .limit(100);

  if (staleAuto && staleAuto.length > 0) {
    for (const market of staleAuto) {
      try {
        await supabase.from("prediction_markets").update({ status: "closed" }).eq("id", market.id);
        const resolveResult = await resolveOneMarket(supabase, { ...market, status: "closed" });
        results.push(resolveResult);
      } catch (err) {
        errors.push(`resolve_${market.id}: ${err}`);
      }
    }
  }

  // Step 2: Also resolve any already-closed automatic markets (from previous partial runs)
  const { data: closedAuto } = await supabase
    .from("prediction_markets")
    .select("*")
    .eq("status", "closed")
    .eq("resolution_type", "automatic")
    .lt("close_at", nowISO)
    .order("close_at", { ascending: true })
    .limit(100);

  if (closedAuto && closedAuto.length > 0) {
    for (const market of closedAuto) {
      try {
        const resolveResult = await resolveOneMarket(supabase, market);
        results.push(resolveResult);
      } catch (err) {
        errors.push(`resolve_${market.id}: ${err}`);
      }
    }
  }

  // Step 3: Close + move manual/semi_automatic expired markets to awaiting_resolution
  const { data: staleManual } = await supabase
    .from("prediction_markets")
    .select("id, title")
    .in("status", ["open", "frozen"])
    .in("resolution_type", ["manual", "semi_automatic"])
    .lt("close_at", nowISO)
    .limit(100);

  if (staleManual && staleManual.length > 0) {
    for (const m of staleManual) {
      await supabase.from("prediction_markets").update({ status: "awaiting_resolution" }).eq("id", m.id);
      results.push({ market_id: m.id, title: m.title, action: "awaiting_resolution" });
    }
  }

  // Also handle already-closed manual ones
  const { data: closedManual } = await supabase
    .from("prediction_markets")
    .select("id, title")
    .eq("status", "closed")
    .in("resolution_type", ["manual", "semi_automatic"])
    .lt("close_at", nowISO)
    .limit(100);

  if (closedManual && closedManual.length > 0) {
    for (const m of closedManual) {
      await supabase.from("prediction_markets").update({ status: "awaiting_resolution" }).eq("id", m.id);
      results.push({ market_id: m.id, title: m.title, action: "awaiting_resolution" });
    }
  }

  return { resolved: results.length, results, errors };
}

// ---- Resolve a single market by fetching real data ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveOneMarket(supabase: any, market: any): Promise<Record<string, unknown>> {
  const config = market.source_config?.custom_params;
  if (!config) throw new Error("no resolution_config");

  let winningKey: string | null = null;
  let resolveReason = "";
  const resolveSourceData: Record<string, unknown> = {};

  if (config.market_type === "crypto_up_down" || config.market_type === "forex_up_down") {
    const openPrice = config.params?.open_price as number;
    if (!openPrice) throw new Error("no open_price");
    let closePrice = 0;
    const sym = (config.params?.symbol as string) || "";
    const binanceSym = (config.params?.binance_symbol as string) || "";
    const cgIds: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin" };
    const cgId = cgIds[sym];
    if (cgId) {
      try { const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`); if (r.ok) { const j = await r.json(); closePrice = j[cgId]?.usd || 0; } } catch { /* */ }
    }
    if (!closePrice && sym) {
      try { const r = await fetch(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`); if (r.ok) { const j = await r.json(); closePrice = parseFloat(j.data?.amount || "0"); } } catch { /* */ }
    }
    if (!closePrice && binanceSym?.includes("BRL")) {
      try { const r = await fetch(`https://economia.awesomeapi.com.br/json/last/USD-BRL`); if (r.ok) { const j = await r.json(); closePrice = parseFloat(j.USDBRL?.bid || "0"); } } catch { /* */ }
    }
    if (closePrice > 0) {
      const diff = closePrice - openPrice;
      winningKey = diff > 0 ? "UP" : diff < 0 ? "DOWN" : null;
      resolveReason = `${sym || binanceSym}: ${openPrice} → ${closePrice} (${diff > 0 ? "+" : ""}${diff.toFixed(4)})`;
      Object.assign(resolveSourceData, { open_price: openPrice, close_price: closePrice, diff });
    }
  } else if (config.market_type === "weather_threshold") {
    const owKey = process.env.OPENWEATHER_API_KEY;
    const cityId = config.params?.city_id as number;
    const threshold = config.params?.threshold as number;
    const operator = (config.params?.operator as string) || ">=";
    const metric = (config.params?.metric as string) || "temperature";
    if (owKey && cityId) {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?id=${cityId}&appid=${owKey}&units=metric`);
      if (r.ok) {
        const w = await r.json();
        const metricMap: Record<string, number> = { temperature: w.main?.temp, temp_max: w.main?.temp_max, humidity: w.main?.humidity };
        const value = metricMap[metric] ?? 0;
        const ops: Record<string, (a: number, b: number) => boolean> = { ">": (a,b)=>a>b, "<": (a,b)=>a<b, ">=": (a,b)=>a>=b, "<=": (a,b)=>a<=b };
        const result = (ops[operator] || ops[">="])(value, threshold);
        winningKey = result ? "YES" : "NO";
        resolveReason = `${metric}=${value.toFixed(1)} ${operator} ${threshold} => ${winningKey}`;
        Object.assign(resolveSourceData, { metric, value, threshold, operator });
      }
    }
  } else if (config.market_type === "stock_performance") {
    const symbols = config.params?.symbols as string[];
    if (symbols?.length) {
      const token = process.env.BRAPI_TOKEN || "";
      const url = token ? `https://brapi.dev/api/quote/${symbols.join(",")}?token=${token}` : `https://brapi.dev/api/quote/${symbols.join(",")}`;
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        if (symbols.length === 1) {
          const stock = j.results?.[0];
          if (stock) { winningKey = stock.regularMarketChangePercent > 0 ? "UP" : "DOWN"; resolveReason = `${stock.symbol}: ${stock.regularMarketChangePercent > 0 ? "+" : ""}${stock.regularMarketChangePercent?.toFixed(2)}%`; }
        } else {
          const sorted = [...(j.results || [])].sort((a: Record<string,number>, b: Record<string,number>) => (b.regularMarketChangePercent||0) - (a.regularMarketChangePercent||0));
          if (sorted[0]) { winningKey = (sorted[0].symbol as string).toUpperCase(); resolveReason = `${winningKey} liderou com ${(sorted[0].regularMarketChangePercent as number)?.toFixed(2)}%`; }
        }
      }
    }
  } else if (config.market_type === "sport_event") {
    const matchId = config.params?.match_id;
    const key = process.env.FOOTBALL_DATA_KEY;
    if (key && matchId) {
      const r = await fetch(`https://api.football-data.org/v4/matches/${matchId}`, { headers: { "X-Auth-Token": key } });
      if (r.ok) {
        const match = await r.json();
        if (match.status === "FINISHED") {
          const hg = match.score?.fullTime?.home ?? 0;
          const ag = match.score?.fullTime?.away ?? 0;
          if (config.params?.stat === "result") { winningKey = hg > ag ? "HOME" : hg < ag ? "AWAY" : "DRAW"; resolveReason = `${config.params?.home_team} ${hg} x ${ag} ${config.params?.away_team}`; }
          else if (config.params?.stat === "total_goals") { const th = parseInt(((config.params?.condition as string) || ">8").replace(/[^0-9]/g, "")); winningKey = hg + ag > th ? "YES" : "NO"; resolveReason = `Total gols: ${hg + ag} (threshold: ${th})`; }
          Object.assign(resolveSourceData, { home_goals: hg, away_goals: ag });
        }
      }
    }
  }

  if (!winningKey) {
    await supabase.from("prediction_markets").update({ status: "cancelled" }).eq("id", market.id);
    const { data: bets } = await supabase.from("prediction_bets").select("*").eq("market_id", market.id).eq("status", "pending");
    if (bets) {
      for (const bet of bets) {
        await supabase.from("prediction_bets").update({ status: "refunded", final_payout: bet.amount }).eq("id", bet.id);
        await supabase.rpc("increment_balance", { user_id_param: bet.user_id, amount_param: bet.amount });
      }
    }
    return { market_id: market.id, action: "cancelled", reason: resolveReason };
  }

  // Calculate payouts
  const outcomes = market.outcomes || [];
  const poolTotal = outcomes.reduce((s: number, o: { pool: number }) => s + (o.pool || 0), 0);
  const winnerPool = outcomes.find((o: { key: string }) => o.key.toUpperCase() === winningKey?.toUpperCase())?.pool || 0;
  const houseFee = poolTotal * (market.house_fee_percent || 0.05);
  const distributable = poolTotal - houseFee;
  const payoutPerUnit = winnerPool > 0 ? distributable / winnerPool : 0;

  await supabase.from("prediction_markets").update({
    status: "resolved", winning_outcome_key: winningKey,
    resolved_at: new Date().toISOString(), resolved_by: "auto_engine",
    resolution_evidence: JSON.stringify({ reason: resolveReason, source_data: resolveSourceData, resolved_at: new Date().toISOString() }),
  }).eq("id", market.id);

  const { data: bets } = await supabase.from("prediction_bets").select("*").eq("market_id", market.id).eq("status", "pending");
  if (bets) {
    for (const bet of bets) {
      const isWinner = bet.outcome_key.toUpperCase() === winningKey?.toUpperCase();
      const payout = isWinner ? bet.amount * payoutPerUnit : 0;
      await supabase.from("prediction_bets").update({ status: isWinner ? "won" : "lost", final_payout: payout }).eq("id", bet.id);
      // Update user stats (wins/losses/streaks/cashback) — non-blocking
      updateUserStats(supabase, bet.user_id, isWinner, payout, bet.amount);
      if (isWinner && payout > 0) {
        // Credit balance with retry on failure
        let credited = false;
        for (let attempt = 0; attempt < 3 && !credited; attempt++) {
          const { error: rpcErr } = await supabase.rpc("increment_balance", { user_id_param: bet.user_id, amount_param: payout });
          if (!rpcErr) { credited = true; } else if (attempt === 2) {
            console.error(`[settlement] CRITICAL: Failed to credit ${payout} to user ${bet.user_id} for bet ${bet.id} after 3 attempts:`, rpcErr.message);
            await supabase.from("prediction_bets").update({ status: "pending", final_payout: 0 }).eq("id", bet.id);
            continue;
          }
        }
        if (credited) {
          const { data: userRow } = await supabase.from("users").select("balance").eq("id", bet.user_id).maybeSingle();
          await supabase.from("ledger").insert({ user_id: bet.user_id, type: "bet_won", amount: payout, balance_after: Number(userRow?.balance ?? 0), reference_id: bet.id, description: `Auto: ${market.title} — ${bet.outcome_label} (${payoutPerUnit.toFixed(2)}x)` });
        }
      }
    }
  }

  try {
    const ch = supabase.channel(`market-${market.id}`);
    await ch.send({ type: "broadcast", event: "market.resolved", payload: { marketId: market.id, winningKey, payoutPerUnit, title: market.title, _ts: Date.now() } });
    await supabase.removeChannel(ch);
  } catch { /* non-blocking */ }

  return { market_id: market.id, title: market.title, action: "resolved", winning_key: winningKey, payout_per_unit: payoutPerUnit, total_bets: bets?.length || 0 };
}

// ---- Job Dispatcher: process scheduled market jobs ----

export async function processMarketJobs(): Promise<{
  processed: number;
  results: Record<string, unknown>[];
  errors: string[];
}> {
  const supabase = sb();
  const errors: string[] = [];
  const results: Record<string, unknown>[] = [];
  const nowISO = new Date().toISOString();

  const { data: jobs } = await supabase
    .from("market_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("execute_at", nowISO)
    .order("execute_at", { ascending: true })
    .limit(50);

  if (!jobs || jobs.length === 0) {
    return { processed: 0, results: [], errors: [] };
  }

  for (const job of jobs) {
    await supabase.from("market_jobs").update({ status: "processing", attempts: job.attempts + 1 }).eq("id", job.id);

    try {
      if (job.market_type === "prediction") {
        const { data: market } = await supabase.from("prediction_markets").select("*").eq("id", job.market_id).single();
        if (!market) throw new Error(`Market ${job.market_id} not found`);

        if (job.job_type === "close") {
          if (["open", "frozen"].includes(market.status)) {
            await supabase.from("prediction_markets").update({ status: "closed" }).eq("id", market.id);
            try { const ch = supabase.channel(`market-${market.id}`); await ch.send({ type: "broadcast", event: "market.closed", payload: { marketId: market.id, title: market.title, _ts: Date.now() } }); await supabase.removeChannel(ch); } catch { /* */ }
          }
        } else if (job.job_type === "resolve") {
          if (["resolved", "cancelled"].includes(market.status)) { /* already done */ }
          else if (market.resolution_type === "manual" || market.resolution_type === "semi_automatic") {
            if (["open", "frozen"].includes(market.status)) await supabase.from("prediction_markets").update({ status: "closed" }).eq("id", market.id);
            await supabase.from("prediction_markets").update({ status: "awaiting_resolution" }).eq("id", market.id);
          } else {
            if (["open", "frozen"].includes(market.status)) await supabase.from("prediction_markets").update({ status: "closed" }).eq("id", market.id);
            await resolveOneMarket(supabase, { ...market, status: "closed" });
          }
        }
      } else if (job.market_type === "camera" && job.job_type === "resolve") {
        const { data: round } = await supabase.from("camera_rounds").select("*").eq("id", job.market_id).single();
        if (round && !round.resolved_at) {
          const finalCount = round.final_count || 0;
          const threshold = round.threshold || 0;
          const result = finalCount > threshold ? "over" : "under";
          const { data: predictions } = await supabase.from("camera_predictions").select("*").eq("round_id", round.id).eq("status", "open");
          if (!predictions || predictions.length === 0) {
            await supabase.from("camera_rounds").update({ resolved_at: nowISO }).eq("id", round.id);
          } else {
            const totalPool = Number(round.total_pool) || predictions.reduce((sum: number, p: { amount_brl: number }) => sum + Number(p.amount_brl), 0);
            const winningPool = predictions.filter((p: { prediction_type: string }) => p.prediction_type === result).reduce((sum: number, p: { amount_brl: number }) => sum + Number(p.amount_brl), 0);
            const distributable = totalPool * 0.95;
            const payoutMultiplier = winningPool > 0 ? distributable / winningPool : 0;
            for (const pred of predictions) {
              const isWinner = pred.prediction_type === result;
              const payout = isWinner ? Number(pred.amount_brl) * payoutMultiplier : 0;
              await supabase.from("camera_predictions").update({ status: isWinner ? "won" : "lost", payout: isWinner ? payout : 0 }).eq("id", pred.id);
              updateUserStats(supabase, pred.user_id, isWinner, payout, Number(pred.amount_brl));
              if (isWinner && payout > 0) {
                let credited = false;
                for (let attempt = 0; attempt < 3 && !credited; attempt++) {
                  const { error: rpcErr } = await supabase.rpc("increment_balance", { user_id_param: pred.user_id, amount_param: payout });
                  if (!rpcErr) { credited = true; } else if (attempt === 2) {
                    console.error(`[camera-job] CRITICAL: Failed to credit ${payout} to user ${pred.user_id} for pred ${pred.id}:`, rpcErr.message);
                    await supabase.from("camera_predictions").update({ status: "open", payout: 0 }).eq("id", pred.id);
                  }
                }
                if (credited) {
                  const { data: userRow } = await supabase.from("users").select("balance").eq("id", pred.user_id).maybeSingle();
                  await supabase.from("ledger").insert({
                    id: `ldg_camjob_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    user_id: pred.user_id, type: "bet_won", amount: payout,
                    balance_after: Number(userRow?.balance ?? 0), reference_id: pred.id,
                    description: `Camera ${result.toUpperCase()}: ${finalCount} veiculos (threshold ${threshold}) ${payoutMultiplier.toFixed(2)}x`,
                  });
                }
              }
            }
            await supabase.from("camera_rounds").update({ resolved_at: nowISO, final_count: finalCount }).eq("id", round.id);
          }
        }
      }

      await supabase.from("market_jobs").update({ status: "done", completed_at: nowISO }).eq("id", job.id);
      results.push({ job_id: job.id, market_id: job.market_id, job_type: job.job_type, action: "done" });
    } catch (err) {
      const errMsg = String(err);
      const totalAttempts = (job.attempts || 0) + 1;
      const maxAttempts = job.max_attempts || 5;
      const newStatus = totalAttempts >= maxAttempts ? "failed" : "pending";
      // Exponential backoff: delay next retry by 2^attempts minutes (capped at 30min)
      const backoffMinutes = Math.min(Math.pow(2, totalAttempts), 30);
      const nextExecuteAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();
      await supabase.from("market_jobs").update({
        status: newStatus, last_error: errMsg,
        ...(newStatus === "pending" ? { execute_at: nextExecuteAt } : {}),
      }).eq("id", job.id);
      if (newStatus === "failed") console.error(`[jobs] FAILED permanently after ${totalAttempts} attempts: job ${job.id} market ${job.market_id}`);
      errors.push(`job_${job.id}: ${errMsg}`);
    }
  }

  return { processed: results.length, results, errors };
}
