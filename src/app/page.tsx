"use client";

import { useState } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import MarketCard from "@/components/MarketCard";
import { markets, categories } from "@/lib/markets";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeTab, setActiveTab] = useState<"closing" | "hot">("closing");

  const filteredMarkets = markets.filter((m) => {
    if (activeCategory === "all") return true;
    const catMap: Record<string, string> = {
      entertainment: "Entretenimento",
      crypto: "Criptomoedas",
      sports: "Esportes",
      politics: "Política",
      finance: "Financeiro",
    };
    return m.category === catMap[activeCategory];
  });

  const sortedMarkets = [...filteredMarkets].sort((a, b) => {
    if (activeTab === "closing") {
      const statusOrder = { live: 0, closing: 1, open: 2, closed: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return b.volume - a.volume;
  });

  return (
    <div className="min-h-screen bg-[#121212]">
      <Header />

      {/* Categories */}
      <div className="px-4 py-3 border-b border-[#2A2A2A] overflow-x-auto no-scrollbar">
        <div className="flex gap-2 min-w-max">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? "bg-[#00C853]/10 border border-[#00C853] text-[#00C853]"
                  : "bg-[#1E1E1E] border border-transparent text-gray-300"
              }`}
            >
              <span className="material-icons-outlined text-sm">{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sub tabs */}
      <div className="px-4 py-3 flex gap-4 text-sm border-b border-[#2A2A2A]">
        <button
          onClick={() => setActiveTab("closing")}
          className={`font-semibold pb-1 transition-colors ${
            activeTab === "closing"
              ? "text-[#00C853] border-b-2 border-[#00C853]"
              : "text-[#9CA3AF]"
          }`}
        >
          Encerram em breve
        </button>
        <button
          onClick={() => setActiveTab("hot")}
          className={`font-medium pb-1 transition-colors ${
            activeTab === "hot"
              ? "text-[#00C853] border-b-2 border-[#00C853]"
              : "text-[#9CA3AF]"
          }`}
        >
          Em Alta
        </button>
      </div>

      {/* Market Cards */}
      <main className="p-4 flex flex-col gap-4 pb-24 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {sortedMarkets.map((market) => (
          <MarketCard key={market.id} market={market} />
        ))}
        {sortedMarkets.length === 0 && (
          <div className="col-span-full text-center py-12 text-[#9CA3AF]">
            <span className="material-icons-outlined text-4xl mb-2 block">search_off</span>
            <p>Nenhum mercado encontrado nesta categoria.</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
