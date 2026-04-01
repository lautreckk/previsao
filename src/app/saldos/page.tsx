"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import BottomNav from "@/components/BottomNav";

export default function SaldosPage() {
  const router = useRouter();
  const { user, bets } = useUser();
  const [activeTab, setActiveTab] = useState<"ativas" | "resolvidas" | "canceladas">("ativas");

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-dim text-on-surface flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">confirmation_number</span>
          <p className="mt-2 text-on-surface-variant mb-4">Faca login para ver seus saldos</p>
          <Link href="/login" className="px-6 py-3 rounded-2xl kinetic-gradient text-[#1A0E00] font-black font-headline text-sm uppercase">Entrar</Link>
        </div>
      </div>
    );
  }

  const activeBets = bets.filter((b) => b.status === "pending");
  const resolvedBets = bets.filter((b) => b.status === "won" || b.status === "lost");
  const displayedBets = activeTab === "ativas" ? activeBets : activeTab === "resolvidas" ? resolvedBets : [];

  return (
    <div className="min-h-screen bg-surface-dim text-on-surface pb-32 overflow-x-hidden w-full max-w-[100vw]">
      <header className="bg-[#0b1120]/80 backdrop-blur-xl fixed top-0 left-0 right-0 z-50 shadow-2xl shadow-emerald-500/10 overflow-hidden">
        <div className="flex justify-between items-center px-4 h-16">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()}><span className="material-symbols-outlined text-[#F5A623]">arrow_back</span></button>
            <Link href="/"><img src="/logo.png" alt="Winify" className="h-16 w-auto" /></Link>
          </div>
          <div className="bg-surface-container-highest px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Saldo</span>
            <span className="font-headline font-bold text-[#F5A623]">R$ {user.balance.toFixed(2)}</span>
          </div>
        </div>
      </header>

      <main className="pt-24 px-4 space-y-8 max-w-md mx-auto">
        <section className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {(["ativas", "resolvidas", "canceladas"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-full font-headline font-bold text-sm whitespace-nowrap transition-all ${
                activeTab === tab
                  ? "bg-[#F5A623]/10 text-[#F5A623] shadow-[0_0_15px_rgba(245,166,35,0.2)]"
                  : "text-on-surface-variant"
              }`}
            >
              {tab === "ativas" ? `ATIVAS (${activeBets.length})` : tab === "resolvidas" ? "RESOLVIDAS" : "CANCELADAS"}
            </button>
          ))}
        </section>

        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <h2 className="font-headline font-extrabold text-2xl tracking-tight">
              {activeTab === "ativas" ? "Apostas Ativas" : activeTab === "resolvidas" ? "Resolvidas" : "Canceladas"}
            </h2>
            {activeTab === "ativas" && activeBets.length > 0 && (
              <span className="text-[10px] font-bold text-[#F5A623] uppercase tracking-[0.2em]">Live Tracking</span>
            )}
          </div>

          {displayedBets.length === 0 ? (
            <div className="bg-surface-container rounded-2xl p-8 text-center">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2 block">receipt_long</span>
              <p className="text-sm text-on-surface-variant">{activeTab === "ativas" ? "Nenhuma aposta ativa" : "Nenhuma aposta encontrada"}</p>
              <Link href="/" className="text-[#F5A623] text-sm font-bold font-headline mt-2 inline-block">Explorar mercados</Link>
            </div>
          ) : (
            displayedBets.map((bet) => (
              <div key={bet.id} className={`bg-surface-container rounded-2xl overflow-hidden relative ${bet.status === "pending" ? "border-l-4 border-[#F5A623]" : ""}`}>
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 min-w-0 flex-1 mr-3">
                      {bet.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <span className="flex h-2 w-2 rounded-full bg-[#F5A623] animate-pulse" />
                          <p className="text-[10px] font-black text-[#F5A623] uppercase tracking-widest">Pendente</p>
                        </div>
                      )}
                      <h3 className="font-headline font-bold text-lg leading-tight truncate">{bet.marketTitle}</h3>
                    </div>
                    <div className="bg-surface-container-highest p-3 rounded-2xl text-center min-w-[70px] shrink-0">
                      <p className="text-[9px] text-on-surface-variant font-bold uppercase mb-1">Odds</p>
                      <p className="font-headline font-black text-[#FFB800] text-lg">{bet.odds.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/5">
                    <div><p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Palpite</p><p className="font-bold text-on-surface">{bet.optionName}</p></div>
                    <div className="text-right"><p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Valor Apostado</p><p className="font-bold text-on-surface">R$ {bet.amount.toFixed(2)}</p></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${bet.status === "won" ? "text-[#F5A623]" : bet.status === "lost" ? "text-error" : "text-[#F5A623]"}`}>
                        {bet.status === "pending" ? "Retorno Potencial" : bet.status === "won" ? "Ganho" : "Perdido"}
                      </p>
                      <p className={`font-headline font-black text-3xl tracking-tighter ${bet.status === "won" ? "text-[#F5A623]" : bet.status === "lost" ? "text-error" : "text-[#F5A623]"}`}>
                        R$ {bet.potentialWin.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
