"use client";

import { useState, useEffect } from "react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gqymalmbbtzdnpbneegg.supabase.co";

interface CameraFrameViewProps {
  marketId: string;
  streamUrl?: string;
  streamType?: string;
  count: number;
  status: "connecting" | "live" | "offline";
  history: { time: number; count: number }[];
  refreshMs?: number;
}

function extractYouTubeId(url: string): string {
  const match = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/live\/)([a-zA-Z0-9_-]+)/);
  return match ? match[1] : "";
}

export default function CameraFrameView({
  marketId, streamUrl, streamType, count, status, history, refreshMs = 2000,
}: CameraFrameViewProps) {
  const [ts, setTs] = useState(Date.now());
  const [hasFrame, setHasFrame] = useState<boolean | null>(null);
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTs(Date.now()), refreshMs);
    return () => clearInterval(iv);
  }, [refreshMs]);

  const ytId = streamUrl ? extractYouTubeId(streamUrl) : "";
  const framePaths = [marketId, ytId ? `stream_${ytId}` : "", "cam_rodovia_sp123"].filter(Boolean);
  const currentPath = framePaths[frameKey % framePaths.length] || marketId;
  const frameUrl = `${SUPABASE_URL}/storage/v1/object/public/camera-frames/${currentPath}/latest.jpg?t=${ts}`;

  // Last 6 history entries for the ticker
  const recentHistory = history.slice(-6);

  return (
    <div className="relative w-full bg-black">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        {/* Annotated frame from worker */}
        {hasFrame !== false ? (
          <img
            src={frameUrl}
            alt="Camera ao vivo"
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
            style={{ opacity: hasFrame === true ? 1 : 0.3 }}
            onLoad={() => { setHasFrame(true); }}
            onError={() => {
              if (frameKey < framePaths.length - 1) setFrameKey((k) => k + 1);
              else setHasFrame(false);
            }}
          />
        ) : streamUrl && streamType === "youtube" ? (
          /* YouTube fallback — hidden controls */
          <>
            <div className="absolute inset-[-10px] overflow-hidden">
              <iframe
                src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&playsinline=1&fs=0`}
                className="absolute top-0 left-0 w-[calc(100%+20px)] h-[calc(100%+20px)]"
                style={{ border: "none", pointerEvents: "none" }}
                allow="autoplay; encrypted-media"
                tabIndex={-1}
              />
            </div>
            <div className="absolute inset-0 z-10" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#8B95A8]">
            <span className="material-symbols-outlined text-4xl">videocam_off</span>
          </div>
        )}

        {/* AO VIVO badge */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <span className={`w-2 h-2 rounded-full ${status === "live" ? "bg-[#FF5252] animate-pulse" : "bg-[#FFC700]"}`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-white">
            {status === "live" ? "Ao Vivo" : status === "connecting" ? "Conectando..." : "Offline"}
          </span>
        </div>

        {/* IA badge */}
        {hasFrame && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#00FFB8]/20">
            <span className="text-[10px] font-bold text-[#00FFB8] uppercase tracking-widest">IA YOLO</span>
          </div>
        )}

        {/* Live count overlay (bottom-left) */}
        <div className="absolute bottom-3 left-3 z-20 bg-black/80 backdrop-blur-md rounded-xl px-4 py-2 border border-[#00FFB8]/30">
          <p className="text-[8px] uppercase tracking-widest text-[#8B95A8] font-bold">Contagem Atual</p>
          <p className="text-3xl font-black font-headline text-[#00FFB8] leading-none">{count}</p>
        </div>

        {/* Recent detections ticker (bottom-right) */}
        {recentHistory.length > 0 && (
          <div className="absolute bottom-3 right-3 z-20 flex items-end gap-0.5">
            {recentHistory.map((h, i) => {
              const prev = i > 0 ? recentHistory[i - 1].count : h.count - 1;
              const isUp = h.count > prev;
              return (
                <div key={i} className={`w-4 h-4 flex items-center justify-center rounded-sm ${isUp ? "bg-[#00FFB8]/80" : "bg-[#FFC700]/80"}`}>
                  <span className="text-[8px] font-black text-black">{isUp ? "\u25B2" : "="}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
