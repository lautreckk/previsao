// ============================================================
// WINIFY - AUTO MARKET ENGINE
// Creates real markets with real data and resolves automatically
// ============================================================

import { createClient } from "@supabase/supabase-js";

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
}

// ---- Crypto Price Helpers (CoinGecko + AwesomeAPI, no Binance) ----

async function getCryptoPrice(cgId: string): Promise<number> {
  // CoinGecko (global, no region block)
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`);
    if (res.ok) {
      const d = await res.json();
      return d[cgId]?.usd || 0;
    }
  } catch { /* fall through */ }
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

const CITIES: Record<string, { id: number; name: string; state: string }> = {
  sp: { id: 3448439, name: "Sao Paulo", state: "SP" },
  rj: { id: 3451190, name: "Rio de Janeiro", state: "RJ" },
  bh: { id: 3470127, name: "Belo Horizonte", state: "MG" },
  ctb: { id: 3464975, name: "Curitiba", state: "PR" },
  bsb: { id: 3469058, name: "Brasilia", state: "DF" },
  poa: { id: 3452925, name: "Porto Alegre", state: "RS" },
  ssa: { id: 3450554, name: "Salvador", state: "BA" },
  for: { id: 3399415, name: "Fortaleza", state: "CE" },
  fln: { id: 3463237, name: "Florianopolis", state: "SC" },
  rec: { id: 3390760, name: "Recife", state: "PE" },
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
          { key: "YES", label: "Sim", color: "#00FFB8" },
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
          { key: "UP", label: "Sobe", color: "#00FFB8" },
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
          { key: "UP", label: "Sobe", color: "#00FFB8" },
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
          { key: "UP", label: "Sobe", color: "#00FFB8" },
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
          { key: "YES", label: `Sim, acima`, color: "#00FFB8" },
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
          { key: "UP", label: "Sobe", color: "#00FFB8" },
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
          { key: "NO", label: `Nao, abaixo`, color: "#00FFB8" },
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
          { key: "DOWN", label: "Desce na semana", color: "#00FFB8" },
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
          { key: "UP", label: "Fecha em alta", color: "#00FFB8" },
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
          { key: "PETR4", label: "PETR4", color: "#00FFB8" },
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
          { key: "HOME", label: home, color: "#00FFB8" },
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
            { key: "YES", label: "Mais de 8 gols", color: "#00FFB8" },
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

  // Insert into prediction_markets
  const supabase = sb();
  const created: Record<string, unknown>[] = [];

  for (const tmpl of allTemplates) {
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
        banner_url: "", // Image will be generated separately if FAL_KEY exists
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

      const { data, error } = await supabase.from("prediction_markets").insert(row).select().single();
      if (error) {
        errors.push(`insert_${tmpl.id}: ${error.message}`);
      } else {
        created.push(data);
      }
    } catch (err) {
      errors.push(`create_${tmpl.id}: ${err}`);
    }
  }

  return { created: created.length, markets: created, errors };
}

// ---- Auto-Resolve: Resolve markets that have closed ----

export async function resolveExpiredMarkets(): Promise<{
  resolved: number;
  results: Record<string, unknown>[];
  errors: string[];
}> {
  const supabase = sb();
  const errors: string[] = [];
  const results: Record<string, unknown>[] = [];

  // Find markets that are past close_at and still "open"
  const { data: expired } = await supabase
    .from("prediction_markets")
    .select("*")
    .eq("status", "open")
    .eq("resolution_type", "automatic")
    .lt("close_at", new Date().toISOString())
    .limit(20);

  if (!expired || expired.length === 0) {
    return { resolved: 0, results: [], errors: [] };
  }

  for (const market of expired) {
    try {
      const config = market.source_config?.custom_params;
      if (!config) {
        errors.push(`${market.id}: no resolution_config`);
        continue;
      }

      // Call the resolve API
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.WEBHOOK_BASE_URL || "http://localhost:3000";

      const res = await fetch(`${baseUrl}/api/v1/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.CRON_SECRET || process.env.ADMIN_SECRET || "",
        },
        body: JSON.stringify({
          market_id: market.id,
          market_type: config.market_type,
          params: config.params,
        }),
      });

      const resolution = await res.json();
      const winningKey = resolution.data?.winning_outcome_key;

      if (!winningKey) {
        // Anulado — refund all
        await supabase.from("prediction_markets").update({ status: "cancelled" }).eq("id", market.id);
        // Refund bets
        const { data: bets } = await supabase
          .from("prediction_bets")
          .select("*")
          .eq("market_id", market.id)
          .eq("status", "pending");

        if (bets) {
          for (const bet of bets) {
            await supabase.from("prediction_bets").update({ status: "refunded", final_payout: bet.amount }).eq("id", bet.id);
            await supabase.rpc("increment_balance", { user_id_param: bet.user_id, amount_param: bet.amount });
          }
        }
        results.push({ market_id: market.id, action: "cancelled", reason: resolution.data?.reason });
        continue;
      }

      // Calculate payouts
      const outcomes = market.outcomes || [];
      const poolTotal = outcomes.reduce((s: number, o: { pool: number }) => s + (o.pool || 0), 0);
      const winnerPool = outcomes.find((o: { key: string }) => o.key === winningKey)?.pool || 0;
      const houseFee = poolTotal * (market.house_fee_percent || 0.05);
      const distributable = poolTotal - houseFee;
      const payoutPerUnit = winnerPool > 0 ? distributable / winnerPool : 0;

      // Update market
      await supabase.from("prediction_markets").update({
        status: "resolved",
        winning_outcome_key: winningKey,
        resolved_at: new Date().toISOString(),
        resolved_by: "auto_engine",
      }).eq("id", market.id);

      // Pay winners
      const { data: bets } = await supabase
        .from("prediction_bets")
        .select("*")
        .eq("market_id", market.id)
        .eq("status", "pending");

      if (bets) {
        for (const bet of bets) {
          const isWinner = bet.outcome_key === winningKey;
          const payout = isWinner ? bet.amount * payoutPerUnit : 0;

          await supabase.from("prediction_bets").update({
            status: isWinner ? "won" : "lost",
            final_payout: payout,
          }).eq("id", bet.id);

          if (isWinner && payout > 0) {
            await supabase.rpc("increment_balance", { user_id_param: bet.user_id, amount_param: payout });
            await supabase.from("ledger").insert({
              user_id: bet.user_id,
              type: "bet_won",
              amount: payout,
              balance_after: 0,
              reference_id: bet.id,
              description: `Auto: ${market.title} — ${bet.outcome_label} (${payoutPerUnit.toFixed(2)}x)`,
            });
          }
        }
      }

      // Broadcast market resolved via Supabase Realtime
      try {
        const broadcastChannel = supabase.channel(`market-${market.id}`);
        await broadcastChannel.send({
          type: "broadcast",
          event: "market.resolved",
          payload: {
            marketId: market.id,
            winningKey,
            payoutPerUnit,
            title: market.title,
            _ts: Date.now(),
          },
        });
        await supabase.removeChannel(broadcastChannel);
      } catch (broadcastErr) {
        // Non-blocking: log but don't fail the resolution
        console.error("[auto-markets] Broadcast error:", broadcastErr);
      }

      results.push({
        market_id: market.id,
        title: market.title,
        action: "resolved",
        winning_key: winningKey,
        payout_per_unit: payoutPerUnit,
        total_bets: bets?.length || 0,
        source_data: resolution.data?.source_data,
      });
    } catch (err) {
      errors.push(`resolve_${market.id}: ${err}`);
    }
  }

  return { resolved: results.length, results, errors };
}
