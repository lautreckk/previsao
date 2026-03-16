"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

export default function PerfilPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#121212] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#121212]/90 backdrop-blur-md border-b border-[#2A2A2A] px-4 py-3">
        <h1 className="text-base font-semibold">Perfil</h1>
      </div>

      <div className="p-4 max-w-md mx-auto flex flex-col gap-4">
        {/* Avatar */}
        <div className="bg-[#1E1E1E] rounded-xl p-6 border border-[#2A2A2A] text-center">
          <div className="w-20 h-20 rounded-full bg-[#2A2A2A] flex items-center justify-center mx-auto mb-3">
            <span className="material-icons-outlined text-4xl text-[#9CA3AF]">person</span>
          </div>
          <h2 className="text-lg font-bold">Usuário</h2>
          <p className="text-sm text-[#9CA3AF]">usuario@email.com</p>
        </div>

        {/* Balance */}
        <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2A2A2A]">
          <p className="text-xs text-[#9CA3AF] mb-1">Saldo disponível</p>
          <p className="text-2xl font-bold text-[#00C853]">R$ 0,00</p>
          <Link
            href="/deposito"
            className="mt-3 block w-full py-2.5 rounded-xl bg-[#00C853] text-white font-semibold text-sm text-center"
          >
            Depositar
          </Link>
        </div>

        {/* Menu */}
        <div className="bg-[#1E1E1E] rounded-xl border border-[#2A2A2A] divide-y divide-[#2A2A2A]">
          {[
            { icon: "receipt_long", label: "Minhas Apostas", href: "/saldos" },
            { icon: "account_balance_wallet", label: "Saldos", href: "/saldos" },
            { icon: "pix", label: "Depositar", href: "/deposito" },
            { icon: "help_outline", label: "Suporte", href: "#" },
            { icon: "logout", label: "Sair", href: "/login" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#2A2A2A] transition-colors"
            >
              <span className="material-icons-outlined text-[#9CA3AF]">{item.icon}</span>
              <span className="text-sm font-medium flex-1">{item.label}</span>
              <span className="material-icons-outlined text-[#9CA3AF] text-sm">chevron_right</span>
            </Link>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
