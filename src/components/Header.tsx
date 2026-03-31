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
      <header className="sticky top-0 z-50 bg-[#0d1525]/95 backdrop-blur-xl border-b border-[#1a2a3a] px-4 lg:px-6 h-14 flex items-center gap-4">
        <Link href="/" className="shrink-0">
          <img src="/logo.png" alt="Palpitano" className="h-10 w-auto" />
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/deposito"
                className="kinetic-gradient text-[#003D2E] px-4 py-2 rounded-lg text-sm font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,255,184,0.3)] hover:shadow-[0_0_25px_rgba(0,255,184,0.5)] hover:scale-105 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-base">add</span>Depositar
              </Link>
              <Link
                href="/perfil"
                className="bg-[#1a2332] border border-[#2a3444] px-3 py-1.5 rounded-lg text-sm font-bold text-[#00D4AA]"
              >
                R$ {user.balance.toFixed(2)}
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={() => setAuthModal("login")}
                className="px-4 py-2 rounded-lg border border-[#2a3444] text-white font-bold text-sm hover:bg-white/5 active:scale-95 transition-all"
              >
                Entrar
              </button>
              <button
                onClick={() => setAuthModal("register")}
                className="kinetic-gradient text-[#003D2E] px-4 py-2 rounded-lg text-sm font-black shadow-[0_0_15px_rgba(0,255,184,0.3)] hover:shadow-[0_0_25px_rgba(0,255,184,0.5)] active:scale-95 transition-all"
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
