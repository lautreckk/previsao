"use client";

import { useEffect, useState } from "react";
import { getAffiliates, saveAffiliate, initializeStore } from "@/lib/engines/store";
import type { Affiliate, AffiliateModel } from "@/lib/engines/types";

export default function AdminAffiliates() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", model: "revshare" as AffiliateModel, cpa: "50", revshare: "25" });

  const refresh = () => setAffiliates(getAffiliates());
  useEffect(() => { initializeStore(); refresh(); }, []);

  const handleCreate = () => {
    const code = form.name.toLowerCase().replace(/\s+/g, "").slice(0, 8) + Math.random().toString(36).slice(2, 6);
    const aff: Affiliate = {
      id: `aff_${Date.now()}`, name: form.name, email: form.email, code,
      model: form.model, cpa_value: parseFloat(form.cpa), revshare_percent: parseFloat(form.revshare) / 100,
      is_active: true, created_at: Date.now(),
      total_clicks: 0, total_signups: 0, total_ftd: 0, total_volume: 0, total_commission: 0,
    };
    saveAffiliate(aff);
    setShowCreate(false);
    setForm({ name: "", email: "", model: "revshare", cpa: "50", revshare: "25" });
    refresh();
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <h2 className="font-headline font-black text-2xl tracking-tight">Afiliados</h2>
        <button onClick={() => setShowCreate(true)} className="kinetic-gradient px-4 py-2 rounded-xl text-[#003D2E] font-bold text-sm flex items-center gap-2 active:scale-95">
          <span className="material-symbols-outlined text-lg">add</span> Novo Afiliado
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-[#0f1729] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline font-bold text-lg mb-4">Novo Afiliado</h3>
            <div className="space-y-4">
              <div><label className="text-xs text-[#8B95A8] uppercase tracking-wider font-bold block mb-1">Nome</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-[#141d30] rounded-xl px-4 py-3 text-white border border-white/5 outline-none" /></div>
              <div><label className="text-xs text-[#8B95A8] uppercase tracking-wider font-bold block mb-1">Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-[#141d30] rounded-xl px-4 py-3 text-white border border-white/5 outline-none" /></div>
              <div><label className="text-xs text-[#8B95A8] uppercase tracking-wider font-bold block mb-1">Modelo</label>
                <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value as AffiliateModel })} className="w-full bg-[#141d30] rounded-xl px-4 py-3 text-white border border-white/5 outline-none">
                  <option value="cpa">CPA (fixo por FTD)</option><option value="revshare">RevShare (%)</option><option value="hybrid">Hibrido</option>
                </select>
              </div>
              {(form.model === "cpa" || form.model === "hybrid") && <div><label className="text-xs text-[#8B95A8] uppercase tracking-wider font-bold block mb-1">CPA (R$)</label><input type="number" value={form.cpa} onChange={(e) => setForm({ ...form, cpa: e.target.value })} className="w-full bg-[#141d30] rounded-xl px-4 py-3 text-white border border-white/5 outline-none" /></div>}
              {(form.model === "revshare" || form.model === "hybrid") && <div><label className="text-xs text-[#8B95A8] uppercase tracking-wider font-bold block mb-1">RevShare (%)</label><input type="number" value={form.revshare} onChange={(e) => setForm({ ...form, revshare: e.target.value })} className="w-full bg-[#141d30] rounded-xl px-4 py-3 text-white border border-white/5 outline-none" /></div>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl bg-[#212e4a] text-[#8B95A8] font-bold">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.name || !form.email} className="flex-1 py-3 rounded-xl kinetic-gradient text-[#003D2E] font-black disabled:opacity-40">Criar</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#0f1729] rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-[#8B95A8]">
                <th className="text-left p-3">Afiliado</th>
                <th className="text-left p-3">Codigo</th>
                <th className="text-center p-3">Modelo</th>
                <th className="text-right p-3">Clicks</th>
                <th className="text-right p-3">Signups</th>
                <th className="text-right p-3">FTDs</th>
                <th className="text-right p-3">Volume</th>
                <th className="text-right p-3">Comissao</th>
              </tr>
            </thead>
            <tbody>
              {affiliates.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-[#8B95A8]">Nenhum afiliado</td></tr>
              ) : affiliates.map((a) => (
                <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3"><p className="font-bold">{a.name}</p><p className="text-[10px] text-[#8B95A8]">{a.email}</p></td>
                  <td className="p-3 font-mono text-xs text-[#FFB800]">{a.code}</td>
                  <td className="p-3 text-center"><span className="text-[10px] font-bold uppercase bg-[#5B9DFF]/10 text-[#5B9DFF] px-2 py-1 rounded-full">{a.model}</span></td>
                  <td className="p-3 text-right">{a.total_clicks}</td>
                  <td className="p-3 text-right">{a.total_signups}</td>
                  <td className="p-3 text-right text-[#00D4AA]">{a.total_ftd}</td>
                  <td className="p-3 text-right font-mono">R$ {a.total_volume.toFixed(2)}</td>
                  <td className="p-3 text-right font-mono text-[#FFB800]">R$ {a.total_commission.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
