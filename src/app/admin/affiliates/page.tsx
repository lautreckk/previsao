"use client";

import Link from "next/link";

export default function AdminAffiliates() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-[40px] text-white/20">handshake</span>
      </div>
      <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">Afiliados</h2>
      <p className="text-white/40 text-sm mb-1">Este modulo esta em desenvolvimento.</p>
      <p className="text-white/30 text-xs mb-8">
        Em breve voce podera gerenciar afiliados, acompanhar conversoes e comissoes diretamente por aqui.
      </p>
      <Link
        href="/admin"
        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.06] border border-white/[0.06] text-white/60 text-sm font-medium hover:bg-white/[0.1] hover:text-white transition-all"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
