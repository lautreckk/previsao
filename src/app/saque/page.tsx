"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, calcLevel, getLevelName } from "@/lib/UserContext";
import SidebarNav from "@/components/SidebarNav";
import MobileNavNew from "@/components/MobileNavNew";
import MarketTicker from "@/components/MarketTicker";
import Link from "next/link";

type PixKeyType = "cpf" | "email" | "phone" | "aleatoria";

const PIX_KEY_TYPES: { value: PixKeyType; label: string; icon: string; placeholder: string }[] = [
  { value: "cpf", label: "CPF", icon: "badge", placeholder: "000.000.000-00" },
  { value: "email", label: "E-mail", icon: "mail", placeholder: "seu@email.com" },
  { value: "phone", label: "Celular", icon: "phone_android", placeholder: "(00) 00000-0000" },
  { value: "aleatoria", label: "Chave Aleatoria", icon: "key", placeholder: "Cole sua chave aleatoria" },
];

// VIP tier benefits per level
const VIP_TIERS = [
  { level: 1, name: "Novato",   color: "#9CA3AF", icon: "person",         maxWithdraw: 200,   withdrawTime: "24h",  dailyBonus: 0,    depositBonus: 0,   saquesDia: 1 },
  { level: 2, name: "Aprendiz", color: "#60A5FA", icon: "school",         maxWithdraw: 500,   withdrawTime: "24h",  dailyBonus: 0,    depositBonus: 0,   saquesDia: 1 },
  { level: 3, name: "Regular",  color: "#34D399", icon: "verified",       maxWithdraw: 1000,  withdrawTime: "12h",  dailyBonus: 0.5,  depositBonus: 2,   saquesDia: 2 },
  { level: 4, name: "Ativo",    color: "#A78BFA", icon: "local_fire_department", maxWithdraw: 2000, withdrawTime: "12h", dailyBonus: 1, depositBonus: 3, saquesDia: 2 },
  { level: 5, name: "Expert",   color: "#F472B6", icon: "diamond",        maxWithdraw: 5000,  withdrawTime: "6h",   dailyBonus: 2,    depositBonus: 5,   saquesDia: 3 },
  { level: 6, name: "Mestre",   color: "#FB923C", icon: "workspace_premium", maxWithdraw: 10000, withdrawTime: "3h", dailyBonus: 5,   depositBonus: 7,   saquesDia: 5 },
  { level: 7, name: "Lenda",    color: "#F87171", icon: "military_tech",  maxWithdraw: 25000, withdrawTime: "1h",   dailyBonus: 10,   depositBonus: 10,  saquesDia: 10 },
  { level: 8, name: "Elite",    color: "#FBBF24", icon: "emoji_events",   maxWithdraw: 50000, withdrawTime: "Instantaneo", dailyBonus: 25, depositBonus: 15, saquesDia: 999 },
];

function getTier(level: number) {
  return VIP_TIERS[Math.min(level, 8) - 1] || VIP_TIERS[0];
}

export default function SaquePage() {
  const router = useRouter();
  const { user } = useUser();
  const [step, setStep] = useState<"form" | "confirm" | "submitted">("form");
  const [amount, setAmount] = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("cpf");
  const [pixKey, setPixKey] = useState("");
  const [holderName, setHolderName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAllTiers, setShowAllTiers] = useState(false);

  const userLevel = user ? calcLevel(user.total_predictions) : 1;
  const currentTier = getTier(userLevel);
  const nextTier = userLevel < 8 ? getTier(userLevel + 1) : null;

  const minWithdrawal = 20;
  const parsedAmount = parseFloat(amount) || 0;
  const canSubmit = parsedAmount >= minWithdrawal && parsedAmount <= Math.min(user?.balance || 0, currentTier.maxWithdraw) && pixKey.trim().length > 3 && holderName.trim().length > 2;

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-dim text-on-surface flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">account_balance_wallet</span>
          <p className="mt-2 text-on-surface-variant mb-4">Faca login para sacar</p>
          <Link href="/login" className="px-6 py-3 rounded-2xl kinetic-gradient text-[#0a0a0a] font-black font-headline text-sm uppercase">Entrar</Link>
        </div>
      </div>
    );
  }

  const handleConfirm = () => {
    setErrorMsg("");
    if (parsedAmount < minWithdrawal) { setErrorMsg(`Valor minimo: R$ ${minWithdrawal},00`); return; }
    if (parsedAmount > user.balance) { setErrorMsg("Saldo insuficiente"); return; }
    if (parsedAmount > currentTier.maxWithdraw) { setErrorMsg(`Limite do seu nivel: R$ ${currentTier.maxWithdraw.toLocaleString("pt-BR")}. Suba de nivel para sacar mais!`); return; }
    if (pixKey.trim().length < 4) { setErrorMsg("Informe uma chave PIX valida"); return; }
    if (holderName.trim().length < 3) { setErrorMsg("Informe o nome do titular"); return; }
    setStep("confirm");
  };

  const handleSubmit = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setStep("submitted");
  };

  const formatPixKey = (value: string) => {
    if (pixKeyType === "cpf") {
      const nums = value.replace(/\D/g, "").slice(0, 11);
      return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) => d ? `${a}.${b}.${c}-${d}` : nums.length > 6 ? `${a}.${b}.${c}` : nums.length > 3 ? `${a}.${b}` : a);
    }
    if (pixKeyType === "phone") {
      const nums = value.replace(/\D/g, "").slice(0, 11);
      if (nums.length <= 2) return nums.length > 0 ? `(${nums}` : "";
      if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
      return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
    }
    return value;
  };

  // Progress to next level
  const currentLevelMin = VIP_TIERS[userLevel - 1]?.level === userLevel ? [0, 10, 30, 50, 100, 200, 350, 500][userLevel - 1] : 0;
  const nextLevelMin = userLevel < 8 ? [0, 10, 30, 50, 100, 200, 350, 500][userLevel] : 500;
  const progress = userLevel >= 8 ? 100 : Math.min(100, ((user.total_predictions - currentLevelMin) / (nextLevelMin - currentLevelMin)) * 100);

  return (
    <div className="min-h-screen bg-[#0d1117] text-on-surface pb-20 lg:pb-0 overflow-x-hidden w-full max-w-[100vw]">
      {/* Ticker */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <MarketTicker />
      </div>

      {/* Header — full width */}
      <header className="fixed top-[32px] left-0 right-0 z-30 bg-[#0d1117]/95 backdrop-blur-xl border-b border-white/[0.04] h-14 flex items-center px-3 lg:px-5 gap-3">
        <button onClick={() => step === "confirm" ? setStep("form") : router.back()} className="lg:hidden text-white/70 p-1">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <Link href="/" className="shrink-0">
          <img src="/logo.png" alt="PALPITEX" className="h-7 w-auto" />
        </Link>
        <h2 className="text-sm font-headline font-bold text-white/60 ml-2 hidden lg:block">Sacar via PIX</h2>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/deposito" className="bg-[#80FF00] text-[#0a0a0a] px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-black flex items-center gap-1.5 hover:opacity-90 transition-all">
            <span className="material-symbols-outlined text-base">add</span>Depositar
          </Link>
          <Link href="/perfil" className="bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-lg text-sm font-bold text-[#80FF00]">R$ {user.balance.toFixed(2)}</Link>
        </div>
      </header>

      {/* Spacer */}
      <div className="h-[78px]" />

      <div className="flex">
        {/* Sidebar — desktop only */}
        <SidebarNav activeCategory="" onCategoryChange={() => {}} />

        <div className="flex-1 lg:ml-44 px-3 sm:px-4 lg:px-6 py-4 min-w-0 max-w-full overflow-x-hidden">
      <div className="max-w-md mx-auto lg:mx-0 lg:max-w-none">
        {errorMsg && (
          <div className="bg-error/10 border border-error/30 rounded-2xl p-3 mb-4 flex items-center gap-2 animate-fade-in-up">
            <span className="material-symbols-outlined text-error text-sm">warning</span>
            <p className="text-error text-sm flex-1">{errorMsg}</p>
          </div>
        )}

        {step === "form" && (
          <div className="flex flex-col lg:flex-row gap-4 animate-fade-in-up lg:items-start">

            {/* ─── LEFT COLUMN: VIP + User info ─── */}
            <div className="flex flex-col gap-4 lg:w-[380px] lg:shrink-0">

            {/* VIP Level Card */}
            <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: `linear-gradient(135deg, ${currentTier.color}15, ${currentTier.color}05)` }}>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${currentTier.color}25` }}>
                    <span className="material-symbols-outlined text-xl" style={{ color: currentTier.color, fontVariationSettings: "'FILL' 1" }}>{currentTier.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black font-headline" style={{ color: currentTier.color }}>Nivel {userLevel}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${currentTier.color}20`, color: currentTier.color }}>{currentTier.name}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant">{user.total_predictions} palpites realizados</p>
                  </div>
                </div>

                {/* Progress bar to next level */}
                {userLevel < 8 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-on-surface-variant mb-1">
                      <span>Nivel {userLevel}</span>
                      <span>{user.total_predictions}/{nextLevelMin} palpites</span>
                      <span>Nivel {userLevel + 1}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${currentTier.color}, ${nextTier?.color || currentTier.color})` }} />
                    </div>
                  </div>
                )}

                {/* Current benefits grid */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <span className="material-symbols-outlined text-sm mb-0.5 block" style={{ color: currentTier.color }}>speed</span>
                    <p className="text-[9px] text-on-surface-variant">Tempo de saque</p>
                    <p className="text-xs font-black font-headline" style={{ color: currentTier.color }}>{currentTier.withdrawTime}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <span className="material-symbols-outlined text-sm mb-0.5 block" style={{ color: currentTier.color }}>account_balance</span>
                    <p className="text-[9px] text-on-surface-variant">Limite por saque</p>
                    <p className="text-xs font-black font-headline" style={{ color: currentTier.color }}>R$ {currentTier.maxWithdraw.toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <span className="material-symbols-outlined text-sm mb-0.5 block" style={{ color: currentTier.color }}>redeem</span>
                    <p className="text-[9px] text-on-surface-variant">Bonus diario</p>
                    <p className="text-xs font-black font-headline" style={{ color: currentTier.color }}>{currentTier.dailyBonus > 0 ? `R$ ${currentTier.dailyBonus.toFixed(2)}` : "---"}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <span className="material-symbols-outlined text-sm mb-0.5 block" style={{ color: currentTier.color }}>trending_up</span>
                    <p className="text-[9px] text-on-surface-variant">Bonus deposito</p>
                    <p className="text-xs font-black font-headline" style={{ color: currentTier.color }}>{currentTier.depositBonus > 0 ? `+${currentTier.depositBonus}%` : "---"}</p>
                  </div>
                </div>

                {/* Next level teaser */}
                {nextTier && (
                  <div className="mt-2 bg-white/5 rounded-lg p-2.5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base" style={{ color: nextTier.color, fontVariationSettings: "'FILL' 1" }}>{nextTier.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold">Proximo: <span style={{ color: nextTier.color }}>{nextTier.name}</span></p>
                      <p className="text-[9px] text-on-surface-variant">Saque em {nextTier.withdrawTime} + limite R$ {nextTier.maxWithdraw.toLocaleString("pt-BR")}</p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant text-sm">arrow_forward</span>
                  </div>
                )}
              </div>
            </div>

            {/* User card */}
            <div className="bg-surface-container rounded-2xl p-3 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#80FF00]/20 flex items-center justify-center">
                  <span className="text-base font-black text-[#80FF00] font-headline">{user.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{user.name}</p><p className="text-xs text-on-surface-variant truncate">{user.email}</p></div>
                <div className="text-right">
                  <p className="text-[10px] text-on-surface-variant">Disponivel</p>
                  <p className="text-sm text-[#80FF00] font-black font-headline">R$ {user.balance.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Info — prazo */}
            <div className="bg-surface-container rounded-2xl p-3 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-amber-400 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
                <span className="text-xs font-bold font-headline">Prazo de Processamento</span>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Seu nivel <span className="font-bold" style={{ color: currentTier.color }}>{currentTier.name}</span> tem prazo de <span className="font-bold text-white">{currentTier.withdrawTime}</span>.
                {currentTier.withdrawTime !== "Instantaneo" && " Suba de nivel para saques mais rapidos!"}
              </p>
            </div>

            {/* All VIP Tiers Table */}
            <div className="bg-surface-container rounded-2xl border border-white/5 overflow-hidden">
              <button onClick={() => setShowAllTiers(!showAllTiers)} className="w-full p-3 flex items-center gap-2 hover:bg-white/5 transition-colors">
                <span className="material-symbols-outlined text-amber-400 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                <span className="text-xs font-bold font-headline flex-1 text-left">Programa VIP - Beneficios por Nivel</span>
                <span className={`material-symbols-outlined text-on-surface-variant text-sm transition-transform ${showAllTiers ? "rotate-180" : ""}`}>expand_more</span>
              </button>

              {showAllTiers && (
                <div className="px-4 pb-4 space-y-2">
                  <p className="text-[10px] text-on-surface-variant mb-3">Quanto mais voce joga, mais beneficios desbloqueia. Cada nivel traz vantagens exclusivas!</p>
                  {VIP_TIERS.map((tier) => {
                    const isCurrentLevel = tier.level === userLevel;
                    const isLocked = tier.level > userLevel;
                    return (
                      <div
                        key={tier.level}
                        className={`rounded-xl p-3 border transition-all ${isCurrentLevel ? "border-white/20 bg-white/5" : "border-transparent bg-white/[0.02]"} ${isLocked ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tier.color}20` }}>
                            <span className="material-symbols-outlined text-base" style={{ color: tier.color, fontVariationSettings: "'FILL' 1" }}>{tier.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black font-headline" style={{ color: tier.color }}>Nivel {tier.level} — {tier.name}</span>
                              {isCurrentLevel && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#80FF00]/20 text-[#80FF00]">VOCE</span>}
                              {isLocked && <span className="material-symbols-outlined text-xs text-on-surface-variant">lock</span>}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] pl-11">
                          <div className="flex justify-between"><span className="text-on-surface-variant">Tempo saque</span><span className="font-bold" style={{ color: tier.color }}>{tier.withdrawTime}</span></div>
                          <div className="flex justify-between"><span className="text-on-surface-variant">Limite saque</span><span className="font-bold">R$ {tier.maxWithdraw.toLocaleString("pt-BR")}</span></div>
                          <div className="flex justify-between"><span className="text-on-surface-variant">Bonus diario</span><span className="font-bold">{tier.dailyBonus > 0 ? `R$ ${tier.dailyBonus.toFixed(2)}` : "---"}</span></div>
                          <div className="flex justify-between"><span className="text-on-surface-variant">Bonus deposito</span><span className="font-bold">{tier.depositBonus > 0 ? `+${tier.depositBonus}%` : "---"}</span></div>
                          <div className="flex justify-between"><span className="text-on-surface-variant">Saques/dia</span><span className="font-bold">{tier.saquesDia >= 999 ? "Ilimitado" : tier.saquesDia}</span></div>
                        </div>
                      </div>
                    );
                  })}

                  {/* CTA to deposit */}
                  <div className="mt-3 bg-gradient-to-r from-[#80FF00]/10 to-[#80FF00]/5 rounded-xl p-4 border border-[#80FF00]/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-[#80FF00] text-base" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
                      <span className="text-sm font-black font-headline text-[#80FF00]">Suba de nivel mais rapido!</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mb-3">Deposite, faca palpites e desbloqueie beneficios incriveis. Quanto mais voce joga, mais rapido sobe de nivel e maiores sao seus bonus.</p>
                    <Link href="/deposito" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl kinetic-gradient text-[#0a0a0a] text-xs font-black font-headline uppercase hover:scale-105 active:scale-95 transition-all">
                      <span className="material-symbols-outlined text-sm">add</span>Depositar Agora
                    </Link>
                  </div>
                </div>
              )}
            </div>

            </div>{/* end left column */}

            {/* ─── RIGHT COLUMN: Withdrawal form ─── */}
            <div className="flex flex-col gap-4 lg:flex-1">

            {/* Amount */}
            <div className="bg-surface-container rounded-2xl p-4 border border-white/5">
              <h2 className="text-sm font-bold text-on-surface-variant mb-3 uppercase tracking-wider">Quanto deseja sacar?</h2>
              <div className="relative mb-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg font-bold">R$</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min={minWithdrawal} className="w-full bg-surface-container-lowest rounded-2xl pl-12 pr-4 py-3 text-white text-xl font-black outline-none focus:ring-2 focus:ring-[#80FF00]/40 border border-white/5" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-on-surface-variant">Min: R$ {minWithdrawal} | Max: R$ {currentTier.maxWithdraw.toLocaleString("pt-BR")}</p>
                <button onClick={() => setAmount(String(Math.min(user.balance, currentTier.maxWithdraw)))} className="text-xs text-[#80FF00] font-bold hover:underline">Sacar maximo</button>
              </div>
              {parsedAmount > user.balance && <p className="text-xs text-error mt-2">Saldo insuficiente</p>}
              {parsedAmount > currentTier.maxWithdraw && parsedAmount <= user.balance && (
                <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">lock</span>
                  Limite do nivel {currentTier.name}: R$ {currentTier.maxWithdraw.toLocaleString("pt-BR")}. Suba de nivel!
                </p>
              )}
            </div>

            {/* PIX key type */}
            <div className="bg-surface-container rounded-2xl p-4 border border-white/5">
              <h2 className="text-sm font-bold text-on-surface-variant mb-3 uppercase tracking-wider">Tipo de chave PIX</h2>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {PIX_KEY_TYPES.map((t) => (
                  <button key={t.value} onClick={() => { setPixKeyType(t.value); setPixKey(""); }} className={`py-2.5 px-3 rounded-2xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2 ${pixKeyType === t.value ? "kinetic-gradient text-[#0a0a0a] glow-green" : "bg-surface-container-highest text-on-surface hover:bg-surface-bright"}`}>
                    <span className="material-symbols-outlined text-base">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mb-3">
                <label className="text-xs text-on-surface-variant mb-1 block">Chave PIX</label>
                <input
                  type={pixKeyType === "email" ? "email" : "text"}
                  value={pixKey}
                  onChange={(e) => setPixKey(formatPixKey(e.target.value))}
                  placeholder={PIX_KEY_TYPES.find((t) => t.value === pixKeyType)?.placeholder}
                  className="w-full bg-surface-container-lowest rounded-2xl px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-[#80FF00]/40 border border-white/5"
                />
              </div>

              <div>
                <label className="text-xs text-on-surface-variant mb-1 block">Nome do titular</label>
                <input
                  type="text"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder="Nome completo do titular da conta"
                  className="w-full bg-surface-container-lowest rounded-2xl px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-[#80FF00]/40 border border-white/5"
                />
              </div>
            </div>

            {/* Submit */}
            <button onClick={handleConfirm} disabled={!canSubmit} className="w-full py-3.5 rounded-2xl kinetic-gradient text-[#0a0a0a] font-black font-headline text-base disabled:opacity-40 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider glow-green">
              <span className="material-symbols-outlined text-sm">pix</span>
              Solicitar Saque
            </button>

            </div>{/* end right column */}
          </div>
        )}

        {step === "confirm" && (
          <div className="flex flex-col gap-4 animate-fade-in-up">
            <div className="bg-surface-container rounded-2xl p-5 border border-white/5 text-center">
              <span className="material-symbols-outlined text-amber-400 text-4xl mb-3 block">receipt_long</span>
              <h2 className="text-lg font-black font-headline uppercase mb-1">Confirmar Saque</h2>
              <p className="text-xs text-on-surface-variant mb-4">Revise os dados antes de confirmar</p>

              <div className="bg-surface-container-highest rounded-2xl p-4 text-left space-y-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Valor</span>
                  <span className="text-lg font-black text-[#A0FF40] font-headline">R$ {parsedAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-white/5" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Tipo de chave</span>
                  <span className="text-sm font-bold">{PIX_KEY_TYPES.find((t) => t.value === pixKeyType)?.label}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Chave PIX</span>
                  <span className="text-sm font-mono">{pixKey}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Titular</span>
                  <span className="text-sm font-bold">{holderName}</span>
                </div>
                <div className="border-t border-white/5" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Nivel VIP</span>
                  <span className="text-sm font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm" style={{ color: currentTier.color, fontVariationSettings: "'FILL' 1" }}>{currentTier.icon}</span>
                    <span style={{ color: currentTier.color }}>{currentTier.name}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Prazo estimado</span>
                  <span className="text-sm font-bold" style={{ color: currentTier.color }}>{currentTier.withdrawTime}</span>
                </div>
                <div className="border-t border-white/5" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Saldo apos saque</span>
                  <span className="text-sm font-bold text-white">R$ {(user.balance - parsedAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={loading} className="w-full py-4 rounded-2xl kinetic-gradient text-[#0a0a0a] font-black font-headline text-base disabled:opacity-40 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider glow-green">
              {loading ? (
                <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Enviando...</>
              ) : (
                <><span className="material-symbols-outlined text-sm">check_circle</span>Confirmar Saque</>
              )}
            </button>

            <button onClick={() => setStep("form")} className="w-full py-3 rounded-2xl bg-surface-container-highest text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-surface-bright transition-colors active:scale-95">
              <span className="material-symbols-outlined text-sm">edit</span>Alterar dados
            </button>
          </div>
        )}

        {step === "submitted" && (
          <div className="flex flex-col gap-4 animate-fade-in-up text-center py-8">
            <div className="bg-surface-container rounded-2xl p-8 border border-white/5">
              <div className="w-16 h-16 rounded-full bg-amber-400/20 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-amber-400 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>hourglass_top</span>
              </div>
              <h2 className="text-xl font-black font-headline mb-2 uppercase">Saque em Analise</h2>
              <p className="text-3xl font-black text-[#A0FF40] font-headline mb-2">R$ {parsedAmount.toFixed(2)}</p>
              <p className="text-sm text-on-surface-variant mb-4">Sua solicitacao foi enviada com sucesso e esta sendo analisada pela nossa equipe.</p>

              <div className="bg-surface-container-highest rounded-2xl p-4 text-left space-y-2 mb-4">
                <div className="flex justify-between"><span className="text-xs text-on-surface-variant">Status</span><span className="text-xs font-bold text-amber-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />Em analise</span></div>
                <div className="flex justify-between"><span className="text-xs text-on-surface-variant">Chave PIX</span><span className="text-xs font-mono">{pixKey}</span></div>
                <div className="flex justify-between"><span className="text-xs text-on-surface-variant">Titular</span><span className="text-xs font-bold">{holderName}</span></div>
                <div className="flex justify-between"><span className="text-xs text-on-surface-variant">Prazo estimado</span><span className="text-xs font-bold" style={{ color: currentTier.color }}>{currentTier.withdrawTime} ({currentTier.name})</span></div>
              </div>

              <p className="text-xs text-on-surface-variant">Voce sera notificado quando o pagamento for processado.</p>
            </div>

            {/* Upsell after withdrawal */}
            {userLevel < 8 && nextTier && (
              <div className="bg-gradient-to-r from-[#80FF00]/10 to-[#80FF00]/5 rounded-2xl p-5 border border-[#80FF00]/20 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[#80FF00]" style={{ fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
                  <span className="text-sm font-black font-headline">Sabia que voce pode sacar mais rapido?</span>
                </div>
                <p className="text-xs text-on-surface-variant mb-3">
                  No nivel <span className="font-bold" style={{ color: nextTier.color }}>{nextTier.name}</span> seus saques sao processados em <span className="font-bold text-white">{nextTier.withdrawTime}</span> com limite de <span className="font-bold text-white">R$ {nextTier.maxWithdraw.toLocaleString("pt-BR")}</span>.
                  {nextTier.depositBonus > 0 && <> Alem de <span className="font-bold text-[#80FF00]">+{nextTier.depositBonus}%</span> de bonus em cada deposito!</>}
                </p>
                <Link href="/deposito" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl kinetic-gradient text-[#0a0a0a] text-xs font-black font-headline uppercase hover:scale-105 active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-sm">add</span>Depositar e Subir de Nivel
                </Link>
              </div>
            )}

            <button onClick={() => router.push("/")} className="w-full py-4 rounded-2xl kinetic-gradient text-[#0a0a0a] font-black font-headline text-base uppercase tracking-wider glow-green hover:scale-[1.02] active:scale-95 transition-all">Voltar para Mercados</button>
            <button onClick={() => router.push("/perfil")} className="w-full py-3 rounded-2xl bg-surface-container-highest text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-surface-bright transition-colors active:scale-95">
              <span className="material-symbols-outlined text-sm">person</span>Ir para Perfil
            </button>
          </div>
        )}
      </div>
      </div>
      </div>

      <MobileNavNew onChatOpen={() => {}} />
    </div>
  );
}
