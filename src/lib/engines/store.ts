// ============================================================
// WINIFY - DATA STORE (Multi-Category)
// ============================================================

import {
  PredictionMarket, Bet, BetSnapshot, LedgerEntry, Settlement,
  RiskAlert, AdminAuditLog, Affiliate, ResolutionLog,
  PlatformConfig, DEFAULT_CONFIG, CATEGORY_META,
} from "./types";
import { recalcMarket } from "./parimutuel";
import { validateBet } from "./risk-engine";
import { addBetToMarket, tickMarket, createMarket, presetBinary, presetUpDown, presetSports, presetMultiChoice } from "./market-engine";

const K = {
  markets: "w_markets", bets: "w_bets", ledger: "w_ledger", settlements: "w_settlements",
  alerts: "w_alerts", audit: "w_audit", affiliates: "w_affiliates", resLogs: "w_reslogs",
  config: "w_config", init: "w_init_v16_rules",
};

function get<T>(key: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fb; } catch { return fb; }
}
function put(key: string, data: unknown) { if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(data)); }

// ---- MARKETS ----
export function getMarkets(): PredictionMarket[] { return get<PredictionMarket[]>(K.markets, []); }
export function getMarket(id: string) { return getMarkets().find((m) => m.id === id); }
export function saveMarket(m: PredictionMarket) { const ms = getMarkets(); const i = ms.findIndex((x) => x.id === m.id); if (i >= 0) ms[i] = m; else ms.push(m); put(K.markets, ms); }
export function saveMarkets(ms: PredictionMarket[]) { put(K.markets, ms); }
export function deleteMarket(id: string) { put(K.markets, getMarkets().filter((m) => m.id !== id)); }

// ---- BETS ----
export function getBets(): Bet[] { return get<Bet[]>(K.bets, []); }
export function getBetsByMarket(id: string) { return getBets().filter((b) => b.market_id === id); }
export function getBetsByUser(id: string) { return getBets().filter((b) => b.user_id === id); }
export function saveBet(b: Bet) { const bs = getBets(); const i = bs.findIndex((x) => x.id === b.id); if (i >= 0) bs[i] = b; else bs.push(b); put(K.bets, bs); }
export function saveBets(bs: Bet[]) { put(K.bets, bs); }

// ---- PLACE BET ----
export function placeBetFull(userId: string, marketId: string, outcomeKey: string, amount: number, userBalance: number) {
  const market = getMarket(marketId);
  if (!market) return { success: false, error: "Mercado nao encontrado" };

  const ticked = tickMarket(market);
  if (ticked.status !== market.status) saveMarket(ticked);

  const outcome = ticked.outcomes.find((o) => o.key === outcomeKey);
  if (!outcome) return { success: false, error: "Outcome invalido" };

  const userBets = getBetsByUser(userId).filter((b) => b.market_id === marketId);
  const check = validateBet(ticked, userId, outcomeKey, amount, userBalance, userBets);
  if (!check.allowed) {
    if (check.alert) saveAlert({ ...check.alert, id: `alrt_${Date.now()}`, created_at: Date.now(), resolved: false } as RiskAlert);
    return { success: false, error: check.reason };
  }

  const isNew = !userBets.some((b) => b.outcome_key === outcomeKey && b.status === "pending");
  const updated = addBetToMarket(ticked, outcomeKey, amount, isNew);
  const targetOutcome = updated.outcomes.find((o) => o.key === outcomeKey);

  const snapshot: BetSnapshot = {
    outcomes: ticked.outcomes.map((o) => ({ key: o.key, pool: o.pool, payout_per_unit: o.payout_per_unit })),
    pool_total: ticked.pool_total, house_fee_percent: ticked.house_fee_percent,
    market_status: ticked.status, timestamp: Date.now(),
  };

  const bet: Bet = {
    id: `bet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId, market_id: marketId, outcome_key: outcomeKey,
    outcome_label: outcome.label, amount,
    payout_at_entry: (targetOutcome?.payout_per_unit ?? 0) * amount,
    final_payout: 0, status: "pending", created_at: Date.now(), snapshot,
  };

  saveBet(bet);
  saveMarket(updated);
  saveLedgerEntry({
    id: `ldg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    user_id: userId, type: "bet_placed", amount: -amount, balance_after: userBalance - amount,
    reference_id: bet.id, description: `Aposta: ${updated.title} - ${outcome.label}`, created_at: Date.now(),
  });

  return { success: true, bet, market: updated };
}

// ---- LEDGER ----
export function getLedger(): LedgerEntry[] { return get<LedgerEntry[]>(K.ledger, []); }
export function getLedgerByUser(id: string) { return getLedger().filter((l) => l.user_id === id); }
export function saveLedgerEntry(e: LedgerEntry) { const ls = getLedger(); ls.push(e); put(K.ledger, ls); }

// ---- SETTLEMENTS ----
export function getSettlements(): Settlement[] { return get<Settlement[]>(K.settlements, []); }
export function saveSettlement(s: Settlement) { const ss = getSettlements(); ss.push(s); put(K.settlements, ss); }

// ---- ALERTS ----
export function getAlerts(): RiskAlert[] { return get<RiskAlert[]>(K.alerts, []); }
export function saveAlert(a: RiskAlert) { const as2 = getAlerts(); as2.push(a); put(K.alerts, as2); }

// ---- AUDIT ----
export function getAuditLogs(): AdminAuditLog[] { return get<AdminAuditLog[]>(K.audit, []); }
export function saveAuditLog(l: AdminAuditLog) { const ls = getAuditLogs(); ls.push(l); put(K.audit, ls); }

// ---- RESOLUTION LOGS ----
export function getResolutionLogs(): ResolutionLog[] { return get<ResolutionLog[]>(K.resLogs, []); }
export function saveResolutionLog(l: ResolutionLog) { const ls = getResolutionLogs(); ls.push(l); put(K.resLogs, ls); }

// ---- AFFILIATES ----
export function getAffiliates(): Affiliate[] { return get<Affiliate[]>(K.affiliates, []); }
export function saveAffiliate(a: Affiliate) { const as2 = getAffiliates(); const i = as2.findIndex((x) => x.id === a.id); if (i >= 0) as2[i] = a; else as2.push(a); put(K.affiliates, as2); }

// ---- CONFIG ----
export function getConfig(): PlatformConfig { return get<PlatformConfig>(K.config, DEFAULT_CONFIG); }
export function saveConfig(c: PlatformConfig) { put(K.config, c); }

// ---- TICK ALL ----
export function tickAllMarkets(): PredictionMarket[] {
  const ms = getMarkets();
  let changed = false;
  const updated = ms.map((m) => { const t = tickMarket(m); if (t.status !== m.status) { changed = true; return t; } return m; });
  if (changed) saveMarkets(updated);
  return updated;
}

// ---- SEED DATA (Multi-Category + Fofocas) ----
export function initializeStore() {
  if (typeof window === "undefined") return;
  if (get<boolean>(K.init, false)) return;

  const seeds: PredictionMarket[] = [];
  const D = 24 * 3600000; // 1 day in ms

  // ===== FOFOCAS / ENTERTAINMENT =====

  // 1. BBB 26 - Paredao
  const bbb1 = createMarket(presetMultiChoice(
    "Quem sai no proximo paredao do BBB 26?",
    "entertainment", "Big Brother Brasil 26 - Paredao da Semana",
    ["Gabriela", "Jonas", "Juliano Floss"],
    { close_at: Date.now() + 2 * D, resolution_type: "semi_automatic", banner_url: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800&q=80" }
  ));
  bbb1.status = "open"; bbb1.is_featured = true;
  bbb1.subcategory = "BBB 26"; bbb1.resolution_method = "manual";
  bbb1.outcomes[0].pool = 1200; bbb1.outcomes[1].pool = 8500; bbb1.outcomes[2].pool = 7800;
  seeds.push(bbb1);

  // 2. Juliano Floss - Acusacoes Vivi Wanderley
  const bbb2 = createMarket(presetBinary(
    "Juliano Floss sera cancelado e eliminado do BBB 26 apos acusacoes de Vivi Wanderley?",
    "entertainment", "Vivi Wanderley acusa Juliano de abuso psicologico",
    { close_at: Date.now() + 5 * D, resolution_type: "manual", banner_url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80" }
  ));
  bbb2.status = "open"; bbb2.is_featured = true;
  bbb2.subcategory = "BBB 26 / Fofoca"; bbb2.resolution_method = "manual";
  bbb2.outcomes[0].pool = 6200; bbb2.outcomes[1].pool = 4100;
  seeds.push(bbb2);

  // 3. Anitta e Alice Carvalho
  const anitta = createMarket(presetBinary(
    "Anitta e Alice Carvalho vao confirmar namoro ate abril?",
    "entertainment", "Rumores de romance entre Anitta e a atriz de O Agente Secreto",
    { close_at: Date.now() + 20 * D, resolution_type: "manual", banner_url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80" }
  ));
  anitta.status = "open"; anitta.is_featured = true;
  anitta.subcategory = "Fofoca / Romance"; anitta.resolution_method = "manual";
  anitta.outcomes[0].pool = 7800; anitta.outcomes[1].pool = 3200;
  seeds.push(anitta);

  // 4. Shakira Copacabana
  const shakira = createMarket(presetBinary(
    "Show da Shakira em Copacabana vai bater recorde de 2 milhoes de pessoas?",
    "entertainment", "Megashow Todo Mundo no Rio - 2 de maio de 2026",
    { close_at: Date.now() + 37 * D, resolution_type: "semi_automatic", banner_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80" }
  ));
  shakira.status = "open"; shakira.is_featured = true;
  shakira.subcategory = "Shows / Musica"; shakira.resolution_method = "manual";
  shakira.outcomes[0].pool = 4500; shakira.outcomes[1].pool = 5200;
  seeds.push(shakira);

  // 5. Chappell Roan - Polemica Seguranca
  const chappell = createMarket(presetBinary(
    "Chappell Roan vai pedir desculpas publicas a familia de Jorginho?",
    "entertainment", "Incidente de seguranca no Lollapalooza com filha de Jorginho do Flamengo",
    { close_at: Date.now() + 7 * D, resolution_type: "manual", banner_url: "https://images.unsplash.com/photo-1501386761578-0a55d7e4d7da?w=800&q=80" }
  ));
  chappell.status = "open"; chappell.resolution_method = "manual";
  chappell.subcategory = "Fofoca / Polemica";
  chappell.outcomes[0].pool = 2100; chappell.outcomes[1].pool = 5800;
  seeds.push(chappell);

  // 6. Gisele Bundchen
  const gisele = createMarket(presetBinary(
    "Gisele Bundchen vai anunciar volta as passarelas em 2026?",
    "entertainment", "Supermodelo vive nova fase apos casamento com Joaquim Valente",
    { close_at: Date.now() + 60 * D, resolution_type: "manual", banner_url: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80" }
  ));
  gisele.status = "open"; gisele.resolution_method = "manual";
  gisele.subcategory = "Fofoca / Moda";
  gisele.outcomes[0].pool = 3400; gisele.outcomes[1].pool = 4800;
  seeds.push(gisele);

  // 7. Lollapalooza 2026
  const lolla = createMarket(presetBinary(
    "Lollapalooza Brasil 2026 vai vender mais de 300 mil ingressos?",
    "entertainment", "Festival no Interlagos, 20-22 marco, 71 atracoes",
    { close_at: Date.now() + 1 * D, resolution_type: "semi_automatic", banner_url: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80" }
  ));
  lolla.status = "open"; lolla.resolution_method = "manual";
  lolla.subcategory = "Festivais";
  lolla.outcomes[0].pool = 2800; lolla.outcomes[1].pool = 1500;
  seeds.push(lolla);

  // 8. BBB 26 - Quem ganha
  const bbb3 = createMarket(presetMultiChoice(
    "Quem vai ganhar o BBB 26?",
    "entertainment", "Grande final do Big Brother Brasil 2026",
    ["Vitoria Strada", "Aline Campos", "Camilla", "Thamiris", "Outro"],
    { close_at: Date.now() + 30 * D, resolution_type: "manual", banner_url: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80" }
  ));
  bbb3.status = "open"; bbb3.is_featured = true;
  bbb3.subcategory = "BBB 26"; bbb3.resolution_method = "manual";
  bbb3.outcomes[0].pool = 12000; bbb3.outcomes[1].pool = 5800; bbb3.outcomes[2].pool = 4200; bbb3.outcomes[3].pool = 3100; bbb3.outcomes[4].pool = 900;
  seeds.push(bbb3);

  // ===== OTHER CATEGORIES =====

  // Crypto
  const btc = createMarket(presetUpDown("BTC", 5));
  btc.status = "open"; btc.banner_url = "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&q=80";
  btc.outcomes[0].pool = 2340; btc.outcomes[1].pool = 1890;
  seeds.push(btc);

  // Politics
  const pol1 = createMarket(presetBinary("Lula aprovacao acima de 35% em abril?", "politics", "Pesquisa Datafolha", { close_at: Date.now() + 15 * D, banner_url: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80" }));
  pol1.status = "open"; pol1.resolution_method = "manual";
  pol1.outcomes[0].pool = 5200; pol1.outcomes[1].pool = 3800;
  seeds.push(pol1);

  // Sports
  const sport1 = createMarket(presetSports("Flamengo", "Palmeiras", "Libertadores 2026", { close_at: Date.now() + 3 * D, banner_url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80" }));
  sport1.status = "open"; sport1.is_featured = true;
  sport1.outcomes[0].pool = 8500; sport1.outcomes[1].pool = 2100; sport1.outcomes[2].pool = 6200;
  seeds.push(sport1);

  // Economy
  const econ1 = createMarket(presetBinary("Dolar fecha acima de R$5.80 hoje?", "economy", "Cotacao dolar comercial", { close_at: Date.now() + 8 * 3600000, resolution_type: "semi_automatic", source_type: "api", banner_url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80" }));
  econ1.status = "open";
  econ1.outcomes[0].pool = 4100; econ1.outcomes[1].pool = 3900;
  seeds.push(econ1);

  // War / Geopolitics
  const war1 = createMarket(presetBinary("Acordo de cessar-fogo na Ucrania ate julho 2026?", "war", "Conflito Russia-Ucrania", { close_at: Date.now() + 90 * D, resolution_type: "manual", banner_url: "https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800&q=80" }));
  war1.status = "open"; war1.resolution_method = "manual";
  war1.outcomes[0].pool = 1800; war1.outcomes[1].pool = 6200;
  seeds.push(war1);

  // Social Media
  const social1 = createMarket(presetBinary("Elon Musk posta no X antes das 12h?", "social_media", "Monitoramento de perfil @elonmusk", { close_at: Date.now() + 6 * 3600000, resolution_type: "semi_automatic", banner_url: "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=800&q=80" }));
  social1.status = "open";
  social1.outcomes[0].pool = 900; social1.outcomes[1].pool = 300;
  seeds.push(social1);

  // Weather
  const weather1 = createMarket(presetBinary("Vai chover em SP amanha?", "weather", "Previsao INMET", { close_at: Date.now() + D, source_type: "api", resolution_type: "semi_automatic", banner_url: "https://images.unsplash.com/photo-1501691223387-dd0500403074?w=800&q=80" }));
  weather1.status = "open";
  weather1.outcomes[0].pool = 1200; weather1.outcomes[1].pool = 800;
  seeds.push(weather1);

  // ===== APOSTAS URBANAS / COTIDIANO / CURIOSIDADES =====

  // 1. Rodovia - Av. Curitiba (REMOVIDO)

  // 2. Temperatura maxima em SP
  const urban2 = createMarket(presetMultiChoice(
    "Qual sera a temperatura maxima em SP amanha?",
    "weather", "Previsao INMET/Climatempo. Recorde de marco: 34.8°C",
    ["Abaixo de 25°C", "25°C a 28°C", "28°C a 32°C", "Acima de 32°C"],
    { close_at: Date.now() + D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "INMET - Estacao Mirante de Santana",
      banner_url: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=800&q=80" }
  ));
  urban2.status = "open";
  urban2.subcategory = "Clima SP";
  urban2.outcomes[0].pool = 500; urban2.outcomes[1].pool = 2800; urban2.outcomes[2].pool = 3500; urban2.outcomes[3].pool = 1200;
  seeds.push(urban2);

  // 3. Km de congestionamento em SP
  const urban3 = createMarket(presetMultiChoice(
    "Quantos km de congestionamento SP vai ter no pico da tarde (18h)?",
    "custom", "Media historica: ~120km. Dados CET-SP tempo real.",
    ["Menos de 80 km", "80 a 120 km", "120 a 180 km", "Mais de 180 km"],
    { close_at: Date.now() + D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "CET-SP / Waze / Google Maps",
      banner_url: "https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=800&q=80" }
  ));
  urban3.status = "open";
  urban3.subcategory = "Transito SP";
  urban3.outcomes[0].pool = 600; urban3.outcomes[1].pool = 3200; urban3.outcomes[2].pool = 4100; urban3.outcomes[3].pool = 1800;
  seeds.push(urban3);

  // 4. Quantas pessoas no metro de SP
  const urban4 = createMarket(presetMultiChoice(
    "Quantos milhoes de passageiros o Metro de SP vai transportar amanha?",
    "custom", "Media diaria: ~4.5 milhoes de passageiros (Metro+CPTM)",
    ["Menos de 3.5M", "3.5M a 4.5M", "4.5M a 5.5M", "Mais de 5.5M"],
    { close_at: Date.now() + D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "Metro SP / CPTM - Relatorio diario",
      banner_url: "https://images.unsplash.com/photo-1565043666747-69f6646db940?w=800&q=80" }
  ));
  urban4.status = "open";
  urban4.subcategory = "Transporte SP";
  urban4.outcomes[0].pool = 400; urban4.outcomes[1].pool = 3800; urban4.outcomes[2].pool = 3200; urban4.outcomes[3].pool = 500;
  seeds.push(urban4);

  // 5. Gols no Brasileirao rodada
  const urban5 = createMarket(presetMultiChoice(
    "Quantos gols vao rolar na proxima rodada do Brasileirao?",
    "sports", "Soma total de gols em todos os jogos da rodada. Media: ~22 gols/rodada.",
    ["Menos de 15", "15 a 22", "22 a 30", "Mais de 30"],
    { close_at: Date.now() + 4 * D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "ESPN / ge.globo / API-Football",
      banner_url: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80" }
  ));
  urban5.status = "open";
  urban5.subcategory = "Brasileirao 2026";
  urban5.outcomes[0].pool = 1200; urban5.outcomes[1].pool = 4800; urban5.outcomes[2].pool = 3600; urban5.outcomes[3].pool = 900;
  seeds.push(urban5);

  // ===== +10 APOSTAS: CLIMA, TRANSITO, COTIDIANO =====

  // 6. Chuva no Rio amanha
  const extra1 = createMarket(presetBinary(
    "Vai chover no Rio de Janeiro amanha?",
    "weather", "Estacao INMET - Rio/Santos Dumont. Março é o mês mais chuvoso do RJ.",
    { close_at: Date.now() + D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "INMET Rio de Janeiro",
      banner_url: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=800&q=80" }
  ));
  extra1.status = "open";
  extra1.subcategory = "Clima RJ";
  extra1.outcomes[0].pool = 3200; extra1.outcomes[1].pool = 1800;
  seeds.push(extra1);

  // 7. Carros na Marginal Tiete
  const extra2 = createMarket(presetMultiChoice(
    "Quantos veiculos vao passar na Marginal Tiete amanha?",
    "custom", "Via mais movimentada de SP. Media: ~800 mil veiculos/dia (CET-SP).",
    ["Menos de 600 mil", "600 a 800 mil", "800 mil a 1 milhao", "Mais de 1 milhao"],
    { close_at: Date.now() + D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "CET-SP Sensores Marginal Tiete",
      banner_url: "https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=800&q=80" }
  ));
  extra2.status = "open";
  extra2.subcategory = "Transito SP";
  extra2.outcomes[0].pool = 700; extra2.outcomes[1].pool = 4500; extra2.outcomes[2].pool = 3800; extra2.outcomes[3].pool = 500;
  seeds.push(extra2);

  // 8. Temperatura maxima em Brasilia
  const extra3 = createMarket(presetMultiChoice(
    "Qual sera a temperatura maxima em Brasilia amanha?",
    "weather", "Estacao INMET Brasilia. Março costuma ter max de 28°C.",
    ["Abaixo de 26°C", "26°C a 29°C", "29°C a 32°C", "Acima de 32°C"],
    { close_at: Date.now() + D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "INMET Brasilia",
      banner_url: "https://images.unsplash.com/photo-1587974928442-77dc3e0748ae?w=800&q=80" }
  ));
  extra3.status = "open";
  extra3.subcategory = "Clima Brasilia";
  extra3.outcomes[0].pool = 600; extra3.outcomes[1].pool = 3100; extra3.outcomes[2].pool = 2400; extra3.outcomes[3].pool = 400;
  seeds.push(extra3);

  // 9. Chuva em BH
  const extra4 = createMarket(presetBinary(
    "Vai chover em Belo Horizonte amanha?",
    "weather", "Marco e epoca de chuvas em MG. Media historica: 22 dias de chuva no mes.",
    { close_at: Date.now() + D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "INMET Belo Horizonte",
      banner_url: "https://images.unsplash.com/photo-1468818438311-4bab781ab9b8?w=800&q=80" }
  ));
  extra4.status = "open";
  extra4.subcategory = "Clima BH";
  extra4.outcomes[0].pool = 4100; extra4.outcomes[1].pool = 1200;
  seeds.push(extra4);

  // 10. Carros na Av Brasil (RJ)
  const extra5 = createMarket(presetMultiChoice(
    "Quantos veiculos na Av. Brasil (RJ) amanha?",
    "custom", "Principal via expressa do RJ. Media: ~300 mil veiculos/dia.",
    ["Menos de 200 mil", "200 a 300 mil", "300 a 400 mil", "Mais de 400 mil"],
    { close_at: Date.now() + D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "CET-Rio / Centro de Operacoes Rio",
      banner_url: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80" }
  ));
  extra5.status = "open";
  extra5.subcategory = "Transito RJ";
  extra5.outcomes[0].pool = 500; extra5.outcomes[1].pool = 3800; extra5.outcomes[2].pool = 2900; extra5.outcomes[3].pool = 600;
  seeds.push(extra5);

  // 11. Onda de calor no Sul
  const extra6 = createMarket(presetBinary(
    "Vai ter onda de calor no Sul do Brasil esta semana?",
    "weather", "INMET alertou risco de onda de calor em marco 2026 nos estados do Sul.",
    { close_at: Date.now() + 5 * D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "INMET - Alertas Climaticos",
      banner_url: "https://images.unsplash.com/photo-1504370805625-d32c54b16100?w=800&q=80" }
  ));
  extra6.status = "open"; extra6.is_featured = true;
  extra6.subcategory = "Clima Sul";
  extra6.outcomes[0].pool = 5200; extra6.outcomes[1].pool = 2800;
  seeds.push(extra6);

  // 12. Congestionamento no Rio pico manha
  const extra7 = createMarket(presetMultiChoice(
    "Quantos km de engarrafamento no RJ no pico da manha (8h)?",
    "custom", "Media historica: ~90km no horario de pico. Dados Centro de Operacoes.",
    ["Menos de 50 km", "50 a 90 km", "90 a 130 km", "Mais de 130 km"],
    { close_at: Date.now() + D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "Centro de Operacoes Rio / Waze",
      banner_url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80" }
  ));
  extra7.status = "open";
  extra7.subcategory = "Transito RJ";
  extra7.outcomes[0].pool = 800; extra7.outcomes[1].pool = 3500; extra7.outcomes[2].pool = 2800; extra7.outcomes[3].pool = 900;
  seeds.push(extra7);

  // 13. Volume de chuva em SP
  const extra8 = createMarket(presetMultiChoice(
    "Quantos mm de chuva vao cair em SP amanha?",
    "weather", "Março 2026: previsão acima de 162mm no mês. Dados Climatempo/INMET.",
    ["0 mm (sem chuva)", "1 a 10 mm", "10 a 30 mm", "Mais de 30 mm"],
    { close_at: Date.now() + D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "Climatempo / INMET Mirante Santana",
      banner_url: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=800&q=80" }
  ));
  extra8.status = "open";
  extra8.subcategory = "Clima SP";
  extra8.outcomes[0].pool = 1500; extra8.outcomes[1].pool = 3200; extra8.outcomes[2].pool = 2800; extra8.outcomes[3].pool = 1100;
  seeds.push(extra8);

  // 14. Carros Av Presidente Vargas (RJ)
  const extra9 = createMarket(presetMultiChoice(
    "Quantos veiculos na Av. Pres. Vargas (RJ) amanha?",
    "custom", "Principal eixo viario do centro do RJ. Media: ~150 mil veiculos/dia.",
    ["Menos de 100 mil", "100 a 150 mil", "150 a 200 mil", "Mais de 200 mil"],
    { close_at: Date.now() + D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "CET-Rio",
      banner_url: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800&q=80" }
  ));
  extra9.status = "open";
  extra9.subcategory = "Transito RJ";
  extra9.outcomes[0].pool = 600; extra9.outcomes[1].pool = 3200; extra9.outcomes[2].pool = 2500; extra9.outcomes[3].pool = 400;
  seeds.push(extra9);

  // 15. Temperatura minima em Curitiba
  const extra10 = createMarket(presetMultiChoice(
    "Qual sera a temperatura minima em Curitiba amanha?",
    "weather", "Curitiba e conhecida pelo frio. Minima media em marco: 15°C.",
    ["Abaixo de 12°C", "12°C a 16°C", "16°C a 20°C", "Acima de 20°C"],
    { close_at: Date.now() + D, resolution_type: "semi_automatic", source_type: "api",
      source_name: "INMET Curitiba / Climatempo",
      banner_url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80" }
  ));
  extra10.status = "open";
  extra10.subcategory = "Clima Curitiba";
  extra10.outcomes[0].pool = 1800; extra10.outcomes[1].pool = 3500; extra10.outcomes[2].pool = 2200; extra10.outcomes[3].pool = 500;
  seeds.push(extra10);

  // ===== APOSTAS DO PRINT (previsao.io style) =====
  const H = 3600000; const W = 7 * D;

  // Helper for quick market creation
  const q = (title: string, cat: MarketCategory, desc: string, outs: [string, number, string][], closeIn: number, img: string, sub?: string) => {
    const m = createMarket(presetBinary(title, cat, desc, { close_at: Date.now() + closeIn, banner_url: img, resolution_type: "manual" }));
    m.status = "open";
    if (sub) m.subcategory = sub;
    // Replace outcomes with custom ones
    if (outs.length >= 2) {
      m.outcomes = outs.map((o) => ({ id: `o_${Math.random().toString(36).slice(2,8)}`, key: o[0].toUpperCase().replace(/\s/g, "_").slice(0,20), label: o[0], pool: o[1], color: o[2], description: "", bet_count: 0, unique_users: 0, payout_per_unit: 0 }));
    }
    return m;
  };

  // Financeiro
  seeds.push(q("Dolar (diario): sobe ou desce?", "economy", "Cotacao dolar comercial", [["Sobe", 2600, "#10B981"], ["Desce", 7400, "#FF6B5A"]], 4*H, "https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=200&q=80", "Financeiro"));
  seeds.push(q("Barril de Petroleo (5 minutos): sobe ou desce?", "economy", "Preco do petroleo Brent", [["Sobe", 3900, "#10B981"], ["Desce", 6100, "#FF6B5A"]], H, "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=200&q=80", "Financeiro"));
  seeds.push(q("O preco do Diesel vai subir esta semana?", "economy", "Monitoramento ANP", [["Sim", 7300, "#10B981"], ["Nao", 2700, "#FF6B5A"]], 11*H, "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=200&q=80", "Financeiro"));
  seeds.push(q("IBOVESPA (Marco): Acima ou Abaixo?", "economy", "Indice Bovespa fechamento mensal", [["Acima", 1500, "#10B981"], ["Abaixo", 8500, "#FF6B5A"]], 4*D, "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=200&q=80", "Financeiro"));
  seeds.push(q("Qual acao tera o maior retorno esta semana?", "economy", "PETR4, VALE3, ITUB4, BBDC4", [["PETR...", 6970, "#10B981"], ["VALE...", 1190, "#5B9DFF"]], 4*D, "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=200&q=80", "Financeiro"));

  // Entretenimento
  seeds.push(q("Carlinhos: stories ativos as 19h?", "entertainment", "Contagem de stories Carlinhos Maia", [["Mais de 94", 8320, "#10B981"], ["Ate 94", 620, "#FF6B5A"]], 6*H, "https://ui-avatars.com/api/?name=CM&background=e91e63&color=fff&size=200&bold=true", "Entretenimento"));
  seeds.push(q("Virginia: stories ativos as 19h?", "entertainment", "Contagem de stories Virginia Fonseca", [["36 a 50", 4570, "#FFB800"], ["50 a 70", 3310, "#5B9DFF"]], 6*H, "https://ui-avatars.com/api/?name=VF&background=FF69B4&color=fff&size=200&bold=true", "Entretenimento"));
  seeds.push(q("Virginia: stories ativos as 13h?", "entertainment", "Contagem de stories Virginia 13h", [["Ate 38", 2780, "#FFB800"], ["39 a 60", 2720, "#5B9DFF"]], 24*H, "https://ui-avatars.com/api/?name=VF&background=FF69B4&color=fff&size=200&bold=true", "Entretenimento"));
  seeds.push(q("GTA VI: Preco acima de R$400 no lancamento?", "entertainment", "Rockstar Games", [["Sim", 7400, "#10B981"], ["Nao", 2600, "#FF6B5A"]], 33*W, "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=200&q=80", "Games"));
  seeds.push(q("Qual boi vencera o Festival de Parintins 2026?", "entertainment", "Festival Folclorico de Parintins", [["Boi Garantido", 5100, "#FF6B5A"], ["Boi Caprichoso", 4900, "#5B9DFF"]], 13*W, "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=200&q=80", "Cultura"));
  seeds.push(q("Buzeira sera solto em 2026?", "entertainment", "Celebridades", [["Sim", 5400, "#10B981"], ["Nao", 4600, "#FF6B5A"]], 39*W, "https://ui-avatars.com/api/?name=BZ&background=FFB800&color=fff&size=200&bold=true", "Celebridades"));
  seeds.push(q("Jesus Cristo retornara ate 2030?", "entertainment", "Previsao mistica", [["Sim", 2000, "#FFB800"], ["Nao", 8000, "#FF6B5A"]], 39*W, "https://images.unsplash.com/photo-1445112098124-3e76dd67983c?w=200&q=80", "Celebridades"));

  // Esportes
  seeds.push(q("Serie A: Atletico-MG vs Cruzeiro", "sports", "Brasileirao Serie A", [["Atletico", 3560, "#10B981"], ["Cruzeiro", 3800, "#FF6B5A"]], 2*D, "https://ui-avatars.com/api/?name=ATL&background=000000&color=fff&size=200&bold=true", "Brasileirao"));
  seeds.push(q("Serie A: Botafogo vs Fluminense", "sports", "Brasileirao Serie A", [["Botaf...", 3850, "#10B981"], ["Mirando...", 3160, "#FF6B5A"]], 5*D, "https://ui-avatars.com/api/?name=BOT&background=000000&color=fff&size=200&bold=true", "Brasileirao"));
  seeds.push(q("Serie A: Internacional vs Gremio", "sports", "Grenal", [["Inter", 3940, "#FF6B5A"], ["Gremio", 3200, "#5B9DFF"]], 35*W, "https://ui-avatars.com/api/?name=INT&background=CC0000&color=fff&size=200&bold=true", "Brasileirao"));
  seeds.push(q("Serie A: Coritiba vs Vasco", "sports", "Brasileirao Serie A", [["Vasco...", 4320, "#5B9DFF"], ["Coritiba", 2800, "#10B981"]], 35*W, "https://ui-avatars.com/api/?name=VAS&background=000000&color=fff&size=200&bold=true", "Brasileirao"));
  seeds.push(q("Serie A: Fluminense vs Corinthians", "sports", "Brasileirao Serie A", [["Corin...", 3770, "#10B981"], ["Flu", 3100, "#FF6B5A"]], 35*W, "https://ui-avatars.com/api/?name=FLU&background=8B0000&color=fff&size=200&bold=true", "Brasileirao"));
  seeds.push(q("Brasileirao: Flamengo sera campeao 2026?", "sports", "Campeonato Brasileiro", [["Sim", 2800, "#10B981"], ["Nao", 7200, "#FF6B5A"]], 35*W, "https://ui-avatars.com/api/?name=FLA&background=FF0000&color=fff&size=200&bold=true", "Brasileirao"));
  seeds.push(q("Brasileirao: Palmeiras sera campeao 2026?", "sports", "Campeonato Brasileiro", [["Sim", 2800, "#10B981"], ["Nao", 7200, "#FF6B5A"]], 35*W, "https://ui-avatars.com/api/?name=PAL&background=006400&color=fff&size=200&bold=true", "Brasileirao"));
  seeds.push(q("Copa do Brasil: Corinthians avanca?", "sports", "Copa do Brasil 2026", [["Sim", 3800, "#10B981"], ["Nao", 6200, "#FF6B5A"]], 36*W, "https://ui-avatars.com/api/?name=COR&background=000000&color=fff&size=200&bold=true", "Copa do Brasil"));
  seeds.push(q("Champions League: Real Madrid avanca?", "sports", "UEFA Champions League", [["Sim", 2800, "#10B981"], ["Nao", 7200, "#FF6B5A"]], 9*W, "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=200&q=80", "Champions"));
  seeds.push(q("Champions League: Barcelona avanca?", "sports", "UEFA Champions League", [["Sim", 2300, "#10B981"], ["Nao", 7700, "#FF6B5A"]], 9*W, "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=200&q=80", "Champions"));
  seeds.push(q("Neymar Jr sera convocado para a Selecao?", "sports", "Selecao Brasileira", [["Sim", 6200, "#10B981"], ["Nao", 3800, "#FF6B5A"]], 10*W, "https://ui-avatars.com/api/?name=NEY&background=FFFF00&color=000&size=200&bold=true", "Selecao"));
  seeds.push(q("Copa do Mundo 2026: Brasil sera campeao?", "sports", "FIFA World Cup 2026", [["Sim", 1300, "#10B981"], ["Nao", 8700, "#FF6B5A"]], 16*W, "https://ui-avatars.com/api/?name=BR&background=009739&color=fff&size=200&bold=true", "Copa do Mundo"));
  seeds.push(q("Dudu Fit x Ganley: Quem vence?", "sports", "Luta de exibicao", [["Ganley", 6000, "#10B981"], ["Dudu Fit", 4000, "#FF6B5A"]], 16*W, "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=200&q=80", "Lutas"));
  seeds.push(q("Boxe: Floyd Mayweather x Manny Pacquiao 3?", "sports", "Luta confirmada?", [["Floyd...", 6800, "#10B981"], ["Manny...", 3200, "#FF6B5A"]], 25*W, "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=200&q=80", "Boxe"));
  seeds.push(q("Mr. Olympia 2026: Ramon Dino vence?", "sports", "Fisiculturismo", [["Sim", 6300, "#10B981"], ["Nao", 3700, "#FF6B5A"]], 26*W, "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200&q=80", "Fisiculturismo"));

  // Politica
  seeds.push(q("Jair Bolsonaro entra no Caso...?", "politics", "Investigacao policial", [["Sim", 2200, "#10B981"], ["Nao", 7800, "#FF6B5A"]], 13*W, "https://ui-avatars.com/api/?name=JB&background=009739&color=fff&size=200&bold=true", "Politica BR"));
  seeds.push(q("Andre Valadao entra no Caso...?", "politics", "Politica e religiao", [["Sim", 3300, "#10B981"], ["Nao", 6700, "#FF6B5A"]], 13*W, "https://ui-avatars.com/api/?name=AV&background=5B9DFF&color=fff&size=200&bold=true", "Politica BR"));
  seeds.push(q("Tarcisio de Freitas entra no Caso...?", "politics", "Governador de SP", [["Sim", 3200, "#10B981"], ["Nao", 6800, "#FF6B5A"]], 13*W, "https://ui-avatars.com/api/?name=TF&background=FFB800&color=fff&size=200&bold=true", "Politica BR"));
  seeds.push(q("O regime iraniano caira ate 2027?", "politics", "Geopolitica", [["Sim", 5000, "#10B981"], ["Nao", 5000, "#FF6B5A"]], 4*52*W, "https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=200&q=80", "Geopolitica"));
  seeds.push(q("O conflito entre Ira e Israel sera resolvido em 2026?", "politics", "Geopolitica Oriente Medio", [["Sim", 1100, "#10B981"], ["Nao", 8900, "#FF6B5A"]], 4*D, "https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=200&q=80", "Geopolitica"));
  seeds.push(q("Quem sera o candidato a presidencia dos EUA em 2028?", "politics", "Eleicoes americanas", [["Soldado...", 3420, "#10B981"], ["Gerla...", 2880, "#5B9DFF"]], 20*W, "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=200&q=80", "Politica EUA"));
  seeds.push(q("Lulinha sera preso ate 2027?", "politics", "Investigacao", [["Sim", 3600, "#10B981"], ["Nao", 6400, "#FF6B5A"]], 39*W, "https://ui-avatars.com/api/?name=LL&background=CC0000&color=fff&size=200&bold=true", "Politica BR"));
  seeds.push(q("O mercado preditivo sera regulamentado no Brasil?", "politics", "Legislacao brasileira", [["Sim", 7000, "#10B981"], ["Nao", 3000, "#FF6B5A"]], 39*W, "https://ui-avatars.com/api/?name=BR&background=009739&color=fff&size=200&bold=true", "Regulamentacao"));
  seeds.push(q("EUA adquirem a Groenlandia ate 2030?", "politics", "Geopolitica internacional", [["Sim", 2600, "#10B981"], ["Nao", 7400, "#FF6B5A"]], 39*W, "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=200&q=80", "Geopolitica"));
  seeds.push(q("Eleicao: Presidente do Brasil 2026", "politics", "Corrida eleitoral", [["Flavio...", 3920, "#10B981"], ["Lula", 3310, "#FF6B5A"]], 30*W, "https://ui-avatars.com/api/?name=BR&background=009739&color=fff&size=200&bold=true", "Eleicoes 2026"));

  // Clima extra
  seeds.push(q("Chove em Sao Paulo, SP em marco?", "weather", "INMET SP", [["Sim", 1400, "#10B981"], ["Nao", 8600, "#FF6B5A"]], 11*H, "https://images.unsplash.com/photo-1501691223387-dd0500403074?w=200&q=80", "Clima SP"));
  seeds.push(q("Rio de Janeiro, RJ atinge 31°C amanha?", "weather", "Temperatura maxima INMET", [["Sim", 1600, "#10B981"], ["Nao", 8400, "#FF6B5A"]], D, "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=200&q=80", "Clima RJ"));

  // Rodovia - Porto de Santos
  const rodovia = q("Rodovia (5 min): quantos veiculos passam no Porto de Santos?", "custom", "Contagem automatica via IA. Camera ao vivo 24h - Entrada do Canal do Porto.", [["Mais de 97", 2900, "#10B981"], ["Ate 97", 7100, "#FF5252"]], 5 * 60000, "https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=200&q=80", "Porto de Santos - SP");
  rodovia.stream_url = "https://www.youtube.com/watch?v=tMYtrEBNVAU";
  rodovia.stream_type = "youtube";
  seeds.push(rodovia);

  saveMarkets(seeds.map(recalcMarket));
  put(K.init, true);
}

// ---- DASHBOARD ----
export function getDashboardStats() {
  const markets = getMarkets();
  const bets = getBets();
  const settlements = getSettlements();
  const alerts = getAlerts();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const todayBets = bets.filter((b) => b.created_at >= todayMs);
  const todayVolume = todayBets.reduce((s, b) => s + b.amount, 0);
  const openMarkets = markets.filter((m) => ["open", "frozen"].includes(m.status));
  const totalExposure = openMarkets.reduce((s, m) => s + m.pool_total, 0);
  const todayFees = settlements.filter((s) => s.settled_at >= todayMs).reduce((s, st) => s + st.house_fee_collected, 0);
  const activeAlerts = alerts.filter((a) => !a.resolved);
  const awaitingResolution = markets.filter((m) => m.status === "awaiting_resolution");

  // Category breakdown
  const catBreakdown: Record<string, { count: number; volume: number }> = {};
  markets.forEach((m) => {
    if (!catBreakdown[m.category]) catBreakdown[m.category] = { count: 0, volume: 0 };
    catBreakdown[m.category].count++;
    catBreakdown[m.category].volume += m.pool_total;
  });

  return {
    totalMarkets: markets.length, openMarkets: openMarkets.length,
    totalBetsToday: todayBets.length, volumeToday: todayVolume,
    feeToday: todayFees, totalExposure, activeAlerts: activeAlerts.length,
    totalUsers: new Set(bets.map((b) => b.user_id)).size,
    awaitingResolution: awaitingResolution.length,
    markets, recentBets: bets.slice(-20).reverse(),
    alerts: activeAlerts.slice(-10), catBreakdown,
  };
}
