"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

interface RealBet {
  id: string;
  market_id: string;
  market_title: string;
  outcome_key: string;
  outcome_label: string;
  amount: number;
  payout_at_entry: number;
  final_payout: number;
  status: string;
  created_at: string;
  entry_price?: number;
}

export default function SaldosPage() {
  const router = useRouter();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<"ativas" | "resolvidas">("ativas");
  const [bets, setBets] = useState<RealBet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    const fetchBets = async () => {
      // Fetch from prediction_bets (real bets)
      const { data } = await supabase
        .from("prediction_bets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (data && data.length > 0) {
        // Get market titles
        const marketIds = [...new Set(data.map((b: RealBet) => b.market_id))];
        const { data: markets } = await supabase
          .from("prediction_markets")
          .select("id, title")
          .in("id", marketIds);
        const titleMap: Record<string, string> = {};
        (markets || []).forEach((m: { id: string; title: string }) => { titleMap[m.id] = m.title; });

        setBets(data.map((b: RealBet) => ({
          ...b,
          market_title: titleMap[b.market_id] || b.market_id,
        })));
      }

      // Also check camera predictions
      const { data: camPreds } = await supabase
        .from("camera_predictions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (camPreds && camPreds.length > 0) {
        const camBets: RealBet[] = camPreds.map((p: { id: string; market_id: string; prediction_type: string; threshold: number; amount_brl: number; odds_at_entry: number; payout: number; status: string; created_at: string }) => ({
          id: p.id,
          market_id: p.market_id,
          market_title: `Rodovia: ${p.prediction_type === "over" ? "Mais de" : "Até"} ${p.threshold} veículos`,
          outcome_key: p.prediction_type,
          outcome_label: p.prediction_type === "over" ? `Mais de ${p.threshold}` : `Até ${p.threshold}`,
          amount: Number(p.amount_brl),
          payout_at_entry: Number(p.odds_at_entry),
          final_payout: Number(p.payout || 0),
          status: p.status === "open" ? "pending" : p.status,
          created_at: p.created_at,
        }));
        setBets(prev => [...prev, ...camBets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }

      setLoading(false);
    };
    fetchBets();
    const iv = setInterval(fetchBets, 15000);
    return () => clearInterval(iv);
  }, [user?.id]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#080d1a] text-white flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-white/20">confirmation_number</span>
          <p className="mt-2 text-white/40 mb-4">Faça login para ver suas apostas</p>
          <Link href="/login" className="px-6 py-3 rounded-xl bg-[#80FF00] text-[#0a0a0a] font-black text-sm uppercase">Entrar</Link>
        </div>
      </div>
    );
  }

  const activeBets = bets.filter(b => b.status === "pending");
  const resolvedBets = bets.filter(b => b.status === "won" || b.status === "lost" || b.status === "refunded");
  const displayedBets = activeTab === "ativas" ? activeBets : resolvedBets;

  const totalWagered = bets.reduce((s, b) => s + Number(b.amount), 0);
  const totalWon = bets.filter(b => b.status === "won").reduce((s, b) => s + Number(b.final_payout || b.amount * b.payout_at_entry), 0);

  return (
    <div className="min-h-screen bg-[#080d1a] text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0d1117]/95 backdrop-blur-xl border-b border-white/[0.04] h-14 flex items-center px-4 gap-3">
        <button onClick={() => router.back()} className="text-[#80FF00]"><span className="material-symbols-outlined">arrow_back</span></button>
        <Link href="/"><img src="/logo.png" alt="PALPITEX" className="h-7 w-auto" /></Link>
        <div className="ml-auto bg-white/[0.04] px-3 py-1.5 rounded-lg border border-white/[0.06]">
          <span className="text-sm font-bold text-[#80FF00]">R$ {user.balance.toFixed(2)}</span>
        </div>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
            <p className="text-[9px] text-white/30 uppercase font-bold">Total Apostado</p>
            <p className="text-base font-black text-white mt-1">R$ {totalWagered.toFixed(2)}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
            <p className="text-[9px] text-white/30 uppercase font-bold">Total Ganho</p>
            <p className="text-base font-black text-[#80FF00] mt-1">R$ {totalWon.toFixed(2)}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
            <p className="text-[9px] text-white/30 uppercase font-bold">Apostas</p>
            <p className="text-base font-black text-white mt-1">{bets.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(["ativas", "resolvidas"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab ? "bg-[#80FF00]/10 text-[#80FF00] border border-[#80FF00]/30" : "bg-white/[0.03] text-white/40 border border-white/[0.06]"}`}>
              {tab === "ativas" ? `Ativas (${activeBets.length})` : `Resolvidas (${resolvedBets.length})`}
            </button>
          ))}
        </div>

        {/* Bets list */}
        {loading ? (
          <div className="text-center py-12"><div className="w-6 h-6 border-2 border-white/10 border-t-[#80FF00] rounded-full animate-spin mx-auto" /></div>
        ) : displayedBets.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-8 text-center">
            <span className="material-symbols-outlined text-3xl text-white/10 block mb-2">receipt_long</span>
            <p className="text-sm text-white/30">{activeTab === "ativas" ? "Nenhuma aposta ativa" : "Nenhuma aposta resolvida"}</p>
            <Link href="/" className="text-[#80FF00] text-sm font-bold mt-2 inline-block">Explorar mercados</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedBets.map(bet => {
              const potentialWin = Number(bet.amount) * Number(bet.payout_at_entry);
              const isWon = bet.status === "won";
              const isLost = bet.status === "lost";
              const isPending = bet.status === "pending";

              return (
                <div key={bet.id} className={`bg-white/[0.03] border rounded-xl overflow-hidden ${isPending ? "border-[#80FF00]/20" : isWon ? "border-[#80FF00]/30" : "border-white/[0.06]"}`}>
                  <div className="p-4 space-y-3">
                    {/* Title + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold truncate">{bet.market_title}</h3>
                        <p className="text-[10px] text-white/30 mt-0.5">{new Date(bet.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isPending ? "bg-[#80FF00]/10 text-[#80FF00]" : isWon ? "bg-[#80FF00]/10 text-[#80FF00]" : "bg-[#FF5252]/10 text-[#FF5252]"}`}>
                        {isPending ? "⏳ Pendente" : isWon ? "🟢 Ganhou" : bet.status === "refunded" ? "↩ Reembolso" : "🔴 Perdeu"}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-white/30">Palpite</span>
                        <span className="font-bold text-white">{bet.outcome_label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/30">Odd</span>
                        <span className="font-bold text-[#80FF00]">{Number(bet.payout_at_entry).toFixed(2)}x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/30">Apostado</span>
                        <span className="font-bold">R$ {Number(bet.amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/30">{isPending ? "Pot. Ganho" : isWon ? "Ganho" : "Perdido"}</span>
                        <span className={`font-bold ${isWon || isPending ? "text-[#80FF00]" : "text-[#FF5252]"}`}>
                          {isLost ? `- R$ ${Number(bet.amount).toFixed(2)}` : `R$ ${(isWon && bet.final_payout ? Number(bet.final_payout) : potentialWin).toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
