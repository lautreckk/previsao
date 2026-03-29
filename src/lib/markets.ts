// Re-export types for frontend compatibility
// The real data now comes from the engine store

export type { PredictionMarket as Market } from "./engines/types";
export { CATEGORY_META as categories } from "./engines/types";
export type { MarketOutcome } from "./engines/types";
