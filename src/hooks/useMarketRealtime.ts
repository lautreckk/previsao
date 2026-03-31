"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { PredictionMarket } from "@/lib/engines/types";

interface LivePriceData {
  symbol: string;
  price: number;
  change_24h: number;
  change_pct_24h: number;
  timestamp: number;
}

interface UseMarketRealtimeReturn {
  market: PredictionMarket | null;
  livePrice: LivePriceData | null;
  isConnected: boolean;
}

export function useMarketRealtime(
  initialMarket: PredictionMarket
): UseMarketRealtimeReturn {
  const [market, setMarket] = useState<PredictionMarket>(initialMarket);
  const [livePrice, setLivePrice] = useState<LivePriceData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const marketIdRef = useRef(initialMarket.id);

  // Keep ref in sync with prop changes
  useEffect(() => {
    marketIdRef.current = initialMarket.id;
    setMarket(initialMarket);
  }, [initialMarket]);

  useEffect(() => {
    const marketId = marketIdRef.current;

    // Channel 1: Postgres Changes on prediction_markets table
    const dbChannel = supabase
      .channel(`market-db-${marketId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "prediction_markets",
          filter: `id=eq.${marketId}`,
        },
        (payload) => {
          const updated = payload.new as PredictionMarket;
          if (updated && updated.id === marketId) {
            setMarket((prev) => ({ ...prev, ...updated }));
          }
        }
      )
      .subscribe((status) => {
        setIsConnected((prev) => {
          if (status === "SUBSCRIBED") return true;
          if (status === "CLOSED" || status === "CHANNEL_ERROR") return false;
          return prev;
        });
      });

    // Channel 2: Broadcast channel for live price data
    const priceChannel = supabase
      .channel(`market-prices-${marketId}`)
      .on("broadcast", { event: "price.update" }, (payload) => {
        const data = payload.payload as LivePriceData;
        if (data) {
          setLivePrice(data);
        }
      })
      .on("broadcast", { event: "odds.update" }, (payload) => {
        const data = payload.payload as {
          market_id: string;
          outcomes: PredictionMarket["outcomes"];
          pool_total: number;
        };
        if (data && data.market_id === marketId) {
          setMarket((prev) => ({
            ...prev,
            outcomes: data.outcomes,
            pool_total: data.pool_total,
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(priceChannel);
    };
  }, [initialMarket.id]);

  return { market, livePrice, isConnected };
}
