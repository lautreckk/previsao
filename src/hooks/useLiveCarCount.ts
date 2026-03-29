"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface VehicleEvent {
  idKey: string;
  time: number;
  type?: string;
}

interface LiveCarCountState {
  count: number;
  history: { time: number; count: number }[];
  status: "connecting" | "live" | "offline";
  lastEvent: VehicleEvent | null;
}

export function useLiveCarCount(marketId: string): LiveCarCountState {
  const [count, setCount] = useState(0);
  const [history, setHistory] = useState<{ time: number; count: number }[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [lastEvent, setLastEvent] = useState<VehicleEvent | null>(null);
  const uniqueIds = useRef(new Set<string>());
  const historyRef = useRef<{ time: number; count: number }[]>([]);

  useEffect(() => {
    // Reset on market change
    uniqueIds.current.clear();
    historyRef.current = [];
    setCount(0);
    setHistory([]);
    setStatus("connecting");

    // Subscribe to Supabase Realtime Broadcast channel
    const channelName = `cars-stream-${marketId}`;
    const channel = supabase.channel(channelName);

    channel
      .on("broadcast", { event: "vehicle.detected" }, (payload) => {
        const data = payload.payload as VehicleEvent;
        if (data?.idKey && !uniqueIds.current.has(data.idKey)) {
          uniqueIds.current.add(data.idKey);
          const newCount = uniqueIds.current.size;
          setCount(newCount);
          setLastEvent(data);

          const entry = { time: data.time || Date.now(), count: newCount };
          historyRef.current.push(entry);
          // Keep last 100 entries
          if (historyRef.current.length > 100) historyRef.current.shift();
          setHistory([...historyRef.current]);
        }
      })
      .on("broadcast", { event: "round.reset" }, () => {
        // New round — reset counter
        uniqueIds.current.clear();
        historyRef.current = [];
        setCount(0);
        setHistory([]);
      })
      .on("broadcast", { event: "count.sync" }, (payload) => {
        // Sync total count from worker (fallback)
        const data = payload.payload as { count: number; ids?: string[] };
        if (data.ids) {
          data.ids.forEach((id) => uniqueIds.current.add(id));
        }
        setCount(data.count || uniqueIds.current.size);
      })
      .subscribe((st) => {
        setStatus(st === "SUBSCRIBED" ? "live" : "connecting");
      });

    // Fallback: poll API every 10s in case realtime is down
    const pollIv = setInterval(async () => {
      try {
        const res = await fetch(`/api/camera/ingest?market_id=${marketId}`);
        if (res.ok) {
          const data = await res.json();
          // Only update if our local count is behind
          if (data.count && data.count > uniqueIds.current.size) {
            setCount(data.count);
          }
        }
      } catch { /* silent */ }
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollIv);
    };
  }, [marketId]);

  return { count, history, status, lastEvent };
}
