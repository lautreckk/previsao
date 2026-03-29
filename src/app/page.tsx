"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import MarketCard from "@/components/MarketCard";
import BottomNav from "@/components/BottomNav";
import { initializeStore, getMarkets, tickAllMarkets } from "@/lib/engines/store";
import { CATEGORY_META } from "@/lib/engines/types";
import { useUser } from "@/lib/UserContext";
import type { PredictionMarket, MarketCategory } from "@/lib/engines/types";

// ---- WINNERS TICKER ----
const FAKE_WINNERS = [
  { name: "LUCAS", game: "BBB 26", amount: "R$ 2.450,00" },
  { name: "TIAGO", game: "BTC 5min", amount: "R$ 16.432,20" },
  { name: "ANA CLARA", game: "Dolar Diario", amount: "R$ 890,50" },
  { name: "PEDRO H.", game: "Flamengo", amount: "R$ 5.200,00" },
  { name: "GABRIELA", game: "Clima SP", amount: "R$ 1.320,00" },
  { name: "MARCOS", game: "Rodovia 5min", amount: "R$ 9.580,20" },
  { name: "JULIANA", game: "Anitta", amount: "R$ 3.750,00" },
  { name: "RAFAELA", game: "Petroleo", amount: "R$ 7.890,00" },
  { name: "CARLOS", game: "Shakira", amount: "R$ 4.100,00" },
  { name: "FERNANDA", game: "Champions", amount: "R$ 12.300,00" },
  { name: "DIEGO", game: "IBOVESPA", amount: "R$ 6.540,00" },
  { name: "BRUNA", game: "BBB 26", amount: "R$ 8.200,00" },
  { name: "RODRIGO", game: "Neymar", amount: "R$ 2.100,00" },
  { name: "CAMILA", game: "Virginia", amount: "R$ 1.800,00" },
  { name: "FELIPE", game: "ETH 5min", amount: "R$ 11.250,00" },
  { name: "AMANDA", game: "Carlinhos", amount: "R$ 950,00" },
];

function WinnersTicker() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setOffset((o) => o + 1), 30);
    return () => clearInterval(iv);
  }, []);

  // Double the array for seamless loop
  const items = [...FAKE_WINNERS, ...FAKE_WINNERS];
  const itemWidth = 280; // approx width per item
  const totalWidth = FAKE_WINNERS.length * itemWidth;
  const translateX = -(offset % totalWidth);

  return (
    <div className="bg-[#060d18] border-b border-[#1a2a3a] overflow-hidden h-10 flex items-center">
      <div className="flex items-center gap-0 whitespace-nowrap" style={{ transform: `translateX(${translateX}px)`, transition: "none" }}>
        {items.map((w, i) => (
          <div key={i} className="flex items-center gap-2.5 px-5 shrink-0" style={{ minWidth: `${itemWidth}px` }}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FFB800] to-[#FF8C00] flex items-center justify-center text-[10px] font-black text-white shrink-0">
              {w.name.charAt(0)}
            </div>
            <span className="text-white font-black text-xs">{w.name}</span>
            <span className="text-[#5A6478] text-[10px]">{w.game}</span>
            <span className="text-[#00FFB8] font-black text-xs">{w.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Chat mock data
const chatUsers = [
  "@renandouglas1903", "@victorturito08", "@suelicapela10", "@ronaldopvneto",
  "@moisesmesquita0702", "@allansilsou", "@carvalho280922", "@kaueeduardokj",
  "@pedrohenrique99", "@julianacosta12", "@felipematos_", "@brunasantos777",
];
const chatMessages = [
  "under,gg - 83 previsoes", "Desgeaca de mulher soe for mulher - 1 previsoes",
  "mensagem apagada", "GG - 5 previsoes", "So pesquisar no telegram - 27 previsoes",
  "tu e mlk so 3 prev willian - 68 previsoes", "quem foi de under ta maluko - 135 previsoes",
  "grupo telegram operando 100% acertivo! pesquisem @rodoviasinais",
  "ENTAO EU SOU LOUCO - 55 previsoes", "estamos jogando juntos no grupo do telegram!! entrem @rodoviasinais",
  "bora lucrar galera", "acertei 5 seguidas", "alguem mais ta no btc?",
  "essa do clima ta facil", "quem apostou no flamengo?",
];

export default function Home() {
  const { user } = useUser();
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"closing" | "hot">("closing");
  const [search, setSearch] = useState("");
  const [chatMsgs, setChatMsgs] = useState<{ user: string; text: string; id: number }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const onlineCount = useRef(620 + Math.floor(Math.random() * 40));

  useEffect(() => {
    initializeStore();
    const refresh = () => { const ms = tickAllMarkets(); setMarkets(ms); };
    refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, []);

  // Seed chat messages
  useEffect(() => {
    const initial = Array.from({ length: 8 }, (_, i) => ({
      user: chatUsers[i % chatUsers.length],
      text: chatMessages[i % chatMessages.length],
      id: i,
    }));
    setChatMsgs(initial);
  }, []);

  // Auto chat messages
  useEffect(() => {
    const iv = setInterval(() => {
      const user = chatUsers[Math.floor(Math.random() * chatUsers.length)];
      const text = chatMessages[Math.floor(Math.random() * chatMessages.length)];
      setChatMsgs((prev) => [...prev.slice(-50), { user, text, id: Date.now() }]);
    }, 4000 + Math.random() * 6000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMsgs]);

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatMsgs((prev) => [...prev.slice(-50), { user: user ? `@${user.name.split(" ")[0].toLowerCase()}` : "@voce", text: chatInput.trim(), id: Date.now() }]);
    setChatInput("");
  }, [chatInput, user]);

  const now = Date.now();
  const openMarkets = markets.filter((m) => ["open", "frozen", "closed", "awaiting_resolution"].includes(m.status));
  const filtered = openMarkets
    .filter((m) => activeCategory === "all" || m.category === activeCategory)
    .filter((m) => !search || m.title.toLowerCase().includes(search.toLowerCase()));

  // Priority categories (gossip/entertainment first)
  const catPriority: Record<string, number> = {
    entertainment: 0, social_media: 1, custom: 2, sports: 3,
    politics: 4, weather: 5, economy: 6, crypto: 7, war: 8,
  };

  const sorted = [...filtered].sort((a, b) => {
    // Featured always first
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    // Then by category priority (entertainment/fofoca first)
    const catA = catPriority[a.category] ?? 9;
    const catB = catPriority[b.category] ?? 9;
    if (catA !== catB) return catA - catB;
    // Then by pool size (most popular)
    if (activeTab === "hot") return b.pool_total - a.pool_total;
    // Then by closing time
    return a.close_at - b.close_at;
  });

  const catEntries = Object.entries(CATEGORY_META) as [MarketCategory, { label: string; icon: string; color: string }][];

  return (
    <div className="min-h-screen bg-[#080d1a] overflow-x-hidden">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#0d1525]/95 backdrop-blur-xl border-b border-[#1a2a3a] px-4 lg:px-6 h-14 flex items-center gap-4">
        <Link href="/" className="shrink-0">
          <img src="/logo.png" alt="Winify" className="h-10 w-auto" />
        </Link>
        <div className="flex-1 max-w-lg mx-auto hidden sm:block">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6478] text-sm">search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar mercados..." className="w-full bg-[#0d1525] rounded-lg pl-10 pr-4 py-2 text-sm text-white border border-[#2a3444] outline-none focus:border-[#00D4AA]/40 placeholder-[#5A6478]" />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href="/deposito" className="kinetic-gradient text-[#003D2E] px-4 py-2 rounded-lg text-sm font-black flex items-center gap-1.5 animate-pulse shadow-[0_0_25px_rgba(0,255,184,0.5)] hover:shadow-[0_0_30px_rgba(0,255,184,0.6)] active:scale-95 transition-all">
                <span className="material-symbols-outlined text-base">add</span>Depositar
              </Link>
              <Link href="/perfil" className="bg-[#1a2332] border border-[#2a3444] px-3 py-1.5 rounded-lg text-sm font-bold text-[#00D4AA]">R$ {user.balance.toFixed(2)}</Link>
            </>
          ) : (
            <Link href="/login" className="kinetic-gradient text-[#003D2E] px-5 py-2 rounded-lg text-sm font-black shadow-[0_0_20px_rgba(0,212,170,0.4)]">Entrar</Link>
          )}
        </div>
      </header>

      {/* WINNERS TICKER */}
      <WinnersTicker />

      {/* PROMO BANNER */}
      <div className="px-4 lg:px-6 py-3">
        <Link href="/criar-conta">
          <div className="relative w-full rounded-2xl overflow-hidden group cursor-pointer hover:shadow-[0_0_40px_rgba(0,212,170,0.3)] transition-all border border-[#00D4AA]/20">
            <img src="/banner-promo.png" alt="Aqui tudo que voce sabe vira dinheiro! Jogue a partir de R$10" className="w-full h-auto rounded-2xl" />
          </div>
        </Link>
      </div>

      <div className="flex">
        {/* MAIN CONTENT */}
        <main className="flex-1 min-w-0">
          {/* Categories row */}
          <div className="px-4 lg:px-6 py-3 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-[#2a3444]">
            <button onClick={() => setActiveCategory("all")} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-all ${activeCategory === "all" ? "bg-[#00FFB8]/10 border border-[#00FFB8]/40 text-[#00FFB8]" : "text-[#8B95A8] hover:text-white"}`}>
              <span className="material-symbols-outlined text-sm">dashboard</span>Todos
            </button>
            {catEntries.map(([key, meta]) => (
              <button key={key} onClick={() => setActiveCategory(key)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-all ${activeCategory === key ? "bg-[#00FFB8]/10 border border-[#00FFB8]/40 text-[#00FFB8]" : "text-[#8B95A8] hover:text-white"}`}>
                <span className="material-symbols-outlined text-sm">{meta.icon}</span>{meta.label}
              </button>
            ))}
          </div>

          {/* Sub tabs */}
          <div className="px-4 lg:px-6 py-3 flex gap-6 text-sm border-b border-[#2a3444]">
            <button onClick={() => setActiveTab("closing")} className={`font-semibold pb-1 transition-all ${activeTab === "closing" ? "text-white border-b-2 border-white" : "text-[#5A6478]"}`}>Encerram em breve</button>
            <button onClick={() => setActiveTab("hot")} className={`font-semibold pb-1 transition-all ${activeTab === "hot" ? "text-white border-b-2 border-white" : "text-[#5A6478]"}`}>Em Alta</button>
          </div>

          {/* GRID 4 columns */}
          <div className="p-4 lg:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24 lg:pb-6">
            {sorted.map((m) => <MarketCard key={m.id} market={m} />)}
            {sorted.length === 0 && (
              <div className="col-span-full text-center py-12 text-[#5A6478]">
                <span className="material-symbols-outlined text-4xl mb-2 block">search_off</span>
                <p>Nenhum mercado encontrado.</p>
              </div>
            )}
          </div>
        </main>

        {/* CHAT SIDEBAR - desktop only */}
        <aside className="hidden lg:flex flex-col w-80 xl:w-96 border-l border-[#2a3444] bg-[#0d1525] sticky top-14 h-[calc(100vh-56px)]">
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-[#2a3444] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#8B95A8] text-lg">chevron_right</span>
              <h3 className="font-black text-sm uppercase tracking-wider">Chat ao Vivo</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#00D4AA]" />
              <span className="text-xs text-[#00D4AA] font-bold">{onlineCount.current} online</span>
            </div>
          </div>

          {/* Chat messages */}
          <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4 no-scrollbar">
            {chatMsgs.map((msg) => (
              <div key={msg.id}>
                <p className="text-[#00D4AA] font-bold text-sm">{msg.user}</p>
                <p className="text-[#c8cdd4] text-sm">{msg.text}</p>
              </div>
            ))}
          </div>

          {/* Chat input */}
          <div className="px-4 py-3 border-t border-[#2a3444] shrink-0">
            <div className="flex items-center gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Enviar mensagem..." className="flex-1 bg-[#1a2332] rounded-lg px-4 py-2.5 text-sm text-white border border-[#2a3444] outline-none placeholder-[#5A6478]" />
              <button className="text-[#5A6478] hover:text-white"><span className="material-symbols-outlined text-xl">mood</span></button>
              <button onClick={sendChat} className="text-[#5A6478] hover:text-[#00D4AA]"><span className="material-symbols-outlined text-xl">send</span></button>
            </div>
            <p className="text-[10px] text-[#5A6478] mt-1.5">Seja respeitoso. Siga as <span className="text-[#00D4AA]">regras da comunidade</span></p>
          </div>
        </aside>
      </div>

      {/* Mobile only bottom nav */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
