"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { trackPurchase, trackInitiateCheckout } from "@/lib/pixel";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";

export default function DepositoPage() {
  const router = useRouter();
  const { user, addBalance, refreshUser } = useUser();
  const [step, setStep] = useState<"amount" | "qrcode" | "success">("amount");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; qrCodeImage: string; transactionId: string; externalId: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const confirmedRef = useRef(false);
  const balanceBeforeRef = useRef(0);
  const presetAmounts = [15, 25, 50, 100, 250, 500];

  const confirmPayment = useCallback(async () => {
    confirmedRef.current = true;
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    setPolling(false);

    // Refresh user from Supabase to get webhook-credited balance
    try { await refreshUser(); } catch { /* ignore */ }

    trackPurchase(parseFloat(amount));

    // Track affiliate commission if user was referred
    if (user?.id) {
      try {
        const { data: userData } = await (await import("@/lib/supabase")).supabase.from("users").select("referred_by").eq("id", user.id).single();
        if (userData?.referred_by) {
          await fetch("/api/affiliates/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "deposit", code: userData.referred_by, user_id: user.id, user_email: user.email, amount: parseFloat(amount) }),
          });
        }
      } catch { /* ignore */ }
    }

    setStep("success");
  }, [amount, refreshUser, user]);

  const checkPaymentStatus = useCallback(async () => {
    if (!pixData || confirmedRef.current) return;
    try {
      const params = new URLSearchParams();
      if (pixData.transactionId) params.set("txId", pixData.transactionId);
      if (pixData.externalId) params.set("extId", pixData.externalId);
      const res = await fetch(`/api/bspay?${params.toString()}`);
      const data = await res.json();

      if (data.status === "PAID") {
        await confirmPayment();
      } else {
        setPollCount((c) => c + 1);

        // Every 5 polls (~15s), also check if user balance changed
        // (webhook may have credited without updating pix_transaction)
        if ((pollCount + 1) % 5 === 0 && user) {
          try {
            await refreshUser();
          } catch { /* ignore */ }
        }
      }
    } catch { /* silent */ }
  }, [pixData, confirmPayment, pollCount, user, refreshUser]);

  useEffect(() => {
    if (step === "qrcode" && pixData && !confirmedRef.current) {
      setPolling(true); setPollCount(0);
      // Poll every 3 seconds
      pollingRef.current = setInterval(() => checkPaymentStatus(), 3000);
      const firstCheck = setTimeout(() => checkPaymentStatus(), 2000);
      return () => { if (pollingRef.current) clearInterval(pollingRef.current); clearTimeout(firstCheck); };
    }
  }, [step, pixData, checkPaymentStatus]);

  useEffect(() => { return () => { if (pollingRef.current) clearInterval(pollingRef.current); }; }, []);

  // Detect balance change while on qrcode step (webhook credited balance)
  useEffect(() => {
    if (step === "qrcode" && user && !confirmedRef.current) {
      if (balanceBeforeRef.current > 0 && user.balance > balanceBeforeRef.current) {
        // Balance increased! Payment was credited via webhook
        confirmPayment();
      }
    }
  }, [user?.balance, step, confirmPayment]);

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-dim text-on-surface flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">account_balance_wallet</span>
          <p className="mt-2 text-on-surface-variant mb-4">Faca login para depositar</p>
          <Link href="/login" className="px-6 py-3 rounded-2xl kinetic-gradient text-[#0a0a0a] font-black font-headline text-sm uppercase">Entrar</Link>
        </div>
      </div>
    );
  }

  const handleGeneratePix = async () => {
    if (!amount || parseFloat(amount) < 15) return;
    setLoading(true); setErrorMsg(""); confirmedRef.current = false;
    balanceBeforeRef.current = user.balance; // Save balance before deposit
    try {
      const res = await fetch("/api/bspay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: parseFloat(amount), name: user.name || "Usuario", document: user.cpf || "00000000000", email: user.email }) });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || "Erro ao gerar QR Code PIX"); setLoading(false); return; }
      setPixData({ qrCode: data.qrCode, qrCodeImage: data.qrCodeImage || "", transactionId: data.transactionId, externalId: data.externalId || "" });
      trackInitiateCheckout(parseFloat(amount));
      setStep("qrcode");
    } catch { setErrorMsg("Erro de conexao. Tente novamente."); } finally { setLoading(false); }
  };

  const handleCopyPix = async () => {
    if (!pixData?.qrCode) return;
    try { await navigator.clipboard.writeText(pixData.qrCode); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {
      const textarea = document.createElement("textarea"); textarea.value = pixData.qrCode; document.body.appendChild(textarea); textarea.select(); document.execCommand("copy"); document.body.removeChild(textarea); setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-surface-dim text-on-surface overflow-x-hidden w-full max-w-[100vw]">
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#0b1120]/80 backdrop-blur-xl bg-gradient-to-b from-[#0f1729] to-transparent shadow-2xl shadow-emerald-500/10 flex items-center px-4 h-16 overflow-hidden">
        <button onClick={() => router.back()} className="text-[#80FF00] mr-4"><span className="material-symbols-outlined">arrow_back</span></button>
        <h1 className="text-base font-bold font-headline uppercase tracking-tight flex-1">Depositar via PIX</h1>
        <span className="text-sm text-on-surface-variant">Saldo: <span className="text-[#80FF00] font-bold font-headline">R$ {user.balance.toFixed(2)}</span></span>
      </div>

      <div className="pt-24 p-4 max-w-md mx-auto pb-32">
        {errorMsg && (
          <div className="bg-error/10 border border-error/30 rounded-2xl p-3 mb-4 flex items-center gap-2 animate-fade-in-up">
            <span className="material-symbols-outlined text-error text-sm">warning</span>
            <p className="text-error text-sm flex-1">{errorMsg}</p>
          </div>
        )}

        {step === "amount" && (
          <div className="flex flex-col gap-4 animate-fade-in-up">
            <div className="bg-surface-container rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#80FF00]/20 flex items-center justify-center">
                  <span className="text-lg font-black text-[#80FF00] font-headline">{user.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{user.name}</p><p className="text-xs text-on-surface-variant truncate">{user.email}</p></div>
                <div className="text-right"><p className="text-xs text-on-surface-variant">CPF</p><p className="text-xs text-white font-mono">{user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4")}</p></div>
              </div>
            </div>

            <div className="bg-surface-container rounded-2xl p-5 border border-white/5">
              <h2 className="text-sm font-bold text-on-surface-variant mb-4 uppercase tracking-wider">Qual valor deseja depositar?</h2>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {presetAmounts.map((val) => (
                  <button key={val} onClick={() => setAmount(String(val))} className={`py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 ${amount === String(val) ? "kinetic-gradient text-[#0a0a0a] glow-green" : "bg-surface-container-highest text-on-surface hover:bg-surface-bright"}`}>R$ {val}</button>
                ))}
              </div>
              <div className="relative mb-4">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg font-bold">R$</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="1" className="w-full bg-surface-container-lowest rounded-2xl pl-12 pr-4 py-4 text-white text-2xl font-black outline-none focus:ring-2 focus:ring-[#80FF00]/40 border border-white/5" />
              </div>
              <p className="text-xs text-on-surface-variant mb-4">Valor minimo: R$ 15,00</p>
              <button onClick={handleGeneratePix} disabled={loading || !amount || parseFloat(amount) < 15} className="w-full py-4 rounded-2xl kinetic-gradient text-[#0a0a0a] font-black font-headline text-base disabled:opacity-40 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider glow-green">
                {loading ? (<><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Gerando PIX...</>) : (<><span className="material-symbols-outlined text-sm">pix</span>Gerar PIX</>)}
              </button>
            </div>
            <div className="bg-surface-container rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2"><span className="material-symbols-outlined text-[#80FF00] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span><span className="text-sm font-bold font-headline">Deposito Instantaneo</span></div>
              <p className="text-xs text-on-surface-variant">Pagamentos via PIX sao confirmados automaticamente em segundos.</p>
            </div>
          </div>
        )}

        {step === "qrcode" && pixData && (
          <div className="flex flex-col gap-4 animate-fade-in-up">
            <div className="bg-surface-container rounded-2xl p-5 border border-white/5 text-center">
              <div className="flex items-center justify-center gap-2 mb-2"><span className="material-symbols-outlined text-[#80FF00]">pix</span><h2 className="text-lg font-black font-headline uppercase">PIX Copia e Cola</h2></div>
              <p className="text-2xl font-black text-[#A0FF40] font-headline mb-4">R$ {parseFloat(amount).toFixed(2)}</p>
              <div className="bg-white rounded-2xl p-3 inline-block mb-4">
                {pixData.qrCodeImage ? <img src={pixData.qrCodeImage} alt="QR Code PIX" className="w-44 h-44 sm:w-52 sm:h-52" /> : <div className="w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center"><span className="material-symbols-outlined text-6xl text-gray-400">qr_code_2</span></div>}
              </div>
              <p className="text-xs text-on-surface-variant mb-3">Escaneie o QR Code ou copie o codigo abaixo</p>
              <div className="bg-surface-container-highest rounded-2xl p-3 mb-3 text-left"><p className="text-xs text-on-surface-variant mb-1">Codigo PIX</p><p className="text-xs text-white break-all font-mono leading-5 max-h-20 overflow-y-auto">{pixData.qrCode}</p></div>
              <button onClick={handleCopyPix} className={`w-full py-3 rounded-2xl font-bold text-base transition-all active:scale-95 ${copied ? "kinetic-gradient text-[#0a0a0a]" : "bg-surface-container-highest text-white border border-[#80FF00]/40"}`}>{copied ? "Copiado!" : "Copiar Codigo PIX"}</button>
            </div>
            <div className="bg-surface-container rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3">
                {polling && <svg className="animate-spin h-5 w-5 text-[#80FF00] shrink-0" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                <div className="flex-1"><p className="text-sm font-bold text-white">Aguardando pagamento...</p><p className="text-xs text-on-surface-variant mt-0.5">Verificacao automatica a cada 3s{pollCount > 0 && ` (${pollCount}x)`}</p></div>
                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#80FF00] animate-pulse-live" /><span className="text-[10px] text-[#80FF00] font-bold uppercase tracking-widest">Ativo</span></div>
              </div>
              <div className="mt-3 w-full h-1 bg-surface-container-highest rounded-full overflow-hidden"><div className="h-full bg-[#80FF00] rounded-full" style={{ animation: "poll-progress 3s linear infinite" }} /></div>
            </div>
            <button onClick={checkPaymentStatus} className="w-full py-3 rounded-2xl bg-surface-container-highest text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-surface-bright transition-colors active:scale-95"><span className="material-symbols-outlined text-sm">refresh</span>Verificar manualmente</button>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col gap-4 animate-fade-in-up text-center py-8">
            <div className="bg-surface-container rounded-2xl p-8 border border-white/5">
              <div className="w-16 h-16 rounded-full bg-[#80FF00]/20 flex items-center justify-center mx-auto mb-4"><span className="material-symbols-outlined text-[#80FF00] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span></div>
              <h2 className="text-xl font-black font-headline mb-2 uppercase">Deposito Confirmado!</h2>
              <p className="text-3xl font-black text-[#A0FF40] font-headline mb-2">R$ {parseFloat(amount).toFixed(2)}</p>
              <p className="text-sm text-on-surface-variant">Seu saldo foi atualizado.</p>
              <p className="text-sm text-white mt-2">Novo saldo: <span className="text-[#80FF00] font-black font-headline">R$ {user.balance.toFixed(2)}</span></p>
            </div>
            <button onClick={() => router.push("/")} className="w-full py-4 rounded-2xl kinetic-gradient text-[#0a0a0a] font-black font-headline text-base uppercase tracking-wider glow-green hover:scale-[1.02] active:scale-95 transition-all">Ir para Mercados</button>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
