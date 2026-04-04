"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface CameraMarket {
  id: string;
  stream_url: string;
  stream_type: string;
  city: string;
  title: string;
  highway: string;
  camera_id: string;
  status: string;
  current_count: number;
  round_duration_seconds: number;
  thumbnail_url: string;
  phase: "waiting" | "betting" | "observation";
  phase_ends_at: string | null;
  current_threshold: number;
  round_number: number;
}

interface CameraRound {
  id: string;
  round_number: number;
  started_at: string;
  ended_at: string;
  final_count: number | null;
  resolved_at: string | null;
  threshold: number;
  phase: string;
  pool_over: number;
  pool_under: number;
  total_pool: number;
}

interface Odds {
  over: number;
  under: number;
}

export function useCameraMarket(marketId: string) {
  const [market, setMarket] = useState<CameraMarket | null>(null);
  const [currentRound, setCurrentRound] = useState<CameraRound | null>(null);
  const [currentCount, setCurrentCount] = useState(0);
  const [odds, setOdds] = useState<Odds>({ over: 0, under: 0 });
  const [loading, setLoading] = useState(true);
  const [lastResult, setLastResult] = useState<{
    final_count: number;
    threshold: number;
    result: "over" | "under";
    payout_multiplier: number;
  } | null>(null);

  const calculateOdds = useCallback((poolOver: number, poolUnder: number) => {
    const total = poolOver + poolUnder;
    if (total === 0) return { over: 1.9, under: 1.9 }; // default
    return {
      over: poolOver > 0 ? Math.round(((total * 0.95) / poolOver) * 100) / 100 : 0,
      under: poolUnder > 0 ? Math.round(((total * 0.95) / poolUnder) * 100) / 100 : 0,
    };
  }, []);

  const fetchMarket = useCallback(async () => {
    try {
      // Try camera_markets first (cam_ prefix)
      const { data } = await supabase
        .from("camera_markets")
        .select("*")
        .eq("id", marketId)
        .maybeSingle();
      if (data) {
        setMarket(data as CameraMarket);
        setCurrentCount(data.current_count || 0);
        setLoading(false);
        return;
      }

      // Fallback: check prediction_markets for mkt_ markets with stream_url
      const { data: pmData } = await supabase
        .from("prediction_markets")
        .select("*")
        .eq("id", marketId)
        .maybeSingle();
      if (pmData && pmData.stream_url) {
        // Adapt prediction_market to CameraMarket interface
        const adapted: CameraMarket = {
          id: pmData.id,
          stream_url: pmData.stream_url,
          stream_type: pmData.stream_type || "youtube",
          city: pmData.subcategory || "",
          title: pmData.title,
          highway: pmData.short_description || "",
          camera_id: pmData.id,
          status: pmData.status === "open" ? "open" : "waiting",
          current_count: 0,
          round_duration_seconds: 300,
          thumbnail_url: pmData.banner_url || "",
          phase: "waiting",
          phase_ends_at: null,
          current_threshold: 0,
          round_number: 0,
        };
        setMarket(adapted);
        setCurrentCount(0);
      }
    } catch (err) {
      console.error("[useCameraMarket] Error fetching market data:", err);
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  const fetchRound = useCallback(async () => {
    const { data } = await supabase
      .from("camera_rounds")
      .select("*")
      .eq("market_id", marketId)
      .is("resolved_at", null)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setCurrentRound(data as CameraRound);
      setOdds(calculateOdds(Number(data.pool_over), Number(data.pool_under)));
    }
  }, [marketId, calculateOdds]);

  useEffect(() => {
    fetchMarket();
    fetchRound();
  }, [fetchMarket, fetchRound]);

  // Realtime: postgres changes on camera_markets (PRIMARY source for count updates)
  // Worker updates DB directly → postgres_changes fires in ~100-300ms → instant count update
  useEffect(() => {
    const channel = supabase
      .channel(`camera:${marketId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "camera_markets", filter: `id=eq.${marketId}` },
        (payload) => {
          const updated = payload.new as CameraMarket;
          // Update count immediately from DB change (fastest path)
          if (updated.current_count !== undefined) {
            setCurrentCount(updated.current_count);
          }
          setMarket((prev) => (prev ? { ...prev, ...updated } : null));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId]);

  // Realtime: broadcast events (round start, phase change, odds, results)
  useEffect(() => {
    const channel = supabase
      .channel(`cars-stream-${marketId}`)
      .on("broadcast", { event: "round.start" }, ({ payload }) => {
        setMarket((prev) =>
          prev
            ? {
                ...prev,
                phase: payload.phase,
                phase_ends_at: payload.phase_ends_at,
                current_threshold: payload.threshold,
                round_number: payload.round_number,
                current_count: 0,
                status: "open",
              }
            : null
        );
        setCurrentCount(0);
        setLastResult(null);
        fetchRound();
      })
      .on("broadcast", { event: "phase.change" }, ({ payload }) => {
        setMarket((prev) =>
          prev ? { ...prev, phase: payload.phase, phase_ends_at: payload.phase_ends_at } : null
        );
      })
      .on("broadcast", { event: "odds.update" }, ({ payload }) => {
        setOdds({
          over: payload.odds_over,
          under: payload.odds_under,
        });
        setCurrentRound((prev) =>
          prev
            ? {
                ...prev,
                pool_over: payload.pool_over,
                pool_under: payload.pool_under,
                total_pool: payload.total_pool,
              }
            : null
        );
      })
      .on("broadcast", { event: "count.sync" }, ({ payload }) => {
        setCurrentCount(payload.count);
      })
      .on("broadcast", { event: "round.resolved" }, ({ payload }) => {
        setLastResult({
          final_count: payload.final_count,
          threshold: payload.threshold,
          result: payload.result,
          payout_multiplier: payload.payout_multiplier,
        });
        setMarket((prev) =>
          prev ? { ...prev, phase: "waiting", phase_ends_at: null, status: "waiting" } : null
        );
        setCurrentRound(null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId, fetchRound]);

  // Light poll (3s) for phase management only — count comes from postgres_changes (faster)
  useEffect(() => {
    let ticking = false;
    const iv = setInterval(async () => {
      const { data } = await supabase
        .from("camera_markets")
        .select("current_count, status, phase, phase_ends_at, current_threshold, round_number")
        .eq("id", marketId)
        .maybeSingle();
      if (data) {
        // Sync count as fallback (postgres_changes is primary)
        setCurrentCount(data.current_count || 0);
        setMarket((prev) => (prev ? { ...prev, ...data } : null));

        // Auto-tick: if phase expired or waiting, call round endpoint to advance
        const expired = data.phase_ends_at && new Date(data.phase_ends_at).getTime() < Date.now();
        const shouldTick = data.phase === "waiting" || expired;
        if (shouldTick && !ticking) {
          ticking = true;
          try {
            await fetch("/api/camera/round", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ market_id: marketId, secret: process.env.NEXT_PUBLIC_WORKER_SECRET || "" }),
            });
          } catch {}
          setTimeout(() => { ticking = false; }, 5000);
          setTimeout(() => fetchRound(), 1000);
        }
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [marketId, fetchRound]);

  return {
    market,
    currentRound,
    currentCount,
    odds,
    loading,
    lastResult,
    refetchRound: fetchRound,
  };
}
