"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

export default function SaldosPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#121212] text-white pb-24">
      <div className="sticky top-0 z-40 bg-[#121212]/90 backdrop-blur-md border-b border-[#2A2A2A] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white">
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-semibold">Saldos & Apostas</h1>
      </div>

      <div className="p-4 max-w-md mx-auto flex flex-col gap-4">
        {/* Balance Card */}
        <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2A2A2A]">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-[#9CA3AF]">Saldo Total</p>
            <span className="material-icons-outlined text-[#9CA3AF] text-sm">visibility</span>
          </div>
          <p className="text-3xl font-bold text-white mb-1">R$ 0,00</p>
          <p className="text-xs text-[#9CA3AF]">Disponível para apostar</p>
          <div className="flex gap-2 mt-4">
            <Link
              href="/deposito"
              className="flex-1 py-2.5 rounded-xl bg-[#00C853] text-white font-semibold text-sm text-center"
            >
              Depositar
            </Link>
            <button className="flex-1 py-2.5 rounded-xl bg-[#2A2A2A] text-white font-semibold text-sm">
              Sacar
            </button>
          </div>
        </div>

        {/* Active bets */}
        <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2A2A2A]">
          <h3 className="text-sm font-semibold mb-3">Apostas Ativas</h3>
          <div className="text-center py-8">
            <span className="material-icons-outlined text-3xl text-[#9CA3AF] mb-2 block">receipt_long</span>
            <p className="text-sm text-[#9CA3AF]">Nenhuma aposta ativa</p>
            <Link href="/" className="text-[#00C853] text-sm font-semibold mt-2 inline-block">
              Explorar mercados
            </Link>
          </div>
        </div>

        {/* History */}
        <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2A2A2A]">
          <h3 className="text-sm font-semibold mb-3">Histórico</h3>
          <div className="text-center py-8">
            <span className="material-icons-outlined text-3xl text-[#9CA3AF] mb-2 block">history</span>
            <p className="text-sm text-[#9CA3AF]">Nenhuma transação ainda</p>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
