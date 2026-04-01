"use client";

import { Home, TrendingUp, User, Wallet, BookOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/UserContext";

export default function MobileNavNew() {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[hsl(0,0%,11%)] border-t border-[hsl(0,0%,18%)] z-30">
      <div className="flex items-center justify-around py-2 relative">
        <Link href="/" className={`flex flex-col items-center gap-0.5 ${pathname === "/" ? "text-[#80FF00]" : "text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)]"} transition-colors`}>
          <Home size={22} />
          <span className="text-[10px] font-medium">Mercados</span>
        </Link>
        <Link href="/saldos" className={`flex flex-col items-center gap-0.5 ${pathname === "/saldos" ? "text-[#80FF00]" : "text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)]"} transition-colors`}>
          <TrendingUp size={22} />
          <span className="text-[10px] font-medium">Portfolio</span>
        </Link>
        {/* Depositar - center elevated button */}
        <Link href="/deposito" className="flex flex-col items-center gap-0.5 -mt-5">
          <div className="w-14 h-14 rounded-full bg-[#80FF00] flex items-center justify-center shadow-lg shadow-[#80FF00]/30">
            <Wallet size={24} className="text-[#0a0a0a]" />
          </div>
          <span className="text-[10px] font-medium text-[hsl(0,0%,95%)]">Depositar</span>
        </Link>
        <Link href="/como-funciona" className={`flex flex-col items-center gap-0.5 ${pathname === "/como-funciona" ? "text-[#80FF00]" : "text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)]"} transition-colors`}>
          <BookOpen size={22} />
          <span className="text-[10px] font-medium">Dúvidas</span>
        </Link>
        {user ? (
          <Link href="/perfil" className={`flex flex-col items-center gap-0.5 ${pathname === "/perfil" ? "text-[#80FF00]" : "text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)]"} transition-colors`}>
            <User size={22} />
            <span className="text-[10px] font-medium">Perfil</span>
          </Link>
        ) : (
          <Link href="/login" className="flex flex-col items-center gap-0.5 text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)] transition-colors">
            <User size={22} />
            <span className="text-[10px] font-medium">Entrar</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
