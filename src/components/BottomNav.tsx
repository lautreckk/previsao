"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LiveChat from "./LiveChat";
import Icon from "@/components/Icon";

export default function BottomNav() {
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);

  const navItems = [
    { href: "/", icon: "home", label: "Home", action: null },
    { href: "#chat", icon: "forum", label: "Chat", action: () => setChatOpen(true) },
    { href: "/ranking", icon: "leaderboard", label: "Ranking", action: null },
    { href: "/saldos", icon: "confirmation_number", label: "Apostas", action: null },
    { href: "/perfil", icon: "person", label: "Perfil", action: null },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 flex justify-around items-center px-2 pb-6 pt-3 bg-[#0f1729]/95 backdrop-blur-2xl rounded-t-[2rem] z-50 border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {navItems.map((item) => {
          const isActive = item.action ? chatOpen : pathname === item.href;

          if (item.action) {
            return (
              <button
                key={item.href}
                onClick={item.action}
                className={`flex flex-col items-center justify-center transition-all px-3 py-1.5 ${
                  isActive
                    ? "text-[#E09520]"
                    : "text-white/30 opacity-70 hover:text-[#E09520] active:scale-110"
                }`}
              >
                <Icon name={item.icon} size={26} weight={isActive ? "fill" : "regular"} />
                <span className="text-[9px] uppercase tracking-widest font-bold mt-0.5">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center transition-all px-3 py-1.5 ${
                isActive
                  ? "text-[#E09520]"
                  : "text-white/30 opacity-70 hover:text-[#E09520] active:scale-110"
              }`}
            >
              <Icon name={item.icon} size={26} weight={isActive ? "fill" : "regular"} />
              <span className="text-[9px] uppercase tracking-widest font-bold mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <LiveChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
