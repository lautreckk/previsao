"use client";

import { useState, useRef, useEffect } from "react";

const CAMERAS = [
  { id: "SP008-KM095", label: "SP-008 KM 95 — Sto. Antônio do Pinhal" },
  { id: "SP055-KM110B", label: "SP-055 KM 110 — Caraguatatuba" },
  { id: "SP055-KM073", label: "SP-055 KM 73 — Caraguatatuba" },
  { id: "SP055-KM083", label: "SP-055 KM 83 — Caraguatatuba" },
  { id: "SP055-KM168", label: "SP-055 KM 168 — São Sebastião" },
  { id: "SP046-KM167", label: "SP-046 KM 167 — Sto. Antônio do Pinhal" },
];

const STREAM_BASE = "https://34.104.32.249.nip.io";

export default function TestCameraPage() {
  const [selected, setSelected] = useState(CAMERAS[0].id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Selecione uma camera");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setStatus("Conectando...");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let hls: any = null;

    const url = `${STREAM_BASE}/${selected}/stream.m3u8`;

    async function setup() {
      if (!video) return;

      // Safari plays HLS natively
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.play().then(() => setStatus("Ao vivo (HLS nativo)")).catch(() => setStatus("Erro ao reproduzir"));
        return;
      }

      // Chrome/Firefox need hls.js
      const { default: Hls } = await import("hls.js");
      if (!Hls.isSupported()) { setStatus("Navegador nao suporta HLS"); return; }

      const h = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 4,
        maxBufferLength: 10,
      });
      h.loadSource(url);
      h.attachMedia(video);
      h.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => setStatus("Ao vivo (HLS.js)")).catch(() => setStatus("Erro ao reproduzir"));
      });
      h.on(Hls.Events.ERROR, (_e: unknown, data: { fatal: boolean }) => {
        if (data.fatal) setStatus("Erro fatal no stream");
      });
      hls = h;
    }

    setup();
    return () => { hls?.destroy(); };
  }, [selected]);

  return (
    <div style={{ background: "#111", color: "#fff", minHeight: "100vh", padding: 20, fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 18, marginBottom: 10 }}>Teste de Camera</h1>

      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{ background: "#222", color: "#0f0", border: "1px solid #333", padding: "8px 12px", fontSize: 14, marginBottom: 10 }}
      >
        {CAMERAS.map((c) => (
          <option key={c.id} value={c.id}>{c.label}</option>
        ))}
      </select>

      <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
        Status: <span style={{ color: status.includes("vivo") ? "#0f0" : "#f80" }}>{status}</span>
        {" | "}URL: {STREAM_BASE}/{selected}/stream.m3u8
      </p>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        controls
        style={{ width: "100%", maxWidth: 800, background: "#000", borderRadius: 4 }}
      />
    </div>
  );
}
