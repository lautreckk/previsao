export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { apiSuccess, apiError, validateApiKey } from "../_lib/auth";
import { cached } from "../_lib/cache";
import type { WeatherData, WeatherForecast } from "../_lib/types";

// Pre-configured Brazilian cities with OpenWeather IDs
const CITIES: Record<string, { id: number; state: string; lat: number; lon: number }> = {
  "sao-paulo": { id: 3448439, state: "SP", lat: -23.55, lon: -46.63 },
  "rio-de-janeiro": { id: 3451190, state: "RJ", lat: -22.91, lon: -43.17 },
  "brasilia": { id: 3469058, state: "DF", lat: -15.78, lon: -47.93 },
  "belo-horizonte": { id: 3470127, state: "MG", lat: -19.92, lon: -43.94 },
  "curitiba": { id: 3464975, state: "PR", lat: -25.43, lon: -49.27 },
  "porto-alegre": { id: 3452925, state: "RS", lat: -30.03, lon: -51.23 },
  "salvador": { id: 3450554, state: "BA", lat: -12.97, lon: -38.51 },
  "fortaleza": { id: 3399415, state: "CE", lat: -3.72, lon: -38.52 },
  "recife": { id: 3390760, state: "PE", lat: -8.05, lon: -34.87 },
  "manaus": { id: 3663517, state: "AM", lat: -3.12, lon: -60.02 },
  "florianopolis": { id: 3463237, state: "SC", lat: -27.60, lon: -48.55 },
  "goiania": { id: 3462377, state: "GO", lat: -16.68, lon: -49.25 },
  "belem": { id: 3405870, state: "PA", lat: -1.46, lon: -48.50 },
  "campinas": { id: 3467865, state: "SP", lat: -22.91, lon: -47.06 },
  "vitoria": { id: 3445781, state: "ES", lat: -20.32, lon: -40.34 },
};

const OW_KEY = () => process.env.OPENWEATHER_API_KEY || "";

async function fetchCurrentWeather(city: string, config: typeof CITIES[string]): Promise<WeatherData> {
  const key = OW_KEY();
  if (!key) throw new Error("OPENWEATHER_API_KEY not configured");

  const url = `https://api.openweathermap.org/data/2.5/weather?id=${config.id}&appid=${key}&units=metric&lang=pt_br`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeather error: ${res.status} ${await res.text()}`);
  const d = await res.json();

  return {
    city: d.name,
    state: config.state,
    country: "BR",
    temperature: Math.round(d.main.temp * 10) / 10,
    feels_like: Math.round(d.main.feels_like * 10) / 10,
    humidity: d.main.humidity,
    description: d.weather[0]?.description || "",
    icon: d.weather[0]?.icon || "",
    wind_speed: d.wind?.speed || 0,
    temp_min: Math.round(d.main.temp_min * 10) / 10,
    temp_max: Math.round(d.main.temp_max * 10) / 10,
    sunrise: new Date(d.sys.sunrise * 1000).toISOString(),
    sunset: new Date(d.sys.sunset * 1000).toISOString(),
    source: "openweathermap",
    updated_at: new Date().toISOString(),
  };
}

async function fetchForecast(config: typeof CITIES[string]): Promise<WeatherForecast[]> {
  const key = OW_KEY();
  if (!key) throw new Error("OPENWEATHER_API_KEY not configured");

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${config.lat}&lon=${config.lon}&appid=${key}&units=metric&lang=pt_br`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeather forecast error: ${res.status}`);
  const d = await res.json();

  // Group by day
  const days = new Map<string, { temps: number[]; descs: string[]; rain: number }>();
  for (const item of d.list) {
    const date = item.dt_txt.split(" ")[0];
    if (!days.has(date)) days.set(date, { temps: [], descs: [], rain: 0 });
    const day = days.get(date)!;
    day.temps.push(item.main.temp);
    day.descs.push(item.weather[0]?.description || "");
    day.rain += item.rain?.["3h"] || 0;
  }

  return Array.from(days.entries()).slice(0, 5).map(([date, day]) => ({
    city: d.city.name,
    date,
    temp_min: Math.round(Math.min(...day.temps) * 10) / 10,
    temp_max: Math.round(Math.max(...day.temps) * 10) / 10,
    description: day.descs[Math.floor(day.descs.length / 2)],
    rain_probability: day.rain > 0 ? Math.min(100, Math.round(day.rain * 10)) : 0,
    rain_mm: Math.round(day.rain * 10) / 10,
  }));
}

/**
 * GET /api/v1/weather
 *
 * Query params:
 *   city     - slug (default: sao-paulo). Use "all" for all cities
 *   forecast - "true" to include 5-day forecast (default: false)
 *
 * Example: /api/v1/weather?city=rio-de-janeiro&forecast=true
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return apiError(auth.error!, 401, "UNAUTHORIZED");

  const { searchParams } = new URL(request.url);
  const cityParam = searchParams.get("city") || "sao-paulo";
  const includeForecast = searchParams.get("forecast") === "true";

  if (!OW_KEY()) {
    return apiError("OPENWEATHER_API_KEY not configured. Get a free key at openweathermap.org", 503, "PROVIDER_NOT_CONFIGURED");
  }

  try {
    if (cityParam === "all") {
      // Return current weather for all cities
      const results = await Promise.all(
        Object.entries(CITIES).map(async ([slug, config]) => {
          const { data, cached: wasCached } = await cached(`weather_${slug}`, 300, () =>
            fetchCurrentWeather(slug, config)
          );
          return { ...data, slug, _cached: wasCached };
        })
      );
      return apiSuccess(results, { available_cities: Object.keys(CITIES) });
    }

    const config = CITIES[cityParam];
    if (!config) {
      return apiError(
        `Unknown city: ${cityParam}. Available: ${Object.keys(CITIES).join(", ")}`,
        400
      );
    }

    const { data: current, cached: wasCached } = await cached(
      `weather_${cityParam}`,
      300, // 5min cache
      () => fetchCurrentWeather(cityParam, config)
    );

    let forecast: WeatherForecast[] | undefined;
    if (includeForecast) {
      const { data: fc } = await cached(`weather_forecast_${cityParam}`, 1800, () =>
        fetchForecast(config)
      );
      forecast = fc;
    }

    return apiSuccess(
      { current, forecast },
      { city_slug: cityParam, _cached: wasCached, available_cities: Object.keys(CITIES) }
    );
  } catch (err) {
    return apiError(`Weather fetch failed: ${err}`, 502, "UPSTREAM_ERROR");
  }
}
