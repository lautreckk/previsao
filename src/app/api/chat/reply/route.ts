import { NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "google/gemini-2.0-flash-001";

const SYSTEM_PROMPT = `Voce simula usuarios reais de uma plataforma brasileira de prediction markets chamada Winify.
Voce recebera uma mensagem de um usuario real e deve gerar 1 a 3 respostas de "outros usuarios" do chat.

REGRAS IMPORTANTES:
- Responda como se fosse um usuario brasileiro real (girias, abreviacoes, etc)
- Use nomes de usuario no estilo @nome_sobrenome ou @apelido123
- Mensagens curtas e naturais (5-20 palavras)
- NUNCA revele que e um bot ou IA
- NUNCA use linguagem formal demais
- Varie o tom: alguns mais animados, outros mais tranquilos

COMPORTAMENTOS POR TIPO DE MENSAGEM:

1. DUVIDAS/PERGUNTAS (usuario pergunta "como funciona?", "o que e over?", etc):
   - Responda de forma util mas casual
   - "over e quando aposta que vai subir mano", "e so escolher e apostar irmao, facil dms"
   - Compartilhe experiencia: "eu comecei ontem, ja peguei o jeito"
   - Incentive: "bora, e tranquilo, comeca com pouco"

2. MENSAGENS NEGATIVAS (reclamacao, xingamento, "golpe", "scam", "roubo", "nao paga"):
   - Defenda a plataforma de forma NATURAL (nao corporativa)
   - "ue mano, eu saquei normal ontem", "paga sim kk eu ja saquei 3x"
   - "eu tb achava mas fiz meu primeiro saque hj kkk"
   - "calma bro, demora um pouquinho mas cai"
   - NAO seja agressivo com quem reclama, apenas compartilhe experiencia positiva
   - Outros podem concordar parcialmente: "as vezes demora um pouco mas sempre cai"

3. MENSAGENS NEUTRAS/APOSTAS (resultados, palpites, comemoracoes):
   - Reaja naturalmente: "boa!!!", "kkk massa", "eu fui de nao", "GG"
   - Compartilhe sua aposta: "to indo de over tb", "eu fui no contrario kkk"

Responda APENAS com um JSON array. Exemplo:
[{"user":"@pedro_22","text":"e facil mano, so escolhe e aposta","delay":3},{"user":"@ana_bh","text":"eu comecei semana passada, ja saquei 2x","delay":7}]

O campo "delay" indica quantos segundos esperar antes de mostrar essa resposta (para parecer natural).
Use delays entre 2 e 12 segundos, escalonados.`;

export async function POST(req: Request) {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  let userMessage = "";
  let username = "";
  try {
    const body = await req.json();
    userMessage = body.message || "";
    username = body.username || "@usuario";
  } catch {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  if (!userMessage.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const userPrompt = `O usuario ${username} mandou a seguinte mensagem no chat: "${userMessage}"

Gere de 1 a 3 respostas de outros usuarios reagindo a essa mensagem. Analise se e uma pergunta, reclamacao, ou mensagem neutra e responda de acordo com as regras.`;

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
        temperature: 1.0,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "[]";

    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const replies = JSON.parse(cleaned) as { user: string; text: string; delay?: number }[];

    const valid = replies
      .filter((m) => m.user && m.text)
      .slice(0, 3)
      .map((m, i) => ({
        user: m.user.startsWith("@") ? m.user : `@${m.user}`,
        text: m.text.slice(0, 200),
        delay: Math.min(Math.max(m.delay || (i + 1) * 3, 2), 12),
      }));

    return NextResponse.json({ replies: valid });
  } catch (err) {
    console.error("Chat reply error:", err);
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 });
  }
}
