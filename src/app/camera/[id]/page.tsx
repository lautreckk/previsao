"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CameraMarketView } from "@/components/CameraMarketView";

export default function CameraMarketPage() {
  const params = useParams();
  const router = useRouter();
  const marketId = params.id as string;
  const [valid, setValid] = useState<boolean | null>(null);

  useEffect(() => {
    async function check() {
      // cam_ IDs always valid (camera_markets table)
      if (marketId.startsWith("cam_")) { setValid(true); return; }

      // mkt_ IDs: must exist in prediction_markets with stream_url
      const { data } = await supabase
        .from("prediction_markets")
        .select("id")
        .eq("id", marketId)
        .not("stream_url", "is", null)
        .maybeSingle();

      if (data) { setValid(true); } else { router.replace("/camera"); }
    }
    check();
  }, [marketId, router]);

  if (valid === null) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#80FF00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <CameraMarketView marketId={marketId} />;
}
