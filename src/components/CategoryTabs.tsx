"use client";

import {
  LayoutGrid, Tv, Trophy, Landmark, DollarSign, Cloud, Bitcoin, Globe,
} from "lucide-react";

const categories = [
  { icon: LayoutGrid, label: "Todos", value: "all" },
  { icon: Tv, label: "Entretenimento", value: "entertainment" },
  { icon: Trophy, label: "Esportes", value: "sports" },
  { icon: Landmark, label: "Política", value: "politics" },
  { icon: DollarSign, label: "Financeiro", value: "economy" },
  { icon: Cloud, label: "Clima", value: "weather" },
  { icon: Bitcoin, label: "Criptomoedas", value: "crypto" },
  { icon: Globe, label: "Geopolítica", value: "war" },
];

interface CategoryTabsProps {
  active: string;
  onChange: (cat: string) => void;
}

export default function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-3 touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
      {categories.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onChange(cat.value)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            active === cat.value
              ? "bg-[#80FF00] text-[#0a0a0a]"
              : "bg-[hsl(0,0%,14%)] text-[hsl(0,0%,85%)] hover:bg-[hsl(0,0%,16%)]"
          }`}
        >
          <cat.icon size={14} />
          {cat.label}
        </button>
      ))}
    </div>
  );
}
