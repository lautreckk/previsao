"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const CAMERAS = [
  { id: "SP008-KM095", marketId: "cam_sp008_km095", label: "SP-008 KM 95 — Sto. Antônio do Pinhal", lineY: 0.48 },
  { id: "SP055-KM110B", marketId: "cam_sp055_km110b", label: "SP-055 KM 110 — Caraguatatuba", lineY: 0.58 },
  { id: "SP055-KM073", marketId: "cam_sp055_km073", label: "SP-055 KM 73 — Caraguatatuba", lineY: 0.55 },
  { id: "SP055-KM083", marketId: "cam_sp055_km083", label: "SP-055 KM 83 — Caraguatatuba", lineY: 0.55 },
];

const STREAM_BASE = "https://34.104.32.249.nip.io";

interface Detection { x1: number; y1: number; x2: number; y2: number; c: number }

export default function TestCameraPage() {
  const [selected, setSelected] = useState(CAMERAS[0]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Conectando...");
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const prevCount = useRef(0);
  const detectionsRef = useRef<Detection[]>([]);

  // Flash on count change
  useEffect(() => {
    if (count !== prevCount.current && count > 0) {
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
      prevCount.current = count;
    }
  }, [count]);

  // Draw line + detection boxes on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const rect = video.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Green counting line (diagonal like Palpitano)
    const y = canvas.height * selected.lineY;
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00FF00";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.05, y + canvas.height * 0.04);
    ctx.lineTo(canvas.width * 0.95, y - canvas.height * 0.04);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Detection boxes from worker
    const boxes = detectionsRef.current;
    for (const b of boxes) {
      const x1 = b.x1 * canvas.width;
      const y1 = b.y1 * canvas.height;
      const x2 = b.x2 * canvas.width;
      const y2 = b.y2 * canvas.height;
      const color = b.c ? "#00FF00" : "#FF0000";

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // Small label
      ctx.fillStyle = color;
      ctx.font = "bold 10px monospace";
      ctx.fillText(b.c ? "OK" : "...", x1 + 2, y1 - 3);
    }
  }, [selected.lineY]);

  // Animation loop for smooth drawing
  useEffect(() => {
    let raf: number;
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  // HLS stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setStatus("Conectando...");
    setCount(0);
    detectionsRef.current = [];
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
      if (!Hls.isSupported()) { setStatus("Sem suporte"); return; }
      const h = new Hls({ enableWorker: true, lowLatencyMode: true, liveSyncDurationCount: 2, liveMaxLatencyDurationCount: 4, maxBufferLength: 10 });
      h.loadSource(url); h.attachMedia(video);
      h.on(Hls.Events.MANIFEST_PARSED, () => { video.play().then(() => setStatus("AO VIVO")).catch(() => setStatus("Erro")); });
      h.on(Hls.Events.ERROR, (_e: unknown, d: { fatal: boolean }) => { if (d.fatal) setStatus("Erro"); });
      hls = h;
    }
    setup();
    return () => { hls?.destroy(); };
  }, [selected]);

  // Receive detections + count via Supabase
  useEffect(() => {
    // Initial count
    const fetchCount = () => {
      supabase.from("camera_markets").select("current_count").eq("id", selected.marketId).maybeSingle()
        .then(({ data }) => { if (data) setCount(data.current_count || 0); });
    };
    fetchCount();
    const pollIv = setInterval(fetchCount, 2000);

    // Realtime: detections broadcast (boxes + count)
    const channel = supabase
      .channel(`test-det-${selected.marketId}`)
      .on("broadcast", { event: "detections" }, ({ payload }) => {
        if (payload?.boxes) detectionsRef.current = payload.boxes;
        if (payload?.count !== undefined) setCount(payload.count);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "camera_markets", filter: `id=eq.${selected.marketId}` },
        (payload) => { const c = (payload.new as { current_count: number }).current_count; if (c !== undefined) setCount(c); })
      .subscribe();

    return () => { clearInterval(pollIv); supabase.removeChannel(channel); };
  }, [selected.marketId]);

  return (
    <div style={{ background: "#111", color: "#fff", minHeight: "100vh", padding: 20, fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 18, marginBottom: 10 }}>Teste de Camera + Contagem</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <select
          value={selected.id}
          onChange={(e) => setSelected(CAMERAS.find((c) => c.id === e.target.value) || CAMERAS[0])}
          style={{ background: "#222", color: "#0f0", border: "1px solid #333", padding: "8px 12px", fontSize: 14 }}
        >
          {CAMERAS.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
        </select>

        <span style={{ fontSize: 12, color: status === "AO VIVO" ? "#0f0" : "#f80" }}>{status}</span>

        {/* Count */}
        <div style={{
          background: flash ? "#00FF00" : "#000", border: "2px solid #00FF00", borderRadius: 8,
          padding: "8px 20px", transition: "all 0.3s", minWidth: 100, textAlign: "center",
        }}>
          <div style={{ fontSize: 9, color: flash ? "#000" : "#888", textTransform: "uppercase", letterSpacing: 2 }}>Veiculos</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: flash ? "#000" : "#00FF00", transition: "all 0.2s", transform: flash ? "scale(1.2)" : "scale(1)" }}>{count}</div>
        </div>
      </div>

      {/* Video + canvas overlay (boxes drawn by browser) */}
      <div style={{ position: "relative", maxWidth: 800, width: "100%" }}>
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

      <p style={{ fontSize: 10, color: "#555", marginTop: 8 }}>
        Video: HLS original (25fps liso) | Boxes: canvas overlay via Supabase broadcast | Count: polling 2s + broadcast
      </p>
    </div>
  );
}
