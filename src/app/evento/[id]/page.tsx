"use client";

import { useParams, useRouter } from "next/navigation";
import { markets } from "@/lib/markets";
import BottomNav from "@/components/BottomNav";
import { useState } from "react";

export default function EventoPage() {
  const params = useParams();
  const router = useRouter();
  const market = markets.find((m) => m.id === params.id);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [betPlaced, setBetPlaced] = useState(false);

  if (!market) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white">
        <div className="text-center">
          <span className="material-icons-outlined text-5xl text-[#9CA3AF]">error_outline</span>
          <p className="mt-2 text-[#9CA3AF]">Mercado não encontrado</p>
          <button onClick={() => router.push("/")} className="mt-4 text-[#00C853] font-semibold">
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  const selected = market.options.find((o) => o.id === selectedOption);

  const handleBet = () => {
    if (!selected || !betAmount) return;
    setBetPlaced(true);
    setShowConfirm(false);
    setTimeout(() => setBetPlaced(false), 3000);
  };

  const potentialWin = selected ? (parseFloat(betAmount || "0") * selected.odds).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#121212]/90 backdrop-blur-md border-b border-[#2A2A2A] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white">
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-semibold truncate flex-1">{market.title}</h1>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] bg-[#2A2A2A] px-2 py-0.5 rounded-sm">
          {market.category}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Market info */}
        <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2A2A2A]">
          <div className="flex items-center gap-3 mb-4">
            {market.image ? (
              <img src={market.image} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-green-900 flex items-center justify-center">
                <span className="material-icons-outlined text-white">{market.categoryIcon}</span>
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold">{market.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                {market.status === "live" && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse-live" />
                    <span className="text-xs font-semibold text-yellow-500">AO VIVO</span>
                  </div>
                )}
                {market.timeLeft && (
                  <span className="text-xs text-[#9CA3AF]">
                    <span className="material-icons-outlined text-xs align-middle">schedule</span> {market.timeLeft}
                  </span>
                )}
                <span className="text-xs text-[#9CA3AF]">
                  Vol: R$ {(market.volume / 1000).toFixed(1)}k
                </span>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-3">
            {market.options.map((option) => {
              const isSelected = selectedOption === option.id;
              const barColor = option.color === "red" ? "rgba(255,59,48,0.2)" : "rgba(0,200,83,0.2)";
              const textColor = option.color === "red" ? "#FF3B30" : "#00C853";

              return (
                <button
                  key={option.id}
                  onClick={() => setSelectedOption(isSelected ? null : option.id)}
                  className={`relative w-full bg-[#2A2A2A] rounded-lg h-12 flex items-center px-3 justify-between overflow-hidden transition-all ${
                    isSelected ? "ring-2 ring-[#00C853]" : ""
                  }`}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 transition-all"
                    style={{ width: `${option.probability}%`, backgroundColor: barColor }}
                  />
                  <div className="flex items-center gap-2 z-10">
                    <span className="text-sm font-medium text-gray-200">
                      {option.name}
                      <span className="text-xs text-[#9CA3AF] ml-2">{option.odds}x</span>
                    </span>
                  </div>
                  <span
                    className="text-sm font-bold z-10 px-2 py-0.5 rounded-md border"
                    style={{
                      color: textColor,
                      borderColor: `${textColor}30`,
                      backgroundColor: `${textColor}10`,
                    }}
                  >
                    {option.probability}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bet Section */}
        {selectedOption && selected && (
          <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2A2A2A] animate-fade-in-up">
            <h3 className="text-sm font-semibold mb-3">
              Apostar em: <span className="text-[#00C853]">{selected.name}</span>
            </h3>

            <div className="flex gap-2 mb-3">
              {[5, 10, 25, 50, 100].map((val) => (
                <button
                  key={val}
                  onClick={() => setBetAmount(String(val))}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    betAmount === String(val)
                      ? "bg-[#00C853] text-white"
                      : "bg-[#2A2A2A] text-gray-300"
                  }`}
                >
                  R${val}
                </button>
              ))}
            </div>

            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm font-semibold">
                R$
              </span>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#2A2A2A] rounded-lg pl-9 pr-4 py-3 text-white text-lg font-semibold outline-none focus:ring-2 focus:ring-[#00C853] border-none"
              />
            </div>

            <div className="flex justify-between text-sm mb-4 text-[#9CA3AF]">
              <span>Odds: {selected.odds}x</span>
              <span>
                Retorno potencial:{" "}
                <span className="text-[#00C853] font-semibold">R$ {potentialWin}</span>
              </span>
            </div>

            <button
              onClick={() => {
                if (parseFloat(betAmount) > 0) setShowConfirm(true);
              }}
              disabled={!betAmount || parseFloat(betAmount) <= 0}
              className="w-full py-3 rounded-xl bg-[#00C853] text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              Confirmar Aposta
            </button>
          </div>
        )}

        {/* Success toast */}
        {betPlaced && (
          <div className="fixed top-4 left-4 right-4 z-50 bg-[#00C853] text-white p-4 rounded-xl font-semibold text-center animate-fade-in-up">
            Aposta realizada com sucesso!
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {showConfirm && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#1E1E1E] rounded-2xl p-6 w-full max-w-sm border border-[#2A2A2A]">
            <h3 className="text-lg font-bold mb-4 text-center">Confirmar Aposta</h3>
            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Mercado</span>
                <span className="font-medium text-right max-w-[200px] truncate">{market.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Opção</span>
                <span className="font-medium text-[#00C853]">{selected.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Valor</span>
                <span className="font-medium">R$ {parseFloat(betAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Odds</span>
                <span className="font-medium">{selected.odds}x</span>
              </div>
              <div className="flex justify-between border-t border-[#2A2A2A] pt-2 mt-2">
                <span className="text-[#9CA3AF]">Retorno potencial</span>
                <span className="font-bold text-[#00C853]">R$ {potentialWin}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-[#2A2A2A] text-[#9CA3AF] font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleBet}
                className="flex-1 py-3 rounded-xl bg-[#00C853] text-white font-semibold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
