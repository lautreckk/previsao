"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useCameraMarket } from "@/hooks/useCameraMarket";
import { useUser } from "@/lib/UserContext";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";

function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

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
    <div className="flex items-center gap-2">
      <span className="text-3xl font-black font-headline text-white tracking-wider">{timeLeft}</span>
      <div className="flex flex-col text-[10px] text-[#8B95A8] uppercase tracking-widest leading-tight">
        <span>MINS</span><span>SECS</span>
      </div>
    </div>
  );
}

function StreamEmbed({ url, type }: { url: string; type: string }) {
  if (type === "youtube") {
    // Extract YouTube video ID
    const match = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/live\/)([a-zA-Z0-9_-]+)/);
    const videoId = match ? match[1] : url;
    return (
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0`}
        className="w-full aspect-video rounded-xl"
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    );
  }

  // HLS/RTSP fallback - show as video tag or placeholder
  return (
    <div className="w-full aspect-video rounded-xl bg-[#0a1222] flex items-center justify-center">
      <video src={url} autoPlay muted playsInline className="w-full h-full rounded-xl object-cover" />
    </div>
  );
}

const RANGES = [
  { min: 0, max: 5 }, { min: 6, max: 10 }, { min: 11, max: 15 },
  { min: 16, max: 20 }, { min: 21, max: 25 }, { min: 26, max: 30 },
  { min: 31, max: 35 }, { min: 36, max: 40 }, { min: 41, max: 50 },
  { min: 51, max: 999 },
];

export default function CameraMarketPage() {
  const params = useParams();
  const marketId = params.id as string;
  const { market, currentRound, currentCount, loading } = useCameraMarket(marketId);
  const { user, refreshUser } = useUser();

  const [selectedRange, setSelectedRange] = useState<{ min: number; max: number } | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [placing, setPlacing] = useState(false);
  const [betMsg, setBetMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [myPredictions, setMyPredictions] = useState<{ id: string; predicted_min: number; predicted_max: number; amount_brl: number; status: string }[]>([]);

  // Load user predictions
  useEffect(() => {
    if (!user || !marketId) return;
    const load = async () => {
      const res = await fetch(`/api/camera/predict?market_id=${marketId}&user_id=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.predictions) setMyPredictions(data.predictions);
      }
    };
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [user, marketId]);

  const placePrediction = useCallback(async () => {
    if (!user || !selectedRange || !betAmount || Number(betAmount) < 1) return;
    setPlacing(true); setBetMsg(null);
    try {
      const res = await fetch("/api/camera/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market_id: marketId,
          round_id: currentRound?.id,
          predicted_min: selectedRange.min,
          predicted_max: selectedRange.max,
          amount: Number(betAmount),
          user_id: user.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.prediction) {
        setBetMsg({ text: `Previsao feita! ${selectedRange.min}-${selectedRange.max} veiculos`, type: "success" });
        setSelectedRange(null); setBetAmount("");
        refreshUser();
        setMyPredictions((prev) => [data.prediction, ...prev]);
      } else {
        setBetMsg({ text: data.error || "Erro ao fazer previsao", type: "error" });
      }
    } catch {
      setBetMsg({ text: "Erro de conexao", type: "error" });
    }
    setPlacing(false);
  }, [user, selectedRange, betAmount, marketId, currentRound, refreshUser]);

  if (loading) return <div className="min-h-screen bg-[#080d1a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#00FFB8] border-t-transparent rounded-full animate-spin" /></div>;
  if (!market) return <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-[#8B95A8]">Mercado nao encontrado</div>;

  const isOpen = market.status === "open";

  return (
    <div className="min-h-screen bg-[#080d1a] text-white overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0d1525]/95 backdrop-blur-xl border-b border-[#1a2a3a] px-4 h-14 flex items-center gap-3">
        <Link href="/" className="text-[#00FFB8]"><span className="material-symbols-outlined">arrow_back</span></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold font-headline truncate">{market.title}</h1>
          <p className="text-[10px] text-[#8B95A8]">{market.city}</p>
        </div>
        {currentRound?.ended_at && <CountdownTimer endsAt={currentRound.ended_at} />}
      </header>

      <div className="flex flex-col lg:flex-row">
        {/* Left: Stream + Counter */}
        <div className="flex-1 p-4 space-y-4">
          {/* Live badge + title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isOpen && (
                <span className="inline-flex items-center gap-1.5 bg-[#FF5252]/20 text-[#FF5252] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-[#FF5252] animate-pulse" />AO VIVO
                </span>
              )}
              <h2 className="text-lg font-black font-headline">{market.title}</h2>
            </div>
          </div>

          {/* Stream */}
          <div className="relative">
            <StreamEmbed url={market.stream_url} type={market.stream_type} />
          </div>

          {/* Counter */}
          <div className="flex items-center justify-between bg-[#0a1222] rounded-2xl p-5 border border-[#1a2a3a]">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#8B95A8] font-bold mb-1">Contagem Atual</p>
              <p className="text-5xl font-black font-headline text-[#00FFB8]">{currentCount}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-[#8B95A8] font-bold mb-1">Previsoes Encerram Em</p>
              {currentRound?.ended_at ? (
                <CountdownTimer endsAt={currentRound.ended_at} />
              ) : (
                <p className="text-xl font-bold text-[#FFC700]">Aguardando...</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Prediction Panel */}
        <div className="w-full lg:w-[400px] p-4 lg:border-l border-[#1a2a3a]">
          <div className="bg-[#0a1222] rounded-2xl border border-[#1a2a3a] overflow-hidden">
            <div className="p-4 border-b border-[#1a2a3a]">
              <h3 className="font-headline font-black text-sm uppercase tracking-wider">Fazer Previsao</h3>
              <p className="text-[10px] text-[#8B95A8] mt-1">Quantos veiculos vao passar?</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Range selector */}
              <div>
                <p className="text-[10px] text-[#8B95A8] uppercase tracking-widest font-bold mb-2">Faixa de veiculos</p>
                <div className="grid grid-cols-2 gap-2">
                  {RANGES.map((r) => (
                    <button
                      key={`${r.min}-${r.max}`}
                      onClick={() => setSelectedRange(r)}
                      disabled={!isOpen}
                      className={`py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                        selectedRange?.min === r.min && selectedRange?.max === r.max
                          ? "bg-[#00FFB8] text-[#003D2E] shadow-[0_0_15px_rgba(0,255,184,0.3)]"
                          : "bg-[#111827] text-white border border-[#1e2a3a] hover:border-[#00FFB8]/40 disabled:opacity-40"
                      }`}
                    >
                      {r.max === 999 ? `${r.min}+` : `${r.min} - ${r.max}`}
                    </button>
                  ))}
                </div>
              </div>

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
                  <input
                    type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="0" min="1"
                    className="w-full bg-[#0a0f1a] rounded-xl pl-12 pr-4 py-3 text-white text-lg font-black outline-none border border-[#1e2a3a] focus:border-[#00FFB8]/40"
                  />
                </div>
                {user && <p className="text-[10px] text-[#8B95A8] mt-1">Saldo: R$ {user.balance.toFixed(2)}</p>}
              </div>

              {/* Potential win */}
              {selectedRange && betAmount && Number(betAmount) > 0 && (
                <div className="flex items-center justify-between bg-[#111827] rounded-xl p-3 border border-[#1e2a3a]">
                  <span className="text-xs text-[#8B95A8]">Para ganhar</span>
                  <span className="text-lg font-black text-[#FFC700] font-headline">R$ {(Number(betAmount) * 2).toFixed(2)}</span>
                </div>
              )}

              {/* Bet message */}
              {betMsg && (
                <div className={`rounded-xl p-3 text-xs font-bold text-center ${betMsg.type === "success" ? "bg-[#00FFB8]/10 text-[#00FFB8]" : "bg-[#FF5252]/10 text-[#FF5252]"}`}>
                  {betMsg.text}
                </div>
              )}

              {/* Place button */}
              <button
                onClick={placePrediction}
                disabled={!isOpen || !selectedRange || !betAmount || Number(betAmount) < 1 || placing || !user}
                className="w-full py-4 rounded-xl bg-[#00FFB8] text-[#003D2E] font-black font-headline text-sm uppercase tracking-wider hover:bg-[#00FFB8]/90 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {!user ? "Faca login para prever" : placing ? "Enviando..." : selectedRange ? `Prever ${selectedRange.max === 999 ? `${selectedRange.min}+` : `${selectedRange.min}-${selectedRange.max}`} veiculos` : "Selecione uma faixa"}
              </button>
            </div>

            {/* My predictions */}
            {myPredictions.length > 0 && (
              <div className="border-t border-[#1a2a3a]">
                <div className="p-4">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-[#8B95A8] mb-3">Minhas Previsoes</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {myPredictions.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-[#111827] rounded-lg p-2.5">
                        <div>
                          <span className="text-xs font-bold">{p.predicted_min}-{p.predicted_max > 900 ? "\u221E" : p.predicted_max}</span>
                          <span className={`text-[10px] ml-2 font-bold ${p.status === "won" ? "text-[#00FFB8]" : p.status === "lost" ? "text-[#FF5252]" : "text-[#FFC700]"}`}>
                            {p.status === "won" ? "GANHOU" : p.status === "lost" ? "PERDEU" : "ABERTA"}
                          </span>
                        </div>
                        <span className="text-xs font-bold">R$ {Number(p.amount_brl).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:hidden"><BottomNav /></div>
    </div>
  );
}
