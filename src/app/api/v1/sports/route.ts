export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { apiSuccess, apiError, validateApiKey } from "../_lib/auth";
import { cached } from "../_lib/cache";
import type { SportMatch } from "../_lib/types";

// football-data.org league codes (free tier)
const LEAGUES: Record<string, { code: string; name: string; country: string }> = {
  brasileirao_a: { code: "BSA", name: "Brasileirao Serie A", country: "Brazil" },
  brasileirao_b: { code: "BSB", name: "Brasileirao Serie B", country: "Brazil" },
  premier_league: { code: "PL", name: "Premier League", country: "England" },
  la_liga: { code: "PD", name: "La Liga", country: "Spain" },
  serie_a_ita: { code: "SA", name: "Serie A", country: "Italy" },
  bundesliga: { code: "BL1", name: "Bundesliga", country: "Germany" },
  ligue_1: { code: "FL1", name: "Ligue 1", country: "France" },
  champions_league: { code: "CL", name: "UEFA Champions League", country: "Europe" },
  copa_libertadores: { code: "CLI", name: "Copa Libertadores", country: "South America" },
  world_cup: { code: "WC", name: "FIFA World Cup", country: "World" },
};

function mapStatus(s: string): SportMatch["status"] {
  const map: Record<string, SportMatch["status"]> = {
    SCHEDULED: "scheduled", TIMED: "scheduled", IN_PLAY: "live",
    PAUSED: "halftime", FINISHED: "finished", POSTPONED: "postponed",
    CANCELLED: "cancelled", SUSPENDED: "live", AWARDED: "finished",
  };
  return map[s] || "scheduled";
}

// Primary: football-data.org (free, 10 req/min)
async function fetchFootballDataOrg(leagueCode: string, date?: string): Promise<SportMatch[]> {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key) throw new Error("FOOTBALL_DATA_KEY not configured");

  let url = `https://api.football-data.org/v4/competitions/${leagueCode}/matches?status=SCHEDULED,LIVE,IN_PLAY,PAUSED,FINISHED`;
  if (date) {
    url = `https://api.football-data.org/v4/competitions/${leagueCode}/matches?dateFrom=${date}&dateTo=${date}`;
  }

  const res = await fetch(url, { headers: { "X-Auth-Token": key } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`football-data.org error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (!json.matches) return [];

  return json.matches.map((m: Record<string, unknown>) => {
    const homeTeam = m.homeTeam as Record<string, string>;
    const awayTeam = m.awayTeam as Record<string, string>;
    const score = m.score as Record<string, Record<string, number | null>>;
    const fullTime = score?.fullTime || {};
    const competition = m.competition as Record<string, unknown>;

    return {
      id: String(m.id),
      league: (competition?.name || leagueCode) as string,
      league_id: (competition?.id || 0) as number,
      home_team: homeTeam?.name || homeTeam?.shortName || "Home",
      away_team: awayTeam?.name || awayTeam?.shortName || "Away",
      home_score: fullTime?.home ?? null,
      away_score: fullTime?.away ?? null,
      status: mapStatus(m.status as string),
      start_time: m.utcDate as string,
      minute: (m.minute as number) || undefined,
      source: "football-data.org",
      updated_at: new Date().toISOString(),
    } as SportMatch;
  });
}

// Fallback: TheSportsDB (100% free, no key needed)
async function fetchTheSportsDB(leagueCode: string): Promise<SportMatch[]> {
  // TheSportsDB league IDs
  const sportsDbIds: Record<string, string> = {
    BSA: "4351", PL: "4328", PD: "4335", SA: "4332",
    BL1: "4331", FL1: "4334", CL: "4480",
  };

  const leagueId = sportsDbIds[leagueCode];
  if (!leagueId) return [];

  const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=${leagueId}&r=38&s=2025-2026`);
  if (!res.ok) return [];

  const json = await res.json();
  if (!json.events) return [];

  return json.events.slice(0, 20).map((e: Record<string, string | null>) => ({
    id: e.idEvent || "",
    league: e.strLeague || "",
    league_id: parseInt(leagueId),
    home_team: e.strHomeTeam || "",
    away_team: e.strAwayTeam || "",
    home_score: e.intHomeScore ? parseInt(e.intHomeScore) : null,
    away_score: e.intAwayScore ? parseInt(e.intAwayScore) : null,
    status: e.intHomeScore !== null ? "finished" : "scheduled",
    start_time: e.dateEvent ? `${e.dateEvent}T${e.strTime || "00:00:00"}Z` : "",
    source: "thesportsdb",
    updated_at: new Date().toISOString(),
  } as SportMatch));
}

/**
 * GET /api/v1/sports
 *
 * Query params:
 *   league - slug (default: brasileirao_a)
 *   date   - YYYY-MM-DD (default: today)
 *
 * Example: /api/v1/sports?league=brasileirao_a
 * Example: /api/v1/sports?league=premier_league&date=2026-03-31
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return apiError(auth.error!, 401, "UNAUTHORIZED");

  const { searchParams } = new URL(request.url);
  const leagueParam = searchParams.get("league") || "brasileirao_a";
  const date = searchParams.get("date") || undefined;

  const league = LEAGUES[leagueParam];
  if (!league) {
    return apiError(`Unknown league: ${leagueParam}. Available: ${Object.keys(LEAGUES).join(", ")}`, 400);
  }

  try {
    const cacheKey = `sports_${leagueParam}_${date || "current"}`;
    const { data, cached: wasCached } = await cached(cacheKey, 120, async () => {
      // Try football-data.org first
      if (process.env.FOOTBALL_DATA_KEY) {
        try {
          return await fetchFootballDataOrg(league.code, date);
        } catch (err) {
          console.warn(`[sports] football-data.org failed, trying fallback: ${err}`);
        }
      }
      // Fallback to TheSportsDB (free, no key)
      return fetchTheSportsDB(league.code);
    });

    return apiSuccess(data, {
      league: league.name,
      _cached: wasCached,
      available_leagues: Object.keys(LEAGUES),
      source: data[0]?.source || "none",
    });
  } catch (err) {
    return apiError(`Sports fetch failed: ${err}`, 502, "UPSTREAM_ERROR");
  }
}
