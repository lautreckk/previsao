// ============================================================
// WINIFY DATA PROVIDER API - Shared Types
// ============================================================

// -- Price Data --
export interface PriceData {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change_24h: number;
  change_percent_24h: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
  market_cap?: number;
  source: string;
  updated_at: string;
}

export interface PriceSnapshot {
  symbol: string;
  price: number;
  timestamp: string;
}

// -- Weather Data --
export interface WeatherData {
  city: string;
  state: string;
  country: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  description: string;
  icon: string;
  wind_speed: number;
  temp_min: number;
  temp_max: number;
  sunrise: string;
  sunset: string;
  source: string;
  updated_at: string;
}

export interface WeatherForecast {
  city: string;
  date: string;
  temp_min: number;
  temp_max: number;
  description: string;
  rain_probability: number;
  rain_mm: number;
}

// -- Stock Data --
export interface StockData {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change: number;
  change_percent: number;
  open: number;
  high: number;
  low: number;
  close_previous: number;
  volume: number;
  market_cap?: number;
  sector?: string;
  source: string;
  updated_at: string;
}

// -- Sports Data --
export interface SportMatch {
  id: string;
  league: string;
  league_id: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "live" | "halftime" | "finished" | "postponed" | "cancelled";
  start_time: string;
  minute?: number;
  stats?: MatchStats;
  source: string;
  updated_at: string;
}

export interface MatchStats {
  home_corners: number;
  away_corners: number;
  home_fouls: number;
  away_fouls: number;
  home_yellow_cards: number;
  away_yellow_cards: number;
  home_red_cards: number;
  away_red_cards: number;
  home_shots: number;
  away_shots: number;
  home_shots_on_target: number;
  away_shots_on_target: number;
  home_possession: number;
  away_possession: number;
}

// -- Resolution Data --
export interface ResolutionRequest {
  market_id: string;
  market_type: "crypto_up_down" | "weather_threshold" | "stock_performance" | "sport_event" | "custom";
  params: Record<string, unknown>;
}

export interface ResolutionResult {
  market_id: string;
  resolved: boolean;
  winning_outcome_key: string | null;
  source_data: Record<string, unknown>;
  reason: string;
  resolved_at: string;
}

// -- Provider Config --
export interface ProviderConfig {
  name: string;
  base_url: string;
  api_key_env: string;
  rate_limit_per_minute: number;
  cache_ttl_seconds: number;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  binance: {
    name: "Binance",
    base_url: "https://api.binance.com/api/v3",
    api_key_env: "", // Public API, no key needed
    rate_limit_per_minute: 1200,
    cache_ttl_seconds: 5,
  },
  coingecko: {
    name: "CoinGecko",
    base_url: "https://api.coingecko.com/api/v3",
    api_key_env: "COINGECKO_API_KEY",
    rate_limit_per_minute: 30,
    cache_ttl_seconds: 60,
  },
  openweather: {
    name: "OpenWeatherMap",
    base_url: "https://api.openweathermap.org/data/2.5",
    api_key_env: "OPENWEATHER_API_KEY",
    rate_limit_per_minute: 60,
    cache_ttl_seconds: 300,
  },
  brapi: {
    name: "brapi.dev",
    base_url: "https://brapi.dev/api",
    api_key_env: "BRAPI_TOKEN",
    rate_limit_per_minute: 60,
    cache_ttl_seconds: 60,
  },
  api_football: {
    name: "API-Football",
    base_url: "https://v3.football.api-sports.io",
    api_key_env: "API_FOOTBALL_KEY",
    rate_limit_per_minute: 30,
    cache_ttl_seconds: 30,
  },
};
