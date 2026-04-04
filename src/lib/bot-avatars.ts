/**
 * Bot avatar system — ~40% of bots get real photo avatars,
 * the rest use dicebear SVGs. Consistent per bot name.
 */

// Names that get real photo avatars (seeded via i.pravatar.cc)
const PHOTO_AVATAR_NAMES = new Set([
  "lucas", "pedro", "mari", "ana", "carol", "bia",
  "julia", "duda", "amanda", "luiza", "alice", "nath",
  "gabriel", "renata", "thiago", "camila", "bruna", "rafael",
  "larissa", "felipe", "fernanda", "diego", "patricia", "rodrigo",
]);

/**
 * Returns avatar URL for a bot name.
 * ~40% get real photos, rest get dicebear SVGs.
 */
export function getBotAvatarUrl(name: string): string {
  const lower = name.toLowerCase().replace("@", "").split("_")[0].split(".")[0];
  if (PHOTO_AVATAR_NAMES.has(lower)) {
    return `https://i.pravatar.cc/40?u=${encodeURIComponent(name)}`;
  }
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=transparent`;
}

/**
 * Check if a name gets a photo avatar (for rendering optimization)
 */
export function hasPhotoAvatar(name: string): boolean {
  const lower = name.toLowerCase().replace("@", "").split("_")[0].split(".")[0];
  return PHOTO_AVATAR_NAMES.has(lower);
}

/** Chat messages bots say after placing bets */
export const BET_CHAT_MESSAGES: Record<string, string[]> = {
  positive: [
    "confia no processo", "bora pra cima", "ja era, facil demais",
    "coloquei tudo nesse", "to confiante demais", "vamoooo",
    "sem medo", "apostei pesado", "quem nao arrisca nao petisca",
    "confio demais", "ta na mao", "vai dar bom",
    "bora lucrar", "all in", "confia",
  ],
  negative: [
    "hmm arriscado", "vamos ver ne", "to com medo",
    "torce comigo", "sera que vai?", "apostei pouco por seguranca",
    "nao sei nao", "rezando aqui", "pqp se perder...",
  ],
  general: [
    "boa sorte galera", "alguem mais foi nessa?",
    "quem ta junto?", "bora", "lets goo",
    "primeira vez aqui, to gostando", "viciei nesse site",
    "ja acertei 3 seguidas", "essa eu confio",
  ],
};

export function getRandomBetMessage(): string {
  const r = Math.random();
  const pool = r < 0.5 ? BET_CHAT_MESSAGES.positive
    : r < 0.75 ? BET_CHAT_MESSAGES.general
    : BET_CHAT_MESSAGES.negative;
  return pool[Math.floor(Math.random() * pool.length)];
}
