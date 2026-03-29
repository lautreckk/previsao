"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", icon: "home", label: "Home" },
    { href: "/saldos", icon: "confirmation_number", label: "Apostas" },
    { href: "/perfil", icon: "person", label: "Perfil" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 flex justify-around items-center px-4 pb-6 pt-3 bg-[#0f1729]/90 backdrop-blur-2xl rounded-t-[3rem] z-50 border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center transition-all ${
              isActive
                ? "text-[#00D4AA] bg-[#00D4AA]/10 rounded-full py-2 px-4 shadow-[0_0_15px_rgba(0,212,170,0.2)]"
                : "text-[#5A6478] opacity-70 hover:text-[#00D4AA] active:scale-110"
            }`}
          >
            <span
              className={`material-symbols-outlined text-2xl ${isActive ? "fill-icon" : ""}`}
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className="text-[10px] uppercase tracking-widest font-bold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
