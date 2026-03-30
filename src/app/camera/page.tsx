"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// All active cameras for rotation
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

export default function CameraRotationPage() {
  const router = useRouter();
  const [markets, setMarkets] = useState<{ id: string; title: string; city: string; phase: string; current_count: number; highway: string }[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("camera_markets")
        .select("id, title, city, phase, current_count, highway")
        .order("id");
      if (data) setMarkets(data);

      // Find the first active camera (betting/observation) or pick random
      const active = data?.find((m) => m.phase === "betting" || m.phase === "observation");
      if (active) {
        router.replace(`/camera/${active.id}`);
      } else {
        // Pick random camera
        const random = CAMERA_IDS[Math.floor(Math.random() * CAMERA_IDS.length)];
        router.replace(`/camera/${random}`);
      }
    }
    load();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#00FFB8] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#8B95A8] text-sm">Selecionando camera ativa...</p>
        <div className="mt-6 grid grid-cols-2 gap-2 max-w-md mx-auto px-4">
          {markets.map((m) => (
            <button
              key={m.id}
              onClick={() => router.push(`/camera/${m.id}`)}
              className={`p-3 rounded-xl text-left text-xs border ${
                m.phase === "betting" || m.phase === "observation"
                  ? "border-[#00FFB8]/40 bg-[#00FFB8]/5"
                  : "border-[#1a2a3a] bg-[#0a1222]"
              }`}
            >
              <p className="font-bold text-white truncate">{m.title}</p>
              <p className="text-[#8B95A8] text-[10px]">{m.city}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  m.phase === "betting" ? "bg-[#00FFB8] animate-pulse" :
                  m.phase === "observation" ? "bg-[#FFC700]" : "bg-[#8B95A8]/30"
                }`} />
                <span className="text-[9px] text-[#8B95A8]">{m.phase === "waiting" ? "Aguardando" : m.phase === "betting" ? "Apostas abertas" : "Observacao"}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
