"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Preencha todos os campos"); return; }
    setLoading(true);
    const success = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (!success) { setError("E-mail ou senha incorretos"); return; }
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-surface-dim text-on-surface flex flex-col overflow-x-hidden w-full max-w-[100vw]">
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#0b1120]/80 backdrop-blur-xl bg-gradient-to-b from-[#0f1729] to-transparent shadow-2xl shadow-emerald-500/10 flex items-center px-4 h-16 overflow-hidden">
        <button onClick={() => router.back()} className="text-[#00D4AA] mr-4"><span className="material-symbols-outlined">arrow_back</span></button>
        <h1 className="text-base font-bold font-headline uppercase tracking-tight">Entrar</h1>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 pt-24">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Winify" className="h-40 w-auto mx-auto mb-4" />
            <p className="text-sm text-on-surface-variant mt-1">Entre na sua conta</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block uppercase tracking-wider font-bold">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="w-full bg-surface-container-lowest rounded-2xl px-4 py-3.5 text-white text-sm outline-none focus:ring-2 focus:ring-[#00D4AA]/40 border border-white/5" />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block uppercase tracking-wider font-bold">Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" className="w-full bg-surface-container-lowest rounded-2xl px-4 py-3.5 text-white text-sm outline-none focus:ring-2 focus:ring-[#00D4AA]/40 border border-white/5" />
            </div>
            {error && <p className="text-error text-sm text-center font-bold">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-4 rounded-2xl kinetic-gradient text-[#003D2E] font-black font-headline text-base mt-2 uppercase tracking-wider glow-green hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60">{loading ? "Entrando..." : "Entrar"}</button>
          </form>
          <p className="text-center text-sm text-on-surface-variant mt-4">Nao tem conta? <Link href="/criar-conta" className="text-[#00D4AA] font-bold">Criar conta</Link></p>
        </div>
      </div>
    </div>
  );
}
