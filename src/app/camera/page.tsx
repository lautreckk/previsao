"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CameraMarketView } from "@/components/CameraMarketView";

const CAMERA_IDS = [
  "cam_sp055_km110b",
  "cam_sp055_km110a",
  "cam_sp055_km073",
  "cam_sp055_km055",
  "cam_sp055_km083",
  "cam_sp055_km092",
  "cam_sp055_km136",
  "cam_sp055_km168",
  "cam_sp055_km193",
  "cam_sp055_km211a",
  "cam_sp055_km211b",
  "cam_sp008_km095",
  "cam_sp046_km167",
];

export default function CameraLobbyPage() {
  const [activeMarketId, setActiveMarketId] = useState<string | null>(null);

  useEffect(() => {
    async function findActive() {
      const { data } = await supabase
        .from("camera_markets")
        .select("id, phase")
        .order("id");

      // Find first active camera (betting/observation), or first open, or first available
      const active = data?.find((m) => m.phase === "betting" || m.phase === "observation");
      if (active) {
        setActiveMarketId(active.id);
        return;
      }

      // Fallback: any waiting market
      const waiting = data?.find((m) => m.phase === "waiting");
      if (waiting) {
        setActiveMarketId(waiting.id);
        return;
      }

      // Last fallback: first available market or first camera ID
      if (data && data.length > 0) {
        setActiveMarketId(data[0].id);
      } else {
        setActiveMarketId(CAMERA_IDS[0]);
      }
    }
    findActive();
  }, []);

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
