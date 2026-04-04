"use client";

import { useState, useEffect, useCallback } from "react";
import { getAdminSecret } from "@/lib/engines/admin-auth";

interface Affiliate {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  code: string;
  commission_percent: number;
  status: string;
  total_referrals: number;
  total_deposits: number;
  total_commission: number;
  total_paid: number;
  balance: number;
  notes: string;
  created_at: string;
}

interface Referral {
  id: string;
  affiliate_id: string;
  affiliate_code: string;
  user_id: string;
  user_name: string;
  user_email: string;
  status: string;
  first_deposit_amount: number;
  first_deposit_at: string | null;
  total_deposits: number;
  commission_generated: number;
  created_at: string;
}

interface Commission {
  id: string;
  affiliate_id: string;
  type: string;
  base_amount: number;
  commission_percent: number;
  commission_amount: number;
  description: string;
  created_at: string;
}

const inputCls = "w-full bg-white/[0.04] rounded-xl px-4 py-3 text-white/90 text-sm border border-white/[0.06] outline-none transition-all placeholder:text-white/20 focus:border-white/[0.14] focus:bg-white/[0.06] focus:ring-1 focus:ring-white/[0.08]";
const labelCls = "text-[11px] text-white/40 uppercase tracking-wider font-semibold block mb-1.5";

export default function AffiliatesPage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [selected, setSelected] = useState<Affiliate | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formCommission, setFormCommission] = useState("10");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch("/api/affiliates", { headers: { "x-admin-secret": getAdminSecret() } }); const d = await r.json(); if (Array.isArray(d)) setAffiliates(d); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openDetail = async (aff: Affiliate) => {
    setSelected(aff); setView("detail");
    try { const r = await fetch(`/api/affiliates?id=${aff.id}`, { headers: { "x-admin-secret": getAdminSecret() } }); const d = await r.json(); setReferrals(d.referrals || []); setCommissions(d.commissions || []); } catch {}
  };

  const handleCreate = async () => {
    setFormError("");
    if (!formName.trim()) { setFormError("Nome obrigatório"); return; }
    if (!formEmail.includes("@")) { setFormError("Email inválido"); return; }
    if (formCode.length < 3) { setFormError("Código mínimo 3 caracteres"); return; }
    setFormLoading(true);
    try {
      const r = await fetch("/api/affiliates", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-secret": getAdminSecret() }, body: JSON.stringify({ name: formName.trim(), email: formEmail.trim().toLowerCase(), code: formCode.toLowerCase().replace(/[^a-z0-9_-]/g, ""), commission_percent: parseFloat(formCommission) || 10, notes: formNotes }) });
      const d = await r.json();
      if (!r.ok) { setFormError(d.error || "Erro"); setFormLoading(false); return; }
      setFormName(""); setFormEmail(""); setFormCode(""); setFormCommission("10"); setFormNotes(""); setView("list"); fetchAll();
    } catch { setFormError("Erro de conexão"); }
    setFormLoading(false);
  };

  const toggleStatus = async (aff: Affiliate) => {
    const s = aff.status === "active" ? "paused" : "active";
    await fetch("/api/affiliates", { method: "PUT", headers: { "Content-Type": "application/json", "x-admin-secret": getAdminSecret() }, body: JSON.stringify({ id: aff.id, status: s }) });
    fetchAll();
    if (selected?.id === aff.id) setSelected({ ...aff, status: s });
  };

  const deleteAff = async (id: string) => {
    if (!confirm("Excluir este afiliado e todos os dados?")) return;
    await fetch(`/api/affiliates?id=${id}`, { method: "DELETE", headers: { "x-admin-secret": getAdminSecret() } });
    setView("list"); fetchAll();
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/criar-conta?ref=${code}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const totals = {
    refs: affiliates.reduce((s, a) => s + (a.total_referrals || 0), 0),
    deps: affiliates.reduce((s, a) => s + (Number(a.total_deposits) || 0), 0),
    comm: affiliates.reduce((s, a) => s + (Number(a.total_commission) || 0), 0),
    bal: affiliates.reduce((s, a) => s + (Number(a.balance) || 0), 0),
  };

  // ── LIST ──
  if (view === "list") return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-headline tracking-tight">Afiliados</h1>
          <p className="text-sm text-white/40 mt-1">Gerencie afiliados, links e comissões</p>
        </div>
        <button onClick={() => setView("create")} className="px-5 py-2.5 rounded-xl bg-[#80FF00] text-[#0a0a0a] font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-2">
          <span className="material-symbols-outlined text-base">add</span>Novo Afiliado
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Afiliados", value: affiliates.length, icon: "handshake" },
          { label: "Indicações", value: totals.refs, icon: "person_add" },
          { label: "Depósitos Ref.", value: `R$ ${totals.deps.toFixed(2)}`, icon: "payments" },
          { label: "Comissões", value: `R$ ${totals.comm.toFixed(2)}`, icon: "trending_up" },
          { label: "A Pagar", value: `R$ ${totals.bal.toFixed(2)}`, icon: "account_balance_wallet", hl: totals.bal > 0 },
        ].map((s) => (
          <div key={s.label} className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-white/20 text-lg">{s.icon}</span>
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">{s.label}</p>
            </div>
            <p className={`text-xl font-black ${s.hl ? "text-[#80FF00]" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12"><div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin mx-auto" /></div>
      ) : affiliates.length === 0 ? (
        <div className="text-center py-16 backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl">
          <span className="material-symbols-outlined text-5xl text-white/10 block mb-3">handshake</span>
          <p className="text-white/30 text-sm">Nenhum afiliado cadastrado</p>
          <button onClick={() => setView("create")} className="mt-4 text-[#80FF00] text-sm font-semibold hover:underline">Criar primeiro afiliado</button>
        </div>
      ) : (
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                  <th className="text-left text-[10px] text-white/30 uppercase tracking-wider font-semibold px-5 py-3">Afiliado</th>
                  <th className="text-left text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-3">Código</th>
                  <th className="text-center text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-3">Status</th>
                  <th className="text-center text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-3">Indicações</th>
                  <th className="text-right text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-3">Depósitos</th>
                  <th className="text-right text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-3">Comissão</th>
                  <th className="text-right text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-3">Saldo</th>
                  <th className="text-center text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map((a) => (
                  <tr key={a.id} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => openDetail(a)}>
                    <td className="px-5 py-3"><p className="text-sm font-semibold">{a.name}</p><p className="text-xs text-white/30">{a.email}</p></td>
                    <td className="px-3 py-3"><code className="text-xs font-mono text-[#80FF00] bg-[#80FF00]/10 px-2 py-1 rounded">{a.code}</code></td>
                    <td className="px-3 py-3 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>{a.status === "active" ? "Ativo" : "Pausado"}</span></td>
                    <td className="px-3 py-3 text-center text-sm font-bold">{a.total_referrals || 0}</td>
                    <td className="px-3 py-3 text-right text-sm font-mono">R$ {(Number(a.total_deposits) || 0).toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-sm font-mono text-emerald-400">R$ {(Number(a.total_commission) || 0).toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-sm font-mono font-bold text-[#80FF00]">R$ {(Number(a.balance) || 0).toFixed(2)}</td>
                    <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => copyLink(a.code)} className="text-white/30 hover:text-[#80FF00] transition-colors p-1" title="Copiar link">
                        <span className="material-symbols-outlined text-lg">link</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // ── CREATE ──
  if (view === "create") return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setView("list")} className="text-white/30 hover:text-white"><span className="material-symbols-outlined">arrow_back</span></button>
        <h1 className="text-2xl font-black font-headline tracking-tight">Novo Afiliado</h1>
      </div>
      <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <div><label className={labelCls}>Nome</label><input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: João Silva" className={inputCls} /></div>
        <div><label className={labelCls}>Email</label><input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="Ex: joao@email.com" className={inputCls} /></div>
        <div>
          <label className={labelCls}>Código de Indicação</label>
          <input type="text" value={formCode} onChange={(e) => setFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="Ex: joao123" className={inputCls + " font-mono"} />
          <p className="text-[10px] text-white/20 mt-1">Link: {typeof window !== "undefined" ? window.location.origin : ""}/criar-conta?ref={formCode || "codigo"}</p>
        </div>
        <div>
          <label className={labelCls}>Comissão (%)</label>
          <input type="number" value={formCommission} onChange={(e) => setFormCommission(e.target.value)} min="0" max="50" step="0.5" className={inputCls} />
          <p className="text-[10px] text-white/20 mt-1">% sobre cada depósito dos indicados</p>
        </div>
        <div><label className={labelCls}>Observações</label><textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Opcional..." className={inputCls + " h-20 resize-none"} /></div>
        {formError && <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2"><span className="material-symbols-outlined text-base">error</span>{formError}</div>}
        <div className="flex gap-3 pt-2">
          <button onClick={() => setView("list")} className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/50 hover:text-white text-sm">Cancelar</button>
          <button onClick={handleCreate} disabled={formLoading} className="flex-1 px-5 py-2.5 rounded-xl bg-[#80FF00] text-[#0a0a0a] font-semibold text-sm hover:opacity-90 disabled:opacity-50">{formLoading ? "Criando..." : "Criar Afiliado"}</button>
        </div>
      </div>
    </div>
  );

  // ── DETAIL ──
  if (view === "detail" && selected) {
    const a = selected;
    const link = typeof window !== "undefined" ? `${window.location.origin}/criar-conta?ref=${a.code}` : "";
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => { setView("list"); setReferrals([]); setCommissions([]); }} className="text-white/30 hover:text-white"><span className="material-symbols-outlined">arrow_back</span></button>
          <div className="flex-1"><h1 className="text-2xl font-black font-headline tracking-tight">{a.name}</h1><p className="text-sm text-white/40">{a.email} — Comissão: {a.commission_percent}%</p></div>
          <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${a.status === "active" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/15 text-amber-400 border border-amber-500/20"}`}>{a.status === "active" ? "Ativo" : "Pausado"}</span>
        </div>

        <div className="backdrop-blur-xl bg-[#80FF00]/[0.04] border border-[#80FF00]/20 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div><p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold mb-1">Link de Indicação</p><code className="text-sm text-[#80FF00] font-mono break-all">{link}</code></div>
          <button onClick={() => copyLink(a.code)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${copied ? "bg-emerald-500/20 text-emerald-400" : "bg-[#80FF00] text-[#0a0a0a]"}`}>{copied ? "Copiado!" : "Copiar"}</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { l: "Indicações", v: a.total_referrals || 0 },
            { l: "Depósitos", v: `R$ ${(Number(a.total_deposits) || 0).toFixed(2)}` },
            { l: "Comissão Total", v: `R$ ${(Number(a.total_commission) || 0).toFixed(2)}` },
            { l: "Já Pago", v: `R$ ${(Number(a.total_paid) || 0).toFixed(2)}` },
            { l: "Saldo a Pagar", v: `R$ ${(Number(a.balance) || 0).toFixed(2)}`, hl: true },
          ].map((s) => (
            <div key={s.l} className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">{s.l}</p>
              <p className={`text-lg font-black mt-1 ${s.hl ? "text-[#80FF00]" : ""}`}>{s.v}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => toggleStatus(a)} className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/50 hover:text-white text-sm">{a.status === "active" ? "Pausar" : "Ativar"}</button>
          <button onClick={() => deleteAff(a.id)} className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm">Excluir</button>
        </div>

        {/* Referrals */}
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]"><h3 className="text-sm font-bold">Usuários Indicados ({referrals.length})</h3></div>
          {referrals.length === 0 ? <div className="text-center py-8 text-white/30 text-sm">Nenhum indicado</div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead><tr className="bg-white/[0.02]">
                  <th className="text-left text-[10px] text-white/30 uppercase tracking-wider font-semibold px-5 py-2.5">Usuário</th>
                  <th className="text-center text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-2.5">Status</th>
                  <th className="text-right text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-2.5">1o Depósito</th>
                  <th className="text-right text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-2.5">Total Dep.</th>
                  <th className="text-right text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-2.5">Comissão</th>
                  <th className="text-right text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-2.5">Data</th>
                </tr></thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-t border-white/[0.04]">
                      <td className="px-5 py-3"><p className="text-sm font-medium">{r.user_name || "—"}</p><p className="text-xs text-white/30">{r.user_email}</p></td>
                      <td className="px-3 py-3 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === "deposited" ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.04] text-white/30"}`}>{r.status === "deposited" ? "Depositou" : "Cadastrado"}</span></td>
                      <td className="px-3 py-3 text-right text-sm font-mono">{r.first_deposit_amount ? `R$ ${Number(r.first_deposit_amount).toFixed(2)}` : "—"}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono">R$ {(Number(r.total_deposits) || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono text-emerald-400">R$ {(Number(r.commission_generated) || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-xs text-white/30">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Commissions */}
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]"><h3 className="text-sm font-bold">Comissões ({commissions.length})</h3></div>
          {commissions.length === 0 ? <div className="text-center py-8 text-white/30 text-sm">Nenhuma comissão</div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead><tr className="bg-white/[0.02]">
                  <th className="text-left text-[10px] text-white/30 uppercase tracking-wider font-semibold px-5 py-2.5">Descrição</th>
                  <th className="text-right text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-2.5">Base</th>
                  <th className="text-center text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-2.5">%</th>
                  <th className="text-right text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-2.5">Comissão</th>
                  <th className="text-right text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-2.5">Data</th>
                </tr></thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-t border-white/[0.04]">
                      <td className="px-5 py-3 text-sm text-white/70 max-w-[250px] truncate">{c.description}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono">R$ {Number(c.base_amount).toFixed(2)}</td>
                      <td className="px-3 py-3 text-center text-sm text-white/50">{c.commission_percent}%</td>
                      <td className="px-3 py-3 text-right text-sm font-mono text-[#80FF00] font-bold">R$ {Number(c.commission_amount).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-xs text-white/30">{new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
