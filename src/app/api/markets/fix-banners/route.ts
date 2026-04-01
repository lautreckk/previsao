import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Entity-based image map (crypto, stocks, forex, etc.)
const ENTITY_IMAGES: { aliases: string[]; image_url: string }[] = [
  // Crypto
  { aliases: ["bitcoin", "btc"], image_url: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&q=80" },
  { aliases: ["ethereum", "eth"], image_url: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800&q=80" },
  { aliases: ["solana", "sol"], image_url: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80" },
  // Stocks / Companies
  { aliases: ["petrobras", "petr4", "petr"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Petrobras_horizontal_logo_%282%29.svg/220px-Petrobras_horizontal_logo_%282%29.svg.png" },
  { aliases: ["vale3", "vale"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Logo_Vale.svg/220px-Logo_Vale.svg.png" },
  { aliases: ["ibovespa", "bovespa", "b3"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/B3_logo.svg/220px-B3_logo.svg.png" },
  { aliases: ["itub4", "itau"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Banco_Ita%C3%BA_logo.svg/220px-Banco_Ita%C3%BA_logo.svg.png" },
  // Forex
  { aliases: ["dolar", "dollar", "usd/brl", "usd"], image_url: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80" },
  // Sports
  { aliases: ["flamengo"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Flamengo_bridge_logo.svg/220px-Flamengo_bridge_logo.svg.png" },
  { aliases: ["corinthians"], image_url: "https://upload.wikimedia.org/wikipedia/pt/thumb/b/b4/Corinthians_simbolo.png/220px-Corinthians_simbolo.png" },
  { aliases: ["palmeiras"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/220px-Palmeiras_logo.svg.png" },
  { aliases: ["botafogo"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Botafogo_de_Futebol_e_Regatas_logo.svg/220px-Botafogo_de_Futebol_e_Regatas_logo.svg.png" },
  { aliases: ["fluminense"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Fluminense_FC_logo.svg/220px-Fluminense_FC_logo.svg.png" },
  { aliases: ["atletico-mg", "atletico", "galo"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Clube_Atletico_Mineiro_logo.svg/220px-Clube_Atletico_Mineiro_logo.svg.png" },
  { aliases: ["cruzeiro"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/220px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png" },
  { aliases: ["internacional", "inter"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Logo_Internacional_Porto_Alegre.svg/220px-Logo_Internacional_Porto_Alegre.svg.png" },
  { aliases: ["gremio", "grêmio"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Gremio_logo.svg/220px-Gremio_logo.svg.png" },
  { aliases: ["vasco"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Vasco_da_Gama_logo.svg/220px-Vasco_da_Gama_logo.svg.png" },
  { aliases: ["coritiba"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Coritiba_FBC_-_badge.svg/220px-Coritiba_FBC_-_badge.svg.png" },
  // Politicians
  { aliases: ["lula", "lulinha"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Reversa1.jpg/330px-Reversa1.jpg" },
  { aliases: ["bolsonaro"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Jair_Bolsonaro_2019_Portrait_%283x4_cropped_center%29.jpg/330px-Jair_Bolsonaro_2019_Portrait_%283x4_cropped_center%29.jpg" },
  { aliases: ["tarcisio", "tarcísio"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Governador_do_Estado_de_S%C3%A3o_Paulo%2C_Tarc%C3%ADsio_de_Freitas_-_Foto_Oficial_%28cropped%29.jpg/330px-Governador_do_Estado_de_S%C3%A3o_Paulo%2C_Tarc%C3%ADsio_de_Freitas_-_Foto_Oficial_%28cropped%29.jpg" },
  { aliases: ["neymar"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/20180610_FIFA_Friendly_Match_Austria_vs._Brazil_Neymar_850_1705_%28cropped%29.jpg/220px-20180610_FIFA_Friendly_Match_Austria_vs._Brazil_Neymar_850_1705_%28cropped%29.jpg" },
  // Entertainment
  { aliases: ["virginia", "virgínia"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Virginia_Fonseca_in_December_2023.jpg/220px-Virginia_Fonseca_in_December_2023.jpg" },
  { aliases: ["carlinhos maia", "carlinhos"], image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Carlinhos_Maia.jpg/220px-Carlinhos_Maia.jpg" },
];

// Category fallback images (when no entity match found)
const CATEGORY_FALLBACKS: Record<string, string> = {
  crypto: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&q=80",
  economy: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80",
  sports: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80",
  entertainment: "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=800&q=80",
  politics: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80",
  social_media: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80",
  custom: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=800&q=80",
  war: "https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800&q=80",
};

function matchesWholeWord(text: string, alias: string): boolean {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[\\s,;:!?()\\[\\]/"'\\-])${escaped}(?:$|[\\s,;:!?()\\[\\]/"'\\-])`, "i");
  return re.test(` ${text} `);
}

function findEntityImage(title: string): string | null {
  const norm = normalize(title);
  for (const entity of ENTITY_IMAGES) {
    for (const alias of entity.aliases) {
      const normAlias = normalize(alias);
      const matches = normAlias.length > 3
        ? norm.includes(normAlias)
        : matchesWholeWord(norm, normAlias);
      if (matches) {
        return entity.image_url;
      }
    }
  }
  return null;
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Option: only fix specific category
  const category = searchParams.get("category"); // optional filter

  let query = supabase
    .from("prediction_markets")
    .select("id, title, banner_url, category");

  if (category) {
    query = query.eq("category", category);
  }

  const { data: markets, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let updated = 0;
  let skipped = 0;
  const results: { id: string; title: string; status: string; source?: string }[] = [];

  for (const m of markets || []) {
    // Skip if already has a good banner (not ui-avatars placeholder, not empty)
    const hasGoodBanner = m.banner_url
      && !m.banner_url.includes("ui-avatars.com")
      && m.banner_url.length > 10;

    // Skip weather markets (already handled by fix-weather-banners)
    if (m.category === "weather") {
      skipped++;
      continue;
    }

    // Try entity match
    const entityUrl = findEntityImage(m.title);
    if (entityUrl && (!hasGoodBanner || m.banner_url?.includes("ui-avatars.com"))) {
      const { error: updateError } = await supabase
        .from("prediction_markets")
        .update({ banner_url: entityUrl })
        .eq("id", m.id);

      if (!updateError) {
        updated++;
        results.push({ id: m.id, title: m.title, status: "updated", source: "entity_map" });
      } else {
        results.push({ id: m.id, title: m.title, status: `error: ${updateError.message}` });
      }
      continue;
    }

    // If no entity match and no good banner, use category fallback
    if (!hasGoodBanner) {
      const fallbackUrl = CATEGORY_FALLBACKS[m.category] || CATEGORY_FALLBACKS.custom;
      const { error: updateError } = await supabase
        .from("prediction_markets")
        .update({ banner_url: fallbackUrl })
        .eq("id", m.id);

      if (!updateError) {
        updated++;
        results.push({ id: m.id, title: m.title, status: "updated", source: "category_fallback" });
      } else {
        results.push({ id: m.id, title: m.title, status: `error: ${updateError.message}` });
      }
      continue;
    }

    skipped++;
    results.push({ id: m.id, title: m.title, status: "already_has_banner" });
  }

  return NextResponse.json({
    total: (markets || []).length,
    updated,
    skipped,
    results,
  });
}
