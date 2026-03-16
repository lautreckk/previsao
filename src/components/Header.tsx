"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-[#121212]/90 backdrop-blur-md px-4 pt-3 pb-3 border-b border-[#2A2A2A]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#00C853] flex items-center justify-center">
            <span className="material-icons-outlined text-white text-lg">trending_up</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">previsao.io</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/deposito"
            className="bg-[#00C853]/10 text-[#00C853] border border-[#00C853]/30 px-3 py-1.5 rounded-full text-sm font-semibold hidden sm:block"
          >
            Depositar
          </Link>
          <Link
            href="/login"
            className="bg-[#00C853] text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm"
          >
            Entrar
          </Link>
        </div>
      </div>
      <div className="relative">
        <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm">
          search
        </span>
        <input
          className="w-full bg-[#1E1E1E] border-none rounded-full pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[#00C853] text-white placeholder-[#9CA3AF] transition-colors outline-none"
          placeholder="Buscar mercados..."
          type="text"
        />
      </div>
    </header>
  );
}
