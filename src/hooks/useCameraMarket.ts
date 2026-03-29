"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface CameraMarket {
  id: string;
  stream_url: string;
  stream_type: string;
  city: string;
  title: string;
  status: string;
  current_count: number;
  round_duration_seconds: number;
  thumbnail_url: string;
}

interface CameraRound {
  id: string;
  round_number: number;
  started_at: string;
  ended_at: string;
  final_count: number | null;
  resolved_at: string | null;
}

export function useCameraMarket(marketId: string) {
  const [market, setMarket] = useState<CameraMarket | null>(null);
  const [currentRound, setCurrentRound] = useState<CameraRound | null>(null);
  const [currentCount, setCurrentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMarket = useCallback(async () => {
    const { data } = await supabase
      .from("camera_markets")
      .select("*")
      .eq("id", marketId)
      .maybeSingle();
    if (data) {
      setMarket(data);
      setCurrentCount(data.current_count || 0);
    }
    setLoading(false);
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
    if (data) setCurrentRound(data);
  }, [marketId]);

  useEffect(() => {
    fetchMarket();
    fetchRound();
  }, [fetchMarket, fetchRound]);

  // Realtime subscription for count updates
  useEffect(() => {
    const channel = supabase
      .channel(`camera:${marketId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "camera_markets", filter: `id=eq.${marketId}` },
        (payload) => {
          const updated = payload.new as CameraMarket;
          setCurrentCount(updated.current_count || 0);
          setMarket((prev) => prev ? { ...prev, ...updated } : null);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [marketId]);

  // Poll every 3s as fallback for realtime
  useEffect(() => {
    const iv = setInterval(async () => {
      const { data } = await supabase
        .from("camera_markets")
        .select("current_count, status")
        .eq("id", marketId)
        .maybeSingle();
      if (data) {
        setCurrentCount(data.current_count || 0);
        setMarket((prev) => prev ? { ...prev, current_count: data.current_count, status: data.status } : null);
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [marketId]);

  return { market, currentRound, currentCount, loading, refetchRound: fetchRound };
}
