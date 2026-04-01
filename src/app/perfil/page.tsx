"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import BottomNav from "@/components/BottomNav";

export default function PerfilPage() {
  const router = useRouter();
  const { user, bets, logout } = useUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-dim text-on-surface flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">person</span>
          <p className="mt-2 text-on-surface-variant mb-4">Faca login para ver seu perfil</p>
          <Link href="/login" className="px-6 py-3 rounded-2xl kinetic-gradient text-[#1A0E00] font-black font-headline text-sm uppercase">
            Entrar
          </Link>
        </div>
      </div>
    );
  }

  const activeBets = bets.filter((b) => b.status === "pending");

  return (
    <div className="min-h-screen bg-surface-dim text-on-surface pb-32 overflow-x-hidden w-full max-w-[100vw]">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0b1120]/80 backdrop-blur-xl bg-gradient-to-b from-[#0f1729] to-transparent shadow-2xl shadow-emerald-500/10 flex justify-between items-center px-4 h-16 overflow-hidden">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="lg:hidden text-[#F5A623] p-1"><span className="material-symbols-outlined">arrow_back</span></button>
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Winify" className="h-16 w-auto" />
          </Link>
        </div>
        <div className="bg-surface-container-highest px-4 py-1.5 rounded-full border border-white/5 flex items-center gap-2">
          <span className="text-[#F5A623] font-bold font-headline tracking-tight text-sm">R$ {user.balance.toFixed(2)}</span>
          <span className="material-symbols-outlined text-[#F5A623] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
        </div>
      </header>

      <main className="pt-24 pb-8 px-4 space-y-8 max-w-md mx-auto">
        <section className="relative flex flex-col items-center">
          <div className="relative">
            <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-[#F5A623] via-[#FFB800] to-[#F5A623] animate-pulse shadow-[0_0_30px_rgba(245,166,35,0.3)]">
              <div className="w-full h-full rounded-full bg-surface-dim flex items-center justify-center border-4 border-surface-dim">
                <span className="text-5xl font-black text-[#F5A623] font-headline">{user.name.charAt(0).toUpperCase()}</span>
              </div>
            </div>
          </div>
          <div className="text-center mt-6">
            <h1 className="font-headline font-extrabold text-2xl tracking-tight text-on-surface">{user.name}</h1>
            <p className="text-on-surface-variant text-sm font-medium">{user.email}</p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div className="col-span-2 bg-surface-container rounded-2xl p-6 border-l-4 border-[#F5A623] shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-[0.2em]">Saldo Disponivel</p>
                <h2 className="text-4xl font-headline font-black text-on-surface mt-1 italic">R$ {user.balance.toFixed(2)}</h2>
              </div>
              <span className="material-symbols-outlined text-[#F5A623] text-3xl">payments</span>
            </div>
            <div className="flex gap-3">
              <Link href="/deposito" className="flex-1 bg-gradient-to-r from-[#F5A623] to-[#C4841A] text-[#1A0E00] font-headline font-extrabold py-3 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all glow-green text-center">DEPOSITAR</Link>
              <button className="flex-1 bg-surface-container-highest text-on-surface font-headline font-extrabold py-3 rounded-2xl hover:bg-surface-bright active:scale-95 transition-all">SACAR</button>
            </div>
          </div>
          <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1">
            <span className="text-[#F5A623] font-headline font-black text-xl italic leading-none">{activeBets.length}</span>
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Apostas Ativas</p>
          </div>
          <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-1">
            <span className="text-[#FFB800] font-headline font-black text-xl italic leading-none">--</span>
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Lucro Semanal</p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-headline font-bold text-lg tracking-tight">Ultimas Atividades</h3>
            <Link href="/saldos" className="text-[#FFB800] text-[10px] font-black uppercase tracking-widest">Ver Tudo</Link>
          </div>
          <div className="space-y-3">
            {bets.length === 0 ? (
              <div className="bg-surface-container rounded-2xl p-6 text-center">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2 block">receipt_long</span>
                <p className="text-sm text-on-surface-variant">Nenhuma atividade recente</p>
                <Link href="/" className="text-[#F5A623] text-sm font-bold mt-2 inline-block">Explorar mercados</Link>
              </div>
            ) : (
              bets.slice(-3).reverse().map((bet) => (
                <div key={bet.id} className={`bg-surface-container rounded-2xl p-4 flex items-center justify-between border-l-4 ${bet.status === "won" ? "border-[#F5A623]" : bet.status === "lost" ? "border-error" : "border-[#5B9DFF]"} shadow-sm`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${bet.status === "won" ? "bg-[#F5A623]/10" : bet.status === "lost" ? "bg-error/10" : "bg-[#5B9DFF]/10"}`}>
                      <span className={`material-symbols-outlined ${bet.status === "won" ? "text-[#F5A623]" : bet.status === "lost" ? "text-error" : "text-[#5B9DFF]"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {bet.status === "won" ? "check_circle" : bet.status === "lost" ? "cancel" : "pending"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-headline font-bold text-sm truncate">{bet.marketTitle}</p>
                      <p className="text-[10px] text-on-surface-variant font-medium">{bet.optionName} - {bet.odds}x</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className={`font-headline font-black text-sm italic ${bet.status === "won" ? "text-[#F5A623]" : bet.status === "lost" ? "text-error" : "text-on-surface"}`}>R$ {bet.amount.toFixed(2)}</p>
                    <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-tighter">{bet.status === "pending" ? "Pendente" : bet.status === "won" ? "Ganho" : "Perdido"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-headline font-bold text-lg tracking-tight px-1">Configuracoes</h3>
          <div className="bg-surface-container rounded-2xl divide-y divide-white/5 overflow-hidden">
            {[
              { icon: "person", label: "Alterar Foto do Perfil" },
              { icon: "verified_user", label: "Seguranca e Senha" },
              { icon: "notifications_active", label: "Preferencias de Alerta" },
            ].map((item) => (
              <button key={item.label} className="w-full flex items-center justify-between p-4 hover:bg-surface-container-high transition-colors group">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-[#F5A623] transition-colors">{item.icon}</span>
                  <span className="font-headline font-semibold text-sm">{item.label}</span>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-sm">chevron_right</span>
              </button>
            ))}
            <button onClick={() => { logout(); router.push("/"); }} className="w-full flex items-center justify-between p-4 hover:bg-surface-container-high transition-colors group">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-error/70 group-hover:text-error transition-colors">logout</span>
                <span className="font-headline font-semibold text-sm text-error/80">Sair da Conta</span>
              </div>
            </button>
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
