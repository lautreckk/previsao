export interface ChatMessage {
  id: string;
  user: string;
  text: string;
  predictions: number;
  timestamp: Date;
  isSystem?: boolean;
}

export interface ChatAgent {
  name: string;
  predictions: number;
  personality: string;
}

export const agents: ChatAgent[] = [
  { name: "listbrazil1", predictions: 1144, personality: "veterano, responde perguntas, usa kkk" },
  { name: "eduardorfama", predictions: 3517, personality: "experiente, responde rapido, usa kk" },
  { name: "xablaucoin", predictions: 128, personality: "entusiasmado crypto, usa gíria" },
  { name: "brunocosta", predictions: 101, personality: "cauteloso, fala de odds conservadoras" },
  { name: "oddnave", predictions: 281, personality: "animado com green, usa foguete emoji" },
  { name: "tatusideral", predictions: 341, personality: "filosófico, fala de matrix e armadilha" },
  { name: "capivara777", predictions: 221, personality: "pergunta opinião, pede conselho" },
  { name: "cafecombug", predictions: 131, personality: "dev, faz analogias com código" },
  { name: "pasteldopix", predictions: 159, personality: "cauteloso, pix magro, usa emoji" },
  { name: "maedina", predictions: 250, personality: "mística, fala de cartas e cautela" },
  { name: "oddmonstro", predictions: 134, personality: "confiante, diz confia no pai" },
  { name: "morcegopix", predictions: 238, personality: "discreto, dá dicas certeiras" },
  { name: "rafaelalmeida", predictions: 330, personality: "comemorativo, usa CAPS quando ganha" },
  { name: "previsaoraiz", predictions: 181, personality: "raiz, pega o basicao" },
  { name: "zedarodovia", predictions: 142, personality: "especialista em rodovia" },
  { name: "arthurhenriquediniz", predictions: 420, personality: "direto, respostas curtas" },
];

const preloadedMessages: Omit<ChatMessage, "id" | "timestamp">[] = [
  { user: "xablaucoin", text: "boa tarde tropa, btc ta de foguete mas 212 tá esticado, cuidado ai", predictions: 128 },
  { user: "brunocosta", text: "212 ta forçado demais, eu curto ate 206 só pra garantir green", predictions: 101 },
  { user: "tatusideral", text: "tropa 212 ta com cara de armadilha da matrix... pegam ou cai?", predictions: 341 },
  { user: "listbrazil1", text: "calma pessoal, paciência é green", predictions: 1144 },
  { user: "rafaelalmeida", text: "GREEN LINDO NO BTC 5M, PEGUEI A SUBIDA E TA PAGO!!!", predictions: 330 },
  { user: "oddnave", text: "green veio tipo foguete da nasa, 36 a 50 deu bom demais ta pago 🚀", predictions: 281 },
  { user: "previsaoraiz", text: "peguei o basicao e deu green lisinho ta pago demais esquece 212 👊", predictions: 181 },
  { user: "cafecombug", text: "mais de 2.5 ta bugado igual meu deploy, melhor 1.5 safe e sai fora", predictions: 131 },
  { user: "pasteldopix", text: "to na duvida no carlinhos 13h... vcs vao de 21 a 60 ou +90? pix ta curto 😅", predictions: 159 },
  { user: "oddnave", text: "carlinhos 13h eu iria de 21-60, +90 é pedir red em marte", predictions: 281 },
  { user: "maedina", text: "ja vi na carta: carlinhos bate 21 a 60 stories às 13h, confia", predictions: 250 },
  { user: "capivara777", text: "to na duvida no mais de 2.5 hj... ta com cara de pegadinha, qq vcs acham?", predictions: 221 },
  { user: "eduardorfama", text: "facil essa", predictions: 3517 },
  { user: "oddmonstro", text: "boa tarde... carlinhos 21 a 60 é a call confia no pai", predictions: 134 },
  { user: "morcegopix", text: "virginia 19h eu iria de 36 a 50, sem alarde...", predictions: 238 },
];

const autoResponses: { triggers: string[]; responses: { user: string; text: string; predictions: number }[] }[] = [
  {
    triggers: ["boa tarde", "boa noite", "bom dia", "eae", "oi", "salve"],
    responses: [
      { user: "listbrazil1", text: "eae, bora pra cima 🚀", predictions: 1144 },
      { user: "eduardorfama", text: "salve salve, bora fazer green", predictions: 3517 },
      { user: "oddnave", text: "fala tropa!! bora lucrar", predictions: 281 },
    ],
  },
  {
    triggers: ["bitcoin", "btc", "crypto", "ethereum", "solana"],
    responses: [
      { user: "xablaucoin", text: "btc hj ta oscilando muito, cuidado no 5m", predictions: 128 },
      { user: "brunocosta", text: "no crypto hj to indo cauteloso, odds baixas e sai fora", predictions: 101 },
      { user: "rafaelalmeida", text: "PEGUEI GREEN NO BTC AGORA, TA SUBINDO DEMAIS", predictions: 330 },
    ],
  },
  {
    triggers: ["green", "ganhei", "pago", "acertei"],
    responses: [
      { user: "listbrazil1", text: "bora demais!! parabéns 🎉", predictions: 1144 },
      { user: "oddnave", text: "green veiooo, ta pago demais 🚀🚀", predictions: 281 },
      { user: "previsaoraiz", text: "é isso ai mano, consistência é tudo 👊", predictions: 181 },
    ],
  },
  {
    triggers: ["red", "perdi", "zicado", "droga"],
    responses: [
      { user: "cafecombug", text: "calma, red faz parte... o importante é a gestão de banca", predictions: 131 },
      { user: "brunocosta", text: "segura mão, diminui a banca e vai devagar", predictions: 101 },
      { user: "maedina", text: "as cartas dizem: paciência, o green vem 🙏", predictions: 250 },
    ],
  },
  {
    triggers: ["deposito", "depositar", "pix", "saldo"],
    responses: [
      { user: "listbrazil1", text: "deposita do mesmo CPF da conta, cai na hr", predictions: 1144 },
      { user: "eduardorfama", text: "pix cai instantâneo, tranquilo", predictions: 3517 },
    ],
  },
  {
    triggers: ["saque", "sacar", "retirar"],
    responses: [
      { user: "eduardorfama", text: "saque é pix, cai rapido", predictions: 3517 },
      { user: "morcegopix", text: "ja saquei varias vezes, sempre caiu certinho", predictions: 238 },
    ],
  },
  {
    triggers: ["verdade", "real", "confiavel", "golpe", "fake"],
    responses: [
      { user: "listbrazil1", text: "é real sim, to aqui faz tempo já", predictions: 1144 },
      { user: "eduardorfama", text: "totalmente real, ja saquei muitas vezes", predictions: 3517 },
      { user: "arthurhenriquediniz", text: "é verdade sim, uso todo dia", predictions: 420 },
    ],
  },
  {
    triggers: ["carlinhos", "stories", "story"],
    responses: [
      { user: "oddmonstro", text: "carlinhos 21 a 60 é a call, confia no pai", predictions: 134 },
      { user: "pasteldopix", text: "vou de 21-60 no carlinhos, sem loucura 😅", predictions: 159 },
    ],
  },
  {
    triggers: ["futebol", "jogo", "serie a", "flamengo", "palmeiras", "gremio"],
    responses: [
      { user: "capivara777", text: "esse jogo ta difícil de prever, cuidado", predictions: 221 },
      { user: "zedarodovia", text: "no futebol sempre tem surpresa, vai devagar", predictions: 142 },
    ],
  },
];

const randomMessages: { user: string; text: string; predictions: number }[] = [
  { user: "xablaucoin", text: "green veiooo porraaa 🚀🚀🚀", predictions: 128 },
  { user: "brunocosta", text: "hj to cauteloso, devagar e sempre", predictions: 101 },
  { user: "listbrazil1", text: "kkkkkkk", predictions: 1144 },
  { user: "eduardorfama", text: "bora bora, mais uma rodada", predictions: 3517 },
  { user: "tatusideral", text: "será que é armadilha da matrix dnv? 🤔", predictions: 341 },
  { user: "oddnave", text: "foguete não tem ré, bora pra cima 🚀", predictions: 281 },
  { user: "cafecombug", text: "minha paciência ta compilando... kkk", predictions: 131 },
  { user: "previsaoraiz", text: "pegando o basicao aqui, sem stress 👊", predictions: 181 },
  { user: "pasteldopix", text: "pix ta magro hj mas bora tentar 😅", predictions: 159 },
  { user: "maedina", text: "as cartas estão positivas pra hj 🙏", predictions: 250 },
  { user: "capivara777", text: "alguem mais ta vendo isso? ta estranho", predictions: 221 },
  { user: "oddmonstro", text: "confia no pai que o green vem", predictions: 134 },
  { user: "morcegopix", text: "to de olho no proximo 5m...", predictions: 238 },
  { user: "rafaelalmeida", text: "MAIS UM GREEN!! VAMO DEMAIS!!", predictions: 330 },
  { user: "arthurhenriquediniz", text: "eh rapido", predictions: 420 },
  { user: "zedarodovia", text: "na rodovia hj ta tranquilo", predictions: 142 },
  { user: "listbrazil1", text: "fala tropa, bora fazer green hj", predictions: 1144 },
  { user: "eduardorfama", text: "caminhaozinho fazendo a boa kk", predictions: 3517 },
  { user: "xablaucoin", text: "btc 5m ta complicado hj, cuidado", predictions: 128 },
  { user: "brunocosta", text: "vou esperar a proxima, essa ta arriscada", predictions: 101 },
  { user: "oddnave", text: "essa aqui é green certeza, ja vi esse padrão 🚀", predictions: 281 },
  { user: "capivara777", text: "boa noite tropa, amanha a gente volta 🙏", predictions: 221 },
  { user: "cafecombug", text: "bugou o grafico dnv kkk", predictions: 131 },
  { user: "tatusideral", text: "padrão classico, a matrix ta a nosso favor hj", predictions: 341 },
  { user: "pasteldopix", text: "peguei green no carlinhos, ta pago!! 😍", predictions: 159 },
];

export function getPreloadedMessages(): ChatMessage[] {
  const now = Date.now();
  return preloadedMessages.map((msg, i) => ({
    ...msg,
    id: `preload_${i}`,
    timestamp: new Date(now - (preloadedMessages.length - i) * 45000),
  }));
}

export function getRandomMessage(): ChatMessage {
  const msg = randomMessages[Math.floor(Math.random() * randomMessages.length)];
  return {
    ...msg,
    id: `rand_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date(),
  };
}

export function getResponseToUser(userMessage: string): ChatMessage[] {
  const lower = userMessage.toLowerCase();
  const responses: ChatMessage[] = [];

  for (const rule of autoResponses) {
    if (rule.triggers.some((t) => lower.includes(t))) {
      const chosen = rule.responses[Math.floor(Math.random() * rule.responses.length)];
      responses.push({
        ...chosen,
        id: `resp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date(),
      });
      break;
    }
  }

  if (responses.length === 0) {
    const fallbacks = [
      { user: "listbrazil1", text: "bora tropa 💪", predictions: 1144 },
      { user: "eduardorfama", text: "👍", predictions: 3517 },
      { user: "oddnave", text: "boa sorte ae mano", predictions: 281 },
    ];
    const chosen = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    responses.push({
      ...chosen,
      id: `fall_${Date.now()}`,
      timestamp: new Date(),
    });
  }

  return responses;
}

// Support FAQ
export const supportFAQ = [
  {
    question: "Como depositar?",
    answer: "Você pode depositar via PIX. Vá em Depositar, escolha o valor, preencha seus dados e gere o QR Code. O depósito é creditado instantaneamente após o pagamento.",
  },
  {
    question: "Quanto tempo demora o saque?",
    answer: "O saque é feito via PIX e geralmente cai em poucos minutos. Em casos excepcionais, pode levar até 1 hora.",
  },
  {
    question: "Qual o valor mínimo para apostar?",
    answer: "O valor mínimo para apostar é R$ 0,01 (1 centavo). Não há valor máximo definido.",
  },
  {
    question: "Como funciona a plataforma?",
    answer: "Aqui você aposta em previsões sobre eventos reais — se o Bitcoin sobe ou desce, resultados de jogos, entretenimento e mais. Escolha uma opção, defina o valor, e se acertar você ganha de acordo com as odds!",
  },
  {
    question: "É confiável?",
    answer: "Sim! Temos milhares de usuários ativos e todos os pagamentos são processados via PIX de forma segura e instantânea.",
  },
  {
    question: "Não consigo depositar, o que faço?",
    answer: "Verifique se está usando o mesmo CPF cadastrado na sua conta. Se o problema persistir, entre em contato pelo chat de suporte.",
  },
  {
    question: "Como funciona as odds?",
    answer: "As odds representam o multiplicador do seu retorno. Por exemplo, se você aposta R$10 em uma odd de 2.5x e acerta, recebe R$25,00.",
  },
];
