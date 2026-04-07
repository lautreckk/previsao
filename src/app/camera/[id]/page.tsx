"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CameraMarketView } from "@/components/CameraMarketView";

export default function CameraMarketPage() {
  const params = useParams();
  const router = useRouter();
  const marketId = params.id as string;
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase
      .from("camera_markets")
      .select("status, operating_hours")
      .eq("id", marketId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data || data.status === "disabled") {
          router.replace("/camera");
          return;
        }
        // Check operating hours (Brazil UTC-3)
        const oh = data.operating_hours as string | null;
        if (oh) {
          const match = oh.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
          if (match) {
            const [, sH, sM, eH, eM] = match.map(Number);
            const now = new Date();
            const brTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
            const mins = brTime.getUTCHours() * 60 + brTime.getUTCMinutes();
            const start = sH * 60 + sM;
            const end = eH * 60 + eM;
            const inRange = start <= end ? (mins >= start && mins < end) : (mins >= start || mins < end);
            if (!inRange) {
              router.replace("/camera");
              return;
            }
          }
        }
        setChecked(true);
      });
  }, [marketId, router]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#80FF00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <CameraMarketView marketId={marketId} />;
}
