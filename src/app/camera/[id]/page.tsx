"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CameraMarketView } from "@/components/CameraMarketView";

export default function CameraMarketPage() {
  const params = useParams();
  const router = useRouter();
  const marketId = params.id as string;
  const [resolved, setResolved] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function resolve() {
      // cam_ markets go straight through
      if (marketId.startsWith("cam_")) {
        setResolved(marketId);
        setChecking(false);
        return;
      }

      // mkt_ markets: check if they exist and have a matching camera market
      const { data: pm } = await supabase
        .from("prediction_markets")
        .select("id, stream_url")
        .eq("id", marketId)
        .maybeSingle();

      if (pm?.stream_url) {
        setResolved(marketId);
        setChecking(false);
        return;
      }

      // Market not found — redirect to camera lobby
      router.replace("/camera");
    }
    resolve();
  }, [marketId, router]);

  if (checking || !resolved) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#80FF00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <CameraMarketView marketId={resolved} />;
}
