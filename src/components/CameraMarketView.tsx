"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCameraMarket } from "@/hooks/useCameraMarket";
import { useUser } from "@/lib/UserContext";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gqymalmbbtzdnpbneegg.supabase.co";

/* ─── Money sound when count increments ─── */
let moneyAudio: HTMLAudioElement | null = null;
function playBeep() {
  try {
    if (!moneyAudio) {
      moneyAudio = new Audio("/sounds/money.mp3");
      moneyAudio.volume = 0.3;
    }
    // Clone to allow overlapping plays
    const sound = moneyAudio.cloneNode() as HTMLAudioElement;
    sound.volume = 0.3;
    sound.play().catch(() => {});
  } catch {}
}

/* ─── Animated Count (odometer style) ─── */
function AnimatedCount({ value, onIncrement }: { value: number; onIncrement?: () => void }) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value === display) return;
    const increased = value > prevRef.current;
    prevRef.current = value;
    if (increased) onIncrement?.();
    setFlash(true);
    const diff = value - display;
    const steps = Math.min(Math.abs(diff), 10);
    const stepTime = 150 / steps;
    let current = display;
    const iv = setInterval(() => {
      current += diff > 0 ? 1 : -1;
      setDisplay(current);
      if (current === value) clearInterval(iv);
    }, stepTime);
    const flashTimer = setTimeout(() => setFlash(false), 300);
    return () => { clearInterval(iv); clearTimeout(flashTimer); };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className={`transition-all duration-200 ${flash ? "scale-110 text-white" : "scale-100"}`}>
      {display}
    </span>
  );
}

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
      {label && <span className="text-[9px] uppercase tracking-widest text-white/50 font-bold">{label}</span>}
      <span className="text-3xl font-black text-[#FF5252] tabular-nums animate-pulse">{timeLeft}</span>
    </div>
  );
}

/* ─── Live Stream: HLS from our server (annotated video with boxes) ─── */
function LiveStream({ marketId, count }: { marketId: string; count: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [connected, setConnected] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [muted, setMuted] = useState(false);
  const prevCountRef = useRef(count);

  // Sound effect when count increases
  useEffect(() => {
    if (count > prevCountRef.current && !muted) {
      playBeep();
    }
    prevCountRef.current = count;
  }, [count, muted]);

  // HLS from our MediaMTX server (proxied through Next.js API for HTTPS)
  const hlsUrl = `/api/camera/stream/${marketId}/index.m3u8`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    // Track actual playback start (not just manifest parsed)
    const onPlaying = () => { if (!cancelled) { setConnected(true); setBuffering(false); } };
    const onWaiting = () => { if (!cancelled) setBuffering(true); };
    const onCanPlay = () => { if (!cancelled) setBuffering(false); };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);

    async function setupHLS() {
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (Hls.isSupported()) {
        const hls = new Hls({
          liveSyncDurationCount: 4,
          liveMaxLatencyDurationCount: 8,
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 10,
          maxBufferLength: 20,
          maxMaxBufferLength: 30,
        });
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(video!);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video?.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              setTimeout(() => { if (!cancelled) hls.startLoad(); }, 3000);
            } else {
              hls.destroy();
              setTimeout(() => { if (!cancelled) setupHLS(); }, 5000);
            }
          }
        });
      } else if (video!.canPlayType("application/vnd.apple.mpegurl")) {
        video!.src = hlsUrl;
        video!.addEventListener("loadedmetadata", () => { video?.play().catch(() => {}); });
      }
    }
    setupHLS();
    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
    };
  }, [hlsUrl]);

  return (
    <div className="relative w-full" style={{ paddingBottom: "80%" }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-contain rounded-lg bg-black"
      />

      {/* Loading — until video actually plays */}
      {!connected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black rounded-lg z-[6]">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-[#80FF00] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-white/70 font-bold">Carregando camera...</p>
            <p className="text-[10px] text-white/40 mt-1">Processando IA em tempo real</p>
          </div>
        </div>
      )}

      {/* Buffering indicator (when connected but rebuffering) */}
      {connected && buffering && (
        <div className="absolute inset-0 flex items-center justify-center z-[6] pointer-events-none">
          <div className="w-8 h-8 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* AO VIVO badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full">
        <span className="w-2 h-2 rounded-full bg-[#FF5252] animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white">AO VIVO</span>
      </div>


      {/* Mute/unmute button */}
      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute bottom-3 right-3 z-10 bg-black/70 backdrop-blur-md px-3 py-2 rounded-full text-white/70 hover:text-white transition-colors"
        title={muted ? "Ativar som" : "Silenciar"}
      >
        <span className="material-symbols-outlined text-sm">{muted ? "volume_off" : "volume_up"}</span>
      </button>
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

const CAM_AVATAR_COLORS = [
  "from-[#FF6B6B] to-[#EE5A24]", "from-[#80FF00] to-[#4A9900]",
  "from-[#6C5CE7] to-[#A29BFE]", "from-[#FDCB6E] to-[#F39C12]",
  "from-[#00CEFF] to-[#0984E3]", "from-[#FD79A8] to-[#E84393]",
  "from-[#55E6C1] to-[#58B19F]", "from-[#FF9FF3] to-[#F368E0]",
];
function camAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return CAM_AVATAR_COLORS[Math.abs(hash) % CAM_AVATAR_COLORS.length];
}

interface ChatMsg { id: string; user: string; text: string; ts: number }

function InlineChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const { user } = useUser();
  const chatRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const now = Date.now();
    const seed: ChatMsg[] = [];
    for (let i = 0; i < 8; i++) {
      seed.push({
        id: `s${i}`,
        user: FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)],
        text: FAKE_MSGS[Math.floor(Math.random() * FAKE_MSGS.length)],
        ts: now - (8 - i) * 25000,
      });
    }
    setMessages(seed);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      if (Math.random() > 0.4) {
        setMessages((prev) => [
          ...prev.slice(-40),
          {
            id: `f${Date.now()}`,
            user: FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)],
            text: FAKE_MSGS[Math.floor(Math.random() * FAKE_MSGS.length)],
            ts: Date.now(),
          },
        ]);
        if (!isAtBottom) setUnreadCount((c) => c + 1);
      }
    }, 5000 + Math.random() * 5000);
    return () => clearInterval(iv);
  }, [isAtBottom]);

  useEffect(() => {
    if (isAtBottom) chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isAtBottom]);

  const handleScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setIsAtBottom(atBottom);
    if (atBottom) setUnreadCount(0);
  }, []);

  const send = () => {
    if (!input.trim() || !user) return;
    setMessages((prev) => [
      ...prev.slice(-40),
      { id: `u${Date.now()}`, user: `@${user.name.split(" ")[0].toLowerCase()}`, text: input.trim(), ts: Date.now() },
    ]);
    setInput("");
    setIsAtBottom(true);
  };

  const onlineCount = 420 + Math.floor(Math.random() * 80);

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#80FF00]/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#80FF00] text-sm">forum</span>
          </div>
          <div>
            <span className="text-xs font-black text-white uppercase tracking-wider">CHAT AO VIVO</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#80FF00] opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#80FF00]" /></span>
              <span className="text-[9px] text-[#80FF00] font-bold">{onlineCount} online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 min-h-0">
        {messages.map((msg, idx) => {
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const isGrouped = prevMsg?.user === msg.user;
          const timeAgo = Math.max(0, Math.floor((Date.now() - msg.ts) / 60000));
          const timeStr = timeAgo === 0 ? "agora" : `${timeAgo}min`;

          return (
            <div key={msg.id} className={`group flex gap-2 px-2 py-1 rounded-lg hover:bg-[#1a2a3a]/50 transition-colors ${isGrouped ? "" : "mt-1.5"}`}>
              {!isGrouped ? (
                <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${camAvatarColor(msg.user)} flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5`}>
                  {msg.user.replace("@", "").charAt(0).toUpperCase()}
                </div>
              ) : (
                <div className="w-7 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                {!isGrouped && (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[#80FF00] font-bold text-[11px] truncate">{msg.user}</span>
                    <span className="text-[9px] text-[#3a4a5a] ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">{timeStr}</span>
                  </div>
                )}
                <p className="text-[12px] text-gray-300 break-words leading-relaxed">{msg.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* New messages indicator */}
      {!isAtBottom && unreadCount > 0 && (
        <button
          onClick={() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); setIsAtBottom(true); setUnreadCount(0); }}
          className="absolute bottom-[60px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-[#80FF00] text-[#0a0a0a] px-2.5 py-1 rounded-full text-[10px] font-black shadow-[0_4px_12px_rgba(128,255,0,0.4)] animate-bounce"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>keyboard_arrow_down</span>
          {unreadCount} novas
        </button>
      )}

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-white/[0.04] shrink-0 bg-[#0a1020]">
        {user ? (
          <div className="flex items-center gap-2 bg-[#12101A] rounded-xl border border-[#1e2a3a] focus-within:border-[#80FF00]/40 transition-colors px-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Enviar mensagem..."
              className="flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder-[#8B95A8]"
            />
            <button onClick={send} className="text-white/50 hover:text-[#80FF00] transition-colors p-1">
              <span className="material-symbols-outlined text-base">send</span>
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-white/50">
            <a href="/login" className="text-[#80FF00] font-bold">Faca login</a> para enviar mensagens
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
    <div className="px-4 py-3 border-t border-white/[0.04]">
      <p className="text-[10px] uppercase tracking-widest font-bold text-white/50 mb-2">Historico</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {history.map((r) => {
          const isOver = (r.final_count || 0) > (r.threshold || 0);
          return (
            <div key={r.id} className={`flex-shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${isOver ? "bg-[#80FF00]/10 text-[#80FF00]" : "bg-[#FF5252]/10 text-[#FF5252]"}`}>
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
export function CameraMarketView({ marketId }: { marketId: string }) {
  const { market, currentRound, currentCount, odds, loading, lastResult } = useCameraMarket(marketId);
  const { user, refreshUser } = useUser();

  const [selectedType, setSelectedType] = useState<"over" | "under" | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [placing, setPlacing] = useState(false);
  const [betMsg, setBetMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [tab, setTab] = useState<"posicoes" | "aberto" | "encerradas">("posicoes");
  const [mobilePanel, setMobilePanel] = useState<"camera" | "posicoes" | "chat">("camera");
  const [myPredictions, setMyPredictions] = useState<
    { id: string; prediction_type: string; threshold: number; amount_brl: number; odds_at_entry: number; payout: number; status: string }[]
  >([]);
  const [showConfirm, setShowConfirm] = useState(false);

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

  if (loading) return <div className="min-h-screen bg-[#080d1a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#80FF00] border-t-transparent rounded-full animate-spin" /></div>;
  if (!market) return <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-white/50">Mercado nao encontrado</div>;

  const isBetting = market.phase === "betting";
  const isObservation = market.phase === "observation";
  const isActive = isBetting || isObservation;
  const threshold = market.current_threshold;

  const openPredictions = myPredictions.filter((p) => p.status === "open");
  const closedPredictions = myPredictions.filter((p) => p.status !== "open");

  return (
    <div className="h-screen bg-[#080d1a] text-white overflow-hidden">
      {/* ─── MOBILE: Panel switcher tabs ─── */}
      <div className="lg:hidden flex border-b border-white/[0.04] bg-[#0D0B14] sticky top-0 z-20">
        {([
          { key: "camera" as const, icon: "videocam", label: "Camera" },
          { key: "posicoes" as const, icon: "receipt_long", label: "Posicoes" },
          { key: "chat" as const, icon: "forum", label: "Chat" },
        ]).map((p) => (
          <button
            key={p.key}
            onClick={() => setMobilePanel(p.key)}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider transition-colors ${
              mobilePanel === p.key
                ? "text-[#80FF00] border-b-2 border-[#80FF00]"
                : "text-white/40"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-41px)] pb-16 lg:pb-0 lg:h-screen">

        {/* ─── LEFT COLUMN: Stream + Betting ─── */}
        <div className={`flex-1 flex flex-col min-w-0 overflow-y-auto ${mobilePanel !== "camera" ? "hidden lg:flex" : ""}`}>

          {/* Top bar: Title + Timer */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] bg-[#0D0B14]">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/" className="text-[#80FF00] shrink-0">
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
                      <span key={i} className={`w-2 h-2 rounded-full ${i <= 3 ? "bg-[#80FF00]" : "bg-[#8B95A8]/30"}`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {isActive && market.phase_ends_at && (
              <CountdownTimer endsAt={market.phase_ends_at} />
            )}
          </header>

          {/* Phase label — count is shown IN the video by the worker */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] bg-[#0a1222]">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Rodada {market.round_number}</span>
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
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                  Aguardando rodada...
                </span>
              )}
            </div>
          </div>

          {/* Live HLS stream */}
          <div className="px-4 pt-3">
            <LiveStream marketId={marketId} count={currentCount} />
          </div>

          {/* Betting buttons: OVER / UNDER (like Palpitano bottom buttons) */}
          <div className="px-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedType("over")}
                disabled={!isBetting}
                className={`py-4 rounded-xl text-center transition-all active:scale-95 border-2 ${
                  selectedType === "over"
                    ? "bg-[#80FF00]/20 border-[#80FF00] text-[#80FF00] shadow-[0_0_20px_rgba(128,255,0,0.15)]"
                    : "bg-[#12101A] border-[#1e2a3a] text-white hover:border-[#80FF00]/40 disabled:opacity-40"
                }`}
              >
                <span className="text-xs font-bold opacity-70">Mais de {threshold}</span>
                <span className={`block text-lg font-black ${selectedType === "over" ? "text-[#80FF00]" : "text-[#80FF00]"}`}>
                  {odds.over > 0 ? `(${odds.over.toFixed(2)}x)` : "(--x)"}
                </span>
              </button>
              <button
                onClick={() => setSelectedType("under")}
                disabled={!isBetting}
                className={`py-4 rounded-xl text-center transition-all active:scale-95 border-2 ${
                  selectedType === "under"
                    ? "bg-[#FF5252]/20 border-[#FF5252] text-[#FF5252] shadow-[0_0_20px_rgba(255,82,82,0.15)]"
                    : "bg-[#12101A] border-[#1e2a3a] text-white hover:border-[#FF5252]/40 disabled:opacity-40"
                }`}
              >
                <span className="text-xs font-bold opacity-70">Ate {threshold}</span>
                <span className={`block text-lg font-black ${selectedType === "under" ? "text-[#FF5252]" : "text-[#FF5252]"}`}>
                  {odds.under > 0 ? `(${odds.under.toFixed(2)}x)` : "(--x)"}
                </span>
              </button>
            </div>
          </div>

          {/* Mobile inline bet form — appears in camera tab when type selected */}
          {selectedType && (
            <div className="lg:hidden px-4 pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/70">{selectedType === "over" ? "Mais de" : "Até"} {threshold} — {selectedType === "over" ? odds.over.toFixed(2) : odds.under.toFixed(2)}x</span>
                <button onClick={() => setSelectedType(null)} className="text-white/40 text-xs">Cancelar</button>
              </div>
              <div className="flex gap-2">
                {[5, 10, 50, 100].map((v) => (
                  <button key={v} onClick={() => setBetAmount(String(v))} className={`flex-1 py-2 rounded-lg text-xs font-bold ${betAmount === String(v) ? "bg-[#80FF00]/20 text-[#80FF00] border border-[#80FF00]/40" : "bg-[#12101A] text-white/50 border border-[#1e2a3a]"}`}>R$ {v}</button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm font-bold">R$</span>
                <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} placeholder="0" min="1" className="w-full bg-[#0A0910] rounded-xl pl-10 pr-4 py-2.5 text-white text-base font-black outline-none border border-[#1e2a3a] focus:border-[#80FF00]/40" />
              </div>
              {/* Potential gain preview */}
              {betAmount && parseFloat(betAmount) > 0 && (
                <div className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.04]">
                  <span className="text-[10px] text-white/40">Potencial ganho</span>
                  <span className="text-sm font-black text-[#80FF00]">R$ {(parseFloat(betAmount) * (selectedType === "over" ? odds.over : odds.under)).toFixed(2)}</span>
                </div>
              )}
              <button
                onClick={() => setShowConfirm(true)}
                disabled={placing || !betAmount || parseFloat(betAmount) <= 0 || !user}
                className="w-full py-3 rounded-xl bg-[#80FF00] text-[#0a0a0a] font-black text-sm uppercase tracking-wider disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {placing ? "Enviando..." : !user ? "Faça login" : `Apostar R$ ${betAmount || "0"}`}
              </button>
              {betMsg && <div className={`rounded-lg p-2 text-xs font-bold text-center ${betMsg.type === "success" ? "bg-[#80FF00]/10 text-[#80FF00]" : "bg-[#FF5252]/10 text-[#FF5252]"}`}>{betMsg.text}</div>}
            </div>
          )}

          {/* Round history */}
          <RoundHistory marketId={marketId} />

          {/* Last result + Next round CTA */}
          {lastResult && (
            <div className="mx-4 mb-3 space-y-3">
              <div className={`rounded-xl p-4 border text-center ${
                lastResult.result === "over"
                  ? "bg-[#80FF00]/10 border-[#80FF00]/30 text-[#80FF00]"
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
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-[#80FF00] to-[#80FF00] text-[#0a0a0a] font-black text-sm uppercase tracking-wider active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(128,255,0,0.2)]"
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
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#80FF00] to-[#80FF00] text-[#0a0a0a] font-black text-sm uppercase tracking-wider active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(128,255,0,0.2)] animate-pulse"
              >
                Iniciar Previsao
              </button>
            </div>
          )}
        </div>

        {/* ─── MIDDLE COLUMN: Positions + Bet form ─── */}
        <div className={`w-full lg:w-[340px] lg:border-l border-white/[0.04] flex flex-col bg-[#0a1222] overflow-hidden ${mobilePanel !== "posicoes" ? "hidden lg:flex" : ""}`}>
          {/* Tabs */}
          {selectedType ? (
            /* Bet form when type is selected */
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider">
                  {selectedType === "over" ? "Mais de" : "Ate"} {threshold}
                </h3>
                <button onClick={() => setSelectedType(null)} className="text-white/50 hover:text-white">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <p className="text-[10px] text-white/50">
                Selecione uma opcao ao lado para fazer sua previsao.
              </p>

              {/* Amount */}
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-2">Valor (R$)</p>
                <div className="flex items-center gap-2 mb-2">
                  {[1, 10, 50, 100].map((v) => (
                    <button key={v} onClick={() => setBetAmount(String(v))} className={`flex-1 py-2 rounded-lg text-xs font-bold ${betAmount === String(v) ? "bg-[#80FF00]/20 text-[#80FF00] border border-[#80FF00]/40" : "bg-[#12101A] text-white/50 border border-[#1e2a3a]"}`}>
                      R$ {v}
                    </button>
                  ))}
                  <button
                    onClick={() => user && setBetAmount(String(Math.floor(Number(user.balance) * 100) / 100))}
                    disabled={!user || Number(user.balance) <= 0}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold ${
                      user && betAmount === String(Math.floor(Number(user.balance) * 100) / 100)
                        ? "bg-[#80FF00]/20 text-[#80FF00] border border-[#80FF00]/40"
                        : "bg-[#12101A] text-white/50 border border-[#1e2a3a] disabled:opacity-40"
                    }`}
                  >
                    MAX
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold">R$</span>
                  <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} placeholder="0" min="1" className="w-full bg-[#0A0910] rounded-xl pl-12 pr-4 py-3 text-white text-lg font-black outline-none border border-[#1e2a3a] focus:border-[#80FF00]/40" />
                </div>
                {user && <p className="text-[10px] text-white/50 mt-1">Saldo: R$ {Number(user.balance).toFixed(2)}</p>}
              </div>

              {betMsg && (
                <div className={`rounded-xl p-3 text-xs font-bold text-center ${betMsg.type === "success" ? "bg-[#80FF00]/10 text-[#80FF00]" : "bg-[#FF5252]/10 text-[#FF5252]"}`}>
                  {betMsg.text}
                </div>
              )}

              <button
                onClick={placePrediction}
                disabled={!isBetting || !betAmount || Number(betAmount) < 1 || placing || !user}
                className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider active:scale-[0.98] transition-all disabled:opacity-40 ${
                  selectedType === "under" ? "bg-[#FF5252] text-white" : "bg-[#80FF00] text-[#0a0a0a]"
                }`}
              >
                {!user ? "Faca login" : placing ? "Enviando..." : `${selectedType === "over" ? "MAIS DE" : "ATE"} ${threshold} — R$ ${betAmount || "0"}`}
              </button>
            </div>
          ) : (
            /* Positions tabs */
            <>
              <div className="flex border-b border-white/[0.04]">
                {(["posicoes", "aberto", "encerradas"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${tab === t ? "text-[#80FF00] border-b-2 border-[#80FF00]" : "text-white/50"}`}>
                    {t === "posicoes" ? "Posicoes" : t === "aberto" ? "Em aberto" : "Encerradas"}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {tab === "posicoes" && (
                  <div className="text-center text-white/50 py-8">
                    <p className="text-sm">Faca login para visualizar suas posicoes.</p>
                    {!user && <Link href="/login" className="text-[#80FF00] text-sm font-bold mt-2 inline-block">Entrar</Link>}
                    {user && myPredictions.length === 0 && <p className="text-xs mt-2">Nenhuma previsao feita ainda.</p>}
                    {user && myPredictions.length > 0 && (
                      <div className="space-y-2 mt-4 text-left">
                        {myPredictions.slice(0, 10).map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-[#12101A] rounded-lg p-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${p.prediction_type === "over" ? "bg-[#80FF00]/15 text-[#80FF00]" : "bg-[#FF5252]/15 text-[#FF5252]"}`}>
                                {p.prediction_type === "over" ? "OVER" : "UNDER"} {p.threshold}
                              </span>
                              <span className={`text-[10px] font-bold ${p.status === "won" ? "text-[#80FF00]" : p.status === "lost" ? "text-[#FF5252]" : "text-[#FFC700]"}`}>
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
                    {openPredictions.length === 0 && <p className="text-center text-white/50 text-sm py-8">Nenhuma previsao em aberto.</p>}
                    {openPredictions.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-[#12101A] rounded-lg p-2.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${p.prediction_type === "over" ? "bg-[#80FF00]/15 text-[#80FF00]" : "bg-[#FF5252]/15 text-[#FF5252]"}`}>
                          {p.prediction_type === "over" ? "OVER" : "UNDER"} {p.threshold} @{Number(p.odds_at_entry).toFixed(2)}x
                        </span>
                        <span className="text-xs font-bold text-[#FFC700]">R$ {Number(p.amount_brl).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {tab === "encerradas" && (
                  <div className="space-y-2">
                    {closedPredictions.length === 0 && <p className="text-center text-white/50 text-sm py-8">Nenhuma previsao encerrada.</p>}
                    {closedPredictions.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-[#12101A] rounded-lg p-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${p.prediction_type === "over" ? "bg-[#80FF00]/15 text-[#80FF00]" : "bg-[#FF5252]/15 text-[#FF5252]"}`}>
                            {p.prediction_type === "over" ? "OVER" : "UNDER"} {p.threshold}
                          </span>
                          <span className={`text-[10px] font-bold ${p.status === "won" ? "text-[#80FF00]" : "text-[#FF5252]"}`}>
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
        <div className={`w-full lg:w-[340px] lg:border-l border-white/[0.04] flex flex-col bg-[#0D0B14] overflow-hidden ${mobilePanel !== "chat" ? "hidden lg:flex" : ""}`}>
          <InlineChat />
        </div>
      </div>

      <div className="lg:hidden"><BottomNav /></div>

      {/* Confirmation Modal */}
      {showConfirm && selectedType && betAmount && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-[#0D0B14] rounded-2xl p-6 w-full max-w-sm border border-white/[0.06]">
            <h3 className="text-lg font-black mb-4 text-center uppercase">Confirmar Previsão</h3>
            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-white/40">Previsão</span>
                <span className="font-bold" style={{ color: selectedType === "over" ? "#80FF00" : "#FF5252" }}>
                  {selectedType === "over" ? `Mais de ${threshold}` : `Até ${threshold}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Valor</span>
                <span className="font-bold">R$ {parseFloat(betAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Odd</span>
                <span className="font-bold text-[#80FF00]">{(selectedType === "over" ? odds.over : odds.under).toFixed(2)}x</span>
              </div>
              <div className="flex justify-between border-t border-white/[0.06] pt-3">
                <span className="text-white/40">Potencial Ganho</span>
                <span className="font-black text-[#80FF00] text-lg">
                  R$ {(parseFloat(betAmount) * (selectedType === "over" ? odds.over : odds.under)).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 rounded-xl bg-[#1a2a3a] text-white/50 font-bold">Cancelar</button>
              <button
                onClick={() => { setShowConfirm(false); placePrediction(); }}
                disabled={placing}
                className="flex-1 py-3 rounded-xl bg-[#80FF00] text-[#0a0a0a] font-black uppercase disabled:opacity-50"
              >
                {placing ? "Enviando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
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
