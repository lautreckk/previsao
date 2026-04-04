import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminSecret } from "@/lib/supabase-server";

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

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function findCityCoords(title: string): { lat: number; lon: number } | null {
  const norm = normalize(title);
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (norm.includes(normalize(city))) return coords;
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!checkAdminSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "MAPBOX token not configured" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all weather markets
  const { data: markets, error } = await supabase
    .from("prediction_markets")
    .select("id, title, banner_url, category")
    .eq("category", "weather");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let updated = 0;
  let skipped = 0;
  const results: { id: string; title: string; status: string }[] = [];

  for (const m of markets || []) {
    // Skip if already has a mapbox URL
    if (m.banner_url?.includes("api.mapbox.com")) {
      skipped++;
      results.push({ id: m.id, title: m.title, status: "already_mapbox" });
      continue;
    }

    const coords = findCityCoords(m.title);
    if (!coords) {
      skipped++;
      results.push({ id: m.id, title: m.title, status: "no_coords_found" });
      continue;
    }

    const mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${coords.lon},${coords.lat},9,0/800x450?access_token=${token}`;

    const { error: updateError } = await supabase
      .from("prediction_markets")
      .update({ banner_url: mapboxUrl })
      .eq("id", m.id);

    if (updateError) {
      results.push({ id: m.id, title: m.title, status: `error: ${updateError.message}` });
    } else {
      updated++;
      results.push({ id: m.id, title: m.title, status: "updated" });
    }
  }

  return NextResponse.json({
    total: (markets || []).length,
    updated,
    skipped,
    results,
  });
}
