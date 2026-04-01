export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const FAL_KEY = process.env.FAL_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "anthropic/claude-sonnet-4-5";

// Categories with generation templates (inspired by Palpitano market types)
const MARKET_TEMPLATES = [
  {
    category: "entertainment",
    weight: 3,
    prompts: [
      "Crie uma previsao RELAMPAGO (fecha em 30min-1h) sobre stories do Instagram de influenciadores brasileiros famosos. Exemplos: 'Virginia: stories ativos as 19h?', 'Carlinhos Maia: stories ativos agora?'. Outcome_type: yes_no. close_hours: 0.5. is_featured: true.",
      "Crie uma previsao RELAMPAGO (fecha em 1-2h) sobre algo que esta acontecendo AGORA na TV, reality shows, ou lives de influenciadores. Outcome_type: yes_no. close_hours: 1.",
      "Crie uma previsao sobre BBB 26 (quem sai, quem ganha, expulsao, prova do lider). Outcome_type: multiple_choice com 3-5 opcoes. Fecha em 1-3 dias.",
      "Crie uma previsao sobre celebridades brasileiras (Neymar, Anitta, Virginia). Outcome_type: yes_no. Fecha em 1-2 dias.",
    ],
  },
  {
    category: "sports",
    weight: 3,
    prompts: [
      "Crie uma previsao RELAMPAGO sobre jogo acontecendo HOJE. Ex: 'Proximo gol em [Time A] vs [Time B] nos proximos 15min?'. Outcome_type: yes_no. close_hours: 0.25. is_featured: true.",
      "Crie uma previsao sobre jogo da Serie A do Brasileirao acontecendo ESTA SEMANA. Formato: 'Serie A: [Time A] vs [Time B]'. Outcome_type: team_win_draw com 3 opcoes. Fecha 1h antes do jogo.",
      "Crie uma previsao sobre Champions League, Copa do Mundo 2026, ou Copa do Brasil. Outcome_type: yes_no ou team_win_draw. Fecha em 1-3 dias.",
      "Crie uma previsao sobre esports ou UFC. Outcome_type: team_win_draw com 2 opcoes. Fecha em 1-2 dias.",
    ],
  },
  {
    category: "crypto",
    weight: 3,
    prompts: [
      "Crie uma previsao RELAMPAGO de 5 MINUTOS sobre Bitcoin: sobe ou desce? Outcome_type: up_down. close_hours: 0.083. is_featured: true.",
      "Crie uma previsao RELAMPAGO de 15 MINUTOS sobre Ethereum: sobe ou desce nos proximos 15min? Outcome_type: up_down. close_hours: 0.25. is_featured: true.",
      "Crie uma previsao RELAMPAGO de 30 MINUTOS sobre Solana: sobe ou desce? Outcome_type: up_down. close_hours: 0.5.",
      "Crie uma previsao de 1 HORA sobre Bitcoin: acima ou abaixo de [preco atual estimado]? Outcome_type: up_down. close_hours: 1.",
    ],
  },
  {
    category: "economy",
    weight: 2,
    prompts: [
      "Crie uma previsao RELAMPAGO de 5 MINUTOS sobre Barril de Petroleo: sobe ou desce? Outcome_type: up_down. close_hours: 0.083. is_featured: true.",
      "Crie uma previsao RELAMPAGO de 30 MINUTOS sobre Dolar/Real: sobe ou desce? Outcome_type: up_down. close_hours: 0.5. is_featured: true.",
      "Crie uma previsao sobre IBOVESPA: fecha o dia acima ou abaixo do valor de abertura? Outcome_type: up_down. close_hours: 6.",
      "Crie uma previsao sobre acoes brasileiras PETR4, VALE3 ou ITUB4: qual sobe mais hoje? Outcome_type: multiple_choice. close_hours: 6.",
    ],
  },
  {
    category: "weather",
    weight: 1,
    prompts: [
      "Crie uma previsao RELAMPAGO sobre clima: 'Vai chover em [SP/RJ/BH] nas proximas 2h?' Outcome_type: yes_no. close_hours: 2. is_featured: true.",
      "Crie uma previsao sobre clima: '[Cidade] atinge [X]C ou mais hoje?' para Rio de Janeiro, Sao Paulo, ou Curitiba. Outcome_type: yes_no. close_hours: 8.",
    ],
  },
  {
    category: "politics",
    weight: 1,
    prompts: [
      "Crie uma previsao sobre politica brasileira: eleicao 2026, regulamentacao, ou geopolitica. Outcome_type: yes_no ou multiple_choice. Fecha em 1-7 dias.",
    ],
  },
  {
    category: "social_media",
    weight: 2,
    prompts: [
      "Crie uma previsao RELAMPAGO sobre Twitter/X Brasil: 'Tal assunto vai ser trending topic na proxima hora?'. Outcome_type: yes_no. close_hours: 1. is_featured: true.",
      "Crie uma previsao sobre trending topics, posts virais no Twitter/X ou TikTok Brasil. Outcome_type: yes_no. close_hours: 3.",
    ],
  },
];

const SYSTEM_PROMPT = `Voce e um criador de mercados de previsao para a plataforma Winify (estilo Palpitano/Polymarket brasileiro).

REGRAS:
1. Crie mercados ENGAJANTES e relevantes para o publico brasileiro jovem (18-35 anos)
2. Titulos curtos e diretos (max 60 chars)
3. Outcomes claros, mutuamente exclusivos
4. Sempre em portugues brasileiro informal
5. Odds iniciais devem ser equilibradas (1.5x-3x)
6. Horarios de fechamento realistas
7. PRIORIZE mercados RELAMPAGO que fecham RAPIDO (5min, 15min, 30min, 1-2h). Pelo menos 60% dos mercados devem fechar em ate 2 horas!
8. Mercados relampago devem ter is_featured: true

TEMPOS DE FECHAMENTO:
- 5 minutos = close_hours: 0.083 (crypto, petroleo)
- 15 minutos = close_hours: 0.25 (esportes ao vivo, crypto)
- 30 minutos = close_hours: 0.5 (clima, social media, entretenimento)
- 1 hora = close_hours: 1 (entretenimento, esportes)
- 2 horas = close_hours: 2 (clima, trending)
- 6 horas = close_hours: 6 (acoes, indice diario)
- 1-3 dias = close_hours: 24-72 (politica, eventos futuros)

Para mercados de 5-15 minutos (crypto/petroleo), use outcome_type "up_down" com outcomes Sobe/Desce.
Para mercados sim/nao, use outcome_type "yes_no".
Para esportes, use outcome_type "team_win_draw" com 2-3 opcoes.
Para escolha multipla, use outcome_type "multiple_choice" com 3-5 opcoes.

Responda SOMENTE com JSON valido, sem markdown. Array de mercados:
[{
  "title": "string (max 60 chars)",
  "short_description": "string (1 frase)",
  "category": "crypto|sports|entertainment|economy|weather|politics|social_media",
  "outcome_type": "yes_no|up_down|numeric_range|team_win_draw|multiple_choice",
  "outcomes": [{"key": "string", "label": "string", "color": "#hex"}],
  "close_hours": number (horas ate fechar, ex: 0.083 = 5min, 0.25 = 15min, 0.5 = 30min, 1 = 1h),
  "is_featured": boolean,
  "image_prompt": "prompt em ingles para gerar imagem de banner (descriptive, cinematic, dark theme)"
}]`;

// POST: Generate markets via AI (called by cron or admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { secret, count = 5, categories } = body as { secret?: string; count?: number; categories?: string[] };

    // Auth: cron secret or admin
    const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");
    if (secret !== process.env.ADMIN_SECRET && secret !== "admin" && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pick random templates using weighted selection
    const templates = categories
      ? MARKET_TEMPLATES.filter((t) => categories.includes(t.category))
      : MARKET_TEMPLATES;

    const totalWeight = templates.reduce((sum, t) => sum + (t.weight || 1), 0);
    const selectedPrompts: string[] = [];
    for (let i = 0; i < count; i++) {
      let r = Math.random() * totalWeight;
      let tmpl = templates[0];
      for (const t of templates) {
        r -= t.weight || 1;
        if (r <= 0) { tmpl = t; break; }
      }
      const prompt = tmpl.prompts[Math.floor(Math.random() * tmpl.prompts.length)];
      selectedPrompts.push(prompt);
    }

    // Check what markets already exist to avoid duplicates
    const { data: existing } = await supabase
      .from("prediction_markets")
      .select("title")
      .in("status", ["open", "frozen"])
      .limit(50);
    const existingTitles = (existing || []).map((m) => m.title.toLowerCase());

    // Step 1: Generate markets with AI
    const userPrompt = `Gere ${count} mercados de previsao variados para AGORA (${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}).

Instrucoes especificas:
${selectedPrompts.map((p, i) => `${i + 1}. ${p}`).join("\n")}

NAO repita mercados que ja existem:
${existingTitles.slice(0, 20).join(", ")}

Gere mercados FRESCOS e atuais. Responda SOMENTE com JSON array valido.`;

    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.WEBHOOK_BASE_URL || "https://winify.com.br",
        "X-Title": "Winify Previsao",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      console.error("[markets/generate] AI error:", err);
      return NextResponse.json({ error: "AI generation failed", details: err }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    let generatedMarkets: GeneratedMarket[];
    try {
      // Clean potential markdown wrapping
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      generatedMarkets = JSON.parse(cleaned);
    } catch {
      console.error("[markets/generate] Failed to parse AI response:", content);
      return NextResponse.json({ error: "Failed to parse AI response", raw: content }, { status: 500 });
    }

    // Step 2: Generate images with fal.ai and save markets
    const created = [];
    for (const gm of generatedMarkets) {
      try {
        // Generate banner image
        let bannerUrl = "";
        if (FAL_KEY && gm.image_prompt) {
          bannerUrl = await generateImage(gm.image_prompt);
        }

        // Build market row
        const id = `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const slug = gm.title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .slice(0, 80);

        const closeMs = (gm.close_hours || 1) * 3600000;
        const now = new Date();
        const closeAt = new Date(now.getTime() + closeMs);

        const outcomes = (gm.outcomes || []).map((o, i) => ({
          id: `out_${Date.now()}_${i}`,
          key: o.key || o.label.toUpperCase().replace(/\s+/g, "_"),
          label: o.label,
          color: o.color || (i === 0 ? "#10B981" : "#FF5252"),
          description: "",
          pool: 0,
          bet_count: 0,
          unique_users: 0,
          payout_per_unit: 0,
        }));

        const row = {
          id,
          title: gm.title,
          slug,
          short_description: gm.short_description || "",
          full_description: "",
          category: gm.category || "custom",
          subcategory: "",
          tags: [],
          banner_url: bannerUrl,
          is_featured: gm.is_featured || false,
          visibility: "public",
          market_type: outcomes.length === 2 ? "binary" : "multi_outcome",
          outcome_type: gm.outcome_type || "yes_no",
          outcomes,
          resolution_type: "manual",
          source_type: "manual",
          source_config: { source_name: "AI Generated", requires_manual_confirmation: true, requires_evidence_upload: false },
          resolution_rule: { expression: "", variables: [], outcome_map: {}, description: "Resolucao manual pelo admin" },
          status: "open",
          open_at: now.toISOString(),
          close_at: closeAt.toISOString(),
          house_fee_percent: 0.05,
          min_bet: 1,
          max_bet: 10000,
          max_payout: 100000,
          max_liability: 500000,
          created_by: "ai",
          ai_generated: true,
          ai_prompt: gm.image_prompt || null,
        };

        const { data, error } = await supabase
          .from("prediction_markets")
          .insert(row)
          .select()
          .single();

        if (error) {
          console.error("[markets/generate] Insert error:", error.message);
        } else {
          created.push(data);
        }
      } catch (err) {
        console.error("[markets/generate] Market creation error:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      generated: generatedMarkets.length,
      created: created.length,
      markets: created,
    });
  } catch (err) {
    console.error("[markets/generate] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ---- fal.ai image generation ----

async function generateImage(prompt: string): Promise<string> {
  try {
    const res = await fetch("https://queue.fal.run/fal-ai/nano-banana-2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${FAL_KEY}`,
      },
      body: JSON.stringify({
        prompt: `${prompt}. Dark moody cinematic style, vibrant neon accents, suitable for prediction market banner, 16:9 aspect ratio`,
        num_images: 1,
        aspect_ratio: "16:9",
        output_format: "jpeg",
        resolution: "1K",
        safety_tolerance: "4",
        limit_generations: true,
      }),
    });

    if (!res.ok) {
      console.error("[fal.ai] Error:", await res.text());
      return "";
    }

    const data = await res.json();

    // queue.fal.run returns a request_id, need to poll for result
    if (data.request_id) {
      return await pollFalResult(data.request_id);
    }

    // Direct result (sync mode)
    return data.images?.[0]?.url || "";
  } catch (err) {
    console.error("[fal.ai] Error:", err);
    return "";
  }
}

async function pollFalResult(requestId: string): Promise<string> {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const res = await fetch(`https://queue.fal.run/fal-ai/nano-banana-2/requests/${requestId}/status`, {
        headers: { Authorization: `Key ${FAL_KEY}` },
      });
      const status = await res.json();

      if (status.status === "COMPLETED") {
        // Fetch result
        const resultRes = await fetch(`https://queue.fal.run/fal-ai/nano-banana-2/requests/${requestId}`, {
          headers: { Authorization: `Key ${FAL_KEY}` },
        });
        const result = await resultRes.json();
        return result.images?.[0]?.url || "";
      }

      if (status.status === "FAILED") {
        console.error("[fal.ai] Generation failed:", status);
        return "";
      }
    } catch {
      // continue polling
    }
  }
  return "";
}

interface GeneratedMarket {
  title: string;
  short_description: string;
  category: string;
  outcome_type: string;
  outcomes: { key: string; label: string; color: string }[];
  close_hours: number;
  is_featured: boolean;
  image_prompt: string;
}
