/**
 * Seed 500 bot users into Supabase with realistic Brazilian names,
 * varied balances, and pre-populated stats.
 *
 * Run: npx tsx scripts/seed-bots.ts
 *
 * Idempotent — skips if bots already exist (checks @winify.bot emails).
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load env from .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE env vars. Check .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Name pools ───
const FIRST_NAMES = [
  "joao","pedro","lucas","matheus","gabriel","rafael","gustavo","felipe","bruno","thiago",
  "andre","diego","henrique","victor","caio","daniel","marcos","leonardo","rodrigo","eduardo",
  "maria","ana","julia","beatriz","larissa","camila","fernanda","amanda","bruna","carolina",
  "jessica","gabriela","leticia","mariana","natalia","isabela","tatiana","aline","raquel","vanessa",
  "patricia","renata","bianca","priscila","daniela","roberta","luana","monique","michele","sabrina",
  "vinicius","fabio","alex","leandro","sergio","paulo","carlos","marcelo","william","arthur",
  "nicolas","samuel","bernardo","heitor","miguel","enzo","davi","noah","liam","valentina",
  "helena","alice","laura","sophia","manuela","cecilia","lorena","giovanna","luna","yasmin",
  "igor","renan","wallace","kelvin","kaua","ruan","yuri","otavio","luciano","emerson",
  "tais","milena","viviane","cintia","elaine","simone","adriana","rosana","marta","solange",
];

const LAST_NAMES = [
  "silva","santos","oliveira","souza","rodrigues","ferreira","almeida","nascimento","lima","araujo",
  "pereira","carvalho","gomes","martins","rocha","ribeiro","costa","dias","monteiro","moreira",
  "barbosa","ramos","cardoso","mendes","lopes","freitas","vieira","andrade","cunha","campos",
  "nunes","teixeira","batista","correia","pinto","macedo","medeiros","aguiar","cavalcanti","amaral",
  "barros","melo","reis","moraes","fonseca","guimaraes","vasconcelos","magalhaes","pires","bezerra",
];

const CITIES = ["sp","rj","bh","df","ba","pr","rs","sc","go","ce","pe","pa","mg","am","mt","es","pb","rn","se","al","ma","pi","to","ro","ap","ac","rr"];

// ─── Helpers ───
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min: number, max: number) { return +(Math.random() * (max - min) + min).toFixed(2); }

function calcLevel(predictions: number): number {
  if (predictions >= 500) return 8;
  if (predictions >= 350) return 7;
  if (predictions >= 200) return 6;
  if (predictions >= 100) return 5;
  if (predictions >= 50) return 4;
  if (predictions >= 30) return 3;
  if (predictions >= 10) return 2;
  return 1;
}

function generateBot(index: number) {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const city = pick(CITIES);
  const num = randInt(1, 99);

  // Various username patterns
  const patterns = [
    `${first}_${last}${num}`,
    `${first}_${city}${num}`,
    `${first}${num}_${city}`,
    `${first}_${last}`,
    `${first}${last}${num}`,
    `${first}_${city}`,
  ];
  const username = pick(patterns);
  const displayName = `${first.charAt(0).toUpperCase() + first.slice(1)} ${last.charAt(0).toUpperCase() + last.slice(1)}`;

  // Stats - varied distribution
  const tier = Math.random();
  let totalPredictions: number;
  let winRate: number;

  if (tier < 0.05) {
    // 5% whale/pro bots
    totalPredictions = randInt(300, 600);
    winRate = randFloat(0.55, 0.75);
  } else if (tier < 0.20) {
    // 15% active bots
    totalPredictions = randInt(100, 300);
    winRate = randFloat(0.45, 0.65);
  } else if (tier < 0.50) {
    // 30% regular bots
    totalPredictions = randInt(30, 100);
    winRate = randFloat(0.35, 0.60);
  } else if (tier < 0.80) {
    // 30% casual bots
    totalPredictions = randInt(10, 30);
    winRate = randFloat(0.30, 0.55);
  } else {
    // 20% new bots
    totalPredictions = randInt(1, 10);
    winRate = randFloat(0.20, 0.60);
  }

  const totalWins = Math.round(totalPredictions * winRate);
  const totalLosses = totalPredictions - totalWins;

  // Financial stats
  const avgBet = randFloat(10, 150);
  const totalWagered = +(totalPredictions * avgBet).toFixed(2);
  const avgReturn = avgBet * randFloat(1.5, 2.5);
  const totalReturns = +(totalWins * avgReturn).toFixed(2);

  // Balance: profitable bots have more
  const profit = totalReturns - totalWagered;
  const baseBalance = randFloat(50, 2000);
  const balance = Math.max(50, +(baseBalance + Math.max(0, profit * 0.3)).toFixed(2));

  // Streaks
  const winStreak = randInt(0, Math.min(totalWins, 8));
  const bestStreak = Math.max(winStreak, randInt(winStreak, Math.min(totalWins, 15)));

  const id = `bot_${index.toString().padStart(4, "0")}_${username.slice(0, 8)}`;

  return {
    id,
    name: displayName,
    email: `bot_${username}@winify.bot`,
    cpf: "",
    phone: "",
    password: "bot_no_login_2024",
    balance,
    avatar_url: "",
    is_public: true,
    is_bot: true,
    bio: "",
    level: calcLevel(totalPredictions),
    total_predictions: totalPredictions,
    total_wins: totalWins,
    total_losses: totalLosses,
    total_wagered: totalWagered,
    total_returns: totalReturns,
    win_streak: winStreak,
    best_streak: bestStreak,
    rank_position: 0,
  };
}

async function main() {
  console.log("🤖 Checking for existing bots...");

  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("is_bot", true);

  if (count && count >= 400) {
    console.log(`✅ Already ${count} bots in database. Skipping seed.`);
    return;
  }

  console.log(`📊 Found ${count || 0} existing bots. Generating ${500 - (count || 0)} new bots...`);

  const bots = [];
  const existingEmails = new Set<string>();

  // Get existing bot emails to avoid duplicates
  if (count && count > 0) {
    const { data } = await supabase.from("users").select("email").eq("is_bot", true);
    data?.forEach((u) => existingEmails.add(u.email));
  }

  for (let i = 0; i < 500; i++) {
    let bot = generateBot(i);
    // Retry if email collision
    let attempts = 0;
    while (existingEmails.has(bot.email) && attempts < 10) {
      bot = generateBot(i + 1000 + attempts);
      attempts++;
    }
    if (!existingEmails.has(bot.email)) {
      existingEmails.add(bot.email);
      bots.push(bot);
    }
  }

  // Insert in batches of 50
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < bots.length; i += BATCH) {
    const batch = bots.slice(i, i + BATCH);
    const { error } = await supabase.from("users").upsert(batch, { onConflict: "email" });
    if (error) {
      console.error(`❌ Batch ${i / BATCH + 1} error:`, error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  Inserted ${inserted}/${bots.length} bots...`);
    }
  }

  console.log(`\n✅ Seeded ${inserted} bots successfully!`);

  // Update rank positions
  console.log("📊 Calculating rankings...");
  const { data: allUsers } = await supabase
    .from("users")
    .select("id, total_returns, total_wagered, total_predictions")
    .eq("is_public", true)
    .order("total_returns", { ascending: false });

  if (allUsers) {
    // Rank by profit (returns - wagered)
    const sorted = allUsers
      .map((u) => ({ id: u.id, profit: (Number(u.total_returns) || 0) - (Number(u.total_wagered) || 0) }))
      .sort((a, b) => b.profit - a.profit);

    // Update in batches
    for (let i = 0; i < sorted.length; i += BATCH) {
      const batch = sorted.slice(i, i + BATCH);
      await Promise.all(
        batch.map((u, idx) =>
          supabase.from("users").update({ rank_position: i + idx + 1 }).eq("id", u.id)
        )
      );
    }
    console.log(`✅ Updated rankings for ${sorted.length} users.`);
  }

  console.log("\n🎉 Bot seed complete!");
}

main().catch(console.error);
