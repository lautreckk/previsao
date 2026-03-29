// ============================================================
// WINIFY - MARKET ENGINE (Generic, Multi-Category)
// ============================================================

import {
  PredictionMarket, MarketStatus, MarketCategory, MarketType,
  OutcomeType, ResolutionType, SourceType, MarketOutcome,
  DEFAULT_CONFIG, generateSlug, createOutcome,
} from "./types";
import { recalcMarket } from "./parimutuel";

const VALID_TRANSITIONS: Record<MarketStatus, MarketStatus[]> = {
  draft: ["scheduled", "open", "cancelled"],
  scheduled: ["open", "cancelled"],
  open: ["frozen", "closed", "cancelled"],
  frozen: ["open", "closed", "cancelled"],
  closed: ["awaiting_resolution", "cancelled"],
  awaiting_resolution: ["resolved", "cancelled"],
  resolved: [],
  cancelled: [],
};

export function canTransition(from: MarketStatus, to: MarketStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionMarket(
  market: PredictionMarket,
  newStatus: MarketStatus
): { success: boolean; market?: PredictionMarket; error?: string } {
  if (!canTransition(market.status, newStatus)) {
    return { success: false, error: `Transicao invalida: ${market.status} -> ${newStatus}` };
  }
  return { success: true, market: { ...market, status: newStatus } };
}

export interface CreateMarketParams {
  title: string;
  short_description: string;
  full_description?: string;
  category: MarketCategory;
  subcategory?: string;
  banner_url?: string;
  tags?: string[];
  market_type: MarketType;
  outcome_type: OutcomeType;
  outcomes: { key: string; label: string; color: string }[];
  resolution_type: ResolutionType;
  source_type: SourceType;
  source_name?: string;
  source_url?: string;
  resolution_expression?: string;
  resolution_description?: string;
  open_at: number;
  close_at: number;
  house_fee_percent?: number;
  min_bet?: number;
  max_bet?: number;
  max_payout?: number;
  max_liability?: number;
  country?: string;
  is_featured?: boolean;
  created_by?: string;
}

export function createMarket(params: CreateMarketParams): PredictionMarket {
  const config = DEFAULT_CONFIG;
  const freezeBuffer = config.freeze_buffer_seconds * 1000;

  const outcomes: MarketOutcome[] = params.outcomes.map((o) =>
    createOutcome(o.key, o.label, o.color)
  );

  // Build outcome_map from outcomes
  const outcome_map: Record<string, string> = {};
  outcomes.forEach((o, i) => {
    if (i === 0) outcome_map["true"] = o.key;
    if (i === 1) outcome_map["false"] = o.key;
  });

  const market: PredictionMarket = {
    id: `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: params.title,
    slug: generateSlug(params.title),
    short_description: params.short_description,
    full_description: params.full_description || "",
    category: params.category,
    subcategory: params.subcategory || "",
    tags: params.tags || [],
    country: params.country,
    language: "pt-BR",
    banner_url: params.banner_url || "",
    is_featured: params.is_featured || false,
    visibility: "public",
    market_type: params.market_type,
    outcome_type: params.outcome_type,
    outcomes,
    resolution_type: params.resolution_type,
    source_type: params.source_type,
    source_config: {
      source_name: params.source_name || "manual",
      source_url: params.source_url,
      requires_manual_confirmation: params.resolution_type !== "automatic",
      requires_evidence_upload: params.resolution_type === "manual",
    },
    resolution_rule: {
      expression: params.resolution_expression || "",
      variables: [],
      outcome_map,
      description: params.resolution_description || "",
    },
    created_at: Date.now(),
    open_at: params.open_at,
    freeze_at: params.close_at - freezeBuffer,
    close_at: params.close_at,
    resolve_at: params.close_at + 60000,
    status: "draft",
    house_fee_percent: params.house_fee_percent ?? config.default_house_fee_percent,
    min_bet: params.min_bet ?? config.default_min_bet,
    max_bet: params.max_bet ?? config.default_max_bet,
    max_payout: params.max_payout ?? config.default_max_payout,
    max_liability: params.max_liability ?? config.default_max_liability,
    pool_total: 0,
    distributable_pool: 0,
    created_by: params.created_by || "admin",
    volume: 0,
  };

  return recalcMarket(market);
}

/**
 * Add a bet to market outcome pools
 */
export function addBetToMarket(
  market: PredictionMarket,
  outcomeKey: string,
  amount: number,
  isNewUserOnOutcome: boolean
): PredictionMarket {
  const updated = {
    ...market,
    outcomes: market.outcomes.map((o) => {
      if (o.key !== outcomeKey) return o;
      return {
        ...o,
        pool: o.pool + amount,
        bet_count: o.bet_count + 1,
        unique_users: isNewUserOnOutcome ? o.unique_users + 1 : o.unique_users,
      };
    }),
  };
  return recalcMarket(updated);
}

/**
 * Auto-manage market lifecycle
 */
export function tickMarket(market: PredictionMarket): PredictionMarket {
  const now = Date.now();
  let updated = { ...market };

  if ((updated.status === "draft" || updated.status === "scheduled") && now >= updated.open_at && now < updated.freeze_at) {
    updated.status = "open";
  }
  if (updated.status === "open" && now >= updated.freeze_at) {
    updated.status = "frozen";
  }
  if (updated.status === "frozen" && now >= updated.close_at) {
    updated.status = "closed";
  }
  if (updated.status === "closed" && now >= updated.resolve_at) {
    updated.status = "awaiting_resolution";
  }

  return updated;
}

// ---- PRESETS ----

export function presetBinary(title: string, category: MarketCategory, desc: string, opts?: Partial<CreateMarketParams>): CreateMarketParams {
  return {
    title,
    short_description: desc,
    category,
    market_type: "yes_no",
    outcome_type: "yes_no",
    outcomes: [
      { key: "YES", label: "Sim", color: "#00D4AA" },
      { key: "NO", label: "Nao", color: "#FF6B5A" },
    ],
    resolution_type: "manual",
    source_type: "manual",
    open_at: Date.now(),
    close_at: Date.now() + 24 * 60 * 60 * 1000,
    ...opts,
  };
}

export function presetUpDown(asset: string, timeframeMin: number, opts?: Partial<CreateMarketParams>): CreateMarketParams {
  return {
    title: `${asset} (${timeframeMin}min): sobe ou desce?`,
    short_description: `Preco do ${asset} em ${timeframeMin} minutos`,
    category: "crypto",
    market_type: "up_down",
    outcome_type: "up_down",
    outcomes: [
      { key: "UP", label: "Sobe", color: "#00D4AA" },
      { key: "DOWN", label: "Desce", color: "#FF6B5A" },
    ],
    resolution_type: "automatic",
    source_type: "api",
    source_name: `binance_${asset.toLowerCase()}usdt`,
    resolution_expression: "close_price > open_price",
    resolution_description: `Preco de fechamento > preco de abertura`,
    open_at: Date.now(),
    close_at: Date.now() + timeframeMin * 60 * 1000,
    house_fee_percent: 0.05,
    ...opts,
  };
}

export function presetSports(home: string, away: string, league: string, opts?: Partial<CreateMarketParams>): CreateMarketParams {
  return {
    title: `${home} vs ${away}`,
    short_description: league,
    category: "sports",
    subcategory: league,
    market_type: "multi_outcome",
    outcome_type: "team_win_draw",
    outcomes: [
      { key: "HOME", label: home, color: "#00D4AA" },
      { key: "DRAW", label: "Empate", color: "#FFB800" },
      { key: "AWAY", label: away, color: "#FF6B5A" },
    ],
    resolution_type: "semi_automatic",
    source_type: "api",
    open_at: Date.now(),
    close_at: Date.now() + 3 * 60 * 60 * 1000,
    ...opts,
  };
}

export function presetMultiChoice(title: string, category: MarketCategory, desc: string, choices: string[], opts?: Partial<CreateMarketParams>): CreateMarketParams {
  const colors = ["#00D4AA", "#FFB800", "#FF6B5A", "#5B9DFF", "#E040FB", "#8B95A8"];
  return {
    title,
    short_description: desc,
    category,
    market_type: "multi_outcome",
    outcome_type: "multiple_choice",
    outcomes: choices.map((c, i) => ({ key: c.toUpperCase().replace(/\s+/g, "_").slice(0, 20), label: c, color: colors[i % colors.length] })),
    resolution_type: "manual",
    source_type: "manual",
    open_at: Date.now(),
    close_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
    ...opts,
  };
}
