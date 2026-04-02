import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const ENTITY_IMAGES: { aliases: string[]; image_url: string }[] = [
  // ── Crypto ──
  { aliases: ["bitcoin", "btc"], image_url: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&q=80" },
  { aliases: ["ethereum", "eth"], image_url: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800&q=80" },
  { aliases: ["solana", "sol"], image_url: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80" },
  { aliases: ["xrp", "ripple"], image_url: "https://images.unsplash.com/photo-1621504450181-5d356f61d307?w=800&q=80" },
  { aliases: ["dogecoin", "doge"], image_url: "https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=800&q=80" },
  // ── Forex / Economy ──
  { aliases: ["dolar", "dollar", "usd/brl", "usd", "cambio"], image_url: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80" },
  { aliases: ["euro", "eur/brl", "eur"], image_url: "https://images.unsplash.com/photo-1519458246479-6acae7536988?w=800&q=80" },
  { aliases: ["selic", "juros", "taxa"], image_url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80" },
  { aliases: ["inflacao", "ipca", "igpm"], image_url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80" },
  { aliases: ["petroleo", "barril", "brent", "wti"], image_url: "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=800&q=80" },
  { aliases: ["ouro", "gold"], image_url: "https://images.unsplash.com/photo-1610375461246-83df859d849d?w=800&q=80" },
  // ── Stocks / Companies ──
  { aliases: ["petrobras", "petr4", "petr3"], image_url: "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=800&q=80" },
  { aliases: ["vale3", "vale"], image_url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80" },
  { aliases: ["ibovespa", "bovespa", "b3", "bolsa"], image_url: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&q=80" },
  { aliases: ["itau", "itub4", "banco"], image_url: "https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=800&q=80" },
  { aliases: ["magazine luiza", "magalu", "mglu3"], image_url: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80" },
  // ── Brazilian Football Teams ──
  { aliases: ["flamengo", "mengao"], image_url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80" },
  { aliases: ["corinthians", "timao"], image_url: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80" },
  { aliases: ["palmeiras", "verdao"], image_url: "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=800&q=80" },
  { aliases: ["santos"], image_url: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80" },
  { aliases: ["botafogo", "fogao"], image_url: "https://images.unsplash.com/photo-1508098682722-e99c643e7f0b?w=800&q=80" },
  { aliases: ["fluminense", "flu"], image_url: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80" },
  { aliases: ["atletico", "galo"], image_url: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800&q=80" },
  { aliases: ["cruzeiro"], image_url: "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80" },
  { aliases: ["internacional", "inter"], image_url: "https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=800&q=80" },
  { aliases: ["gremio", "grêmio", "imortal"], image_url: "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800&q=80" },
  { aliases: ["vasco", "vascao"], image_url: "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=800&q=80" },
  { aliases: ["bahia"], image_url: "https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=800&q=80" },
  { aliases: ["sao paulo", "são paulo", "spfc", "tricolor"], image_url: "https://images.unsplash.com/photo-1570498839593-e565b39455fc?w=800&q=80" },
  // ── Sports General ──
  { aliases: ["copa do mundo", "world cup", "fifa", "mundial"], image_url: "https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=800&q=80" },
  { aliases: ["brasileirao", "brasileirão", "serie a"], image_url: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80" },
  { aliases: ["champions", "champions league", "ucl"], image_url: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80" },
  { aliases: ["kings league"], image_url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80" },
  { aliases: ["formula 1", "f1", "grande premio"], image_url: "https://images.unsplash.com/photo-1541889413-bc70d9e8c41c?w=800&q=80" },
  { aliases: ["ufc", "mma", "luta"], image_url: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&q=80" },
  { aliases: ["nba", "basquete", "basketball"], image_url: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80" },
  { aliases: ["tenis", "tênis", "tennis"], image_url: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80" },
  { aliases: ["olimpiada", "olimpíada", "olympics", "jogos"], image_url: "https://images.unsplash.com/photo-1569517282132-25d22f4573e6?w=800&q=80" },
  { aliases: ["artilheiro", "gol", "gols"], image_url: "https://images.unsplash.com/photo-1508098682722-e99c643e7f0b?w=800&q=80" },
  { aliases: ["neymar"], image_url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80" },
  // ── Politicians ──
  { aliases: ["lula"], image_url: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80" },
  { aliases: ["bolsonaro"], image_url: "https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=800&q=80" },
  { aliases: ["tarcisio", "tarcísio"], image_url: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80" },
  { aliases: ["trump"], image_url: "https://images.unsplash.com/photo-1580128660010-fd027e1e587a?w=800&q=80" },
  { aliases: ["eleicao", "eleição", "eleicoes", "eleições", "presidente", "governador"], image_url: "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=800&q=80" },
  { aliases: ["congresso", "senado", "camara", "câmara", "deputado"], image_url: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80" },
  // ── Entertainment ──
  { aliases: ["bbb", "big brother"], image_url: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800&q=80" },
  { aliases: ["oscar", "academy awards"], image_url: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80" },
  { aliases: ["grammy", "musica", "música", "show"], image_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80" },
  { aliases: ["netflix", "serie", "série", "streaming"], image_url: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800&q=80" },
  { aliases: ["gta", "jogo", "game", "playstation", "xbox", "nintendo"], image_url: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&q=80" },
  { aliases: ["youtube", "youtuber", "influencer", "tiktok"], image_url: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&q=80" },
  { aliases: ["reality", "eliminacao", "eliminação", "paredao", "paredão"], image_url: "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=800&q=80" },
  { aliases: ["alien", "alienigena", "alienígena", "extraterrestre", "ovni", "ufo"], image_url: "https://images.unsplash.com/photo-1534294668821-28a3054f4256?w=800&q=80" },
  // ── Weather ──
  { aliases: ["temperatura", "°c", "graus", "calor", "frio", "maxima", "máxima", "minima", "mínima"], image_url: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=800&q=80" },
  { aliases: ["chuva", "chover", "precipitacao", "temporal", "tempestade"], image_url: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=800&q=80" },
  // ── War / Geopolitics ──
  { aliases: ["guerra", "conflito", "invasao", "invasão", "bombardeio", "missile", "missil"], image_url: "https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800&q=80" },
  { aliases: ["ira", "irã", "iran", "israel"], image_url: "https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800&q=80" },
  { aliases: ["russia", "rússia", "ucrania", "ucrânia", "ukraine"], image_url: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80" },
  { aliases: ["china", "taiwan", "xi jinping"], image_url: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800&q=80" },
  { aliases: ["nuclear", "arma nuclear", "bomba"], image_url: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&q=80" },
  { aliases: ["tarifa", "sancao", "sanção", "embargo", "comercio"], image_url: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800&q=80" },
  { aliases: ["terrorismo", "terrorista", "atentado"], image_url: "https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800&q=80" },
  // ── Rodovia / Camera ──
  { aliases: ["rodovia", "carro", "veiculo", "veículo", "transito", "trânsito", "highway"], image_url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80" },
  // ── Social Media ──
  { aliases: ["instagram", "post", "seguidores", "followers"], image_url: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80" },
  { aliases: ["twitter", "tweet", "x.com"], image_url: "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=800&q=80" },
];

const CATEGORY_FALLBACKS: Record<string, string> = {
  crypto: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80",
  economy: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80",
  sports: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80",
  entertainment: "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=800&q=80",
  politics: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80",
  social_media: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80",
  custom: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=800&q=80",
  war: "https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800&q=80",
  weather: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=800&q=80",
};

function findEntityImage(title: string): string | null {
  const norm = normalize(title);
  for (const entity of ENTITY_IMAGES) {
    for (const alias of entity.aliases) {
      if (norm.includes(normalize(alias))) {
        return entity.image_url;
      }
    }
  }
  return null;
}

// GET - no auth needed (simpler to call)
export async function GET(req: Request) {
  return runFixBanners(req);
}

// POST - same logic
export async function POST(req: Request) {
  return runFixBanners(req);
}

async function runFixBanners(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  let query = supabase.from("prediction_markets").select("id, title, banner_url, category");
  if (category) query = query.eq("category", category);

  const { data: markets, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let updated = 0;
  let skipped = 0;
  const results: { id: string; title: string; status: string; source?: string; url?: string }[] = [];

  for (const m of markets || []) {
    const hasGoodBanner = m.banner_url
      && !m.banner_url.includes("ui-avatars.com")
      && !m.banner_url.includes("placeholder")
      && m.banner_url.length > 10;

    // Try entity match first
    const entityUrl = findEntityImage(m.title);

    if (entityUrl && !hasGoodBanner) {
      const { error: updateError } = await supabase
        .from("prediction_markets")
        .update({ banner_url: entityUrl })
        .eq("id", m.id);

      if (!updateError) {
        updated++;
        results.push({ id: m.id, title: m.title, status: "updated", source: "entity_map", url: entityUrl });
      }
      continue;
    }

    // Category fallback for markets without banners
    if (!hasGoodBanner) {
      const fallbackUrl = CATEGORY_FALLBACKS[m.category] || CATEGORY_FALLBACKS.custom;
      const { error: updateError } = await supabase
        .from("prediction_markets")
        .update({ banner_url: fallbackUrl })
        .eq("id", m.id);

      if (!updateError) {
        updated++;
        results.push({ id: m.id, title: m.title, status: "updated", source: "category_fallback", url: fallbackUrl });
      }
      continue;
    }

    skipped++;
  }

  return NextResponse.json({ total: (markets || []).length, updated, skipped, results });
}
