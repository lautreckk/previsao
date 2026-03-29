"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { initializeStore, getMarket, placeBetFull, tickAllMarkets } from "@/lib/engines/store";
import { simulateBet, calcImpliedProbabilities } from "@/lib/engines/parimutuel";
import { CATEGORY_META } from "@/lib/engines/types";
import BottomNav from "@/components/BottomNav";
import CameraFrameView from "@/components/CameraFrameView";
import { useLiveCarCount } from "@/hooks/useLiveCarCount";
import { useState, useEffect } from "react";
import type { PredictionMarket } from "@/lib/engines/types";

export default function EventoPage() {
  const params = useParams();
  const router = useRouter();
  const { user, placeBet: legacyPlaceBet } = useUser();
  const [market, setMarket] = useState<PredictionMarket | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [betPlaced, setBetPlaced] = useState(false);
  const [error, setError] = useState("");
  const liveCount = useLiveCarCount(market?.id || "");

  useEffect(() => {
    initializeStore();
    tickAllMarkets();
    const m = getMarket(params.id as string);
    setMarket(m || null);
    const iv = setInterval(() => { const m2 = getMarket(params.id as string); if (m2) setMarket(m2); }, 3000);
    return () => clearInterval(iv);
  }, [params.id]);

  if (!market) {
    return (
      <div className="min-h-screen bg-[#0b1120] flex items-center justify-center text-white">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-[#8B95A8]">error</span>
          <p className="mt-2 text-[#8B95A8]">Mercado nao encontrado</p>
          <button onClick={() => router.push("/")} className="mt-4 text-[#00D4AA] font-bold">Voltar</button>
        </div>
      </div>
    );
  }

  const meta = CATEGORY_META[market.category];
  const selected = market.outcomes.find((o) => o.key === selectedOutcome);
  const simulation = selected && betAmount ? simulateBet(market, selected.key, parseFloat(betAmount) || 0) : null;
  const probabilities = calcImpliedProbabilities(market.outcomes);
  const isOpen = market.status === "open";
  const now = Date.now();
  const timeLeft = market.close_at - now;

  let timeStr = "";
  if (timeLeft <= 0) timeStr = "Encerrado";
  else if (timeLeft < 3600000) { const m = Math.floor(timeLeft / 60000); const s = Math.floor((timeLeft % 60000) / 1000); timeStr = `${m}:${String(s).padStart(2, "0")}`; }
  else if (timeLeft < 86400000) timeStr = `${Math.floor(timeLeft / 3600000)}h ${Math.floor((timeLeft % 3600000) / 60000)}m`;
  else timeStr = `${Math.floor(timeLeft / 86400000)}d`;

  const handleBet = () => {
    setError("");
    if (!user) { router.push("/login"); return; }
    if (!selected || !betAmount) return;
    const amount = parseFloat(betAmount);

    const result = placeBetFull(user.id, market.id, selected.key, amount, user.balance);
    if (!result.success) { setError(result.error || "Erro"); return; }

    // Also debit from UserContext for balance display
    legacyPlaceBet({ marketId: market.id, marketTitle: market.title, optionId: selected.key, optionName: selected.label, amount, odds: selected.payout_per_unit, potentialWin: amount * selected.payout_per_unit });

    setBetPlaced(true); setShowConfirm(false); setSelectedOutcome(null); setBetAmount("");
    setMarket(result.market || market);
    setTimeout(() => setBetPlaced(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-white overflow-x-hidden w-full max-w-[100vw]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-4 h-16 bg-[#0b1120]/80 backdrop-blur-xl bg-gradient-to-b from-[#0f1729] to-transparent shadow-2xl shadow-emerald-500/10 overflow-hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-[#00D4AA]"><span className="material-symbols-outlined">arrow_back</span></button>
          <img src="/logo.png" alt="Winify" className="h-16 w-auto" />
        </div>
        {user && <div className="bg-[#00D4AA]/10 px-4 py-1.5 rounded-full border border-[#00D4AA]/20"><span className="text-[#00D4AA] font-bold font-headline tracking-tight">R$ {user.balance.toFixed(2)}</span></div>}
      </nav>

      <main className="pt-16 pb-32 max-w-2xl mx-auto">
        {/* Live Stream — Worker frames (with YOLO boxes) or YouTube fallback */}
        {market.stream_url ? (
          <CameraFrameView
            marketId={market.id}
            streamUrl={market.stream_url}
            streamType={market.stream_type || "youtube"}
            count={liveCount.count}
            status={liveCount.status}
            history={liveCount.history}
            refreshMs={2000}
          />
        ) : market.banner_url ? (
          <div className="relative w-full h-48 sm:h-64 overflow-hidden">
            <img src={market.banner_url} alt={market.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1120] via-[#0b1120]/50 to-transparent" />
          </div>
        ) : null}

        {/* Market Header */}
        <section className={`mb-6 px-4 ${market.banner_url ? "-mt-16 relative z-10" : "mt-4"}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-sm" style={{ color: meta?.color }}>{meta?.icon}</span>
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: meta?.color }}>{meta?.label}</span>
            {market.subcategory && <span className="text-[10px] text-[#8B95A8]">/ {market.subcategory}</span>}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-headline leading-tight tracking-tighter mb-2">{market.title}</h1>
          {market.short_description && <p className="text-sm text-[#8B95A8] mb-3">{market.short_description}</p>}

          <div className="flex items-center gap-3 flex-wrap">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${isOpen ? "bg-[#00D4AA]/10 border-[#00D4AA]/30" : "bg-[#FF6B5A]/10 border-[#FF6B5A]/30"}`}>
              <div className={`w-2 h-2 rounded-full ${isOpen ? "bg-[#00D4AA] animate-pulse" : "bg-[#FF6B5A]"}`} />
              <span className={`text-xs font-bold uppercase ${isOpen ? "text-[#00D4AA]" : "text-[#FF6B5A]"}`}>{market.status}</span>
            </div>
            <span className="text-xs text-[#8B95A8] font-bold tabular-nums">{timeStr}</span>
            <span className="text-xs text-[#8B95A8]">Pool: R$ {market.pool_total.toFixed(0)}</span>
            <span className="text-xs text-[#8B95A8]">Fee: {(market.house_fee_percent * 100).toFixed(0)}%</span>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 gap-4 mb-6 px-4">
          <div className="bg-[#141d30] p-4 rounded-2xl border-l-4 border-[#00D4AA]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B95A8] block mb-1">Pool Total</span>
            <span className="text-xl font-black font-headline text-[#00D4AA]">R$ {market.pool_total.toFixed(0)}</span>
          </div>
          <div className="bg-[#141d30] p-4 rounded-2xl border-l-4 border-[#FFB800]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B95A8] block mb-1">Resolucao</span>
            <span className={`text-sm font-black font-headline ${market.resolution_type === "automatic" ? "text-[#00D4AA]" : market.resolution_type === "manual" ? "text-[#FF6B5A]" : "text-[#FFB800]"}`}>{market.resolution_type}</span>
            {market.source_config.source_name !== "manual" && <p className="text-[10px] text-[#8B95A8] mt-0.5">{market.source_config.source_name}</p>}
          </div>
        </section>

        {/* Outcomes */}
        <section className="space-y-3 mb-6 px-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#8B95A8]">Selecionar Resultado</h3>
          {market.outcomes.map((o) => {
            const isSelected = selectedOutcome === o.key;
            const prob = probabilities.find((p) => p.key === o.key);

            return (
              <button key={o.key} onClick={() => { if (!isOpen) return; setSelectedOutcome(isSelected ? null : o.key); setError(""); }} disabled={!isOpen}
                className={`w-full group bg-[#141d30] hover:bg-[#1a2540] active:scale-[0.98] transition-all p-1 rounded-2xl flex items-center justify-between border overflow-hidden ${isSelected ? "border-[#00D4AA]/60 shadow-[0_0_20px_rgba(0,212,170,0.15)]" : "border-white/5"} ${!isOpen ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-3 pl-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-black text-lg italic shrink-0" style={{ backgroundColor: o.color + "15", color: o.color }}>{o.key.slice(0, 2)}</div>
                  <div className="text-left min-w-0">
                    <span className="font-bold font-headline uppercase tracking-tight block text-sm sm:text-base truncate">{o.label}</span>
                    <span className="text-[10px] text-[#8B95A8]">{prob ? (prob.probability * 100).toFixed(1) : "0"}% | R$ {o.pool.toFixed(0)} apostado</span>
                  </div>
                </div>
                <div className="px-4 sm:px-6 py-4 sm:py-5 rounded-l-2xl shrink-0" style={{ backgroundColor: o.color + "10" }}>
                  <span className="block text-[10px] font-bold text-[#8B95A8] mb-0.5 text-right uppercase">Payout</span>
                  <span className="text-xl sm:text-2xl font-black font-headline" style={{ color: o.color }}>{o.payout_per_unit > 0 ? o.payout_per_unit.toFixed(2) + "x" : "—"}</span>
                </div>
              </button>
            );
          })}
          <p className="text-[10px] text-[#8B95A8] italic">* Payout estimado. Pode variar ate o fechamento do mercado.</p>
        </section>

        {/* Sentiment */}
        <section className="bg-[#0b1120] border border-white/5 rounded-2xl p-5 mb-6 mx-4">
          <h4 className="font-black font-headline text-sm uppercase mb-4">Sentimento do Mercado</h4>
          {market.outcomes.map((o) => {
            const pct = market.pool_total > 0 ? (o.pool / market.pool_total) * 100 : 0;
            return (
              <div key={o.key} className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold w-16 truncate" style={{ color: o.color }}>{o.label}</span>
                <div className="flex-1 h-3 bg-[#212e4a] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: o.color }} /></div>
                <span className="text-[10px] font-bold w-10 text-right" style={{ color: o.color }}>{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </section>

        {/* Rules - only for camera/traffic markets */}
        {market.stream_url && (
          <section className="bg-[#0b1120] border border-white/5 rounded-2xl p-5 mb-6 mx-4">
            <h4 className="font-black font-headline text-sm uppercase mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FFC700] text-lg">gavel</span>
              Regras do Mercado
            </h4>
            <div className="space-y-1 text-xs text-[#8B95A8] mb-4">
              <p>{market.subcategory && <span className="text-white font-bold">{market.subcategory}</span>}</p>
              <p>Este mercado roda recorrentemente a cada <span className="text-white font-bold">5 minutos</span> (horario de Brasilia).</p>
              <p>Este mercado funciona <span className="text-white font-bold">24 horas por dia, 7 dias por semana</span>.</p>
            </div>

            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Como funciona</h5>
            <ol className="space-y-1.5 text-xs text-[#8B95A8] mb-4 list-decimal list-inside">
              <li>Ao iniciar cada rodada, uma transmissao ao vivo da rodovia fica disponivel na tela com a contagem automatica.</li>
              <li>Voce pode fazer previsoes apenas nos primeiros <span className="text-white font-bold">2 minutos e 30 segundos</span> da rodada.</li>
              <li>Apos 2:30, o mercado entra em modo de observacao por mais 2:30 (sem novas previsoes).</li>
            </ol>

            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Como resolve</h5>
            <ol className="space-y-1.5 text-xs text-[#8B95A8] mb-4 list-decimal list-inside">
              <li>O sistema conta automaticamente os veiculos detectados durante a rodada usando <span className="text-[#00FFB8] font-bold">IA (Machine Learning)</span> com o modelo YOLO.</li>
              <li>A rodada termina quando completar 5 minutos.</li>
              <li>O resultado e definido pela contagem registrada ao fim da rodada.</li>
            </ol>

            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-2">O que e contado</h5>
            <div className="space-y-1 text-xs text-[#8B95A8] mb-4">
              <p><span className="text-[#00FFB8]">&#10003;</span> Veiculos validos: carro, caminhao, caminhonete, onibus e similares.</p>
              <p><span className="text-[#FF5252]">&#10007;</span> Motocicletas <span className="text-white font-bold">NAO</span> entram na contagem (sao ignoradas).</p>
            </div>

            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Importante sobre a contagem (IA)</h5>
            <div className="space-y-1 text-xs text-[#8B95A8] mb-4">
              <p>Este mercado <span className="text-white font-bold">NAO</span> mede exatamente quantos veiculos reais passaram na rodovia.</p>
              <p>Ele mede quantos veiculos a IA conseguiu <span className="text-white font-bold">detectar e contar</span> na transmissao.</p>
              <p>Por ser um sistema automatizado, podem ocorrer erros de deteccao/contagem (ex.: oclusao, chuva/noite, angulos, qualidade do video, trafego intenso, etc.).</p>
              <p>Ao participar, voce concorda que a contagem exibida pelo sistema e a referencia oficial da rodada.</p>
            </div>

            <div className="bg-[#FF5252]/10 border border-[#FF5252]/20 rounded-xl p-3">
              <p className="text-xs text-[#FF5252]"><span className="font-bold">Falhas e reembolso:</span> Se a transmissao ficar indisponivel, a contagem automatica falhar, ou ocorrer erro sistemico, a rodada e anulada e todos recebem reembolso.</p>
            </div>
          </section>
        )}

        {/* Bet Section */}
        {isOpen && selectedOutcome && selected && (
          <section className="animate-fade-in-up bg-[#141d30] rounded-2xl p-5 border border-white/5 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold font-headline uppercase">Apostar em: <span style={{ color: selected.color }}>{selected.label}</span></h3>
              {user && <span className="text-xs text-[#8B95A8]">Saldo: R$ {user.balance.toFixed(2)}</span>}
            </div>

            {!user ? (
              <div className="text-center py-4">
                <p className="text-sm text-[#8B95A8] mb-3">Faca login para apostar</p>
                <button onClick={() => router.push("/login")} className="px-6 py-2.5 rounded-2xl kinetic-gradient text-[#003D2E] font-black text-sm uppercase">Entrar</button>
              </div>
            ) : (
              <>
                <div className="flex gap-2 mb-3">
                  {[5, 10, 25, 50, 100].map((v) => (
                    <button key={v} onClick={() => { setBetAmount(String(v)); setError(""); }}
                      className={`flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 ${betAmount === String(v) ? "kinetic-gradient text-[#003D2E]" : "bg-[#212e4a] text-white hover:bg-[#283654]"}`}>R${v}</button>
                  ))}
                </div>
                <div className="relative mb-3">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B95A8] text-sm font-bold">R$</span>
                  <input type="number" value={betAmount} onChange={(e) => { setBetAmount(e.target.value); setError(""); }} placeholder="0.00" className="w-full bg-[#0b1120] rounded-2xl pl-10 pr-4 py-4 text-white text-lg font-bold outline-none focus:ring-2 focus:ring-[#00D4AA]/40 border border-white/5" />
                </div>
                {simulation && parseFloat(betAmount) > 0 && (
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-[#8B95A8]">Payout estimado: <span className="font-bold" style={{ color: selected.color }}>{simulation.estimatedPayout.toFixed(2)}x</span></span>
                    <span className="text-[#8B95A8]">Retorno: <span className="text-[#FFB800] font-black">R$ {simulation.estimatedReturn.toFixed(2)}</span></span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3 text-xs text-[#8B95A8]"><span className="material-symbols-outlined text-sm">timer</span><span>Encerra em: <span className="text-white font-bold tabular-nums">{timeStr}</span></span></div>
                {error && (
                  <div className="bg-[#FF6B5A]/10 border border-[#FF6B5A]/30 rounded-2xl p-3 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FF6B5A] text-sm">warning</span>
                    <p className="text-[#FF6B5A] text-sm flex-1">{error}</p>
                  </div>
                )}
                <button onClick={() => { setError(""); const amt = parseFloat(betAmount); if (!amt || amt <= 0) { setError("Valor invalido"); return; } if (user.balance < amt) { setError("Saldo insuficiente"); return; } setShowConfirm(true); }} disabled={!betAmount || parseFloat(betAmount) <= 0}
                  className="w-full bg-gradient-to-r from-[#00D4AA] via-[#00B894] to-[#FFB800] text-[#003D2E] font-black font-headline text-lg py-5 rounded-2xl shadow-[0_10px_40px_rgba(0,212,170,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-40 uppercase tracking-wider">
                  Apostar Agora <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                </button>
              </>
            )}
          </section>
        )}

        {betPlaced && <div className="fixed top-20 left-4 right-4 z-[60] kinetic-gradient text-[#003D2E] p-4 rounded-2xl font-black font-headline text-center animate-fade-in-up">Aposta realizada!</div>}

        {showConfirm && selected && user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="bg-[#141d30] rounded-2xl p-6 w-full max-w-sm border border-white/10 animate-fade-in-up">
              <h3 className="text-lg font-black font-headline mb-4 text-center uppercase">Confirmar Aposta</h3>
              <div className="space-y-2 text-sm mb-6">
                <div className="flex justify-between"><span className="text-[#8B95A8]">Mercado</span><span className="font-bold text-right max-w-[200px] truncate">{market.title}</span></div>
                <div className="flex justify-between"><span className="text-[#8B95A8]">Outcome</span><span className="font-bold" style={{ color: selected.color }}>{selected.label}</span></div>
                <div className="flex justify-between"><span className="text-[#8B95A8]">Valor</span><span className="font-bold">R$ {parseFloat(betAmount).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-[#8B95A8]">Payout est.</span><span className="font-bold">{simulation?.estimatedPayout.toFixed(2)}x</span></div>
                <div className="flex justify-between border-t border-white/5 pt-2"><span className="text-[#8B95A8]">Retorno est.</span><span className="font-black text-[#FFB800]">R$ {simulation?.estimatedReturn.toFixed(2)}</span></div>
              </div>
              <p className="text-[10px] text-[#8B95A8] italic mb-4">* Payout pode variar ate o fechamento.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 rounded-2xl bg-[#212e4a] text-[#8B95A8] font-bold">Cancelar</button>
                <button onClick={handleBet} className="flex-1 py-3 rounded-2xl kinetic-gradient text-[#003D2E] font-black uppercase">Confirmar</button>
              </div>
            </div>
          </div>
        )}
      </main>
      <BottomNav />

    </div>
  );
}
