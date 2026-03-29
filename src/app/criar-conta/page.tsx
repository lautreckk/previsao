"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { trackLead } from "@/lib/pixel";

export default function CriarContaPage() {
  const router = useRouter();
  const { register } = useUser();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleStep1 = () => {
    setError("");
    if (!name.trim() || name.trim().length < 3) { setError("Digite seu nome completo"); return; }
    if (!email.includes("@") || !email.includes(".")) { setError("Digite um e-mail valido"); return; }
    if (!phone || phone.replace(/\D/g, "").length < 10) { setError("Digite um telefone valido"); return; }
    if (cpf.replace(/\D/g, "").length !== 11) { setError("Digite um CPF valido"); return; }
    setStep(2);
  };

  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError("");
    if (password.length < 6) { setError("A senha deve ter no minimo 6 caracteres"); return; }
    if (password !== confirmPassword) { setError("As senhas nao coincidem"); return; }
    setLoading(true);
    const success = await register(name.trim(), email.trim().toLowerCase(), cpf.replace(/\D/g, ""), password, phone.replace(/\D/g, ""));
    setLoading(false);
    if (!success) { setError("Ja existe uma conta com esse e-mail"); return; }
    trackLead({ email: email.trim().toLowerCase(), name: name.trim() });
    router.push("/");
  };

  const inputClass = "w-full bg-surface-container-lowest rounded-2xl px-4 py-3.5 text-white text-sm outline-none focus:ring-2 focus:ring-[#00D4AA]/40 border border-white/5";

  return (
    <div className="min-h-screen bg-surface-dim text-on-surface flex flex-col overflow-x-hidden w-full max-w-[100vw]">
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#0b1120]/80 backdrop-blur-xl bg-gradient-to-b from-[#0f1729] to-transparent shadow-2xl shadow-emerald-500/10 flex items-center px-4 h-16 overflow-hidden">
        <button onClick={() => (step === 2 ? setStep(1) : router.back())} className="text-[#00D4AA] mr-4"><span className="material-symbols-outlined">arrow_back</span></button>
        <h1 className="text-base font-bold font-headline uppercase tracking-tight flex-1">Criar Conta</h1>
        <div className="flex gap-1">
          <div className={`w-8 h-1 rounded-full ${step >= 1 ? "bg-[#00D4AA]" : "bg-surface-container-highest"}`} />
          <div className={`w-8 h-1 rounded-full ${step >= 2 ? "bg-[#00D4AA]" : "bg-surface-container-highest"}`} />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 pt-24">
        <div className="w-full max-w-sm">
          {step === 1 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-6">
                <img src="/logo.png" alt="Winify" className="h-32 w-auto mx-auto mb-4" />
                <h2 className="text-xl font-black font-headline uppercase tracking-tight">Seus dados</h2>
                <p className="text-sm text-on-surface-variant mt-1">Etapa 1 de 2</p>
              </div>
              <div className="flex flex-col gap-3">
                <div><label className="text-xs text-on-surface-variant mb-1 block uppercase tracking-wider font-bold">Nome completo</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" className={inputClass} /></div>
                <div><label className="text-xs text-on-surface-variant mb-1 block uppercase tracking-wider font-bold">E-mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputClass} /></div>
                <div><label className="text-xs text-on-surface-variant mb-1 block uppercase tracking-wider font-bold">Telefone</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" maxLength={15} className={inputClass} /></div>
                <div><label className="text-xs text-on-surface-variant mb-1 block uppercase tracking-wider font-bold">CPF</label><input type="text" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} className={inputClass} /></div>
              </div>
              {error && <p className="text-error text-sm mt-3 text-center font-bold">{error}</p>}
              <button onClick={handleStep1} className="w-full py-4 rounded-2xl kinetic-gradient text-[#003D2E] font-black font-headline text-base mt-4 uppercase tracking-wider glow-green hover:scale-[1.02] active:scale-95 transition-all">Continuar</button>
              <p className="text-center text-sm text-on-surface-variant mt-4">Ja tem conta? <Link href="/login" className="text-[#00D4AA] font-bold">Entrar</Link></p>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full kinetic-gradient flex items-center justify-center mx-auto mb-4 glow-green"><span className="material-symbols-outlined text-[#003D2E] text-3xl">lock</span></div>
                <h2 className="text-xl font-black font-headline uppercase tracking-tight">Criar senha</h2>
                <p className="text-sm text-on-surface-variant mt-1">Etapa 2 de 2</p>
              </div>
              <div className="flex flex-col gap-3">
                <div><label className="text-xs text-on-surface-variant mb-1 block uppercase tracking-wider font-bold">Senha</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 6 caracteres" className={inputClass} /></div>
                <div><label className="text-xs text-on-surface-variant mb-1 block uppercase tracking-wider font-bold">Confirmar senha</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a senha" className={inputClass} /></div>
              </div>
              {error && <p className="text-error text-sm mt-3 text-center font-bold">{error}</p>}
              <button onClick={handleRegister} className="w-full py-4 rounded-2xl kinetic-gradient text-[#003D2E] font-black font-headline text-base mt-4 uppercase tracking-wider glow-green hover:scale-[1.02] active:scale-95 transition-all">Criar Conta</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
