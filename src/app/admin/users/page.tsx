"use client";

import { useEffect, useState } from "react";
import { getBets, getLedger, initializeStore, saveLedgerEntry } from "@/lib/engines/store";
import { getAllRegisteredUsers, getAllRegisteredUsersAsync, adminSetBalance, adminAddBalance, adminUpdateUser, adminGetUserPassword, adminDeleteUser } from "@/lib/UserContext";
import type { Bet, LedgerEntry } from "@/lib/engines/types";

interface UserSummary {
  id: string; name: string; email: string; phone: string; balance: number; createdAt: string;
  totalBets: number; totalWagered: number; totalWon: number;
  totalLost: number; pnl: number; pendingBets: number; pendingExposure: number;
}

const inputCls = "w-full bg-[#0A0910] rounded-xl px-4 py-3 text-white/90 text-sm outline-none border border-white/[0.06] focus:border-white/[0.12] focus:ring-1 focus:ring-white/[0.06] transition-all placeholder:text-white/20";
const labelCls = "text-[11px] text-white/40 font-medium block mb-1.5";

export default function AdminUsers() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userBets, setUserBets] = useState<Bet[]>([]);
  const [userLedger, setUserLedger] = useState<LedgerEntry[]>([]);
  const [search, setSearch] = useState("");

  const [editMode, setEditMode] = useState<"view" | "edit_info" | "edit_balance" | "quick_balance">("view");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [balanceAction, setBalanceAction] = useState<"set" | "add" | "subtract">("add");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceReason, setBalanceReason] = useState("");
  const [toast, setToast] = useState("");
  const [modalVisible, setModalVisible] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const refresh = async () => {
    initializeStore();
    const registeredUsers = await getAllRegisteredUsersAsync();
    const bets = getBets();

    const betStats: Record<string, { totalBets: number; totalWagered: number; totalWon: number; totalLost: number; pnl: number; pendingBets: number; pendingExposure: number }> = {};
    bets.forEach((b) => {
      if (!betStats[b.user_id]) betStats[b.user_id] = { totalBets: 0, totalWagered: 0, totalWon: 0, totalLost: 0, pnl: 0, pendingBets: 0, pendingExposure: 0 };
      const s = betStats[b.user_id];
      s.totalBets++; s.totalWagered += b.amount;
      if (b.status === "won") { s.totalWon += b.final_payout; s.pnl += b.final_payout - b.amount; }
      if (b.status === "lost") { s.totalLost += b.amount; s.pnl -= b.amount; }
      if (b.status === "pending") { s.pendingBets++; s.pendingExposure += b.amount; }
    });

    const allUsers: UserSummary[] = registeredUsers.map((u) => {
      const stats = betStats[u.id] || { totalBets: 0, totalWagered: 0, totalWon: 0, totalLost: 0, pnl: 0, pendingBets: 0, pendingExposure: 0 };
      return { id: u.id, name: u.name, email: u.email, phone: (u as Record<string,unknown>).phone as string || "", balance: u.balance, createdAt: u.createdAt, ...stats };
    });

    const registeredIds = new Set(registeredUsers.map((u) => u.id));
    Object.entries(betStats).forEach(([userId, stats]) => {
      if (!registeredIds.has(userId)) allUsers.push({ id: userId, name: userId.slice(0, 16), email: "—", phone: "", balance: 0, createdAt: "—", ...stats });
    });

    setUsers(allUsers.sort((a, b) => {
      if (a.totalBets !== b.totalBets) return b.totalBets - a.totalBets;
      return (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0);
    }));
  };

  useEffect(() => { refresh(); }, []);

  const handleSelectUser = async (userId: string) => {
    setSelectedUser(userId);
    setEditMode("view");
    setUserBets(getBets().filter((b) => b.user_id === userId));
    setUserLedger(getLedger().filter((l) => l.user_id === userId));
    const cached = await getAllRegisteredUsersAsync();
    const u = cached.find((x) => x.id === userId);
    if (u) {
      setEditName(u.name); setEditEmail(u.email); setEditCpf(u.cpf);
      const pw = await adminGetUserPassword(userId);
      setCurrentPassword(pw || "");
    }
    setEditPassword(""); setBalanceAmount(""); setBalanceReason(""); setShowPassword(false);
    // Trigger animation
    requestAnimationFrame(() => setModalVisible(true));
  };

  const closeModal = () => {
    setModalVisible(false);
    setTimeout(() => setSelectedUser(null), 300);
  };

  const handleSaveInfo = async () => {
    if (!selectedUser) return;
    const data: { name?: string; email?: string; cpf?: string; password?: string } = {};
    if (editName) data.name = editName;
    if (editEmail) data.email = editEmail;
    if (editCpf) data.cpf = editCpf;
    if (editPassword && editPassword.length >= 6) data.password = editPassword;
    await adminUpdateUser(selectedUser, data);
    showToast("Dados atualizados com sucesso");
    setEditMode("view");
    refresh();
  };

  const handleBalanceChange = async () => {
    if (!selectedUser || !balanceAmount) return;
    const amt = parseFloat(balanceAmount);
    if (isNaN(amt) || amt <= 0) return;

    const user = users.find((u) => u.id === selectedUser);
    if (!user) return;

    let newBalance = user.balance;
    let ledgerAmount = 0;
    let description = balanceReason || "Ajuste admin";

    if (balanceAction === "set") {
      newBalance = amt;
      ledgerAmount = amt - user.balance;
      description = `Saldo definido para R$ ${amt.toFixed(2)} - ${description}`;
      await adminSetBalance(selectedUser, amt);
    } else if (balanceAction === "add") {
      newBalance = user.balance + amt;
      ledgerAmount = amt;
      description = `Credito: +R$ ${amt.toFixed(2)} - ${description}`;
      await adminAddBalance(selectedUser, amt);
    } else {
      newBalance = Math.max(0, user.balance - amt);
      ledgerAmount = -Math.min(amt, user.balance);
      description = `Debito: -R$ ${amt.toFixed(2)} - ${description}`;
      await adminAddBalance(selectedUser, -Math.min(amt, user.balance));
    }

    saveLedgerEntry({
      id: `ldg_admin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id: selectedUser,
      type: "admin_adjustment",
      amount: ledgerAmount,
      balance_after: newBalance,
      description,
      created_at: Date.now(),
      created_by: "admin",
    });

    showToast(`Saldo atualizado: R$ ${newBalance.toFixed(2)}`);
    setBalanceAmount(""); setBalanceReason("");
    setEditMode("view");
    refresh();
    setUserLedger(getLedger().filter((l) => l.user_id === selectedUser));
  };

  const handleQuickBalance = async (userId: string, amount: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await adminAddBalance(userId, amount);
    saveLedgerEntry({
      id: `ldg_admin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id: userId, type: "admin_adjustment", amount, balance_after: 0,
      description: `Quick adjust: ${amount >= 0 ? "+" : ""}R$ ${amount.toFixed(2)}`,
      created_at: Date.now(), created_by: "admin",
    });
    showToast(`${amount >= 0 ? "+" : ""}R$ ${amount.toFixed(2)} aplicado`);
    refresh();
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!confirm("Tem certeza que deseja excluir este usuario?")) return;
    await adminDeleteUser(selectedUser);
    closeModal();
    showToast("Usuario excluido");
    refresh();
  };

  const filtered = search
    ? users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search) || u.id.includes(search))
    : users;

  const selectedUserData = users.find((u) => u.id === selectedUser);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] bg-white/[0.08] backdrop-blur-2xl text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-2xl border border-white/[0.06] animate-fade-in-up">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full bg-[#10b981]/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            {toast}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Usuarios</h2>
          <p className="text-sm text-white/40 mt-0.5">{users.length} usuarios registrados</p>
        </div>
        <button onClick={() => {
          const csv = ["Nome,Email,Telefone,Saldo,Apostas,Volume,PnL,Pendente,Criado em"];
          users.forEach((u) => csv.push(`"${u.name}","${u.email}","${u.phone}",${u.balance.toFixed(2)},${u.totalBets},${u.totalWagered.toFixed(2)},${u.pnl.toFixed(2)},${u.pendingExposure.toFixed(2)},"${u.createdAt !== "—" ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "—"}"`));
          const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = `winify_leads_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
          showToast("CSV exportado!");
        }} className="h-9 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/70 hover:text-white text-sm font-medium flex items-center gap-2 border border-white/[0.06] transition-all active:scale-[0.97]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          Exportar CSV
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" /></svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, email, telefone ou ID..."
          className="w-full bg-[#12101A] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white/80 border border-white/[0.06] outline-none focus:border-white/[0.12] focus:ring-1 focus:ring-white/[0.06] transition-all placeholder:text-white/20"
        />
      </div>

      {/* USER DETAIL MODAL / SHEET */}
      {selectedUser && selectedUserData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeModal}>
          {/* Backdrop */}
          <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${modalVisible ? "opacity-100" : "opacity-0"}`} />

          {/* Desktop: centered modal, Mobile: right sheet */}
          <div
            className={`
              relative z-10 bg-[#12101A] w-full max-h-[100dvh] overflow-y-auto overscroll-contain
              border-white/[0.06]
              /* Mobile: full-height sheet from right */
              fixed right-0 top-0 bottom-0 max-w-full border-l
              sm:static sm:rounded-2xl sm:border sm:max-w-2xl sm:max-h-[90vh] sm:border-l-0
              transition-all duration-300 ease-out
              ${modalVisible
                ? "translate-x-0 sm:translate-x-0 sm:scale-100 opacity-100"
                : "translate-x-full sm:translate-x-0 sm:scale-95 opacity-0"
              }
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar (mobile) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/10" />
            </div>

            {/* Header */}
            <div className="px-5 py-4 border-b border-white/[0.06] flex justify-between items-center sticky top-0 bg-[#12101A]/95 backdrop-blur-xl z-10">
              <div className="min-w-0">
                <h3 className="font-semibold text-[17px] text-white truncate">{selectedUserData.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-white/35 truncate">{selectedUserData.email} -- {selectedUserData.id.slice(0, 12)}...</p>
                  {selectedUserData.phone && (
                    <a
                      href={`https://wa.me/55${selectedUserData.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#25D366]/15 hover:bg-[#25D366]/25 transition-all active:scale-[0.95] flex-shrink-0"
                      title="Abrir WhatsApp"
                    >
                      <svg className="w-3 h-3 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      <span className="text-[10px] font-semibold text-[#25D366]">WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center flex-shrink-0 transition-colors ml-3">
                <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: "Saldo", value: `R$ ${selectedUserData.balance.toFixed(2)}`, color: "text-[#10b981]" },
                  { label: "Apostas", value: `${selectedUserData.totalBets}`, color: "text-white" },
                  { label: "Volume", value: `R$ ${selectedUserData.totalWagered.toFixed(0)}`, color: "text-white" },
                  { label: "PnL", value: `${selectedUserData.pnl >= 0 ? "+" : ""}R$ ${selectedUserData.pnl.toFixed(2)}`, color: selectedUserData.pnl >= 0 ? "text-[#10b981]" : "text-[#ef4444]" },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-[#0A0910] rounded-xl p-3.5">
                    <p className="text-[11px] text-white/30 font-medium">{kpi.label}</p>
                    <p className={`text-base font-semibold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setEditMode(editMode === "edit_balance" ? "view" : "edit_balance")}
                  className={`h-9 px-4 rounded-xl text-sm font-medium flex items-center gap-2 transition-all active:scale-[0.97] ${
                    editMode === "edit_balance"
                      ? "bg-[#10b981] text-white shadow-lg shadow-[#10b981]/20"
                      : "bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/15"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
                  Saldo
                </button>
                <button
                  onClick={() => setEditMode(editMode === "edit_info" ? "view" : "edit_info")}
                  className={`h-9 px-4 rounded-xl text-sm font-medium flex items-center gap-2 transition-all active:scale-[0.97] ${
                    editMode === "edit_info"
                      ? "bg-[#3b82f6] text-white shadow-lg shadow-[#3b82f6]/20"
                      : "bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/15"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                  Editar
                </button>
                <button
                  onClick={handleDeleteUser}
                  className="h-9 px-4 rounded-xl text-sm font-medium flex items-center gap-2 bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/15 transition-all active:scale-[0.97]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  Excluir
                </button>
              </div>

              {/* BALANCE MANAGEMENT */}
              {editMode === "edit_balance" && (
                <div className="bg-[#0A0910] rounded-2xl p-5 border border-[#10b981]/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white/80">Gerenciar Saldo</h4>
                    <span className="text-sm font-semibold text-[#10b981]">R$ {selectedUserData.balance.toFixed(2)}</span>
                  </div>

                  {/* Quick balance pills */}
                  <div>
                    <p className={labelCls}>Ajuste rapido</p>
                    <div className="flex gap-2 flex-wrap">
                      {[10, 50, 100, 500, 1000, 5000].map((v) => (
                        <button key={v} onClick={async () => { await adminAddBalance(selectedUser, v); saveLedgerEntry({ id: `ldg_q_${Date.now()}`, user_id: selectedUser, type: "admin_adjustment", amount: v, balance_after: selectedUserData.balance + v, description: `Quick +R$ ${v}`, created_at: Date.now(), created_by: "admin" }); showToast(`+R$ ${v} adicionado`); refresh(); setUserLedger(getLedger().filter((l) => l.user_id === selectedUser)); }}
                          className="h-8 px-3.5 rounded-full bg-[#10b981]/10 text-[#10b981] text-xs font-semibold hover:bg-[#10b981]/20 active:scale-[0.95] transition-all">
                          +R$ {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Segmented control for action */}
                  <div>
                    <p className={labelCls}>Acao</p>
                    <div className="flex bg-[#12101A] rounded-xl p-1 border border-white/[0.06]">
                      {([
                        { key: "add" as const, label: "Adicionar" },
                        { key: "subtract" as const, label: "Remover" },
                        { key: "set" as const, label: "Definir" },
                      ]).map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => setBalanceAction(opt.key)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                            balanceAction === opt.key
                              ? "bg-white/[0.08] text-white shadow-sm"
                              : "text-white/35 hover:text-white/50"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className={labelCls}>Valor (R$)</p>
                      <input type="number" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" className={inputCls} />
                    </div>
                    <div>
                      <p className={labelCls}>Motivo</p>
                      <input value={balanceReason} onChange={(e) => setBalanceReason(e.target.value)} placeholder="Ex: Bonus, Correcao..." className={inputCls} />
                    </div>
                  </div>

                  {balanceAmount && parseFloat(balanceAmount) > 0 && (
                    <div className="bg-[#12101A] rounded-xl p-3.5 flex justify-between items-center border border-white/[0.06]">
                      <span className="text-xs text-white/35">Novo saldo:</span>
                      <span className="font-semibold text-[#f59e0b]">
                        R$ {(balanceAction === "set" ? parseFloat(balanceAmount) : balanceAction === "add" ? selectedUserData.balance + parseFloat(balanceAmount) : Math.max(0, selectedUserData.balance - parseFloat(balanceAmount))).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <button onClick={handleBalanceChange} disabled={!balanceAmount || parseFloat(balanceAmount) <= 0} className="w-full h-11 rounded-xl bg-[#10b981] text-white font-semibold text-sm disabled:opacity-30 active:scale-[0.98] transition-all hover:bg-[#10b981]/90">
                    Confirmar Alteracao
                  </button>
                </div>
              )}

              {/* EDIT USER INFO */}
              {editMode === "edit_info" && (
                <div className="bg-[#0A0910] rounded-2xl p-5 border border-[#3b82f6]/10 space-y-4">
                  <h4 className="text-sm font-semibold text-white/80">Editar Dados</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><p className={labelCls}>Nome</p><input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} /></div>
                    <div><p className={labelCls}>Email</p><input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className={inputCls} /></div>
                    <div><p className={labelCls}>CPF</p><input value={editCpf} onChange={(e) => setEditCpf(e.target.value)} className={inputCls} /></div>
                    <div>
                      <p className={labelCls}>Senha atual</p>
                      <div className="relative">
                        <input type={showPassword ? "text" : "password"} value={currentPassword} readOnly className={inputCls + " pr-10 text-white/35"} />
                        <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50 transition-colors">
                          {showPassword ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <p className={labelCls}>Nova senha (deixe vazio para manter a atual)</p>
                      <input type="text" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Min 6 caracteres" className={inputCls} />
                    </div>
                  </div>

                  <button onClick={handleSaveInfo} className="w-full h-11 rounded-xl bg-[#3b82f6] text-white font-semibold text-sm active:scale-[0.98] transition-all hover:bg-[#3b82f6]/90">
                    Salvar Alteracoes
                  </button>
                </div>
              )}

              {/* BETS */}
              <div>
                <h4 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>
                  Apostas ({userBets.length})
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {userBets.length === 0 ? <p className="text-sm text-white/25 text-center py-6">Nenhuma aposta</p> :
                  userBets.map((b) => (
                    <div key={b.id} className="bg-[#0A0910] rounded-xl p-3 flex justify-between items-center border border-white/[0.04]">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white/80 truncate">{b.outcome_label}</p>
                        <p className="text-[11px] text-white/25 mt-0.5">{b.outcome_key} -- {new Date(b.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-semibold text-white/80">R$ {b.amount.toFixed(2)}</p>
                        <span className={`text-[11px] font-semibold ${b.status === "won" ? "text-[#10b981]" : b.status === "lost" ? "text-[#ef4444]" : "text-[#f59e0b]"}`}>{b.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* LEDGER */}
              <div>
                <h4 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  Ledger ({userLedger.length})
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {userLedger.length === 0 ? <p className="text-sm text-white/25 text-center py-6">Nenhuma entrada</p> :
                  [...userLedger].reverse().map((l) => (
                    <div key={l.id} className={`bg-[#0A0910] rounded-xl p-3 flex justify-between items-center border border-white/[0.04] ${l.type === "admin_adjustment" ? "border-l-2 border-l-[#f59e0b]/50" : ""}`}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white/80 truncate">{l.description}</p>
                        <p className="text-[11px] text-white/25 mt-0.5">{l.type} {l.created_by === "admin" ? "-- ADMIN" : ""} -- {new Date(l.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                      <p className={`text-sm font-semibold flex-shrink-0 ml-3 ${l.amount >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>{l.amount >= 0 ? "+" : ""}R$ {l.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USERS TABLE (Desktop) */}
      <div className="hidden sm:block bg-[#12101A] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Usuario", "Saldo", "Apostas", "Volume", "PnL", "Criado", "Acoes"].map((h, i) => (
                  <th key={h} className={`${i === 0 ? "text-left" : i === 6 ? "text-center" : "text-right"} px-4 py-3 text-[11px] text-white/30 font-medium uppercase tracking-wider`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-white/25 text-sm">Nenhum usuario encontrado</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group" onClick={() => handleSelectUser(u.id)}>
                  <td className="px-4 py-3.5">
                    <p className="text-[13px] font-medium text-white/80 group-hover:text-white transition-colors">{u.name}</p>
                    <p className="text-[11px] text-white/25 mt-0.5">{u.email}</p>
                    {u.phone && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-white/25">{u.phone}</span>
                        <a
                          href={`https://wa.me/55${u.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#25D366]/15 hover:bg-[#25D366]/25 transition-all active:scale-[0.9]"
                          title="Abrir WhatsApp"
                        >
                          <svg className="w-3 h-3 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-[#10b981] font-semibold text-[13px]">R$ {u.balance.toFixed(2)}</td>
                  <td className="px-4 py-3.5 text-right text-white/60 text-[13px]">{u.totalBets}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-white/50 text-[13px]">R$ {u.totalWagered.toFixed(0)}</td>
                  <td className={`px-4 py-3.5 text-right font-mono font-semibold text-[13px] ${u.pnl >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>{u.pnl >= 0 ? "+" : ""}R$ {u.pnl.toFixed(2)}</td>
                  <td className="px-4 py-3.5 text-right text-[11px] text-white/25">{u.createdAt !== "—" ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => handleQuickBalance(u.id, 100, e)} className="h-7 px-2.5 rounded-full bg-[#10b981]/8 text-[10px] font-semibold text-[#10b981] hover:bg-[#10b981]/15 active:scale-[0.95] transition-all">+100</button>
                      <button onClick={(e) => handleQuickBalance(u.id, 1000, e)} className="h-7 px-2.5 rounded-full bg-[#10b981]/8 text-[10px] font-semibold text-[#10b981] hover:bg-[#10b981]/15 active:scale-[0.95] transition-all">+1k</button>
                      <button onClick={(e) => { e.stopPropagation(); handleSelectUser(u.id).then(() => setEditMode("edit_balance")); }} className="h-7 px-2.5 rounded-full bg-[#3b82f6]/8 text-[10px] font-semibold text-[#3b82f6] hover:bg-[#3b82f6]/15 active:scale-[0.95] transition-all">Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* USERS CARDS (Mobile) */}
      <div className="sm:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="bg-[#12101A] rounded-2xl border border-white/[0.06] p-8 text-center text-white/25 text-sm">Nenhum usuario encontrado</div>
        ) : filtered.map((u) => (
          <div
            key={u.id}
            onClick={() => handleSelectUser(u.id)}
            className="bg-[#12101A] rounded-2xl border border-white/[0.06] p-4 active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-white/90 truncate">{u.name}</p>
                <p className="text-[12px] text-white/25 mt-0.5 truncate">{u.email}</p>
                {u.phone && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-white/25">{u.phone}</span>
                    <a
                      href={`https://wa.me/55${u.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#25D366]/15 hover:bg-[#25D366]/25 transition-all active:scale-[0.9]"
                      title="Abrir WhatsApp"
                    >
                      <svg className="w-3 h-3 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </a>
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className="text-[15px] font-semibold text-[#10b981]">R$ {u.balance.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-white/35 mb-3">
              <span>{u.totalBets} apostas</span>
              <span className="w-px h-3 bg-white/10" />
              <span>R$ {u.totalWagered.toFixed(0)} vol</span>
              <span className="w-px h-3 bg-white/10" />
              <span className={u.pnl >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}>{u.pnl >= 0 ? "+" : ""}R$ {u.pnl.toFixed(2)}</span>
            </div>

            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button onClick={(e) => handleQuickBalance(u.id, 100, e)} className="h-7 px-3 rounded-full bg-[#10b981]/8 text-[11px] font-semibold text-[#10b981] active:scale-[0.95] transition-all">+100</button>
              <button onClick={(e) => handleQuickBalance(u.id, 1000, e)} className="h-7 px-3 rounded-full bg-[#10b981]/8 text-[11px] font-semibold text-[#10b981] active:scale-[0.95] transition-all">+1k</button>
              <button onClick={(e) => { e.stopPropagation(); handleSelectUser(u.id).then(() => setEditMode("edit_balance")); }} className="h-7 px-3 rounded-full bg-[#3b82f6]/8 text-[11px] font-semibold text-[#3b82f6] active:scale-[0.95] transition-all">Editar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
