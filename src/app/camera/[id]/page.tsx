"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useCameraMarket } from "@/hooks/useCameraMarket";
import { useUser } from "@/lib/UserContext";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gqymalmbbtzdnpbneegg.supabase.co";

/* ─── Countdown Timer ─── */
function CountdownTimer({ endsAt, label }: { endsAt: string; label?: string }) {
  const [timeLeft, setTimeLeft] = useState("--:--");

  useEffect(() => {
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("00:00"); return; }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);

  return (
    <div className="flex flex-col items-center">
      {label && <span className="text-[9px] uppercase tracking-widest text-[#8B95A8] font-bold">{label}</span>}
      <span className="text-3xl font-black text-[#FF5252] tabular-nums animate-pulse">{timeLeft}</span>
    </div>
  );
}

/* ─── Hybrid Stream: HLS live → fallback to worker frame ─── */
function LiveStream({ marketId, count, cameraId }: { marketId: string; streamUrl: string; count: number; cameraId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"loading" | "hls" | "frame">("loading");
  const [frameTs, setFrameTs] = useState(Date.now());
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Use our proxy URL instead of direct camera URL (avoids CORS/SSL, more stable)
  const proxyUrl = `/api/camera/stream?cam=${cameraId}`;

  // Try HLS first, fallback to frame after 10s or on error
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let hls: any = null;
    const fallbackTimer = setTimeout(() => {
      setMode((m) => m === "loading" ? "frame" : m);
    }, 10000);

    async function setup() {
      if (!video) return;
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = proxyUrl;
        video.play().then(() => { setMode("hls"); clearTimeout(fallbackTimer); }).catch(() => setMode("frame"));
      } else {
        const { default: Hls } = await import("hls.js");
        if (Hls.isSupported()) {
          const h = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 4,
            maxBufferLength: 10,
            maxMaxBufferLength: 20,
            fragLoadingTimeOut: 15000,
            manifestLoadingTimeOut: 15000,
            levelLoadingTimeOut: 15000,
          });
          h.loadSource(proxyUrl);
          h.attachMedia(video);
          h.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().then(() => { setMode("hls"); clearTimeout(fallbackTimer); }).catch(() => setMode("frame"));
          });
          h.on(Hls.Events.ERROR, (_event: unknown, data: { fatal: boolean; type: string }) => {
            if (data.fatal) {
              // Try to recover once before giving up
              setTimeout(() => { h.loadSource(proxyUrl); h.startLoad(); }, 2000);
              setTimeout(() => { if (modeRef.current !== "hls") setMode("frame"); }, 8000);
            }
          });
          hls = h;
        } else {
          setMode("frame");
        }
      }
    }

    setup();
    return () => { hls?.destroy(); clearTimeout(fallbackTimer); };
  }, [proxyUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh frame every 2s in frame mode
  useEffect(() => {
    if (mode !== "frame") return;
    const iv = setInterval(() => setFrameTs(Date.now()), 2000);
    return () => clearInterval(iv);
  }, [mode]);

  // Periodically retry HLS if stuck in frame mode (every 30s)
  useEffect(() => {
    if (mode !== "frame") return;
    const video = videoRef.current;
    if (!video) return;
    const retryIv = setInterval(async () => {
      try {
        const res = await fetch(proxyUrl, { method: "HEAD" });
        if (res.ok && video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = proxyUrl;
          video.play().then(() => setMode("hls")).catch(() => {});
        } else if (res.ok) {
          const { default: Hls } = await import("hls.js");
          if (Hls.isSupported()) {
            const h = new Hls({ enableWorker: true, lowLatencyMode: true, liveSyncDurationCount: 2, liveMaxLatencyDurationCount: 4, maxBufferLength: 10 });
            h.loadSource(proxyUrl);
            h.attachMedia(video);
            h.on(Hls.Events.MANIFEST_PARSED, () => {
              video.play().then(() => setMode("hls")).catch(() => { h.destroy(); });
            });
            h.on(Hls.Events.ERROR, (_e: unknown, d: { fatal: boolean }) => { if (d.fatal) h.destroy(); });
          }
        }
      } catch {}
    }, 30000);
    return () => clearInterval(retryIv);
  }, [mode, proxyUrl]);

  const frameUrl = `${SUPABASE_URL}/storage/v1/object/public/camera-frames/${marketId}/latest.jpg?t=${frameTs}`;

  return (
    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
      {/* HLS video (hidden in frame mode) */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-cover rounded-lg bg-black ${mode === "frame" ? "hidden" : ""}`}
      />

      {/* Worker frame fallback */}
      {mode === "frame" && (
        <img
          src={frameUrl}
          alt="Camera ao vivo"
          className="absolute inset-0 w-full h-full object-cover rounded-lg bg-black"
          onError={() => {}}
        />
      )}

      {/* Counting zone indicator — subtle, only in HLS mode (frame mode has OpenCV annotations) */}
      {mode === "hls" && (
        <div className="absolute inset-0 pointer-events-none z-[5] rounded-lg overflow-hidden">
          <div className="absolute left-[10%] right-[25%]" style={{ top: "55%" }}>
            <div className="w-full border-t-2 border-dashed border-[#00FF00]/50" style={{ boxShadow: "0 0 4px #00FF00" }} />
            <div className="absolute -top-5 left-0 bg-black/60 px-2 py-0.5 rounded">
              <span className="text-[9px] font-bold text-[#00FF00]/70 uppercase tracking-wider">ZONA DE CONTAGEM</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {mode === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black rounded-lg z-[6]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#00FFB8] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-[10px] text-[#8B95A8]">Conectando camera...</p>
          </div>
        </div>
      )}

      {/* AO VIVO badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full">
        <span className="w-2 h-2 rounded-full bg-[#FF5252] animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white">AO VIVO</span>
      </div>

      {/* Mode indicator */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#00FFB8]/20">
        <span className="text-[10px] font-bold text-[#00FFB8] uppercase tracking-widest">
          {mode === "hls" ? "STREAM AO VIVO" : mode === "frame" ? "IA YOLO" : "..."}
        </span>
      </div>

      {/* Count overlay */}
      <div className="absolute bottom-3 left-3 z-10 bg-black/80 backdrop-blur-md rounded-xl px-4 py-2 border border-[#00FFB8]/30">
        <p className="text-[8px] uppercase tracking-widest text-[#8B95A8] font-bold">Contagem Atual</p>
        <p className="text-3xl font-black text-[#00FFB8] tabular-nums leading-none">{count}</p>
      </div>
    </div>
  );
}

/* ─── Mini Chat (inline, like Palpitano) ─── */
const FAKE_USERS = ["@daisajubes","@luccasomaior","@tfrfryypaciho2007","@gabrielfenknupp","@hugoascni","@lucaselquezf1a","@diagramasjai","@clamentecorreia","@eimarolvlx0d42","@rofrsdaimoda"];
const FAKE_MSGS = [
  "boa tarde tropa, btc nos 5m ta com cara de descer, barlera puxando frt",
  "under vamooo","irl em c, 2K nisso aq e pq tem dinheiro sobrando, slc",
  "mds irmao como tu poe 2k nisso eu coloquei 30","eu vendo a minha plo",
  "nao faco apostas altas, perdi 250 mil no betano","under vamoooo",
  "po mh site me deslogou, um aro pro entrar, n consegui pegar odd boa",
  "over over over","30 segundos pra executar o bglh",
  "Cuida rapaziadaa na proxima pode ir pesado no verde",
  "GRUPO TELEGRAM OPERANDO 100% ACERTIVO! PESQUISEM @RODOVIASINAIS",
  "Acabei de sacar 200 calu na hora","to vendo a linha 3k n vai cair",
  "aq passa mais de 50 carros","menos","dol mai","aq e o over",
  "mais carros agora","ta vindo","presta atencao na linha verde",
];

interface ChatMsg { id: string; user: string; text: string; time: string }

function InlineChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const { user } = useUser();
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    // Seed initial messages
    const seed: ChatMsg[] = [];
    for (let i = 0; i < 8; i++) {
      seed.push({
        id: `s${i}`,
        user: FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)],
        text: FAKE_MSGS[Math.floor(Math.random() * FAKE_MSGS.length)],
        time: `${Math.floor(Math.random() * 60)} previsoes`,
      });
    }
    setMessages(seed);
  }, []);

  // Auto-generate messages
  useEffect(() => {
    const iv = setInterval(() => {
      if (Math.random() > 0.4) {
        setMessages((prev) => [
          ...prev.slice(-40),
          {
            id: `f${Date.now()}`,
            user: FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)],
            text: FAKE_MSGS[Math.floor(Math.random() * FAKE_MSGS.length)],
            time: `${Math.floor(Math.random() * 500)} previsoes`,
          },
        ]);
      }
    }, 5000 + Math.random() * 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    if (!input.trim() || !user) return;
    setMessages((prev) => [
      ...prev.slice(-40),
      { id: `u${Date.now()}`, user: `@${user.name.split(" ")[0].toLowerCase()}`, text: input.trim(), time: "agora" },
    ]);
    setInput("");
  };

  const onlineCount = 420 + Math.floor(Math.random() * 80);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2a3a]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-white uppercase tracking-wider">CHAT AO VIVO</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00FFB8] animate-pulse" />
          <span className="text-[10px] text-[#8B95A8]">{onlineCount} online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-0">
        {messages.map((msg) => (
          <div key={msg.id}>
            <span className="text-xs font-bold text-[#00FFB8]">{msg.user}</span>
            <span className="text-[10px] text-[#8B95A8] ml-1.5">· {msg.time}</span>
            <p className="text-sm text-gray-300 break-words leading-snug">{msg.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[#1a2a3a]">
        {user ? (
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Enviar mensagem..."
              className="flex-1 bg-[#111827] rounded-full px-4 py-2.5 text-sm text-white outline-none border border-[#1e2a3a] focus:border-[#00FFB8]/40 placeholder-[#8B95A8]"
            />
            <button onClick={send} className="w-10 h-10 rounded-full bg-[#00FFB8] text-[#003D2E] flex items-center justify-center shrink-0 active:scale-95">
              <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-[#8B95A8]">
            <a href="/login" className="text-[#00FFB8] font-bold">Faca login</a> para enviar mensagens
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Round History ─── */
function RoundHistory({ marketId }: { marketId: string }) {
  const [history, setHistory] = useState<
    { id: string; round_number: number; final_count: number; threshold: number }[]
  >([]);

  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase
        .from("camera_rounds")
        .select("id, round_number, final_count, threshold")
        .eq("market_id", marketId)
        .not("resolved_at", "is", null)
        .order("round_number", { ascending: false })
        .limit(10)
        .then(({ data }) => { if (data) setHistory(data); });
    });
  }, [marketId]);

  if (history.length === 0) return null;

  return (
    <div className="px-4 py-3 border-t border-[#1a2a3a]">
      <p className="text-[10px] uppercase tracking-widest font-bold text-[#8B95A8] mb-2">Historico</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {history.map((r) => {
          const isOver = (r.final_count || 0) > (r.threshold || 0);
          return (
            <div key={r.id} className={`flex-shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${isOver ? "bg-[#00FFB8]/10 text-[#00FFB8]" : "bg-[#FF5252]/10 text-[#FF5252]"}`}>
              <span>#{r.round_number}</span>
              <span className="text-xs font-black">{r.final_count}</span>
              <span className="text-[8px] opacity-70">{isOver ? "OVER" : "UNDER"} {r.threshold}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function CameraMarketPage() {
  const params = useParams();
  const marketId = params.id as string;
  const { market, currentRound, currentCount, odds, loading, lastResult } = useCameraMarket(marketId);
  const { user, refreshUser } = useUser();

  const [selectedType, setSelectedType] = useState<"over" | "under" | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [placing, setPlacing] = useState(false);
  const [betMsg, setBetMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [tab, setTab] = useState<"posicoes" | "aberto" | "encerradas">("posicoes");
  const [myPredictions, setMyPredictions] = useState<
    { id: string; prediction_type: string; threshold: number; amount_brl: number; odds_at_entry: number; payout: number; status: string }[]
  >([]);

  useEffect(() => {
    if (!user || !marketId) return;
    const load = async () => {
      const res = await fetch(`/api/camera/predict?market_id=${marketId}&user_id=${user.id}`);
      if (res.ok) { const data = await res.json(); if (data.predictions) setMyPredictions(data.predictions); }
    };
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [user, marketId]);

  const placePrediction = useCallback(async () => {
    if (!user || !selectedType || !betAmount || Number(betAmount) < 1) return;
    setPlacing(true); setBetMsg(null);
    try {
      const res = await fetch("/api/camera/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market_id: marketId, prediction_type: selectedType, amount: Number(betAmount), user_id: user.id }),
      });
      const data = await res.json();
      if (res.ok && data.prediction) {
        setBetMsg({ text: `Previsao ${selectedType.toUpperCase()} confirmada!`, type: "success" });
        setSelectedType(null); setBetAmount(""); refreshUser();
        setMyPredictions((prev) => [data.prediction, ...prev]);
      } else {
        setBetMsg({ text: data.error || "Erro ao fazer previsao", type: "error" });
      }
    } catch { setBetMsg({ text: "Erro de conexao", type: "error" }); }
    setPlacing(false);
  }, [user, selectedType, betAmount, marketId, refreshUser]);

  if (loading) return <div className="min-h-screen bg-[#080d1a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#00FFB8] border-t-transparent rounded-full animate-spin" /></div>;
  if (!market) return <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-[#8B95A8]">Mercado nao encontrado</div>;

  const isBetting = market.phase === "betting";
  const isObservation = market.phase === "observation";
  const isActive = isBetting || isObservation;
  const threshold = market.current_threshold;

  const openPredictions = myPredictions.filter((p) => p.status === "open");
  const closedPredictions = myPredictions.filter((p) => p.status !== "open");

  return (
    <div className="min-h-screen bg-[#080d1a] text-white overflow-x-hidden">
      {/* ─── DESKTOP: 3-column layout like Palpitano ─── */}
      <div className="flex flex-col lg:flex-row min-h-screen">

        {/* ─── LEFT COLUMN: Stream + Betting ─── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Top bar: Title + Timer */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-[#1a2a3a] bg-[#0d1525]">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/" className="text-[#00FFB8] shrink-0">
                <span className="material-symbols-outlined">arrow_back</span>
              </Link>
              <div className="min-w-0">
                <h1 className="text-sm font-bold truncate">Rodovia (5 minutos): quantos carros?</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {isActive && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#FF5252]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF5252] animate-pulse" />
                      AO VIVO
                    </span>
                  )}
                  {/* Camera status dots */}
                  <div className="flex gap-1">
                    {[1,2,3,4,5,6,7].map((i) => (
                      <span key={i} className={`w-2 h-2 rounded-full ${i <= 3 ? "bg-[#00FFB8]" : "bg-[#8B95A8]/30"}`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {isActive && market.phase_ends_at && (
              <CountdownTimer endsAt={market.phase_ends_at} />
            )}
          </header>

          {/* Counter + Phase label */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a2a3a] bg-[#0a1222]">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[#8B95A8] uppercase tracking-widest font-bold">Contagem atual:</span>
              <span className="text-2xl font-black text-[#00FFB8] tabular-nums">{currentCount}</span>
            </div>
            <div>
              {isBetting && (
                <span className="text-[10px] font-black text-[#FF5252] uppercase tracking-widest animate-pulse">
                  Previsoes encerram em: {market.phase_ends_at && <CountdownInline endsAt={market.phase_ends_at} />}
                </span>
              )}
              {isObservation && (
                <span className="text-[10px] font-black text-[#FFC700] uppercase tracking-widest">
                  Previsoes encerradas
                </span>
              )}
              {market.phase === "waiting" && (
                <span className="text-[10px] font-bold text-[#8B95A8] uppercase tracking-widest">
                  Aguardando rodada...
                </span>
              )}
            </div>
          </div>

          {/* Live HLS stream */}
          <div className="px-4 pt-3">
            <LiveStream marketId={marketId} streamUrl={market.stream_url} count={currentCount} cameraId={market.camera_id || marketId} />
          </div>

          {/* Betting buttons: OVER / UNDER (like Palpitano bottom buttons) */}
          <div className="px-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedType("over")}
                disabled={!isBetting}
                className={`py-4 rounded-xl text-center transition-all active:scale-95 border-2 ${
                  selectedType === "over"
                    ? "bg-[#00FFB8]/20 border-[#00FFB8] text-[#00FFB8] shadow-[0_0_20px_rgba(0,255,184,0.15)]"
                    : "bg-[#111827] border-[#1e2a3a] text-white hover:border-[#00FFB8]/40 disabled:opacity-40"
                }`}
              >
                <span className="text-xs font-bold opacity-70">Mais de {threshold}</span>
                <span className={`block text-lg font-black ${selectedType === "over" ? "text-[#00FFB8]" : "text-[#00FFB8]"}`}>
                  {odds.over > 0 ? `(${odds.over.toFixed(2)}x)` : "(--x)"}
                </span>
              </button>
              <button
                onClick={() => setSelectedType("under")}
                disabled={!isBetting}
                className={`py-4 rounded-xl text-center transition-all active:scale-95 border-2 ${
                  selectedType === "under"
                    ? "bg-[#FF5252]/20 border-[#FF5252] text-[#FF5252] shadow-[0_0_20px_rgba(255,82,82,0.15)]"
                    : "bg-[#111827] border-[#1e2a3a] text-white hover:border-[#FF5252]/40 disabled:opacity-40"
                }`}
              >
                <span className="text-xs font-bold opacity-70">Ate {threshold}</span>
                <span className={`block text-lg font-black ${selectedType === "under" ? "text-[#FF5252]" : "text-[#FF5252]"}`}>
                  {odds.under > 0 ? `(${odds.under.toFixed(2)}x)` : "(--x)"}
                </span>
              </button>
            </div>
          </div>

          {/* Round history */}
          <RoundHistory marketId={marketId} />

          {/* Last result + Next round CTA */}
          {lastResult && (
            <div className="mx-4 mb-3 space-y-3">
              <div className={`rounded-xl p-4 border text-center ${
                lastResult.result === "over"
                  ? "bg-[#00FFB8]/10 border-[#00FFB8]/30 text-[#00FFB8]"
                  : "bg-[#FF5252]/10 border-[#FF5252]/30 text-[#FF5252]"
              }`}>
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-70 mb-1">Resultado da Rodada</p>
                <p className="text-2xl font-black">{lastResult.final_count} <span className="text-sm">veiculos</span></p>
                <p className="text-xs mt-1">
                  {lastResult.result.toUpperCase()} (threshold {lastResult.threshold}) — <span className="font-black">{lastResult.payout_multiplier.toFixed(2)}x</span>
                </p>
              </div>
              {market.phase === "waiting" && (
                <button
                  onClick={async () => {
                    try {
                      await fetch("/api/camera/round", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ market_id: marketId, secret: "auto" }),
                      });
                    } catch {}
                  }}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00FFB8] to-[#00D4FF] text-[#003D2E] font-black text-sm uppercase tracking-wider active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(0,255,184,0.2)]"
                >
                  Proxima Previsao
                </button>
              )}
            </div>
          )}
          {/* Waiting without result */}
          {!lastResult && market.phase === "waiting" && (
            <div className="mx-4 mb-3">
              <button
                onClick={async () => {
                  try {
                    await fetch("/api/camera/round", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ market_id: marketId, secret: "auto" }),
                    });
                  } catch {}
                }}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00FFB8] to-[#00D4FF] text-[#003D2E] font-black text-sm uppercase tracking-wider active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(0,255,184,0.2)] animate-pulse"
              >
                Iniciar Previsao
              </button>
            </div>
          )}
        </div>

        {/* ─── MIDDLE COLUMN: Positions + Bet form ─── */}
        <div className="w-full lg:w-[340px] border-l border-[#1a2a3a] flex flex-col bg-[#0a1222]">
          {/* Tabs */}
          {selectedType ? (
            /* Bet form when type is selected */
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider">
                  {selectedType === "over" ? "Mais de" : "Ate"} {threshold}
                </h3>
                <button onClick={() => setSelectedType(null)} className="text-[#8B95A8] hover:text-white">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <p className="text-[10px] text-[#8B95A8]">
                Selecione uma opcao ao lado para fazer sua previsao.
              </p>

              {/* Amount */}
              <div>
                <p className="text-[10px] text-[#8B95A8] uppercase tracking-widest font-bold mb-2">Valor (R$)</p>
                <div className="flex items-center gap-2 mb-2">
                  {[1, 10, 50, 100].map((v) => (
                    <button key={v} onClick={() => setBetAmount(String(v))} className={`flex-1 py-2 rounded-lg text-xs font-bold ${betAmount === String(v) ? "bg-[#00FFB8]/20 text-[#00FFB8] border border-[#00FFB8]/40" : "bg-[#111827] text-[#8B95A8] border border-[#1e2a3a]"}`}>
                      R$ {v}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B95A8] font-bold">R$</span>
                  <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} placeholder="0" min="1" className="w-full bg-[#0a0f1a] rounded-xl pl-12 pr-4 py-3 text-white text-lg font-black outline-none border border-[#1e2a3a] focus:border-[#00FFB8]/40" />
                </div>
                {user && <p className="text-[10px] text-[#8B95A8] mt-1">Saldo: R$ {Number(user.balance).toFixed(2)}</p>}
              </div>

              {betMsg && (
                <div className={`rounded-xl p-3 text-xs font-bold text-center ${betMsg.type === "success" ? "bg-[#00FFB8]/10 text-[#00FFB8]" : "bg-[#FF5252]/10 text-[#FF5252]"}`}>
                  {betMsg.text}
                </div>
              )}

              <button
                onClick={placePrediction}
                disabled={!isBetting || !betAmount || Number(betAmount) < 1 || placing || !user}
                className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider active:scale-[0.98] transition-all disabled:opacity-40 ${
                  selectedType === "under" ? "bg-[#FF5252] text-white" : "bg-[#00FFB8] text-[#003D2E]"
                }`}
              >
                {!user ? "Faca login" : placing ? "Enviando..." : `${selectedType === "over" ? "MAIS DE" : "ATE"} ${threshold} — R$ ${betAmount || "0"}`}
              </button>
            </div>
          ) : (
            /* Positions tabs */
            <>
              <div className="flex border-b border-[#1a2a3a]">
                {(["posicoes", "aberto", "encerradas"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${tab === t ? "text-[#00FFB8] border-b-2 border-[#00FFB8]" : "text-[#8B95A8]"}`}>
                    {t === "posicoes" ? "Posicoes" : t === "aberto" ? "Em aberto" : "Encerradas"}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {tab === "posicoes" && (
                  <div className="text-center text-[#8B95A8] py-8">
                    <p className="text-sm">Faca login para visualizar suas posicoes.</p>
                    {!user && <Link href="/login" className="text-[#00FFB8] text-sm font-bold mt-2 inline-block">Entrar</Link>}
                    {user && myPredictions.length === 0 && <p className="text-xs mt-2">Nenhuma previsao feita ainda.</p>}
                    {user && myPredictions.length > 0 && (
                      <div className="space-y-2 mt-4 text-left">
                        {myPredictions.slice(0, 10).map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-[#111827] rounded-lg p-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${p.prediction_type === "over" ? "bg-[#00FFB8]/15 text-[#00FFB8]" : "bg-[#FF5252]/15 text-[#FF5252]"}`}>
                                {p.prediction_type === "over" ? "OVER" : "UNDER"} {p.threshold}
                              </span>
                              <span className={`text-[10px] font-bold ${p.status === "won" ? "text-[#00FFB8]" : p.status === "lost" ? "text-[#FF5252]" : "text-[#FFC700]"}`}>
                                {p.status === "won" ? `+R$${Number(p.payout).toFixed(2)}` : p.status === "lost" ? "PERDEU" : `@${Number(p.odds_at_entry).toFixed(2)}x`}
                              </span>
                            </div>
                            <span className="text-xs font-bold">R$ {Number(p.amount_brl).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {tab === "aberto" && (
                  <div className="space-y-2">
                    {openPredictions.length === 0 && <p className="text-center text-[#8B95A8] text-sm py-8">Nenhuma previsao em aberto.</p>}
                    {openPredictions.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-[#111827] rounded-lg p-2.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${p.prediction_type === "over" ? "bg-[#00FFB8]/15 text-[#00FFB8]" : "bg-[#FF5252]/15 text-[#FF5252]"}`}>
                          {p.prediction_type === "over" ? "OVER" : "UNDER"} {p.threshold} @{Number(p.odds_at_entry).toFixed(2)}x
                        </span>
                        <span className="text-xs font-bold text-[#FFC700]">R$ {Number(p.amount_brl).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {tab === "encerradas" && (
                  <div className="space-y-2">
                    {closedPredictions.length === 0 && <p className="text-center text-[#8B95A8] text-sm py-8">Nenhuma previsao encerrada.</p>}
                    {closedPredictions.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-[#111827] rounded-lg p-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${p.prediction_type === "over" ? "bg-[#00FFB8]/15 text-[#00FFB8]" : "bg-[#FF5252]/15 text-[#FF5252]"}`}>
                            {p.prediction_type === "over" ? "OVER" : "UNDER"} {p.threshold}
                          </span>
                          <span className={`text-[10px] font-bold ${p.status === "won" ? "text-[#00FFB8]" : "text-[#FF5252]"}`}>
                            {p.status === "won" ? "GANHOU" : "PERDEU"}
                          </span>
                        </div>
                        <span className="text-xs font-bold">{p.status === "won" ? `+R$${Number(p.payout).toFixed(2)}` : `R$ ${Number(p.amount_brl).toFixed(2)}`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ─── RIGHT COLUMN: Chat ao Vivo ─── */}
        <div className="w-full lg:w-[340px] border-l border-[#1a2a3a] flex flex-col bg-[#0d1525] h-screen lg:h-auto">
          <InlineChat />
        </div>
      </div>

      <div className="lg:hidden"><BottomNav /></div>
    </div>
  );
}

/* ─── Inline countdown (small, no animation) ─── */
function CountdownInline({ endsAt }: { endsAt: string }) {
  const [t, setT] = useState("--:--");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setT("00:00"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setT(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);
  return <span className="tabular-nums">{t}</span>;
}
