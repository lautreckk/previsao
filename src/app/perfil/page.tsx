"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser, getLevelName, type User } from "@/lib/UserContext";
import BottomNav from "@/components/BottomNav";

type Tab = "resumo" | "conta" | "historico";
type BetFilter = "all" | "pending" | "won" | "lost";

interface Stats {
  won: number; lost: number; pending: number; total: number;
  totalWagered: number; totalReturns: number; profit: number; winRate: number;
  weekProfit: number; weekBets: number;
}

function useStats(bets: Array<{ amount: number; potentialWin: number; status: string; createdAt: string }>): Stats {
  return useMemo(() => {
    const won = bets.filter((b) => b.status === "won");
    const lost = bets.filter((b) => b.status === "lost");
    const pending = bets.filter((b) => b.status === "pending");
    const resolved = [...won, ...lost];
    const totalWagered = bets.reduce((s, b) => s + b.amount, 0);
    const totalReturns = won.reduce((s, b) => s + b.potentialWin, 0);
    const totalLost = lost.reduce((s, b) => s + b.amount, 0);
    const profit = totalReturns - won.reduce((s, b) => s + b.amount, 0) - totalLost;
    const winRate = resolved.length > 0 ? (won.length / resolved.length) * 100 : 0;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekBets = bets.filter((b) => new Date(b.createdAt) >= weekAgo);
    const weekWon = weekBets.filter((b) => b.status === "won");
    const weekLost = weekBets.filter((b) => b.status === "lost");
    const weekProfit = weekWon.reduce((s, b) => s + b.potentialWin - b.amount, 0) - weekLost.reduce((s, b) => s + b.amount, 0);
    return { won: won.length, lost: lost.length, pending: pending.length, total: bets.length, totalWagered, totalReturns, profit, winRate, weekProfit, weekBets: weekBets.length };
  }, [bets]);
}

export default function PerfilPage() {
  const router = useRouter();
  const { user, bets, logout, updateProfile, changePassword, uploadAvatar, togglePublicProfile } = useUser();
  const [tab, setTab] = useState<Tab>("resumo");
  const stats = useStats(bets);

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-dim text-on-surface flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">person</span>
          <p className="mt-2 text-on-surface-variant mb-4">Faca login para ver seu perfil</p>
          <Link href="/login" className="px-6 py-3 rounded-2xl kinetic-gradient text-[#1A0E00] font-black font-headline text-sm uppercase">Entrar</Link>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "resumo", label: "Resumo", icon: "dashboard" },
    { key: "conta", label: "Conta", icon: "person" },
    { key: "historico", label: "Historico", icon: "history" },
  ];

  return (
    <div className="min-h-screen bg-surface-dim text-on-surface pb-32 overflow-x-hidden w-full max-w-[100vw]">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0b1120]/80 backdrop-blur-xl bg-gradient-to-b from-[#0f1729] to-transparent shadow-2xl shadow-emerald-500/10 flex justify-between items-center px-4 h-16 overflow-hidden">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="lg:hidden text-[#F5A623] p-1"><span className="material-symbols-outlined">arrow_back</span></button>
          <Link href="/" className="flex items-center gap-2"><img src="/logo.png" alt="Winify" className="h-16 w-auto" /></Link>
        </div>
        <div className="bg-surface-container-highest px-4 py-1.5 rounded-full border border-white/5 flex items-center gap-2">
          <span className="text-[#F5A623] font-bold font-headline tracking-tight text-sm">R$ {user.balance.toFixed(2)}</span>
          <span className="material-symbols-outlined text-[#F5A623] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
        </div>
      </header>

      <main className="pt-20 pb-8 px-4 max-w-lg mx-auto">
        {/* Profile Header */}
        <section className="relative bg-gradient-to-br from-surface-container via-surface-container to-surface-container-high rounded-3xl p-6 border border-white/5 mb-6 overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[#F5A623]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full p-[2px] bg-gradient-to-tr from-[#F5A623] via-[#FFB800] to-[#F5A623]">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="w-full h-full rounded-full object-cover border-[3px] border-surface-dim" />
                ) : (
                  <div className="w-full h-full rounded-full bg-surface-dim flex items-center justify-center border-[3px] border-surface-dim">
                    <span className="text-3xl font-black text-[#F5A623] font-headline">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="font-headline font-extrabold text-xl tracking-tight text-on-surface truncate">{user.name}</h1>
              <p className="text-on-surface-variant text-xs font-medium truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-bold bg-[#F5A623]/15 text-[#F5A623] px-2 py-0.5 rounded-full">Lv.{user.level} {getLevelName(user.level)}</span>
                <span className="text-on-surface-variant/40 text-[10px]">
                  Desde {new Date(user.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Bar */}
        <nav className="flex bg-surface-container rounded-2xl p-1 mb-6 border border-white/5">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-headline font-bold transition-all ${tab === t.key ? "bg-[#F5A623]/15 text-[#F5A623] shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}>
              <span className="material-symbols-outlined text-base" style={tab === t.key ? { fontVariationSettings: "'FILL' 1" } : undefined}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "resumo" && <ResumoTab stats={stats} user={user} bets={bets} />}
        {tab === "conta" && <ContaTab user={user} updateProfile={updateProfile} changePassword={changePassword} uploadAvatar={uploadAvatar} logout={logout} router={router} togglePublicProfile={togglePublicProfile} />}
        {tab === "historico" && <HistoricoTab bets={bets} stats={stats} />}
      </main>
      <BottomNav />
    </div>
  );
}

/* ─── RESUMO TAB ─── */
function ResumoTab({ stats, user, bets }: { stats: Stats; user: User; bets: Array<{ id: string; marketTitle: string; optionName: string; odds: number; amount: number; status: string; createdAt: string }> }) {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Vitorias" value={user.total_wins || stats.won} icon="emoji_events" color="text-[#F5A623]" bg="bg-[#F5A623]/10" />
        <StatCard label="Derrotas" value={user.total_losses || stats.lost} icon="close" color="text-red-400" bg="bg-red-400/10" />
        <StatCard label="Pendentes" value={stats.pending} icon="schedule" color="text-[#5B9DFF]" bg="bg-[#5B9DFF]/10" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-container rounded-2xl p-4 border border-white/5">
          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mb-1">Taxa de Acerto</p>
          <span className="text-2xl font-headline font-black text-[#F5A623] italic">{stats.winRate.toFixed(0)}%</span>
          <div className="mt-2 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#F5A623] to-[#FFB800] rounded-full transition-all" style={{ width: `${Math.min(stats.winRate, 100)}%` }} />
          </div>
        </div>
        <div className="bg-surface-container rounded-2xl p-4 border border-white/5">
          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mb-1">Lucro Semanal</p>
          <span className={`text-2xl font-headline font-black italic ${stats.weekProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {stats.weekProfit >= 0 ? "+" : ""}R$ {Math.abs(stats.weekProfit).toFixed(0)}
          </span>
          <p className="text-[10px] text-on-surface-variant mt-1">{stats.weekBets} apostas esta semana</p>
        </div>
      </div>

      {/* Streak & Level */}
      {(user.win_streak > 0 || user.best_streak > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container rounded-2xl p-4 border border-white/5 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#F5A623] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
            <div>
              <span className="text-lg font-headline font-black text-[#F5A623] italic">{user.win_streak}</span>
              <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest">Sequencia Atual</p>
            </div>
          </div>
          <div className="bg-surface-container rounded-2xl p-4 border border-white/5 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#FFB800] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>military_tech</span>
            <div>
              <span className="text-lg font-headline font-black text-[#FFB800] italic">{user.best_streak}</span>
              <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest">Melhor Sequencia</p>
            </div>
          </div>
        </div>
      )}

      {/* Balance Card */}
      <div className="bg-surface-container rounded-2xl p-6 border-l-4 border-[#F5A623] shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-[0.2em]">Saldo Disponivel</p>
            <h2 className="text-4xl font-headline font-black text-on-surface mt-1 italic">R$ {user.balance.toFixed(2)}</h2>
          </div>
          <span className="material-symbols-outlined text-[#F5A623] text-3xl">payments</span>
        </div>
        <div className="flex gap-3">
          <Link href="/deposito" className="flex-1 bg-gradient-to-r from-[#F5A623] to-[#C4841A] text-[#1A0E00] font-headline font-extrabold py-3 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all text-center text-sm">DEPOSITAR</Link>
          <button className="flex-1 bg-surface-container-highest text-on-surface font-headline font-extrabold py-3 rounded-2xl hover:bg-surface-bright active:scale-95 transition-all text-sm">SACAR</button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-surface-container rounded-2xl p-5 border border-white/5">
        <h3 className="font-headline font-bold text-sm mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#F5A623] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
          Resumo Financeiro
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant">Total Apostado</span>
            <span className="text-sm font-headline font-bold">R$ {(user.total_wagered || stats.totalWagered).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant">Total Retornado</span>
            <span className="text-sm font-headline font-bold text-emerald-400">R$ {(user.total_returns || stats.totalReturns).toFixed(2)}</span>
          </div>
          <div className="h-px bg-white/5" />
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-on-surface">Lucro Liquido</span>
            <span className={`text-lg font-headline font-black italic ${stats.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {stats.profit >= 0 ? "+" : ""}R$ {Math.abs(stats.profit).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-headline font-bold text-sm tracking-tight">Ultimas Atividades</h3>
          <Link href="/saldos" className="text-[#FFB800] text-[10px] font-black uppercase tracking-widest">Ver Tudo</Link>
        </div>
        {bets.length === 0 ? (
          <div className="bg-surface-container rounded-2xl p-6 text-center border border-white/5">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2 block">receipt_long</span>
            <p className="text-sm text-on-surface-variant">Nenhuma atividade recente</p>
            <Link href="/" className="text-[#F5A623] text-sm font-bold mt-2 inline-block">Explorar mercados</Link>
          </div>
        ) : (
          bets.slice(0, 5).map((bet) => <BetRow key={bet.id} bet={bet} />)
        )}
      </div>
    </div>
  );
}

/* ─── CONTA TAB ─── */
function ContaTab({
  user, updateProfile, changePassword, uploadAvatar, logout, router, togglePublicProfile,
}: {
  user: User;
  updateProfile: (data: Record<string, string>) => Promise<boolean>;
  changePassword: (old: string, pw: string) => Promise<boolean>;
  uploadAvatar: (f: File) => Promise<string | null>;
  logout: () => void;
  router: ReturnType<typeof useRouter>;
  togglePublicProfile: () => Promise<boolean>;
}) {
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || "");
  const [cpf, setCpf] = useState(user.cpf || "");
  const [bio, setBio] = useState(user.bio || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasChanges = name !== user.name || email !== user.email || phone !== (user.phone || "") || cpf !== (user.cpf || "") || bio !== (user.bio || "");

  async function handleSave() {
    setSaving(true);
    const ok = await updateProfile({ name, email, phone, cpf, bio });
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  async function handlePasswordChange() {
    setPwMsg(null);
    if (newPw.length < 6) { setPwMsg({ ok: false, text: "Senha deve ter pelo menos 6 caracteres" }); return; }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: "Senhas nao coincidem" }); return; }
    setPwSaving(true);
    const ok = await changePassword(oldPw, newPw);
    setPwSaving(false);
    if (ok) { setPwMsg({ ok: true, text: "Senha alterada com sucesso!" }); setOldPw(""); setNewPw(""); setConfirmPw(""); }
    else setPwMsg({ ok: false, text: "Senha atual incorreta" });
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await uploadAvatar(file);
    setUploading(false);
  }

  return (
    <div className="space-y-6">
      {/* Public Profile Toggle */}
      <div className="bg-surface-container rounded-2xl p-6 border border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5A623]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#F5A623]">{user.is_public ? "visibility" : "visibility_off"}</span>
            </div>
            <div>
              <h3 className="font-headline font-bold text-sm">Perfil Publico</h3>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                {user.is_public ? "Seu perfil aparece no ranking e feed" : "Seu perfil esta oculto para outros usuarios"}
              </p>
            </div>
          </div>
          <button
            onClick={async () => { setTogglingPublic(true); await togglePublicProfile(); setTogglingPublic(false); }}
            disabled={togglingPublic}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${user.is_public ? "bg-[#F5A623]" : "bg-white/10"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${user.is_public ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>
        {user.is_public && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
            <span className="text-[10px] text-on-surface-variant">Nivel {user.level}</span>
            <span className="text-[10px] text-[#F5A623] font-bold">{getLevelName(user.level)}</span>
            <span className="text-[10px] text-on-surface-variant ml-auto">{user.total_predictions} previsoes</span>
            <span className="text-[10px] text-on-surface-variant">•</span>
            <span className="text-[10px] text-on-surface-variant">{user.total_predictions > 0 ? Math.round((user.total_wins / user.total_predictions) * 100) : 0}% acerto</span>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="bg-surface-container rounded-2xl p-6 border border-white/5">
        <h3 className="font-headline font-bold text-sm mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#F5A623] text-lg">photo_camera</span>
          Foto do Perfil
        </h3>
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-24 h-24 rounded-full p-[2px] bg-gradient-to-tr from-[#F5A623] via-[#FFB800] to-[#F5A623]">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-full h-full rounded-full object-cover border-[3px] border-surface-dim" />
              ) : (
                <div className="w-full h-full rounded-full bg-surface-dim flex items-center justify-center border-[3px] border-surface-dim">
                  <span className="text-4xl font-black text-[#F5A623] font-headline">{user.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#F5A623] flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-sm text-[#1A0E00]">{uploading ? "hourglass_top" : "edit"}</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="text-xs text-on-surface-variant">
            <p>Clique no icone para alterar</p>
            <p className="text-[10px] mt-1 opacity-60">JPG, PNG - max 2MB</p>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-surface-container rounded-2xl p-6 border border-white/5">
        <h3 className="font-headline font-bold text-sm mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#F5A623] text-lg">badge</span>
          Informacoes Pessoais
        </h3>
        <div className="space-y-4">
          <FormField label="Nome completo" value={name} onChange={setName} icon="person" />
          <FormField label="E-mail" value={email} onChange={setEmail} icon="mail" type="email" />
          <FormField label="Telefone" value={phone} onChange={setPhone} icon="phone" placeholder="(11) 99999-9999" />
          <FormField label="CPF" value={cpf} onChange={setCpf} icon="fingerprint" placeholder="000.000.000-00" />
          <div>
            <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mb-1 block">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Conte um pouco sobre voce..." rows={2}
              className="w-full bg-surface-container-highest border border-white/5 rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-[#F5A623]/40 focus:ring-1 focus:ring-[#F5A623]/20 transition-all resize-none" />
          </div>
        </div>
        <button onClick={handleSave} disabled={!hasChanges || saving}
          className={`mt-5 w-full py-3 rounded-2xl font-headline font-extrabold text-sm transition-all ${hasChanges ? "bg-gradient-to-r from-[#F5A623] to-[#C4841A] text-[#1A0E00] hover:scale-[1.02] active:scale-95" : "bg-surface-container-highest text-on-surface-variant cursor-not-allowed"}`}>
          {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar Alteracoes"}
        </button>
      </div>

      {/* Change Password */}
      <div className="bg-surface-container rounded-2xl p-6 border border-white/5">
        <h3 className="font-headline font-bold text-sm mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#F5A623] text-lg">lock</span>
          Alterar Senha
        </h3>
        <div className="space-y-4">
          <FormField label="Senha atual" value={oldPw} onChange={setOldPw} icon="key" type="password" />
          <FormField label="Nova senha" value={newPw} onChange={setNewPw} icon="lock" type="password" />
          <FormField label="Confirmar nova senha" value={confirmPw} onChange={setConfirmPw} icon="lock" type="password" />
        </div>
        {pwMsg && <p className={`mt-3 text-xs font-medium ${pwMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{pwMsg.text}</p>}
        <button onClick={handlePasswordChange} disabled={!oldPw || !newPw || !confirmPw || pwSaving}
          className={`mt-5 w-full py-3 rounded-2xl font-headline font-extrabold text-sm transition-all ${oldPw && newPw && confirmPw ? "bg-surface-container-highest text-on-surface hover:bg-surface-bright active:scale-95 border border-white/10" : "bg-surface-container-highest text-on-surface-variant cursor-not-allowed"}`}>
          {pwSaving ? "Alterando..." : "Alterar Senha"}
        </button>
      </div>

      {/* Logout */}
      <button onClick={() => { logout(); router.push("/"); }}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-headline font-bold text-sm hover:bg-red-500/20 active:scale-95 transition-all">
        <span className="material-symbols-outlined text-lg">logout</span>
        Sair da Conta
      </button>
    </div>
  );
}

/* ─── HISTORICO TAB ─── */
function HistoricoTab({ bets, stats }: { bets: Array<{ id: string; marketTitle: string; optionName: string; odds: number; amount: number; potentialWin: number; status: string; createdAt: string }>; stats: Stats }) {
  const [filter, setFilter] = useState<BetFilter>("all");
  const filtered = useMemo(() => filter === "all" ? bets : bets.filter((b) => b.status === filter), [bets, filter]);

  const filters: { key: BetFilter; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: stats.total },
    { key: "pending", label: "Pendentes", count: stats.pending },
    { key: "won", label: "Ganhas", count: stats.won },
    { key: "lost", label: "Perdidas", count: stats.lost },
  ];

  return (
    <div className="space-y-6">
      {/* Filter buttons */}
      <div className="grid grid-cols-4 gap-2">
        {filters.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`py-2.5 rounded-xl text-center transition-all ${filter === f.key ? "bg-[#F5A623]/15 border border-[#F5A623]/30 text-[#F5A623]" : "bg-surface-container border border-white/5 text-on-surface-variant hover:text-on-surface"}`}>
            <span className="text-lg font-headline font-black block leading-none">{f.count}</span>
            <span className="text-[9px] uppercase font-bold tracking-wider">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Win/Loss Report */}
      <div className="bg-surface-container rounded-2xl p-5 border border-white/5">
        <h3 className="font-headline font-bold text-sm mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#F5A623] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
          Relatorio de Performance
        </h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <div className="flex h-3 rounded-full overflow-hidden bg-surface-container-highest">
              {stats.won > 0 && <div className="bg-[#F5A623] transition-all" style={{ width: `${(stats.won / Math.max(stats.won + stats.lost, 1)) * 100}%` }} />}
              {stats.lost > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(stats.lost / Math.max(stats.won + stats.lost, 1)) * 100}%` }} />}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-[#F5A623] font-bold">{stats.won}W</span>
              <span className="text-[10px] text-red-400 font-bold">{stats.lost}L</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-headline font-black text-[#F5A623] italic">{stats.winRate.toFixed(0)}%</span>
            <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-wider">Win Rate</p>
          </div>
        </div>
        <div className="h-px bg-white/5 mb-3" />
        <div className="flex justify-between items-center">
          <span className="text-xs text-on-surface-variant">Lucro Total</span>
          <span className={`text-lg font-headline font-black italic ${stats.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {stats.profit >= 0 ? "+" : ""}R$ {Math.abs(stats.profit).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Bet List */}
      <div className="space-y-3">
        <h3 className="font-headline font-bold text-sm px-1">
          {filter === "all" ? "Todas as Apostas" : filter === "pending" ? "Apostas Pendentes" : filter === "won" ? "Apostas Ganhas" : "Apostas Perdidas"}
          <span className="text-on-surface-variant font-normal ml-2">({filtered.length})</span>
        </h3>
        {filtered.length === 0 ? (
          <div className="bg-surface-container rounded-2xl p-8 text-center border border-white/5">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-2 block">search_off</span>
            <p className="text-sm text-on-surface-variant">Nenhuma aposta encontrada</p>
          </div>
        ) : (
          filtered.map((bet) => <BetRow key={bet.id} bet={bet} expanded />)
        )}
      </div>
    </div>
  );
}

/* ─── SHARED COMPONENTS ─── */

function StatCard({ label, value, icon, color, bg }: { label: string; value: number; icon: string; color: string; bg: string }) {
  return (
    <div className="bg-surface-container rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-2`}>
        <span className={`material-symbols-outlined ${color} text-xl`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
      <span className={`text-xl font-headline font-black italic leading-none ${color}`}>{value}</span>
      <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest mt-1">{label}</p>
    </div>
  );
}

function BetRow({ bet, expanded }: { bet: { id: string; marketTitle: string; optionName: string; odds: number; amount: number; potentialWin?: number; status: string; createdAt: string }; expanded?: boolean }) {
  const cfg = {
    won: { color: "text-[#F5A623]", border: "border-[#F5A623]", bg: "bg-[#F5A623]/10", icon: "check_circle", label: "Ganho" },
    lost: { color: "text-red-400", border: "border-red-400", bg: "bg-red-400/10", icon: "cancel", label: "Perdido" },
    pending: { color: "text-[#5B9DFF]", border: "border-[#5B9DFF]", bg: "bg-[#5B9DFF]/10", icon: "schedule", label: "Pendente" },
  }[bet.status as "won" | "lost" | "pending"] || { color: "text-[#5B9DFF]", border: "border-[#5B9DFF]", bg: "bg-[#5B9DFF]/10", icon: "schedule", label: "Pendente" };

  return (
    <div className={`bg-surface-container rounded-2xl p-4 flex items-center justify-between border-l-4 ${cfg.border} border border-white/5`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-xl ${cfg.bg} shrink-0`}>
          <span className={`material-symbols-outlined ${cfg.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
        </div>
        <div className="min-w-0">
          <p className="font-headline font-bold text-sm truncate">{bet.marketTitle}</p>
          <p className="text-[10px] text-on-surface-variant font-medium">{bet.optionName} {bet.odds ? `- ${bet.odds}x` : ""}</p>
          {expanded && (
            <p className="text-[9px] text-on-surface-variant/50 mt-0.5">
              {new Date(bet.createdAt).toLocaleDateString("pt-BR")} as {new Date(bet.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className={`font-headline font-black text-sm italic ${cfg.color}`}>R$ {bet.amount.toFixed(2)}</p>
        <p className={`text-[9px] uppercase font-bold tracking-tighter ${cfg.color}`}>{cfg.label}</p>
        {expanded && bet.status === "won" && bet.potentialWin && (
          <p className="text-[9px] text-emerald-400 font-bold">+R$ {(bet.potentialWin - bet.amount).toFixed(2)}</p>
        )}
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, icon, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; icon: string; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mb-1 block">{label}</label>
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">{icon}</span>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full bg-surface-container-highest border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-[#F5A623]/40 focus:ring-1 focus:ring-[#F5A623]/20 transition-all" />
      </div>
    </div>
  );
}
