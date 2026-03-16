"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Demo: just redirect
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col">
      <div className="sticky top-0 z-40 bg-[#121212]/90 backdrop-blur-md border-b border-[#2A2A2A] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white">
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-semibold">Entrar</h1>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-[#00C853] flex items-center justify-center mx-auto mb-3">
              <span className="material-icons-outlined text-white text-2xl">trending_up</span>
            </div>
            <h2 className="text-2xl font-bold">previsao.io</h2>
            <p className="text-sm text-[#9CA3AF] mt-1">Entre na sua conta</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              className="w-full bg-[#1E1E1E] rounded-lg px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-[#00C853] border border-[#2A2A2A]"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full bg-[#1E1E1E] rounded-lg px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-[#00C853] border border-[#2A2A2A]"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#00C853] text-white font-semibold text-base mt-2"
            >
              Entrar
            </button>
          </form>

          <p className="text-center text-sm text-[#9CA3AF] mt-4">
            Não tem conta?{" "}
            <Link href="/login" className="text-[#00C853] font-semibold">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
