"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { trackLead, trackPageView } from "@/lib/pixel";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "login" | "register";
}

export default function AuthModal({ isOpen, onClose, initialTab = "login" }: AuthModalProps) {
  const router = useRouter();
  const { login, register } = useUser();
  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const [step, setStep] = useState(1);

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCpf, setRegCpf] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ref = new URLSearchParams(window.location.search).get("ref") || localStorage.getItem("winify_ref") || "";
      if (ref) setReferralCode(ref);
    }
  }, []);

  if (!isOpen) return null;

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const switchTab = (t: "login" | "register") => {
    setTab(t); setStep(1); setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!email || !password) { setError("Preencha todos os campos"); return; }
    setLoading(true);
    const success = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (!success) { setError("E-mail ou senha incorretos"); return; }
    onClose(); router.push("/");
  };

  const handleStep1 = () => {
    setError("");
    if (!regName.trim() || regName.trim().length < 3) { setError("Digite seu nome completo"); return; }
    if (!regEmail.includes("@") || !regEmail.includes(".")) { setError("Digite um e-mail valido"); return; }
    if (!regPhone || regPhone.replace(/\D/g, "").length < 10) { setError("Digite um telefone valido"); return; }
    if (regCpf.replace(/\D/g, "").length !== 11) { setError("Digite um CPF valido"); return; }
    setStep(2);
  };

  const handleRegister = async () => {
    setError("");
    if (regPassword.length < 6) { setError("A senha deve ter no minimo 6 caracteres"); return; }
    if (regPassword !== regConfirmPassword) { setError("As senhas nao coincidem"); return; }
    setLoading(true);
    const success = await register(regName.trim(), regEmail.trim().toLowerCase(), regCpf.replace(/\D/g, ""), regPassword, regPhone.replace(/\D/g, ""), referralCode || undefined);
    setLoading(false);
    if (!success) { setError("Ja existe uma conta com esse e-mail"); return; }
    trackLead({ email: regEmail.trim().toLowerCase(), name: regName.trim(), phone: regPhone.replace(/\D/g, "") });
    onClose(); router.push("/");
  };

  const inputClass = "w-full bg-[#0A0910] rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-[#80FF00]/40 border border-[#1e2a3a] placeholder-[#4a5568]";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 bg-[#12101A] rounded-2xl border border-[#1e2a3a] shadow-2xl shadow-black/50 overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-[#4a5568] hover:text-white transition-colors z-10">
          <span className="material-symbols-outlined">close</span>
        </button>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2a3a]">
          <button
            onClick={() => switchTab("login")}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all ${tab === "login" ? "text-[#80FF00] border-b-2 border-[#80FF00] bg-[#80FF00]/5" : "text-[#4a5568] hover:text-white"}`}
          >
            Entrar
          </button>
          <button
            onClick={() => switchTab("register")}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all ${tab === "register" ? "text-[#80FF00] border-b-2 border-[#80FF00] bg-[#80FF00]/5" : "text-[#4a5568] hover:text-white"}`}
          >
            Cadastre-se
          </button>
        </div>

        <div className="p-6">
          {/* ---- LOGIN ---- */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <img src="/logo.png" alt="Winify" className="h-20 w-auto mx-auto mb-2" />
                <p className="text-xs text-[#4a5568]">Acesse sua conta</p>
              </div>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block uppercase tracking-widest font-bold">E-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block uppercase tracking-widest font-bold">Senha</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" className={inputClass} />
              </div>
              {error && <p className="text-[#FF5252] text-xs text-center font-bold">{error}</p>}
              <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-[#80FF00] text-[#0a0a0a] font-black text-sm uppercase tracking-wider hover:bg-[#80FF00]/90 active:scale-[0.98] transition-all disabled:opacity-50">
                {loading ? "Entrando..." : "Entrar"}
              </button>
              <p className="text-center text-xs text-[#4a5568]">
                Nao tem conta? <button type="button" onClick={() => switchTab("register")} className="text-[#80FF00] font-bold">Cadastre-se</button>
              </p>
            </form>
          )}

          {/* ---- REGISTER STEP 1 ---- */}
          {tab === "register" && step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-black font-headline uppercase tracking-tight">Criar conta</h2>
                <p className="text-xs text-[#4a5568] mt-1">Etapa 1 de 2 — Seus dados</p>
              </div>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block uppercase tracking-widest font-bold">Nome completo</label>
                <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Seu nome completo" className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block uppercase tracking-widest font-bold">E-mail</label>
                <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="seu@email.com" className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block uppercase tracking-widest font-bold">Telefone</label>
                <input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="(11) 99999-9999" maxLength={15} className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block uppercase tracking-widest font-bold">CPF</label>
                <input type="text" value={regCpf} onChange={(e) => setRegCpf(formatCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} className={inputClass} />
              </div>
              {error && <p className="text-[#FF5252] text-xs text-center font-bold">{error}</p>}
              <button onClick={handleStep1} className="w-full py-3.5 rounded-xl bg-[#80FF00] text-[#0a0a0a] font-black text-sm uppercase tracking-wider hover:bg-[#80FF00]/90 active:scale-[0.98] transition-all">
                Continuar
              </button>
              <p className="text-center text-xs text-[#4a5568]">
                Ja tem conta? <button onClick={() => switchTab("login")} className="text-[#80FF00] font-bold">Entrar</button>
              </p>
            </div>
          )}

          {/* ---- REGISTER STEP 2 ---- */}
          {tab === "register" && step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <div className="w-14 h-14 rounded-full bg-[#80FF00]/10 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[#80FF00] text-2xl">lock</span>
                </div>
                <h2 className="text-lg font-black font-headline uppercase tracking-tight">Criar senha</h2>
                <p className="text-xs text-[#4a5568] mt-1">Etapa 2 de 2</p>
              </div>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block uppercase tracking-widest font-bold">Senha</label>
                <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Minimo 6 caracteres" className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block uppercase tracking-widest font-bold">Confirmar senha</label>
                <input type="password" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} placeholder="Repita a senha" className={inputClass} />
              </div>
              {error && <p className="text-[#FF5252] text-xs text-center font-bold">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => { setStep(1); setError(""); }} className="flex-1 py-3.5 rounded-xl border border-[#1e2a3a] text-white font-bold text-sm uppercase tracking-wider hover:bg-white/5 active:scale-[0.98] transition-all">
                  Voltar
                </button>
                <button onClick={handleRegister} disabled={loading} className="flex-[2] py-3.5 rounded-xl bg-[#80FF00] text-[#0a0a0a] font-black text-sm uppercase tracking-wider hover:bg-[#80FF00]/90 active:scale-[0.98] transition-all disabled:opacity-50">
                  {loading ? "Criando..." : "Criar Conta"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
