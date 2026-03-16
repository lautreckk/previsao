"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", icon: "home", label: "Início" },
  { href: "#search", icon: "search", label: "Buscar" },
  { href: "#add", icon: "add", label: "", isCenter: true },
  { href: "/saldos", icon: "receipt_long", label: "Apostas", badge: true },
  { href: "/perfil", icon: "person", label: "Perfil" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#1E1E1E] border-t border-[#2A2A2A] flex justify-around items-center py-3 pb-safe z-50 px-4 sm:hidden">
      {navItems.map((item) => {
        if (item.isCenter) {
          return (
            <div key="center" className="relative -top-5">
              <Link
                href="/deposito"
                className="w-12 h-12 rounded-full bg-[#00C853] text-white flex items-center justify-center shadow-lg border-4 border-[#1E1E1E]"
              >
                <span className="material-icons-outlined">add</span>
              </Link>
            </div>
          );
        }

        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 transition-colors relative ${
              isActive ? "text-[#00C853]" : "text-[#9CA3AF] hover:text-white"
            }`}
          >
            <span className="material-icons-outlined">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
            {item.badge && (
              <span className="absolute top-0 right-1 w-2 h-2 bg-[#FF3B30] rounded-full border border-[#1E1E1E]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
