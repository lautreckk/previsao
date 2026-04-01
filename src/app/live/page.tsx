"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";

// ---- LOCATIONS (rotate every 5 min) ----
const LOCATIONS = [
  { name: "CAMPOS DO JORDAO", cam: "SP 123 KM046", region: "Serra da Mantiqueira, SP" },
  { name: "ITAIM BIBI", cam: "AV FARIA LIMA KM02", region: "Zona Oeste, SP" },
  { name: "AV PAULISTA", cam: "SP CENTRO KM01", region: "Centro, SP" },
  { name: "COPACABANA", cam: "RJ 040 KM003", region: "Zona Sul, RJ" },
  { name: "MARGINAL TIETE", cam: "SP 015 KM098", region: "Zona Norte, SP" },
  { name: "BR-101 FLORIPA", cam: "SC 101 KM212", region: "Florianopolis, SC" },
  { name: "AV BRASIL RJ", cam: "RJ 071 KM005", region: "Zona Norte, RJ" },
  { name: "RODOVIA ANCHIETA", cam: "SP 150 KM042", region: "Santos, SP" },
  { name: "SAVASSI BH", cam: "MG 030 KM002", region: "Centro, BH" },
  { name: "EIXO MONUMENTAL", cam: "DF 002 KM01", region: "Brasilia, DF" },
  { name: "AV BOA VIAGEM", cam: "PE 009 KM003", region: "Recife, PE" },
  { name: "BEIRA MAR FORTALEZA", cam: "CE 040 KM001", region: "Fortaleza, CE" },
];

// Fake bet animations
const FAKE_BETS = ["+R$ 0,40", "+R$ 1,00", "+R$ 2,00", "+R$ 0,66", "+R$ 5,00", "+R$ 10,00", "+R$ 1,00", "+R$ 0,50", "+R$ 3,00", "+R$ 20,00", "+R$ 0,80", "+R$ 15,00", "+R$ 2,50", "+R$ 7,00", "+R$ 1,50"];

// Chat messages
const CHAT_USERS = ["@ggchico29", "@renandouglas1903", "@quilt0renown", "@edu.borgmann", "@taylormizumoto", "@kkkkkkkkkkkk", "@suelicapela10", "@carvalho280922", "@felipematos_", "@bruninha99"];
const CHAT_MSGS = [
  "taylor todo desumilde so pq fez 5k ontem - 698 previsoes",
  "tnc,a moto - 105 previsoes",
  "nervoso - 94 previsoes",
  "Como assim? O tempo termina e a contagem continua? - 30 previsoes",
  "5k eu ja gastei so com programa da mae do leo - 145 previsoes",
  "quem foi de under ta maluko - 135 previsoes",
  "grupo telegram operando 100% acertivo!",
  "ENTAO EU SOU LOUCO - 55 previsoes",
  "bora pra cima galera",
  "acertei 3 seguidas no transito",
  "essa cam ta boa demais",
  "passa mais carro ai",
];

// ---- VIDEO SOURCES (public traffic cam streams/images) ----
const VIDEO_SOURCES = [
  "https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=640&q=80",
  "https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=640&q=80",
  "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=640&q=80",
  "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=640&q=80",
  "https://images.unsplash.com/photo-1554232456-8727aae0862d?w=640&q=80",
  "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=640&q=80",
];

export default function LivePage() {
  const { user } = useUser();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [count, setCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300); // 5 min
  const [locationIdx, setLocationIdx] = useState(0);
  const [betAnimations, setBetAnimations] = useState<{ id: number; text: string; y: number }[]>([]);
  const [recentResults, setRecentResults] = useState<("up" | "down")[]>(["down", "up", "up", "down", "up"]);
  const [chatMsgs, setChatMsgs] = useState<{ user: string; text: string; id: number }[]>([]);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [threshold] = useState(() => 50 + Math.floor(Math.random() * 40)); // 50-90
  const [payoutUp] = useState(() => (1.5 + Math.random() * 0.8).toFixed(2));
  const [payoutDown] = useState(() => (1.5 + Math.random() * 0.8).toFixed(2));
  const [probUp] = useState(() => Math.floor(40 + Math.random() * 25));
  const onlineCount = useRef(640 + Math.floor(Math.random() * 20));
  const animFrameRef = useRef<number>(0);
  const detectionLines = useRef<{ x: number; y: number; w: number; progress: number; color: string }[]>([]);

  const loc = LOCATIONS[locationIdx % LOCATIONS.length];

  // Load background image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = VIDEO_SOURCES[locationIdx % VIDEO_SOURCES.length];
    img.onload = () => { imgRef.current = img; };
    return () => { imgRef.current = null; };
  }, [locationIdx]);

  // Canvas animation - fake vehicle detection
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastDetection = 0;
    const animate = (time: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Draw background image
      if (imgRef.current) {
        ctx.drawImage(imgRef.current, 0, 0, w, h);
        // Dark overlay
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = "#1a2332";
        ctx.fillRect(0, 0, w, h);
      }

      // Scan lines effect
      ctx.strokeStyle = "rgba(0,255,100,0.08)";
      for (let y = 0; y < h; y += 3) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Detection lines (green tracking lines)
      detectionLines.current = detectionLines.current.filter((l) => l.progress < 1);
      detectionLines.current.forEach((line) => {
        line.progress += 0.015;
        const alpha = 1 - line.progress;
        ctx.strokeStyle = `rgba(0,255,100,${alpha * 0.8})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const currentX = line.x + line.w * line.progress;
        ctx.moveTo(currentX - 30, line.y - 5);
        ctx.lineTo(currentX + 30, line.y + 5);
        ctx.stroke();
        // Bounding box
        ctx.strokeStyle = `rgba(128,255,0,${alpha * 0.6})`;
        ctx.strokeRect(currentX - 20, line.y - 15, 40, 25);
      });

      // Spawn new detection lines randomly
      if (time - lastDetection > 800 + Math.random() * 1200) {
        lastDetection = time;
        const laneY = 100 + Math.random() * (h - 200);
        detectionLines.current.push({
          x: 50, y: laneY, w: w - 100,
          progress: 0,
          color: Math.random() > 0.5 ? "#80FF00" : "#A0FF40",
        });
        // Increment count
        setCount((c) => c + 1);
      }

      // Location overlay (top)
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, w, 28);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.fillText(loc.name, 10, 18);
      // Bottom overlay
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, h - 28, w, 28);
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "10px monospace";
      ctx.fillText(loc.cam, 10, h - 10);
      ctx.fillText(new Date().toLocaleTimeString("pt-BR"), w - 70, h - 10);

      // Green detection zone lines
      ctx.strokeStyle = "rgba(0,255,100,0.3)";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, h * 0.4);
      ctx.lineTo(w, h * 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, h * 0.7);
      ctx.lineTo(w, h * 0.65);
      ctx.stroke();
      ctx.setLineDash([]);

      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [loc, locationIdx]);

  // Timer countdown
  useEffect(() => {
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          // Reset - new round, new location
          setLocationIdx((i) => i + 1);
          setCount(0);
          setRecentResults((prev) => {
            const result = Math.random() > 0.5 ? "up" : "down";
            return [...prev.slice(-9), result];
          });
          return 300;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Fake bet animations
  useEffect(() => {
    const iv = setInterval(() => {
      const text = FAKE_BETS[Math.floor(Math.random() * FAKE_BETS.length)];
      const y = 150 + Math.random() * 250;
      setBetAnimations((prev) => [...prev.slice(-8), { id: Date.now() + Math.random(), text, y }]);
    }, 1500 + Math.random() * 2000);
    return () => clearInterval(iv);
  }, []);

  // Remove old animations
  useEffect(() => {
    const iv = setInterval(() => {
      setBetAnimations((prev) => prev.filter((a) => Date.now() - a.id < 3000));
    }, 500);
    return () => clearInterval(iv);
  }, []);

  // Chat auto messages
  useEffect(() => {
    const initial = Array.from({ length: 6 }, (_, i) => ({
      user: CHAT_USERS[i % CHAT_USERS.length],
      text: CHAT_MSGS[i % CHAT_MSGS.length],
      id: i,
    }));
    setChatMsgs(initial);
    const iv = setInterval(() => {
      setChatMsgs((prev) => [...prev.slice(-30), {
        user: CHAT_USERS[Math.floor(Math.random() * CHAT_USERS.length)],
        text: CHAT_MSGS[Math.floor(Math.random() * CHAT_MSGS.length)],
        id: Date.now(),
      }]);
    }, 3000 + Math.random() * 4000);
    return () => clearInterval(iv);
  }, []);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="min-h-screen bg-[#111a27] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#151e2d]/95 backdrop-blur-xl border-b border-white/[0.06] px-4 h-14 flex items-center gap-4">
        <Link href="/" className="shrink-0"><img src="/logo.png" alt="Winify" className="h-10 w-auto" /></Link>
        <div className="flex-1 hidden sm:block max-w-lg mx-auto">
          <input placeholder="Buscar mercados..." className="w-full bg-[#1A1722] rounded-lg pl-10 pr-4 py-2 text-sm text-white border border-white/[0.06] outline-none placeholder-[#5A6478]" />
        </div>
        {user ? (
          <Link href="/perfil" className="bg-[#1A1722] border border-white/[0.06] px-3 py-1.5 rounded-lg text-sm font-bold text-[#80FF00] ml-auto">R$ {user.balance.toFixed(2)}</Link>
        ) : (
          <Link href="/login" className="bg-[#80FF00] text-[#0a0a0a] px-5 py-2 rounded-lg text-sm font-black ml-auto">Entrar</Link>
        )}
      </header>

      <div className="flex">
        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
          {/* Live badge + title + countdown */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center gap-1.5 bg-[#80FF00]/10 px-3 py-1 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-[#80FF00] animate-pulse" />
                  <span className="text-xs font-black text-[#80FF00]">AO VIVO</span>
                </div>
              </div>
              <h1 className="text-xl sm:text-2xl font-black font-headline">Rodovia (5 minutos): quantos carros?</h1>
              <p className="text-xs text-white/50 mt-1">{loc.region} - {loc.cam}</p>
            </div>
            <div className="text-right">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black font-headline text-[#80FF00] tabular-nums">{String(mins).padStart(2, "0")}</span>
                <span className="text-xs text-white/30 uppercase">min</span>
                <span className="text-4xl font-black font-headline text-[#80FF00] tabular-nums">{String(secs).padStart(2, "0")}</span>
                <span className="text-xs text-white/30 uppercase">seg</span>
              </div>
            </div>
          </div>

          {/* Recent results */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-white/30">Ultimos</span>
            {recentResults.map((r, i) => (
              <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${r === "up" ? "bg-[#80FF00]/20 text-[#80FF00]" : "bg-[#FF6B5A]/20 text-[#FF6B5A]"}`}>
                {r === "up" ? "▲" : "▼"}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Video + detection */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <div><span className="text-white/30 uppercase font-bold">Contagem Atual</span><p className="text-3xl font-black font-headline text-white">{count}</p></div>
                <div className="text-right"><span className="text-white/30 uppercase font-bold">Previsoes Encerram Em</span><p className="text-3xl font-black font-headline text-[#A0FF40] tabular-nums">{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</p></div>
              </div>

              <div className="relative rounded-xl overflow-hidden bg-[#0a0f18] border border-white/[0.06]">
                <canvas ref={canvasRef} width={640} height={400} className="w-full h-auto" />
                {/* Floating bet animations */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {betAnimations.map((anim) => (
                    <div key={anim.id} className="absolute left-2 animate-fade-in-up" style={{ top: `${(anim.y / 400) * 100}%` }}>
                      <span className="text-[#80FF00] font-black text-sm drop-shadow-lg">{anim.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bet panel */}
            <div>
              <div className="bg-[#1A1722] rounded-xl border border-white/[0.06] p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs text-white/30">Sua previsao</p>
                    <p className="text-lg font-black text-[#80FF00]">{selectedOutcome === "up" ? `Mais de ${threshold}` : selectedOutcome === "down" ? `Ate ${threshold}` : "Selecione"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/30">Retorno</p>
                    <p className="text-lg font-black">{selectedOutcome === "up" ? payoutUp : selectedOutcome === "down" ? payoutDown : "—"}x <span className="text-xs text-white/30">· {probUp}%</span></p>
                  </div>
                </div>

                <div className="bg-[#111a27] rounded-xl p-6 text-center mb-4 border border-white/[0.06]">
                  <p className="text-3xl font-black font-headline">R$ {betAmount || "0"}</p>
                </div>

                <div className="flex gap-3 mb-4">
                  {[20, 50, 100].map((v) => (
                    <button key={v} onClick={() => setBetAmount(String(v))} className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all active:scale-95 ${betAmount === String(v) ? "bg-[#80FF00]/10 border-[#80FF00] text-[#80FF00]" : "border-white/[0.06] text-white/50"}`}>R$ {v}</button>
                  ))}
                  <button onClick={() => user && setBetAmount(String(Math.floor(user.balance)))} className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all active:scale-95 border-white/[0.06] text-white/50`}>Maximo</button>
                </div>

                <div className="flex justify-between text-xs text-white/30 mb-4">
                  <span>Ao acertar a previsao</span>
                  <span className="text-[#A0FF40] font-black text-sm">R$ {betAmount ? (parseFloat(betAmount) * parseFloat(selectedOutcome === "up" ? payoutUp : payoutDown)).toFixed(2) : "0,00"}</span>
                </div>

                <button className="w-full py-4 rounded-xl bg-[#2a3444] text-white font-black text-base hover:bg-[#3a4454] transition-all active:scale-95">
                  Fazer Previsao
                </button>
              </div>

              {/* Outcome buttons */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button onClick={() => setSelectedOutcome("up")} className={`py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${selectedOutcome === "up" ? "bg-[#80FF00] text-[#0a0a0a]" : "bg-[#80FF00]/10 text-[#80FF00] border border-[#80FF00]/30"}`}>
                  <span>▲</span> Mais de {threshold} ({payoutUp}x)
                </button>
                <button onClick={() => setSelectedOutcome("down")} className={`py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${selectedOutcome === "down" ? "bg-[#FF6B5A] text-white" : "bg-[#FF6B5A]/10 text-[#FF6B5A] border border-[#FF6B5A]/30"}`}>
                  <span>▼</span> Ate {threshold} ({payoutDown}x)
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Chat sidebar */}
        <aside className="hidden lg:flex flex-col w-80 xl:w-96 border-l border-white/[0.06] bg-[#151e2d] sticky top-14 h-[calc(100vh-56px)]">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-white/50 text-lg">chevron_right</span>
              <h3 className="font-black text-sm uppercase tracking-wider">Chat ao Vivo</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#80FF00]" />
              <span className="text-xs text-[#80FF00] font-bold">{onlineCount.current} online</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 no-scrollbar">
            {chatMsgs.map((msg) => (
              <div key={msg.id}>
                <p className="text-[#80FF00] font-bold text-sm">{msg.user}</p>
                <p className="text-[#c8cdd4] text-sm">{msg.text}</p>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              <input placeholder="Enviar mensagem..." className="flex-1 bg-[#1A1722] rounded-lg px-4 py-2.5 text-sm text-white border border-white/[0.06] outline-none placeholder-[#5A6478]" />
              <button className="text-white/30 hover:text-white"><span className="material-symbols-outlined text-xl">mood</span></button>
              <button className="text-white/30 hover:text-[#80FF00]"><span className="material-symbols-outlined text-xl">send</span></button>
            </div>
            <p className="text-[10px] text-white/30 mt-1.5">Seja respeitoso. Siga as <span className="text-[#80FF00]">regras da comunidade</span></p>
          </div>
        </aside>
      </div>
    </div>
  );
}
