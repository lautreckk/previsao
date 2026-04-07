"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CameraMarketView } from "@/components/CameraMarketView";

const CAMERA_IDS = [
  "cam_sp008_km095",
  "cam_sp055_km110b",
  "cam_sp055_km110a",
];

export default function CameraLobbyPage() {
  const [activeMarketId, setActiveMarketId] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    async function findActive() {
      const { data } = await supabase
        .from("camera_markets")
        .select("id, phase, status, operating_hours")
        .in("status", ["waiting", "open"])
        .order("id");

      // Filter out cameras outside operating hours (Brazil UTC-3)
      const now = new Date();
      const brTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const mins = brTime.getUTCHours() * 60 + brTime.getUTCMinutes();
      const available = (data || []).filter((m) => {
        const oh = m.operating_hours as string | null;
        if (!oh) return true;
        const match = oh.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
        if (!match) return true;
        const [, sH, sM, eH, eM] = match.map(Number);
        const start = sH * 60 + sM;
        const end = eH * 60 + eM;
        return start <= end ? (mins >= start && mins < end) : (mins >= start || mins < end);
      });

      if (available.length === 0) {
        setActiveMarketId(null);
        setOffline(true);
        return;
      }

      // Find first active camera (betting/observation), or first open, or first available
      const active = available.find((m) => m.phase === "betting" || m.phase === "observation");
      if (active) {
        setActiveMarketId(active.id);
        return;
      }

      // Fallback: any waiting market
      const waiting = available.find((m) => m.phase === "waiting");
      if (waiting) {
        setActiveMarketId(waiting.id);
        return;
      }

      setActiveMarketId(available[0].id);
    }
    findActive();
  }, []);

  if (offline) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🌙</div>
          <h2 className="text-white text-lg font-semibold mb-2">Cameras offline</h2>
          <p className="text-white/50 text-sm">As cameras operam das 06:00 as 23:00 (horario de Brasilia). Volte durante o horario de funcionamento.</p>
        </div>
      </div>
    );
  }

  if (!activeMarketId) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#80FF00] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50 text-sm">Entrando no lobby...</p>
        </div>
      </div>
    );
  }

  return <CameraMarketView marketId={activeMarketId} />;
}
