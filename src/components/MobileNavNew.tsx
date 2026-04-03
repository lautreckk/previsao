"use client";

import { Home, TrendingUp, User, Wallet, BookOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/UserContext";

export default function MobileNavNew() {
  const pathname = usePathname();
  const { user } = useUser();

  const items = [
    { href: "/", icon: Home, label: "Mercados" },
    { href: "/saldos", icon: TrendingUp, label: "Apostas" },
    { href: "/deposito", icon: Wallet, label: "Depositar", center: true },
    { href: "/ranking", icon: BookOpen, label: "Ranking" },
    { href: user ? "/perfil" : "/login", icon: User, label: user ? "Perfil" : "Entrar" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d1117]/95 backdrop-blur-xl border-t border-white/[0.06] pb-safe">
      <div className="flex items-center justify-around h-16 px-1">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Ic = item.icon;

          if (item.center) {
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center -mt-6">
                <div className="w-14 h-14 rounded-full bg-[#80FF00] flex items-center justify-center shadow-[0_4px_20px_rgba(128,255,0,0.35)]">
                  <Ic size={24} className="text-[#0a0a0a]" />
                </div>
                <span className="text-[9px] font-bold text-white mt-1">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors ${isActive ? "text-[#80FF00]" : "text-white/30"}`}>
              <Ic size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[9px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
