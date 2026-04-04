"use client";

import Link from "next/link";
import {
  Tv, Trophy, Landmark, DollarSign, Cloud, Bitcoin, Globe, Radio, MousePointer, BookOpen,
} from "lucide-react";

interface SidebarNavProps {
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
}

const liveItems = [
  { label: "Rodovia", live: true, href: "/camera" },
];

const cryptoItems = [
  { icon: "🟠", label: "BTC", change: "+0.5%", positive: true },
  { icon: "💎", label: "ETH", change: "+1.7%", positive: true },
  { icon: "🟣", label: "SOL", change: "-0.5%", positive: false },
  { icon: "⚪", label: "XRP", change: "+1.5%", positive: true },
  { icon: "🟡", label: "DOGE", change: "+0.5%", positive: true },
];

const themes = [
  { icon: Tv, label: "Entretenimento", count: 22, value: "entertainment" },
  { icon: Trophy, label: "Esportes", count: 80, value: "sports" },
  { icon: Landmark, label: "Política", count: 17, value: "politics" },
  { icon: DollarSign, label: "Financeiro", count: 35, value: "economy" },
  { icon: Cloud, label: "Clima", count: 10, value: "weather" },
  { icon: Bitcoin, label: "Criptomoedas", count: 3273, value: "crypto" },
  { icon: Globe, label: "Geopolítica", count: 118, value: "war" },
];

export default function SidebarNav({ activeCategory, onCategoryChange }: SidebarNavProps) {
  return (
    <aside className="hidden lg:flex flex-col w-44 bg-[hsl(0,0%,5%)] border-r border-[hsl(0,0%,14%)] fixed left-0 top-20 z-30 overflow-y-auto scrollbar-hide px-2 py-3" style={{ height: 'calc(100vh - 5rem)' }}>
      {/* AO VIVO */}
      <div className="mb-4">
        <p className="text-[10px] text-[hsl(0,0%,55%)] uppercase tracking-wider font-semibold mb-2 px-1">Ao Vivo</p>
        {liveItems.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className="flex items-center justify-between w-full px-2 py-1.5 rounded-md text-sm text-[hsl(0,0%,85%)] hover:bg-[hsl(0,0%,12%)]/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-[hsl(0,0%,55%)]" />
              <span className="text-sm">{item.label}</span>
            </div>
            {item.live && (
              <span className="text-[10px] font-bold text-[hsl(0,84%,60%)] animate-pulse">LIVE</span>
            )}
          </Link>
        ))}
      </div>

      {/* CRIPTO 5 MIN */}
      <div className="mb-4">
        <p className="text-[10px] text-[hsl(0,0%,55%)] uppercase tracking-wider font-semibold mb-2 px-1">Cripto 5 min</p>
        {cryptoItems.map((item, i) => (
          <button
            key={i}
            onClick={() => onCategoryChange("crypto")}
            className="flex items-center justify-between px-2 py-1 text-sm w-full rounded-md hover:bg-[hsl(0,0%,12%)]/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{item.icon}</span>
              <span className="text-[hsl(0,0%,85%)] text-sm">{item.label}</span>
            </div>
            <span className={`text-xs font-medium ${item.positive ? 'text-[#80FF00]' : 'text-[hsl(0,84%,60%)]'}`}>
              {item.change}
            </span>
          </button>
        ))}
      </div>

      {/* TEMAS */}
      <div className="mb-4">
        <p className="text-[10px] text-[hsl(0,0%,55%)] uppercase tracking-wider font-semibold mb-2 px-1">Temas</p>
        <nav className="flex flex-col gap-0.5">
          {themes.map((cat) => (
            <button
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
              className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${
                activeCategory === cat.value
                  ? "bg-[hsl(0,0%,12%)] text-[hsl(0,0%,90%)]"
                  : "text-[hsl(0,0%,85%)] hover:bg-[hsl(0,0%,12%)]/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <cat.icon size={14} />
                <span>{cat.label}</span>
              </div>
              <span className="text-xs text-[hsl(0,0%,55%)]">{cat.count}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Promo banners */}
      <div className="mt-auto space-y-2 px-1">
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-xl p-3 text-center overflow-hidden relative">
          <p className="text-xs font-extrabold text-white leading-tight">INDIQUE E<br/>GANHE!</p>
          <Link href="/criar-conta" className="mt-1.5 inline-block bg-[#121212]/90 text-[hsl(0,0%,95%)] text-[9px] font-bold px-3 py-1 rounded-md">INDICAR AGORA</Link>
        </div>
        <div className="bg-gradient-to-r from-green-700 to-green-500 rounded-xl p-3 text-center overflow-hidden relative">
          <p className="text-[10px] text-white/90 font-medium">Até</p>
          <p className="text-lg font-extrabold text-white leading-tight">10%<span className="text-xs">de</span></p>
          <p className="text-sm font-extrabold text-white">CASHBACK</p>
          <Link href="/criar-conta" className="mt-1.5 inline-block bg-[#121212]/90 text-[hsl(0,0%,95%)] text-[9px] font-bold px-3 py-1 rounded-md">REGISTRAR</Link>
        </div>
      </div>

      {/* Bottom links */}
      <div className="mt-3 px-2 space-y-1 pb-3">
        <Link href="/resultados" className="flex items-center gap-2 text-sm text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)] transition-colors w-full py-1">
          <MousePointer size={14} />
          <span>Precisão</span>
        </Link>
        <Link href="/como-funciona" className="flex items-center gap-2 text-sm text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)] transition-colors w-full py-1">
          <BookOpen size={14} />
          <span>Dúvidas</span>
        </Link>
      </div>
    </aside>
  );
}
