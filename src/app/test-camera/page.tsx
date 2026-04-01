"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const CAMERAS = [
  { id: "SP008-KM095", marketId: "cam_sp008_km095", label: "SP-008 KM 95 — Sto. Antônio do Pinhal", lineY: 0.48 },
  { id: "SP055-KM110B", marketId: "cam_sp055_km110b", label: "SP-055 KM 110 — Caraguatatuba", lineY: 0.58 },
  { id: "SP055-KM073", marketId: "cam_sp055_km073", label: "SP-055 KM 73 — Caraguatatuba", lineY: 0.55 },
  { id: "SP055-KM083", marketId: "cam_sp055_km083", label: "SP-055 KM 83 — Caraguatatuba", lineY: 0.55 },
  { id: "SP055-KM168", marketId: "cam_sp055_km168", label: "SP-055 KM 168 — São Sebastião", lineY: 0.58 },
  { id: "SP046-KM167", marketId: "cam_sp046_km167", label: "SP-046 KM 167 — Sto. Antônio do Pinhal", lineY: 0.55 },
];

const STREAM_BASE = "https://34.104.32.249.nip.io";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gqymalmbbtzdnpbneegg.supabase.co";

function WorkerFrame({ marketId }: { marketId: string }) {
  const [ts, setTs] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setTs(Date.now()), 2000);
    return () => clearInterval(iv);
  }, []);
  const url = `${SUPABASE_URL}/storage/v1/object/public/camera-frames/${marketId}/latest.jpg?t=${ts}`;
  return (
    <img
      src={url}
      alt="Worker IA"
      style={{ width: "100%", borderRadius: 4, border: "1px solid #333" }}
      onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
      onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = "1"; }}
    />
  );
}

export default function TestCameraPage() {
  const [selected, setSelected] = useState(CAMERAS[0]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Selecione uma camera");
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const prevCount = useRef(0);

  // Flash animation when count changes
  useEffect(() => {
    if (count !== prevCount.current && count > 0) {
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
      prevCount.current = count;
    }
  }, [count]);

  // Draw green counting line on canvas overlay (diagonal like Palpitano)
  const drawLine = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const y = canvas.height * selected.lineY;

    // Solid diagonal green line (like Palpitano)
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00FF00";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.05, y + canvas.height * 0.04);
    ctx.lineTo(canvas.width * 0.95, y - canvas.height * 0.04);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [selected.lineY]);

  // Redraw line on resize
  useEffect(() => {
    const iv = setInterval(drawLine, 500);
    window.addEventListener("resize", drawLine);
    return () => { clearInterval(iv); window.removeEventListener("resize", drawLine); };
  }, [drawLine]);

  // HLS stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setStatus("Conectando...");
    setCount(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let hls: any = null;
    const url = `${STREAM_BASE}/${selected.id}/stream.m3u8`;

    async function setup() {
      if (!video) return;
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.play().then(() => setStatus("AO VIVO")).catch(() => setStatus("Erro"));
        return;
      }
      const { default: Hls } = await import("hls.js");
      if (!Hls.isSupported()) { setStatus("Sem suporte HLS"); return; }
      const h = new Hls({ enableWorker: true, lowLatencyMode: true, liveSyncDurationCount: 2, liveMaxLatencyDurationCount: 4, maxBufferLength: 10 });
      h.loadSource(url);
      h.attachMedia(video);
      h.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => setStatus("AO VIVO")).catch(() => setStatus("Erro"));
      });
      h.on(Hls.Events.ERROR, (_e: unknown, d: { fatal: boolean }) => { if (d.fatal) setStatus("Erro no stream"); });
      hls = h;
    }
    setup();
    return () => { hls?.destroy(); };
  }, [selected]);

  // Real-time count from Supabase
  useEffect(() => {
    // Initial fetch
    const fetchCount = () => {
      supabase
        .from("camera_markets")
        .select("current_count")
        .eq("id", selected.marketId)
        .maybeSingle()
        .then(({ data }) => { if (data) setCount(data.current_count || 0); });
    };
    fetchCount();

    // Poll every 2s (reliable)
    const iv = setInterval(fetchCount, 2000);

    // Also subscribe to postgres_changes (instant when it works)
    const channel = supabase
      .channel(`test-cam-${selected.marketId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "camera_markets", filter: `id=eq.${selected.marketId}` },
        (payload) => {
          const c = (payload.new as { current_count: number }).current_count;
          if (c !== undefined) setCount(c);
        }
      )
      .subscribe();

    return () => { clearInterval(iv); supabase.removeChannel(channel); };
  }, [selected.marketId]);

  return (
    <div style={{ background: "#111", color: "#fff", minHeight: "100vh", padding: 20, fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 18, marginBottom: 10 }}>Teste de Camera + Contagem</h1>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <select
          value={selected.id}
          onChange={(e) => setSelected(CAMERAS.find((c) => c.id === e.target.value) || CAMERAS[0])}
          style={{ background: "#222", color: "#0f0", border: "1px solid #333", padding: "8px 12px", fontSize: 14 }}
        >
          {CAMERAS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        <span style={{ fontSize: 12, color: status === "AO VIVO" ? "#0f0" : "#f80" }}>{status}</span>

        {/* Count display */}
        <div style={{
          background: flash ? "#00FF00" : "#000",
          border: "2px solid #00FF00",
          borderRadius: 8,
          padding: "8px 20px",
          transition: "all 0.3s",
          minWidth: 120,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 10, color: flash ? "#000" : "#888", textTransform: "uppercase", letterSpacing: 2 }}>Veiculos</div>
          <div style={{
            fontSize: 36,
            fontWeight: 900,
            color: flash ? "#000" : "#00FF00",
            transition: "all 0.2s",
            transform: flash ? "scale(1.2)" : "scale(1)",
          }}>
            {count}
          </div>
        </div>
      </div>

      {/* Video + canvas overlay */}
      <div ref={containerRef} style={{ position: "relative", maxWidth: 800, width: "100%" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          controls
          style={{ width: "100%", background: "#000", borderRadius: 4, display: "block" }}
        />
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        />
      </div>

      {/* Worker AI view — shows YOLO bounding boxes */}
      <div style={{ maxWidth: 800, width: "100%", marginTop: 12 }}>
        <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Visao da IA (atualiza a cada 2s) — boxes vermelhos = detectado, verdes = contado</p>
        <WorkerFrame marketId={selected.marketId} />
      </div>
    </div>
  );
}
