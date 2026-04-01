"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getLevelName } from "@/lib/UserContext";
import BottomNav from "@/components/BottomNav";

interface PublicUser {
  id: string;
  name: string;
  avatar_url: string;
  is_public: boolean;
  level: number;
  total_predictions: number;
  total_wins: number;
  total_losses: number;
  total_wagered: number;
  total_returns: number;
  win_streak: number;
  best_streak: number;
  rank_position: number;
  created_at: string;
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    async function load() {
      const id = params.id as string;
      const { data } = await supabase
        .from("users")
        .select("id, name, avatar_url, is_public, level, total_predictions, total_wins, total_losses, total_wagered, total_returns, win_streak, best_streak, rank_position, created_at")
        .eq("id", id)
        .single();

      if (!data) { setLoading(false); return; }
      if (!data.is_public) { setIsPrivate(true); setLoading(false); return; }
      setProfile(data as PublicUser);
      setLoading(false);
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#80FF00]/30 border-t-[#80FF00] rounded-full animate-spin" />
      </div>
    );
  }

  if (isPrivate) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-white px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-white/30">lock</span>
          </div>
          <h2 className="font-black text-lg mb-2">Perfil Privado</h2>
          <p className="text-sm text-white/40 mb-6">Este usuario optou por manter seu perfil privado.</p>
          <button onClick={() => router.back()} className="text-[#80FF00] font-bold text-sm">Voltar</button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-white">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-white/30">person_off</span>
          <p className="mt-2 text-white/40">Usuario nao encontrado</p>
          <button onClick={() => router.push("/")} className="mt-4 text-[#80FF00] font-bold">Voltar</button>
        </div>
      </div>
    );
  }

  const winRate = profile.total_predictions > 0
    ? Math.round((profile.total_wins / profile.total_predictions) * 100)
    : 0;
  const profit = Number(profile.total_returns) - Number(profile.total_wagered);
  const memberSince = new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-[#080d1a] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#080d1a]/90 backdrop-blur-lg border-b border-white/[0.04] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white/50 hover:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <span className="font-black text-sm uppercase tracking-wider">Perfil</span>
      </div>

      {/* Profile Card */}
      <div className="px-4 py-6">
        <div className="bg-[#0D0B14] rounded-2xl border border-white/[0.06] p-6 text-center">
          {/* Avatar */}
          <div className="w-20 h-20 mx-auto rounded-full p-[2px] bg-gradient-to-tr from-[#80FF00] via-[#A0FF40] to-[#80FF00] mb-4">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.name} className="w-full h-full rounded-full object-cover border-[3px] border-[#0D0B14]" />
            ) : (
              <div className="w-full h-full rounded-full bg-[#0D0B14] flex items-center justify-center border-[3px] border-[#0D0B14]">
                <img
                  src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(profile.name)}&backgroundColor=transparent`}
                  alt={profile.name}
                  className="w-full h-full rounded-full"
                />
              </div>
            )}
          </div>

          <h1 className="text-xl font-black">{profile.name}</h1>

          {/* Level badge */}
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-[#80FF00]/10 border border-[#80FF00]/20">
            <span className="material-symbols-outlined text-[#80FF00] text-xs">military_tech</span>
            <span className="text-[10px] font-black text-[#80FF00] uppercase">Nivel {profile.level} - {getLevelName(profile.level)}</span>
          </div>

          {profile.rank_position > 0 && profile.rank_position <= 100 && (
            <div className="mt-2">
              <span className="text-[10px] text-white/30">Ranking #{profile.rank_position}</span>
            </div>
          )}

          <p className="text-[10px] text-white/20 mt-2">Membro desde {memberSince}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <StatCard icon="target" label="Previsoes" value={String(profile.total_predictions)} color="#80FF00" />
          <StatCard icon="check_circle" label="Taxa de Acerto" value={`${winRate}%`} color="#10B981" />
          <StatCard icon="trending_up" label="Lucro" value={`R$ ${profit.toFixed(0)}`} color={profit >= 0 ? "#10B981" : "#EF4444"} />
          <StatCard icon="local_fire_department" label="Melhor Streak" value={`${profile.best_streak}x`} color="#FF6B6B" />
          <StatCard icon="toll" label="Volume Total" value={`R$ ${Number(profile.total_wagered).toFixed(0)}`} color="#8B5CF6" />
          <StatCard icon="emoji_events" label="Vitorias" value={`${profile.total_wins}/${profile.total_predictions}`} color="#80FF00" />
        </div>

        {/* Win/Loss Visual */}
        {profile.total_predictions > 0 && (
          <div className="mt-4 bg-[#0D0B14] rounded-2xl border border-white/[0.06] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-wider">Performance</span>
              <span className="text-[10px] text-white/20">{profile.total_wins}W / {profile.total_losses}L</span>
            </div>
            <div className="h-3 rounded-full bg-[#1a2a3a] overflow-hidden flex">
              <div
                className="h-full rounded-l-full bg-[#10B981] transition-all duration-500"
                style={{ width: `${winRate}%` }}
              />
              <div
                className="h-full rounded-r-full bg-[#EF4444] transition-all duration-500"
                style={{ width: `${100 - winRate}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-[#10B981] font-bold">{winRate}% ganhos</span>
              <span className="text-[10px] text-[#EF4444] font-bold">{100 - winRate}% perdidos</span>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0D0B14] rounded-xl border border-white/[0.06] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-sm" style={{ color }}>{icon}</span>
        <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">{label}</span>
      </div>
      <span className="text-lg font-black tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}
