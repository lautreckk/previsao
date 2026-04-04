/**
 * Bot Engine — runs client-side on the market page.
 * Periodically picks a random bot and places a REAL bet via the API.
 * Emits events so the UI can show live activity.
 */

export interface LiveBet {
  id: string;
  user_name: string;
  user_id: string;
  outcome_key: string;
  outcome_label: string;
  outcome_color: string;
  amount: number;
  potential_win: number;
  ts: number;
}

interface BotInfo {
  id: string;
  name: string;
  balance: number;
  level: number;
  total_predictions: number;
}

interface Outcome {
  key: string;
  label: string;
  color: string;
  pool: number;
  payout_per_unit: number;
}

let activeBots: BotInfo[] = [];
let botsFetched = false;

async function fetchBots(): Promise<BotInfo[]> {
  if (botsFetched && activeBots.length > 0) return activeBots;
  try {
    const res = await fetch("/api/bots/active");
    const data = await res.json();
    activeBots = data.bots || [];
    botsFetched = true;
    // Refresh after 60s
    setTimeout(() => { botsFetched = false; }, 60000);
    return activeBots;
  } catch {
    return activeBots;
  }
}

// Fallback bot names for visual-only bets when API bots are unavailable
const FALLBACK_BOT_NAMES = [
  "Lucas M.", "Pedro S.", "Mari P.", "Ana C.", "Carol B.", "Bia R.",
  "Julia F.", "Joao V.", "Bruno L.", "Rafael K.", "Vini S.", "Duda M.",
  "Leo T.", "Matheus G.", "Amanda S.", "Felipe R.", "Luiza N.", "Alice P.",
  "Gabriel S.", "Renata N.", "Thiago C.", "Camila B.", "Diego L.", "Patricia F.",
  "Henrique Santos", "Renata Nunes", "Fernanda Lima", "Ricardo Souza",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedOutcome(outcomes: Outcome[]): Outcome {
  // 70% chance to bet on the favorite (highest pool), 30% underdog
  const sorted = [...outcomes].sort((a, b) => b.pool - a.pool);
  if (Math.random() < 0.7) return sorted[0];
  return pick(sorted.slice(1).length > 0 ? sorted.slice(1) : sorted);
}

function randomAmount(): number {
  const r = Math.random();
  if (r < 0.60) return randInt(5, 50);       // 60%: small bets
  if (r < 0.90) return randInt(50, 100);      // 30%: medium bets
  return randInt(100, 200);                    // 10%: big bets
}

export function createBotEngine(
  marketId: string,
  onNewBet: (bet: LiveBet) => void,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  // Visual-only fallback bet (no API call, just UI activity)
  function emitVisualBet(outcomes: Outcome[]) {
    const outcome = weightedOutcome(outcomes);
    const amount = randomAmount();
    const payout = outcome.payout_per_unit || 1.5;
    onNewBet({
      id: `vis_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_name: pick(FALLBACK_BOT_NAMES),
      user_id: "",
      outcome_key: outcome.key,
      outcome_label: outcome.label,
      outcome_color: outcome.color,
      amount,
      potential_win: +(amount * payout).toFixed(2),
      ts: Date.now(),
    });
  }

  async function tick(outcomes: Outcome[]) {
    if (!running) return;

    if (outcomes.length === 0) {
      scheduleNext(outcomes);
      return;
    }

    const bots = await fetchBots();

    // No bots available — emit visual-only bet
    if (bots.length === 0) {
      emitVisualBet(outcomes);
      scheduleNext(outcomes);
      return;
    }

    const bot = pick(bots);
    const outcome = weightedOutcome(outcomes);
    const amount = Math.min(randomAmount(), Math.floor(bot.balance));

    // Bot has no balance — emit visual-only bet
    if (amount < 1) {
      emitVisualBet(outcomes);
      scheduleNext(outcomes);
      return;
    }

    try {
      const res = await fetch("/api/markets/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market_id: marketId,
          outcome_key: outcome.key,
          outcome_label: outcome.label,
          amount,
          user_id: bot.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const potentialWin = +(amount * (data.bet?.payout_at_entry || outcome.payout_per_unit || 1.5)).toFixed(2);

        onNewBet({
          id: data.bet?.id || `vis_${Date.now()}`,
          user_name: bot.name,
          user_id: bot.id,
          outcome_key: outcome.key,
          outcome_label: outcome.label,
          outcome_color: outcome.color,
          amount,
          potential_win: potentialWin,
          ts: Date.now(),
        });

        // Reduce local balance to prevent overspend
        bot.balance -= amount;
      } else {
        // API failed — show visual bet anyway
        emitVisualBet(outcomes);
      }
    } catch {
      // Network error — show visual bet anyway
      emitVisualBet(outcomes);
    }

    scheduleNext(outcomes);
  }

  function scheduleNext(outcomes: Outcome[]) {
    if (!running) return;
    // 3-8 second interval for ~8-20 bots per minute
    const delay = randInt(3000, 8000);
    timer = setTimeout(() => tick(outcomes), delay);
  }

  return {
    start(outcomes: Outcome[]) {
      if (running) return;
      running = true;
      // Initial delay 2-5s before first bot bet
      timer = setTimeout(() => tick(outcomes), randInt(2000, 5000));
    },

    updateOutcomes(outcomes: Outcome[]) {
      // Called when odds update so bots use fresh data
      if (running && timer) {
        clearTimeout(timer);
        scheduleNext(outcomes);
      }
    },

    stop() {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
