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

  const totalClicks = affiliates.reduce((s, a) => s + a.total_clicks, 0);
  const totalSignups = affiliates.reduce((s, a) => s + a.total_signups, 0);
  const totalFTDs = affiliates.reduce((s, a) => s + a.total_ftd, 0);
  const totalCommission = affiliates.reduce((s, a) => s + a.total_commission, 0);

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[28px] tracking-tight text-white">Afiliados</h2>
          <p className="text-sm text-white/40 mt-1">{affiliates.length} afiliados registrados</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#10b981] hover:bg-[#10b981]/90 text-[#0a0f1a] font-semibold text-sm transition-all duration-200 active:scale-[0.97]"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Novo Afiliado
        </button>
      </div>

      {/* KPI Glass Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: "Total Clicks", value: totalClicks.toLocaleString("pt-BR"), color: "#3b82f6", icon: "ads_click" },
          { label: "Signups", value: totalSignups.toLocaleString("pt-BR"), color: "#f59e0b", icon: "person_add" },
          { label: "FTDs", value: totalFTDs.toLocaleString("pt-BR"), color: "#10b981", icon: "verified" },
          { label: "Comissao Total", value: `R$ ${totalCommission.toFixed(2)}`, color: "#f59e0b", icon: "payments" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111827]/80 backdrop-blur-xl p-5"
          >
            <div
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.07] blur-2xl"
              style={{ background: kpi.color }}
            />
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[18px] text-white/30">{kpi.icon}</span>
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{kpi.label}</p>
            </div>
            <p className="font-semibold text-[26px] tracking-tight" style={{ color: kpi.color }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Create Modal - Frosted Glass */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
        >
          {/* Frosted backdrop */}
          <div className="absolute inset-0 bg-[#0a0f1a]/80 backdrop-blur-md" />

          <div
            className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111827]/95 backdrop-blur-2xl p-7 shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-[#10b981]">person_add</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-white">Novo Afiliado</h3>
                <p className="text-xs text-white/30">Preencha os dados do afiliado</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-white/40 block mb-2">Nome</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome completo"
                  className="w-full bg-white/[0.04] rounded-xl px-4 py-3 text-white placeholder-white/20 border border-white/[0.06] outline-none focus:border-[#10b981]/30 focus:ring-1 focus:ring-[#10b981]/10 transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-white/40 block mb-2">Email</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="w-full bg-white/[0.04] rounded-xl px-4 py-3 text-white placeholder-white/20 border border-white/[0.06] outline-none focus:border-[#10b981]/30 focus:ring-1 focus:ring-[#10b981]/10 transition-all"
                />
              </div>

              {/* Model */}
              <div>
                <label className="text-[11px] font-medium uppercase tracking-wider text-white/40 block mb-2">Modelo</label>
                <select
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value as AffiliateModel })}
                  className="w-full bg-white/[0.04] rounded-xl px-4 py-3 text-white border border-white/[0.06] outline-none focus:border-[#10b981]/30 focus:ring-1 focus:ring-[#10b981]/10 transition-all appearance-none"
                >
                  <option value="cpa">CPA (fixo por FTD)</option>
                  <option value="revshare">RevShare (%)</option>
                  <option value="hybrid">Hibrido</option>
                </select>
              </div>

              {/* CPA Value */}
              {(form.model === "cpa" || form.model === "hybrid") && (
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-white/40 block mb-2">CPA (R$)</label>
                  <input
                    type="number"
                    value={form.cpa}
                    onChange={(e) => setForm({ ...form, cpa: e.target.value })}
                    className="w-full bg-white/[0.04] rounded-xl px-4 py-3 text-white border border-white/[0.06] outline-none focus:border-[#10b981]/30 focus:ring-1 focus:ring-[#10b981]/10 transition-all"
                  />
                </div>
              )}

              {/* RevShare Value */}
              {(form.model === "revshare" || form.model === "hybrid") && (
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wider text-white/40 block mb-2">RevShare (%)</label>
                  <input
                    type="number"
                    value={form.revshare}
                    onChange={(e) => setForm({ ...form, revshare: e.target.value })}
                    className="w-full bg-white/[0.04] rounded-xl px-4 py-3 text-white border border-white/[0.06] outline-none focus:border-[#10b981]/30 focus:ring-1 focus:ring-[#10b981]/10 transition-all"
                  />
                </div>
              )}
            </div>

            {/* Modal actions */}
            <div className="flex gap-3 mt-7">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/40 font-medium hover:text-white/60 hover:bg-white/[0.06] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.name || !form.email}
                className="flex-1 py-3 rounded-xl bg-[#10b981] text-[#0a0f1a] font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#10b981]/90 transition-all active:scale-[0.98]"
              >
                Criar Afiliado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Affiliates Table / Cards */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/80 backdrop-blur-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-white/30">group</span>
          <h3 className="font-semibold text-[15px] text-white/90">Todos os Afiliados</h3>
          <span className="ml-auto text-xs text-white/30 font-medium">{affiliates.length} total</span>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Afiliado", "Codigo", "Modelo", "Clicks", "Signups", "FTDs", "Volume", "Comissao"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-6 py-3 text-[11px] font-medium uppercase tracking-wider text-white/30 ${
                      i <= 1 ? "text-left" : i === 2 ? "text-center" : "text-right"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {affiliates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <span className="material-symbols-outlined text-[32px] text-white/10 mb-2 block">group_off</span>
                    <p className="text-sm text-white/30">Nenhum afiliado</p>
                  </td>
                </tr>
              ) : affiliates.map((a) => (
                <tr key={a.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-white/90">{a.name}</p>
                    <p className="text-[11px] text-white/30 mt-0.5">{a.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-[#f59e0b] bg-[#f59e0b]/8 px-2.5 py-1 rounded-lg">{a.code}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[11px] font-semibold uppercase px-3 py-1 rounded-full bg-[#3b82f6]/10 text-[#3b82f6]">
                      {a.model}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-white/60 font-medium">{a.total_clicks}</td>
                  <td className="px-6 py-4 text-right text-white/60 font-medium">{a.total_signups}</td>
                  <td className="px-6 py-4 text-right font-medium text-[#10b981]">{a.total_ftd}</td>
                  <td className="px-6 py-4 text-right font-mono text-white/80">R$ {a.total_volume.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-mono font-semibold text-[#f59e0b]">R$ {a.total_commission.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-white/[0.04]">
          {affiliates.length === 0 ? (
            <div className="py-16 text-center">
              <span className="material-symbols-outlined text-[32px] text-white/10 mb-2 block">group_off</span>
              <p className="text-sm text-white/30">Nenhum afiliado</p>
            </div>
          ) : affiliates.map((a) => (
            <div key={a.id} className="p-5 space-y-3">
              {/* Top row: name + model badge */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-white/90">{a.name}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">{a.email}</p>
                </div>
                <span className="text-[10px] font-semibold uppercase px-3 py-1 rounded-full bg-[#3b82f6]/10 text-[#3b82f6]">
                  {a.model}
                </span>
              </div>

              {/* Code */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/30 uppercase">Codigo:</span>
                <span className="font-mono text-xs text-[#f59e0b] bg-[#f59e0b]/8 px-2 py-0.5 rounded-md">{a.code}</span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-3 pt-1">
                <div>
                  <p className="text-[10px] text-white/30 uppercase">Clicks</p>
                  <p className="text-sm font-medium text-white/60">{a.total_clicks}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase">Signups</p>
                  <p className="text-sm font-medium text-white/60">{a.total_signups}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase">FTDs</p>
                  <p className="text-sm font-medium text-[#10b981]">{a.total_ftd}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase">Comissao</p>
                  <p className="text-sm font-mono font-semibold text-[#f59e0b]">R$ {a.total_commission.toFixed(2)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
