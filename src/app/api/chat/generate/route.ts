import { NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "google/gemini-2.0-flash-001";

const SYSTEM_PROMPT = `Voce e um gerador de mensagens de chat para uma plataforma brasileira de prediction markets chamada Winify.
Gere mensagens realistas como se fossem de usuarios reais brasileiros em um chat ao vivo.

Regras:
- Use girias brasileiras naturais (tipo "gg", "bora", "mlk", "mano", "pqp", "tnc", "kk", etc)
- Misture maiusculas e minusculas como pessoas reais digitam
- Alguns erros de digitacao ocasionais sao ok
- Topicos: apostas, resultados, bitcoin, futebol, BBB, clima, dolar, petroleo, celebridades
- Variedade de tons: animado, frustrado, perguntando, comemorando, incentivando
- Alguns usuarios mencionam valores ganhos (R$ 50, R$ 200, R$ 1.000, etc)
- Alguns pedem dicas ou fazem previsoes
- Mensagens curtas (1-15 palavras geralmente, max 25)
- NUNCA mencione que sao mensagens geradas ou IA
- Gere nomes de usuario no estilo @usuario (ex: @joao_silva22, @mari_santos, @cadu99)
- Cada mensagem deve ter um campo "user" e "text"

Responda APENAS com um JSON array, sem markdown, sem explicacao. Exemplo:
[{"user":"@joao22","text":"acertei 3 seguidas no btc"},{"user":"@mari_bh","text":"quem ta no bbb?"}]`;

export async function POST(req: Request) {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  let context = "";
  try {
    const body = await req.json();
    context = body.context || "";
  } catch {
    // no body is fine
  }

  const userPrompt = context
    ? `Gere 12 mensagens variadas de chat. Contexto atual dos mercados: ${context}. Lembre de variar os usernames e tons.`
    : `Gere 12 mensagens variadas de chat sobre apostas, mercados de previsao, bitcoin, futebol, BBB e outros topicos populares. Varie os usernames e tons.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://previsao-tau.vercel.app",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 1.1,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenRouter error:", errText);
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "[]";

    // Parse JSON from response (handle markdown code blocks)
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const messages = JSON.parse(cleaned) as { user: string; text: string }[];

    // Validate structure
    const valid = messages
      .filter((m) => m.user && m.text && typeof m.user === "string" && typeof m.text === "string")
      .map((m) => ({
        user: m.user.startsWith("@") ? m.user : `@${m.user}`,
        text: m.text.slice(0, 200),
      }));

    return NextResponse.json({ messages: valid });
  } catch (err) {
    console.error("Chat generate error:", err);
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 });
  }
}
