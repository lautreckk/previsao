"use client";

import { useParams } from "next/navigation";
import { CameraMarketView } from "@/components/CameraMarketView";

export default function CameraMarketPage() {
  const params = useParams();
  const marketId = params.id as string;
  return <CameraMarketView marketId={marketId} />;
}
