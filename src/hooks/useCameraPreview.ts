"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface CameraPreview {
  currentCount: number;
  threshold: number;
  phase: "waiting" | "betting" | "observation";
  phaseEndsAt: number | null;
  roundNumber: number;
  poolOver: number;
  poolUnder: number;
}

/**
 * Lightweight hook that only subscribes when `enabled` is true (on hover).
 * Fetches camera_markets + current round, listens for real-time count updates.
 * Unsubscribes when the card loses hover.
 */
export function useCameraPreview(marketId: string, enabled: boolean) {
  const [data, setData] = useState<CameraPreview | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Cleanup on disable
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    let cancelled = false;

    // Initial fetch
    async function fetch() {
      const [{ data: cam }, { data: round }] = await Promise.all([
        supabase
          .from("camera_markets")
          .select("current_count, current_threshold, phase, phase_ends_at, round_number")
          .eq("id", marketId)
          .maybeSingle(),
        supabase
          .from("camera_rounds")
          .select("pool_over, pool_under, threshold")
          .eq("market_id", marketId)
          .is("resolved_at", null)
          .order("round_number", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (cam) {
        setData({
          currentCount: cam.current_count || 0,
          threshold: cam.current_threshold || round?.threshold || 175,
          phase: cam.phase || "waiting",
          phaseEndsAt: cam.phase_ends_at ? new Date(cam.phase_ends_at).getTime() : null,
          roundNumber: cam.round_number || 0,
          poolOver: Number(round?.pool_over) || 0,
          poolUnder: Number(round?.pool_under) || 0,
        });
      }
    }

    fetch();

    // Real-time subscription
    const channel = supabase
      .channel(`card-preview:${marketId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "camera_markets", filter: `id=eq.${marketId}` },
        (payload) => {
          const u = payload.new as Record<string, unknown>;
          setData((prev) => prev ? {
            ...prev,
            currentCount: (u.current_count as number) ?? prev.currentCount,
            threshold: (u.current_threshold as number) ?? prev.threshold,
            phase: (u.phase as CameraPreview["phase"]) ?? prev.phase,
            phaseEndsAt: u.phase_ends_at ? new Date(u.phase_ends_at as string).getTime() : prev.phaseEndsAt,
            roundNumber: (u.round_number as number) ?? prev.roundNumber,
          } : prev);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [marketId, enabled]);

  return data;
}
