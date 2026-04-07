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
      const { data, error } = await supabase
        .from("camera_markets")
        .select("id, phase, status, operating_hours")
        .in("status", ["waiting", "open"])
        .order("id");

      // Fallback if query fails
      if (error || !data || data.length === 0) {
        setActiveMarketId(CAMERA_IDS[0]);
        return;
      }

      // Filter out cameras outside operating hours (Brazil UTC-3)
      const nowMs = Date.now();
      const brHour = new Date(nowMs - 3 * 3600_000).getUTCHours();
      const brMin = new Date(nowMs - 3 * 3600_000).getUTCMinutes();
      const mins = brHour * 60 + brMin;

      const available = data.filter((m) => {
        const oh = m.operating_hours as string | null;
        if (!oh) return true;
        const match = oh.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
        if (!match) return true;
        const start = Number(match[1]) * 60 + Number(match[2]);
        const end = Number(match[3]) * 60 + Number(match[4]);
        return start <= end ? (mins >= start && mins < end) : (mins >= start || mins < end);
      });

      if (available.length === 0) {
        setOffline(true);
        return;
      }

      const active = available.find((m) => m.phase === "betting" || m.phase === "observation");
      if (active) { setActiveMarketId(active.id); return; }

      const waiting = available.find((m) => m.phase === "waiting");
      if (waiting) { setActiveMarketId(waiting.id); return; }

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
