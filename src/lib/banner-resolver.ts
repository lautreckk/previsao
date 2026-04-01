// ============================================================
// Banner Resolver - 3-tier fallback chain for market banners
// Tier 1: Entity Map lookup (static known entities)
// Tier 2: Wikipedia PT/EN API (dynamic entity photos)
// Tier 3: FAL.ai generation (AI-generated banners)
// ============================================================

import { ENTITY_MAP } from "./entity-map";

export interface BannerContext {
  title: string;
  category: string;
  image_prompt: string;
  entities?: string[];
  lat?: number;
  lon?: number;
}

// Module-level cache for Wikipedia results
const wikiCache = new Map<string, string>();

// Common Portuguese words to skip when extracting capitalized entity names
const PT_STOP_WORDS = new Set([
  "O", "A", "Os", "As", "Um", "Uma", "De", "Do", "Da", "Dos", "Das",
  "Em", "No", "Na", "Nos", "Nas", "Por", "Para", "Com", "Sem", "Sob",
  "Que", "Se", "Ou", "E", "Mais", "Menos", "Muito", "Vai", "Ser",
  "Qual", "Como", "Quando", "Onde", "Quem", "Pode", "Deve", "Tem",
  "Este", "Esta", "Esse", "Essa", "Aquele", "Aquela", "Ele", "Ela",
  "Seu", "Sua", "Novo", "Nova", "Sobre", "Ate", "Entre", "Antes",
  "Depois", "Ainda", "Mesmo", "Cada", "Todo", "Toda", "Dia", "Ano",
]);

// Categories that skip Tier 1 & 2
const WEATHER_CATEGORIES = new Set(["weather"]);
// Categories that skip Tier 2 (Wikipedia)
const ENTITY_ONLY_CATEGORIES = new Set(["crypto", "economy"]);

// City coordinates for weather Mapbox fallback (extracted from title)
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  "sao paulo": { lat: -23.5505, lon: -46.6333 },
  "rio de janeiro": { lat: -22.9068, lon: -43.1729 },
  "belo horizonte": { lat: -19.9167, lon: -43.9345 },
  "curitiba": { lat: -25.4284, lon: -49.2733 },
  "brasilia": { lat: -15.7975, lon: -47.8919 },
  "porto alegre": { lat: -30.0346, lon: -51.2177 },
  "salvador": { lat: -12.9714, lon: -38.5124 },
  "fortaleza": { lat: -3.7172, lon: -38.5433 },
  "florianopolis": { lat: -27.5954, lon: -48.5480 },
  "recife": { lat: -8.0476, lon: -34.8770 },
  "sul do brasil": { lat: -27.0, lon: -49.5 },
  "sp": { lat: -23.5505, lon: -46.6333 },
  "rj": { lat: -22.9068, lon: -43.1729 },
  "bh": { lat: -19.9167, lon: -43.9345 },
};

/**
 * Generate a Mapbox Static Images URL for weather markets
 */
function resolveMapboxUrl(ctx: BannerContext): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  // Use explicit coords if provided
  let lat = ctx.lat;
  let lon = ctx.lon;

  // Otherwise, try to extract city from title
  if (lat == null || lon == null) {
    const normalizedTitle = normalize(ctx.title);
    for (const [city, coords] of Object.entries(CITY_COORDS)) {
      if (normalizedTitle.includes(normalize(city))) {
        lat = coords.lat;
        lon = coords.lon;
        break;
      }
    }
  }

  if (lat == null || lon == null) return null;

  // Mapbox Static Images API - dark style with weather-friendly look
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${lon},${lat},9,0/800x450?access_token=${token}`;
}

/**
 * Normalize text: lowercase, remove accents/diacritics
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ---- Tier 1: Entity Map Lookup ----

function resolveFromEntityMap(ctx: BannerContext): string | null {
  const normalizedTitle = normalize(ctx.title);

  for (const [, entity] of Object.entries(ENTITY_MAP)) {
    const aliases: string[] = entity.aliases ?? [entity.name];
    for (const alias of aliases) {
      if (normalizedTitle.includes(normalize(alias))) {
        return entity.image_url;
      }
    }
  }

  // Also check provided entities array
  if (ctx.entities?.length) {
    for (const e of ctx.entities) {
      const normalizedEntity = normalize(e);
      for (const [, entity] of Object.entries(ENTITY_MAP)) {
        const aliases: string[] = entity.aliases ?? [entity.name];
        for (const alias of aliases) {
          if (normalizedEntity.includes(normalize(alias)) || normalize(alias).includes(normalizedEntity)) {
            return entity.image_url;
          }
        }
      }
    }
  }

  return null;
}

// ---- Tier 2: Wikipedia API ----

/**
 * Extract potential entity names from a market title using heuristics
 */
function extractEntityNames(title: string): string[] {
  const names: string[] = [];

  // Pattern: "X marca/ganha/perde/..." - entity before a verb
  const verbPattern = /([\w\s]+)\s*(?:marca|ganha|perde|sai|vence|atinge|faz|será|sera|entra|vai)/i;
  const verbMatch = title.match(verbPattern);
  if (verbMatch) {
    names.push(verbMatch[1].trim());
  }

  // Pattern: "X vs/x/contra Y" - both sides of a matchup
  const vsPattern = /([\w\s]+)\s*(?:vs|x|contra)\s*([\w\s]+)/i;
  const vsMatch = title.match(vsPattern);
  if (vsMatch) {
    names.push(vsMatch[1].trim());
    names.push(vsMatch[2].trim());
  }

  // Pattern: "BBB123: Name"
  const bbbPattern = /BBB\d*:\s*([\w\s]+)/i;
  const bbbMatch = title.match(bbbPattern);
  if (bbbMatch) {
    names.push(bbbMatch[1].trim());
  }

  // Capitalized words filter: keep words starting uppercase, skip common PT words
  const words = title.split(/\s+/);
  const capitalizedSequence: string[] = [];
  for (const word of words) {
    const clean = word.replace(/[^a-zA-ZÀ-ÿ]/g, "");
    if (clean.length > 1 && /^[A-ZÀ-Ý]/.test(clean) && !PT_STOP_WORDS.has(clean)) {
      capitalizedSequence.push(clean);
    } else {
      if (capitalizedSequence.length >= 2) {
        names.push(capitalizedSequence.join(" "));
      }
      capitalizedSequence.length = 0;
    }
  }
  if (capitalizedSequence.length >= 2) {
    names.push(capitalizedSequence.join(" "));
  }

  // Deduplicate and filter out very short names
  const unique = [...new Set(names)].filter((n) => n.length > 2);
  return unique;
}

/**
 * Try fetching a thumbnail from Wikipedia (PT first, then EN fallback)
 */
async function resolveFromWikipedia(ctx: BannerContext): Promise<string | null> {
  const names = extractEntityNames(ctx.title);

  // Also add entities from context if provided
  if (ctx.entities?.length) {
    for (const e of ctx.entities) {
      if (e.length > 2 && !names.includes(e)) {
        names.push(e);
      }
    }
  }

  for (const name of names) {
    // Check cache first
    const cacheKey = normalize(name);
    if (wikiCache.has(cacheKey)) {
      const cached = wikiCache.get(cacheKey)!;
      if (cached) return cached;
      continue; // cached empty = already tried, no result
    }

    // Try PT Wikipedia
    const ptUrl = await fetchWikiThumbnail(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`);
    if (ptUrl) {
      wikiCache.set(cacheKey, ptUrl);
      return ptUrl;
    }

    // Try EN Wikipedia as fallback
    const enUrl = await fetchWikiThumbnail(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`);
    if (enUrl) {
      wikiCache.set(cacheKey, enUrl);
      return enUrl;
    }

    // Cache the miss
    wikiCache.set(cacheKey, "");
  }

  return null;
}

async function fetchWikiThumbnail(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    return data.thumbnail?.source || null;
  } catch {
    return null;
  }
}

// ---- Tier 3: FAL.ai Generation ----

async function generateWithFal(prompt: string): Promise<string> {
  const falKey = process.env.FAL_KEY;
  if (!falKey || !prompt) return "";

  try {
    const res = await fetch("https://queue.fal.run/fal-ai/nano-banana-2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${falKey}`,
      },
      body: JSON.stringify({
        prompt: `${prompt}. Dark moody cinematic style, vibrant neon accents, suitable for prediction market banner, 16:9 aspect ratio`,
        num_images: 1,
        aspect_ratio: "16:9",
        output_format: "jpeg",
        resolution: "1K",
        safety_tolerance: "4",
      }),
    });

    if (!res.ok) {
      console.error("[banner-resolver/fal] Error:", await res.text());
      return "";
    }

    const data = await res.json();

    if (data.request_id) {
      return await pollFalResult(data.request_id, falKey);
    }

    // Direct result (sync mode)
    return data.images?.[0]?.url || "";
  } catch (err) {
    console.error("[banner-resolver/fal] Error:", err);
    return "";
  }
}

async function pollFalResult(requestId: string, falKey: string): Promise<string> {
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const sr = await fetch(
        `https://queue.fal.run/fal-ai/nano-banana-2/requests/${requestId}/status`,
        { headers: { Authorization: `Key ${falKey}` } }
      );
      const status = await sr.json();

      if (status.status === "COMPLETED") {
        const rr = await fetch(
          `https://queue.fal.run/fal-ai/nano-banana-2/requests/${requestId}`,
          { headers: { Authorization: `Key ${falKey}` } }
        );
        const result = await rr.json();
        return result.images?.[0]?.url || "";
      }

      if (status.status === "FAILED") {
        console.error("[banner-resolver/fal] Generation failed:", status);
        return "";
      }
    } catch {
      // keep polling
    }
  }

  return "";
}

// ---- Main Resolver ----

export async function resolveBannerUrl(ctx: BannerContext): Promise<string> {
  try {
    const cat = ctx.category?.toLowerCase() ?? "";

    // Weather: try Mapbox static map first, then FAL.ai as fallback
    if (WEATHER_CATEGORIES.has(cat)) {
      const mapUrl = resolveMapboxUrl(ctx);
      if (mapUrl) return mapUrl;
      return await generateWithFal(ctx.image_prompt);
    }

    // Tier 1: Entity Map (all non-weather categories)
    const entityUrl = resolveFromEntityMap(ctx);
    if (entityUrl) return entityUrl;

    // Crypto/economy: skip Tier 2, go to FAL.ai
    if (ENTITY_ONLY_CATEGORIES.has(cat)) {
      return await generateWithFal(ctx.image_prompt);
    }

    // Tier 2: Wikipedia (entertainment, politics, sports, social_media, custom)
    const wikiUrl = await resolveFromWikipedia(ctx);
    if (wikiUrl) return wikiUrl;

    // Tier 3: FAL.ai generation
    return await generateWithFal(ctx.image_prompt);
  } catch (err) {
    console.error("[banner-resolver] Unexpected error:", err);
    return "";
  }
}
