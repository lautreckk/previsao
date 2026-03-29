"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import AuthModal from "./AuthModal";

export default function Header() {
  const { user } = useUser();
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0b1120]/80 backdrop-blur-xl flex justify-between items-center px-4 h-16 shadow-2xl shadow-emerald-500/10 bg-gradient-to-b from-[#0f1729] to-transparent overflow-hidden">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Winify" className="h-20 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <Link
              href="/deposito"
              className="bg-surface-container-highest px-4 py-1.5 rounded-full border border-white/5 flex items-center gap-2 hover:scale-105 transition-transform active:scale-95 duration-100"
            >
              <span className="text-xs font-bold text-[#8B95A8] uppercase tracking-widest">Saldo</span>
              <span className="text-[#00FFB8] font-extrabold font-headline">R$ {user.balance.toFixed(2)}</span>
            </Link>
          ) : (
            <>
              <button
                onClick={() => setAuthModal("login")}
                className="px-5 py-2 rounded-full border border-[#1e2a3a] text-white font-bold text-sm uppercase tracking-wider hover:bg-white/5 active:scale-95 transition-all"
              >
                Entrar
              </button>
              <button
                onClick={() => setAuthModal("register")}
                className="px-5 py-2 rounded-full bg-[#00FFB8] text-[#003D2E] font-black text-sm uppercase tracking-wider hover:bg-[#00FFB8]/90 active:scale-95 transition-all"
              >
                Cadastre-se
              </button>
            </>
          )}
        </div>
      </header>

      <AuthModal
        isOpen={authModal !== null}
        onClose={() => setAuthModal(null)}
        initialTab={authModal || "login"}
      />
    </>
  );
}
