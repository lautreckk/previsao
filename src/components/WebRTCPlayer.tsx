"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface WebRTCPlayerProps {
  streamId: string;
  className?: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

/**
 * WebRTC player via WHEP (WebRTC-HTTP Egress Protocol).
 * Connects to MediaMTX through our /api/camera/whep proxy.
 */
export default function WebRTCPlayer({ streamId, className, onConnected, onDisconnected }: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "failed">("connecting");
  const retriesRef = useRef(0);
  const maxRetries = 5;

  const connect = useCallback(async () => {
    // Cleanup previous connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (ev) => {
        if (videoRef.current && ev.streams[0]) {
          videoRef.current.srcObject = ev.streams[0];
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          setStatus("connected");
          retriesRef.current = 0;
          onConnected?.();
        } else if (state === "failed" || state === "disconnected" || state === "closed") {
          setStatus("failed");
          onDisconnected?.();
          // Auto-reconnect
          if (retriesRef.current < maxRetries) {
            retriesRef.current++;
            const delay = Math.min(2000 * retriesRef.current, 10000);
            setTimeout(connect, delay);
          }
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete (or timeout after 2s)
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
          return;
        }
        const timeout = setTimeout(resolve, 2000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") {
            clearTimeout(timeout);
            resolve();
          }
        };
      });

      // Send offer to WHEP endpoint via our proxy
      const res = await fetch(`/api/camera/whep?stream=${encodeURIComponent(streamId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription!.sdp,
      });

      if (!res.ok) {
        throw new Error(`WHEP failed: ${res.status}`);
      }

      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (err) {
      console.error("[WebRTC] Connection error:", err);
      setStatus("failed");
      if (retriesRef.current < maxRetries) {
        retriesRef.current++;
        setTimeout(connect, 3000);
      }
    }
  }, [streamId, onConnected, onDisconnected]);

  useEffect(() => {
    connect();
    return () => {
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [connect]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={className}
      />
      {status === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black rounded-lg z-[6]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#80FF00] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-[10px] text-white/50">Conectando WebRTC...</p>
          </div>
        </div>
      )}
      {status === "failed" && retriesRef.current >= maxRetries && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 rounded-lg z-[6]">
          <div className="text-center">
            <p className="text-sm text-[#FF5252] font-bold mb-2">Conexao perdida</p>
            <button
              onClick={() => { retriesRef.current = 0; setStatus("connecting"); connect(); }}
              className="px-4 py-2 bg-[#80FF00] text-black text-xs font-bold rounded-lg"
            >
              Reconectar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
