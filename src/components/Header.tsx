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
      <header className="sticky top-0 z-50 bg-[#0D0B14]/95 backdrop-blur-xl border-b border-white/[0.04] px-4 lg:px-6 h-14 flex items-center gap-4">
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
                className="kinetic-gradient text-[#1A0E00] px-4 py-2 rounded-lg text-sm font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,166,35,0.3)] hover:shadow-[0_0_25px_rgba(245,166,35,0.5)] hover:scale-105 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-base">add</span>Depositar
              </Link>
              <Link
                href="/perfil"
                className="bg-[#1A1722] border border-white/[0.06] px-3 py-1.5 rounded-lg text-sm font-bold text-[#E09520]"
              >
                R$ {user.balance.toFixed(2)}
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={() => setAuthModal("login")}
                className="px-4 py-2 rounded-lg border border-white/[0.06] text-white font-bold text-sm hover:bg-white/5 active:scale-95 transition-all"
              >
                Entrar
              </button>
              <button
                onClick={() => setAuthModal("register")}
                className="kinetic-gradient text-[#1A0E00] px-4 py-2 rounded-lg text-sm font-black shadow-[0_0_15px_rgba(245,166,35,0.3)] hover:shadow-[0_0_25px_rgba(245,166,35,0.5)] active:scale-95 transition-all"
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
