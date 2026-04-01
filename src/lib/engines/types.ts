// WINIFY - GLOBAL PREDICTION MARKET ENGINE - DATA MODELS

// ---- ENUMS ----

export type MarketCategory =
  | "crypto" | "politics" | "sports" | "weather"
  | "war" | "economy" | "entertainment" | "social_media" | "custom";

export type MarketType =
  | "binary" | "multi_outcome" | "over_under"
  | "yes_no" | "up_down" | "exact_value" | "range";

export type OutcomeType =
  | "yes_no" | "up_down" | "above_below"
  | "team_win_draw" | "multiple_choice" | "numeric_range";

export type ResolutionType = "automatic" | "semi_automatic" | "manual";

export type SourceType = "api" | "scraper" | "rss" | "manual" | "hybrid";

export type MarketStatus =
  | "draft" | "scheduled" | "open" | "frozen"
  | "closed" | "awaiting_resolution" | "resolved" | "cancelled";

export type MarketVisibility = "public" | "unlisted" | "private";

// ---- OUTCOME ----
export interface MarketOutcome {
  id: string;
  key: string;        // e.g. "YES", "NO", "TEAM_A", "OVER_30"
  label: string;      // display label
  description?: string;
  color: string;      // hex color for UI
  pool: number;       // total amount bet on this outcome
  bet_count: number;
  unique_users: number;
  payout_per_unit: number; // current estimated payout
}

// ---- SOURCE CONFIG ----
export interface SourceConfig {
  source_name: string;
  source_url?: string;
  api_endpoint?: string;
  api_key_ref?: string;  // reference to env var, never the actual key
  scraper_selector?: string;
  rss_feed_url?: string;
  fallback_source?: string;
  confidence_threshold?: number; // 0-1
  requires_manual_confirmation: boolean;
  requires_evidence_upload: boolean;
  polling_interval_ms?: number;
  custom_params?: Record<string, unknown>;
}

// ---- RESOLUTION RULE ----
export interface ResolutionRule {
  expression: string;    // e.g. "close_price > open_price", "rain_mm > 0", "score_home > score_away"
  variables: string[];   // e.g. ["close_price", "open_price"]
  outcome_map: Record<string, string>; // maps rule result to outcome key, e.g. { "true": "YES", "false": "NO" }
  description: string;   // human readable
}

// ---- PREDICTION MARKET ----
export interface PredictionMarket {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  full_description: string;

  // Classification
  category: MarketCategory;
  subcategory: string;
  tags: string[];
  country?: string;
  language: string;

  // Display
  banner_url: string;
  is_featured: boolean;
  visibility: MarketVisibility;

  // Structure
  market_type: MarketType;
  outcome_type: OutcomeType;
  outcomes: MarketOutcome[];

  // Resolution
  resolution_type: ResolutionType;
  resolution_method?: "automatic" | "manual";
  source_type: SourceType;
  source_config: SourceConfig;
  resolution_rule: ResolutionRule;
  resolution_evidence?: string;
  resolution_notes?: string;

  // Timing
  created_at: number;
  open_at: number;
  freeze_at: number;
  close_at: number;
  resolve_at: number;

  // Status
  status: MarketStatus;

  // Financial
  house_fee_percent: number;
  min_bet: number;
  max_bet: number;
  max_payout: number;
  max_liability: number;
  pool_total: number;
  distributable_pool: number;

  // Resolution result
  winning_outcome_key?: string;
  resolved_at?: number;
  resolved_by?: string;
  resolution_tx?: string;

  // Admin
  created_by: string;

  // Computed (for legacy compat)
  volume: number;

  // Live camera stream (optional)
  stream_url?: string;
  stream_type?: "youtube" | "hls" | "rtsp" | "iframe";
}

// ---- BET / TICKET ----
export type BetStatus = "pending" | "won" | "lost" | "cancelled" | "refunded";

export interface Bet {
  id: string;
  user_id: string;
  market_id: string;
  outcome_key: string;
  outcome_label: string;
  amount: number;
  payout_at_entry: number;
  final_payout: number;
  status: BetStatus;
  created_at: number;
  snapshot: BetSnapshot;
}

export interface BetSnapshot {
  outcomes: { key: string; pool: number; payout_per_unit: number }[];
  pool_total: number;
  house_fee_percent: number;
  market_status: MarketStatus;
  timestamp: number;
}

// ---- LEDGER ----
export type LedgerType =
  | "deposit" | "withdrawal" | "bet_placed" | "bet_won"
  | "bet_refund" | "bonus" | "fee_collected"
  | "affiliate_commission" | "admin_adjustment";

export interface LedgerEntry {
  id: string;
  user_id: string;
  type: LedgerType;
  amount: number;
  balance_after: number;
  reference_id?: string;
  description: string;
  created_at: number;
  created_by?: string;
}

// ---- SETTLEMENT ----
export interface Settlement {
  id: string;
  market_id: string;
  winning_outcome_key: string;
  winning_outcome_label: string;
  resolution_type: ResolutionType;
  source_payload?: Record<string, unknown>;
  rule_applied: string;
  rule_result: string;
  total_pool: number;
  distributable_pool: number;
  house_fee_collected: number;
  total_winners: number;
  total_losers: number;
  total_payout: number;
  payout_per_unit: number;
  settled_at: number;
  settled_by: string;
  evidence_url?: string;
  notes?: string;
  audit_hash: string;
}

// ---- RISK ----
export interface RiskAlert {
  id: string;
  market_id: string;
  type: "concentration" | "exposure" | "oracle_failure" | "suspicious_activity" | "limit_breach";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  data: Record<string, unknown>;
  created_at: number;
  resolved: boolean;
  resolved_at?: number;
  resolved_by?: string;
}

export interface RiskSnapshot {
  market_id: string;
  timestamp: number;
  outcomes: { key: string; pool: number; payout: number }[];
  pool_total: number;
  max_liability: number;
  imbalance_ratio: number;
  unique_users: number;
  top_user_concentration: number;
}

// ---- ADMIN ----
export type AdminRole =
  | "super_admin" | "risk_manager" | "trader"
  | "finance" | "support" | "affiliate_manager";

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  ip_address: string;
  timestamp: number;
  justification?: string;
}

// ---- AFFILIATES ----
export type AffiliateModel = "cpa" | "revshare" | "hybrid";

export interface Affiliate {
  id: string;
  name: string;
  email: string;
  code: string;
  model: AffiliateModel;
  cpa_value: number;
  revshare_percent: number;
  is_active: boolean;
  created_at: number;
  total_clicks: number;
  total_signups: number;
  total_ftd: number;
  total_volume: number;
  total_commission: number;
}

// ---- RESOLUTION LOG ----
export interface ResolutionLog {
  id: string;
  market_id: string;
  step: "fetch" | "normalize" | "evaluate" | "confirm" | "settle" | "error";
  payload: Record<string, unknown>;
  result?: string;
  error?: string;
  timestamp: number;
  admin_id?: string;
}

// ---- CONFIG ----
export interface PlatformConfig {
  default_house_fee_percent: number;
  default_max_bet: number;
  default_max_payout: number;
  default_max_liability: number;
  default_min_bet: number;
  min_deposit: number;
  max_deposit: number;
  min_withdrawal: number;
  global_max_liability: number;
  freeze_buffer_seconds: number;
  auto_resolve: boolean;
  maintenance_mode: boolean;
}

export const DEFAULT_CONFIG: PlatformConfig = {
  default_house_fee_percent: 0.05,
  default_max_bet: 10000,
  default_max_payout: 100000,
  default_max_liability: 500000,
  default_min_bet: 1,
  min_deposit: 1,
  max_deposit: 50000,
  min_withdrawal: 10,
  global_max_liability: 2000000,
  freeze_buffer_seconds: 30,
  auto_resolve: true,
  maintenance_mode: false,
};

// ---- CATEGORY METADATA ----
export const CATEGORY_META: Record<MarketCategory, { label: string; icon: string; color: string }> = {
  crypto: { label: "Criptomoedas", icon: "currency_bitcoin", color: "#FFB800" },
  politics: { label: "Politica", icon: "account_balance", color: "#5B9DFF" },
  sports: { label: "Esportes", icon: "sports_soccer", color: "#10B981" },
  weather: { label: "Clima", icon: "wb_sunny", color: "#FFB800" },
  war: { label: "Geopolitica", icon: "public", color: "#FF6B5A" },
  economy: { label: "Economia", icon: "trending_up", color: "#10B981" },
  entertainment: { label: "Entretenimento", icon: "movie", color: "#E040FB" },
  social_media: { label: "Redes Sociais", icon: "forum", color: "#5B9DFF" },
  custom: { label: "Outros", icon: "category", color: "#8B95A8" },
};

// ---- HELPER: generate slug ----
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

// ---- HELPER: create empty outcome ----
export function createOutcome(key: string, label: string, color: string): MarketOutcome {
  return { id: `out_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, key, label, color, description: "", pool: 0, bet_count: 0, unique_users: 0, payout_per_unit: 0 };
}
