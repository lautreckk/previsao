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

const inputCls = "w-full bg-[#0b1120] rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-[#00D4AA]/40 border border-white/5";
const labelCls = "text-[10px] text-[#8B95A8] uppercase tracking-wider font-bold block mb-1";

export default function AdminUsers() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userBets, setUserBets] = useState<Bet[]>([]);
  const [userLedger, setUserLedger] = useState<LedgerEntry[]>([]);
  const [search, setSearch] = useState("");

  // Edit states
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
    // Refresh user detail
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
    setSelectedUser(null);
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
      {toast && <div className="fixed top-4 right-4 z-[70] kinetic-gradient text-[#003D2E] px-6 py-3 rounded-xl font-bold text-sm animate-fade-in-up shadow-lg">{toast}</div>}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-headline font-black text-2xl tracking-tight">Gestao de Usuarios</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#8B95A8]">{users.length} usuarios</span>
          <button onClick={() => {
            const csv = ["Nome,Email,Telefone,Saldo,Apostas,Volume,PnL,Pendente,Criado em"];
            users.forEach((u) => csv.push(`"${u.name}","${u.email}","${u.phone}",${u.balance.toFixed(2)},${u.totalBets},${u.totalWagered.toFixed(2)},${u.pnl.toFixed(2)},${u.pendingExposure.toFixed(2)},"${u.createdAt !== "—" ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "—"}"`));
            const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `winify_leads_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
            showToast("CSV exportado!");
          }} className="bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/30 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#00D4AA]/20 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-base">download</span>Exportar CSV
          </button>
        </div>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, email, telefone ou ID..." className="bg-[#141d30] rounded-xl px-4 py-2 text-sm text-white border border-white/5 outline-none w-full max-w-md" />

      {/* USER DETAIL MODAL */}
      {selectedUser && selectedUserData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-[#0f1729] rounded-2xl w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex justify-between items-center sticky top-0 bg-[#0f1729] z-10">
              <div>
                <h3 className="font-headline font-bold text-lg">{selectedUserData.name}</h3>
                <p className="text-xs text-[#8B95A8]">{selectedUserData.email} | ID: {selectedUserData.id.slice(0, 16)}...</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-[#8B95A8] hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>

            <div className="p-5 space-y-5">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#141d30] rounded-xl p-3 text-center"><p className={labelCls}>Saldo</p><p className="font-headline font-black text-lg text-[#00D4AA]">R$ {selectedUserData.balance.toFixed(2)}</p></div>
                <div className="bg-[#141d30] rounded-xl p-3 text-center"><p className={labelCls}>Apostas</p><p className="font-headline font-black text-lg">{selectedUserData.totalBets}</p></div>
                <div className="bg-[#141d30] rounded-xl p-3 text-center"><p className={labelCls}>Volume</p><p className="font-headline font-black text-lg">R$ {selectedUserData.totalWagered.toFixed(0)}</p></div>
                <div className="bg-[#141d30] rounded-xl p-3 text-center"><p className={labelCls}>PnL</p><p className={`font-headline font-black text-lg ${selectedUserData.pnl >= 0 ? "text-[#00D4AA]" : "text-[#FF6B5A]"}`}>{selectedUserData.pnl >= 0 ? "+" : ""}R$ {selectedUserData.pnl.toFixed(2)}</p></div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setEditMode(editMode === "edit_balance" ? "view" : "edit_balance")} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${editMode === "edit_balance" ? "kinetic-gradient text-[#003D2E]" : "bg-[#141d30] text-[#00D4AA] border border-[#00D4AA]/30"}`}>
                  <span className="material-symbols-outlined text-sm">payments</span>Gerenciar Saldo
                </button>
                <button onClick={() => setEditMode(editMode === "edit_info" ? "view" : "edit_info")} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${editMode === "edit_info" ? "kinetic-gradient text-[#003D2E]" : "bg-[#141d30] text-[#5B9DFF] border border-[#5B9DFF]/30"}`}>
                  <span className="material-symbols-outlined text-sm">edit</span>Editar Dados
                </button>
                <button onClick={handleDeleteUser} className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 bg-[#141d30] text-[#FF6B5A] border border-[#FF6B5A]/30">
                  <span className="material-symbols-outlined text-sm">delete</span>Excluir
                </button>
              </div>

              {/* BALANCE MANAGEMENT */}
              {editMode === "edit_balance" && (
                <div className="bg-[#0b1120] rounded-2xl p-5 border border-[#00D4AA]/20 space-y-4 animate-fade-in-up">
                  <h4 className="font-headline font-bold text-sm uppercase tracking-wider text-[#00D4AA] flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">account_balance_wallet</span>Gerenciar Saldo
                  </h4>
                  <p className="text-xs text-[#8B95A8]">Saldo atual: <span className="text-[#00D4AA] font-black text-base">R$ {selectedUserData.balance.toFixed(2)}</span></p>

                  {/* Quick actions */}
                  <div>
                    <p className={labelCls}>Ajuste rapido</p>
                    <div className="flex gap-2 flex-wrap">
                      {[10, 50, 100, 500, 1000, 5000].map((v) => (
                        <button key={v} onClick={async () => { await adminAddBalance(selectedUser, v); saveLedgerEntry({ id: `ldg_q_${Date.now()}`, user_id: selectedUser, type: "admin_adjustment", amount: v, balance_after: selectedUserData.balance + v, description: `Quick +R$ ${v}`, created_at: Date.now(), created_by: "admin" }); showToast(`+R$ ${v} adicionado`); refresh(); setUserLedger(getLedger().filter((l) => l.user_id === selectedUser)); }}
                          className="px-3 py-2 rounded-lg bg-[#00D4AA]/10 text-[#00D4AA] text-xs font-bold border border-[#00D4AA]/20 hover:bg-[#00D4AA]/20 active:scale-95 transition-all">+R$ {v}</button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <p className={labelCls}>Acao</p>
                      <select value={balanceAction} onChange={(e) => setBalanceAction(e.target.value as "set" | "add" | "subtract")} className={inputCls}>
                        <option value="add">Adicionar saldo</option>
                        <option value="subtract">Remover saldo</option>
                        <option value="set">Definir saldo exato</option>
                      </select>
                    </div>
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
                    <div className="bg-[#141d30] rounded-xl p-3 flex justify-between items-center">
                      <span className="text-xs text-[#8B95A8]">Novo saldo sera:</span>
                      <span className="font-headline font-black text-[#FFB800]">
                        R$ {(balanceAction === "set" ? parseFloat(balanceAmount) : balanceAction === "add" ? selectedUserData.balance + parseFloat(balanceAmount) : Math.max(0, selectedUserData.balance - parseFloat(balanceAmount))).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <button onClick={handleBalanceChange} disabled={!balanceAmount || parseFloat(balanceAmount) <= 0} className="w-full py-3 rounded-xl kinetic-gradient text-[#003D2E] font-black text-sm uppercase disabled:opacity-40 active:scale-95 transition-all">
                    Confirmar Alteracao de Saldo
                  </button>
                </div>
              )}

              {/* EDIT USER INFO */}
              {editMode === "edit_info" && (
                <div className="bg-[#0b1120] rounded-2xl p-5 border border-[#5B9DFF]/20 space-y-4 animate-fade-in-up">
                  <h4 className="font-headline font-bold text-sm uppercase tracking-wider text-[#5B9DFF] flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">person</span>Editar Dados do Usuario
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><p className={labelCls}>Nome</p><input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} /></div>
                    <div><p className={labelCls}>Email</p><input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className={inputCls} /></div>
                    <div><p className={labelCls}>CPF</p><input value={editCpf} onChange={(e) => setEditCpf(e.target.value)} className={inputCls} /></div>
                    <div>
                      <p className={labelCls}>Senha atual</p>
                      <div className="relative">
                        <input type={showPassword ? "text" : "password"} value={currentPassword} readOnly className={inputCls + " pr-10 text-[#8B95A8]"} />
                        <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B95A8]">
                          <span className="material-symbols-outlined text-sm">{showPassword ? "visibility_off" : "visibility"}</span>
                        </button>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <p className={labelCls}>Nova senha (deixe vazio para manter a atual)</p>
                      <input type="text" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Min 6 caracteres" className={inputCls} />
                    </div>
                  </div>

                  <button onClick={handleSaveInfo} className="w-full py-3 rounded-xl bg-[#5B9DFF] text-white font-black text-sm uppercase active:scale-95 transition-all">
                    Salvar Alteracoes
                  </button>
                </div>
              )}

              {/* BETS */}
              <div>
                <h4 className="text-xs font-bold text-[#8B95A8] uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">confirmation_number</span>Apostas ({userBets.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {userBets.length === 0 ? <p className="text-sm text-[#8B95A8] text-center py-4">Nenhuma aposta</p> :
                  userBets.map((b) => (
                    <div key={b.id} className="bg-[#141d30] rounded-xl p-3 flex justify-between items-center">
                      <div><p className="text-xs font-bold">{b.outcome_label}</p><p className="text-[10px] text-[#8B95A8]">{b.outcome_key} - {new Date(b.created_at).toLocaleString("pt-BR")}</p></div>
                      <div className="text-right"><p className="text-sm font-bold">R$ {b.amount.toFixed(2)}</p><span className={`text-[10px] font-bold ${b.status === "won" ? "text-[#00D4AA]" : b.status === "lost" ? "text-[#FF6B5A]" : "text-[#FFB800]"}`}>{b.status}</span></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* LEDGER */}
              <div>
                <h4 className="text-xs font-bold text-[#8B95A8] uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">receipt_long</span>Ledger ({userLedger.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {userLedger.length === 0 ? <p className="text-sm text-[#8B95A8] text-center py-4">Nenhuma entrada</p> :
                  [...userLedger].reverse().map((l) => (
                    <div key={l.id} className={`bg-[#141d30] rounded-xl p-3 flex justify-between items-center ${l.type === "admin_adjustment" ? "border-l-4 border-[#FFB800]" : ""}`}>
                      <div>
                        <p className="text-xs font-bold">{l.description}</p>
                        <p className="text-[10px] text-[#8B95A8]">{l.type} {l.created_by === "admin" ? "| ADMIN" : ""} | {new Date(l.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                      <p className={`text-sm font-bold ${l.amount >= 0 ? "text-[#00D4AA]" : "text-[#FF6B5A]"}`}>{l.amount >= 0 ? "+" : ""}R$ {l.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USERS TABLE */}
      <div className="bg-[#0f1729] rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-[#8B95A8]">
                <th className="text-left p-3">Usuario</th>
                <th className="text-right p-3">Saldo</th>
                <th className="text-right p-3">Apostas</th>
                <th className="text-right p-3">Volume</th>
                <th className="text-right p-3">PnL</th>
                <th className="text-left p-3">Criado</th>
                <th className="text-center p-3">Acoes Rapidas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-[#8B95A8]">Nenhum usuario encontrado</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 cursor-pointer" onClick={() => handleSelectUser(u.id)}>
                    <p className="font-bold text-xs">{u.name}</p>
                    <p className="text-[10px] text-[#8B95A8]">{u.email}</p>
                  </td>
                  <td className="p-3 text-right font-mono text-[#00D4AA] font-bold cursor-pointer" onClick={() => handleSelectUser(u.id)}>R$ {u.balance.toFixed(2)}</td>
                  <td className="p-3 text-right cursor-pointer" onClick={() => handleSelectUser(u.id)}>{u.totalBets}</td>
                  <td className="p-3 text-right font-mono cursor-pointer" onClick={() => handleSelectUser(u.id)}>R$ {u.totalWagered.toFixed(0)}</td>
                  <td className={`p-3 text-right font-mono font-bold cursor-pointer ${u.pnl >= 0 ? "text-[#00D4AA]" : "text-[#FF6B5A]"}`} onClick={() => handleSelectUser(u.id)}>{u.pnl >= 0 ? "+" : ""}R$ {u.pnl.toFixed(2)}</td>
                  <td className="p-3 text-left text-[10px] text-[#8B95A8] cursor-pointer" onClick={() => handleSelectUser(u.id)}>{u.createdAt !== "—" ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={(e) => handleQuickBalance(u.id, 100, e)} className="text-[10px] font-bold text-[#00D4AA] bg-[#00D4AA]/10 px-2 py-1 rounded hover:bg-[#00D4AA]/20 active:scale-95">+100</button>
                      <button onClick={(e) => handleQuickBalance(u.id, 1000, e)} className="text-[10px] font-bold text-[#00D4AA] bg-[#00D4AA]/10 px-2 py-1 rounded hover:bg-[#00D4AA]/20 active:scale-95">+1k</button>
                      <button onClick={(e) => { e.stopPropagation(); handleSelectUser(u.id); setEditMode("edit_balance"); }} className="text-[10px] font-bold text-[#5B9DFF] bg-[#5B9DFF]/10 px-2 py-1 rounded hover:bg-[#5B9DFF]/20 active:scale-95">Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
