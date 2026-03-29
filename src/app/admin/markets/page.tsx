"use client";

import { useEffect, useState } from "react";
import { getMarkets, saveMarket, deleteMarket, initializeStore, saveSettlement, saveBets, getBets, saveLedgerEntry } from "@/lib/engines/store";
import { createMarket, transitionMarket, CreateMarketParams } from "@/lib/engines/market-engine";
import { resolveMarket } from "@/lib/engines/settlement";
import { recalcMarket } from "@/lib/engines/parimutuel";
import { CATEGORY_META } from "@/lib/engines/types";
import type { PredictionMarket, MarketStatus, MarketCategory, MarketType, OutcomeType, ResolutionType, SourceType } from "@/lib/engines/types";

const statusColors: Record<string, string> = {
  draft: "bg-[#5A6478]/20 text-[#8B95A8]", scheduled: "bg-[#5B9DFF]/10 text-[#5B9DFF]",
  open: "bg-[#00D4AA]/10 text-[#00D4AA]", frozen: "bg-[#FFB800]/10 text-[#FFB800]",
  closed: "bg-[#FF6B5A]/10 text-[#FF6B5A]", awaiting_resolution: "bg-[#FFB800]/10 text-[#FFB800]",
  resolved: "bg-[#5B9DFF]/10 text-[#5B9DFF]", cancelled: "bg-[#5A6478]/20 text-[#5A6478]",
};

const defaultOutcomePresets: Record<string, { key: string; label: string; color: string }[]> = {
  yes_no: [{ key: "YES", label: "Sim", color: "#00D4AA" }, { key: "NO", label: "Nao", color: "#FF6B5A" }],
  up_down: [{ key: "UP", label: "Sobe", color: "#00D4AA" }, { key: "DOWN", label: "Desce", color: "#FF6B5A" }],
  above_below: [{ key: "ABOVE", label: "Acima", color: "#00D4AA" }, { key: "BELOW", label: "Abaixo", color: "#FF6B5A" }],
  team_win_draw: [{ key: "HOME", label: "Time A", color: "#00D4AA" }, { key: "DRAW", label: "Empate", color: "#FFB800" }, { key: "AWAY", label: "Time B", color: "#FF6B5A" }],
  multiple_choice: [{ key: "A", label: "Opcao A", color: "#00D4AA" }, { key: "B", label: "Opcao B", color: "#FFB800" }, { key: "C", label: "Opcao C", color: "#FF6B5A" }],
  numeric_range: [{ key: "RANGE_1", label: "Faixa 1", color: "#00D4AA" }, { key: "RANGE_2", label: "Faixa 2", color: "#FFB800" }, { key: "RANGE_3", label: "Faixa 3", color: "#FF6B5A" }],
};

const inputCls = "w-full bg-[#141d30] rounded-xl px-4 py-3 text-white border border-white/5 outline-none focus:ring-2 focus:ring-[#00D4AA]/40 text-sm";
const labelCls = "text-xs text-[#8B95A8] uppercase tracking-wider font-bold block mb-1";

export default function AdminMarkets() {
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRes, setFilterRes] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [resolveModal, setResolveModal] = useState<PredictionMarket | null>(null);
  const [resolveOutcome, setResolveOutcome] = useState("");
  const [resolveNotes, setResolveNotes] = useState("");

  // Create form
  const [f, setF] = useState({
    title: "", short_desc: "", full_desc: "", category: "politics" as MarketCategory,
    subcategory: "", market_type: "yes_no" as MarketType, outcome_type: "yes_no" as OutcomeType,
    resolution_type: "manual" as ResolutionType, source_type: "manual" as SourceType,
    source_name: "", source_url: "", resolution_expr: "", resolution_desc: "",
    fee: "5", min_bet: "1", max_bet: "10000", max_payout: "100000", max_liability: "500000",
    close_hours: "24", is_featured: false, country: "BR",
    outcomes: defaultOutcomePresets.yes_no,
  });

  const refresh = () => setMarkets(getMarkets());
  useEffect(() => { initializeStore(); refresh(); }, []);

  const filtered = markets.filter((m) => {
    if (filterCat !== "all" && m.category !== filterCat) return false;
    if (filterStatus !== "all" && m.status !== filterStatus) return false;
    if (filterRes !== "all" && m.resolution_type !== filterRes) return false;
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCreate = () => {
    const params: CreateMarketParams = {
      title: f.title, short_description: f.short_desc, full_description: f.full_desc,
      category: f.category, subcategory: f.subcategory,
      market_type: f.market_type, outcome_type: f.outcome_type,
      outcomes: f.outcomes, resolution_type: f.resolution_type,
      source_type: f.source_type, source_name: f.source_name, source_url: f.source_url,
      resolution_expression: f.resolution_expr, resolution_description: f.resolution_desc,
      open_at: Date.now(), close_at: Date.now() + parseFloat(f.close_hours) * 3600000,
      house_fee_percent: parseFloat(f.fee) / 100,
      min_bet: parseFloat(f.min_bet), max_bet: parseFloat(f.max_bet),
      max_payout: parseFloat(f.max_payout), max_liability: parseFloat(f.max_liability),
      country: f.country, is_featured: f.is_featured, created_by: "admin",
    };
    const m = createMarket(params);
    saveMarket(m);
    setShowCreate(false);
    refresh();
  };

  const handleResolve = () => {
    if (!resolveModal || !resolveOutcome) return;
    const bets = getBets();
    const result = resolveMarket(resolveModal, bets, resolveOutcome, {}, "admin", undefined, resolveNotes);
    if (result.errors.length > 0) return;
    saveMarket(result.updatedMarket);
    saveSettlement(result.settlement);
    const allBets = getBets();
    result.updatedBets.forEach((ub) => { const idx = allBets.findIndex((b) => b.id === ub.id); if (idx >= 0) allBets[idx] = ub; });
    saveBets(allBets);
    result.ledgerEntries.forEach((le) => saveLedgerEntry(le));
    setResolveModal(null); setResolveOutcome(""); setResolveNotes("");
    refresh();
  };

  const addOutcome = () => {
    const idx = f.outcomes.length;
    const colors = ["#00D4AA", "#FFB800", "#FF6B5A", "#5B9DFF", "#E040FB", "#8B95A8"];
    setF({ ...f, outcomes: [...f.outcomes, { key: `OPT_${idx + 1}`, label: `Opcao ${idx + 1}`, color: colors[idx % colors.length] }] });
  };

  const removeOutcome = (i: number) => {
    if (f.outcomes.length <= 2) return;
    setF({ ...f, outcomes: f.outcomes.filter((_, j) => j !== i) });
  };

  const updateOutcome = (i: number, field: "key" | "label" | "color", value: string) => {
    const outs = [...f.outcomes];
    outs[i] = { ...outs[i], [field]: value };
    setF({ ...f, outcomes: outs });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-headline font-black text-2xl tracking-tight">Gestao de Mercados</h2>
        <button onClick={() => setShowCreate(true)} className="kinetic-gradient px-4 py-2 rounded-xl text-[#003D2E] font-bold text-sm flex items-center gap-2 active:scale-95">
          <span className="material-symbols-outlined text-lg">add</span> Nova Previsao
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por titulo..." className="bg-[#141d30] rounded-xl px-4 py-2 text-sm text-white border border-white/5 outline-none w-64" />
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="bg-[#141d30] rounded-xl px-3 py-2 text-sm text-white border border-white/5 outline-none">
          <option value="all">Todas categorias</option>
          {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-[#141d30] rounded-xl px-3 py-2 text-sm text-white border border-white/5 outline-none">
          <option value="all">Todos status</option>
          {["draft", "scheduled", "open", "frozen", "closed", "awaiting_resolution", "resolved", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterRes} onChange={(e) => setFilterRes(e.target.value)} className="bg-[#141d30] rounded-xl px-3 py-2 text-sm text-white border border-white/5 outline-none">
          <option value="all">Toda resolucao</option>
          <option value="automatic">Automatica</option><option value="semi_automatic">Semi-auto</option><option value="manual">Manual</option>
        </select>
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 overflow-y-auto p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-[#0b1120] rounded-2xl p-6 w-full max-w-3xl mx-auto border border-white/10 my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline font-black text-xl mb-6">Nova Previsao</h3>

            {/* A. Info */}
            <div className="mb-6"><h4 className="text-xs font-black text-[#FFB800] uppercase tracking-widest mb-3">A. Informacoes</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2"><label className={labelCls}>Titulo *</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inputCls} placeholder="Ex: Bitcoin fecha acima de $100k em marco?" /></div>
                <div className="md:col-span-2"><label className={labelCls}>Descricao curta *</label><input value={f.short_desc} onChange={(e) => setF({ ...f, short_desc: e.target.value })} className={inputCls} placeholder="Uma frase resumindo" /></div>
                <div className="md:col-span-2"><label className={labelCls}>Descricao completa</label><textarea value={f.full_desc} onChange={(e) => setF({ ...f, full_desc: e.target.value })} className={inputCls + " h-20"} placeholder="Detalhes, contexto, regras" /></div>
                <div><label className={labelCls}>Categoria *</label><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as MarketCategory })} className={inputCls}>{Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                <div><label className={labelCls}>Subcategoria</label><input value={f.subcategory} onChange={(e) => setF({ ...f, subcategory: e.target.value })} className={inputCls} placeholder="Ex: Libertadores, Bitcoin..." /></div>
                <div><label className={labelCls}>Pais</label><input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} className={inputCls} /></div>
                <div className="flex items-center gap-3 pt-5"><input type="checkbox" checked={f.is_featured} onChange={(e) => setF({ ...f, is_featured: e.target.checked })} className="w-5 h-5 rounded accent-[#00D4AA]" /><span className="text-sm font-bold">Destaque na home</span></div>
              </div>
            </div>

            {/* B. Structure */}
            <div className="mb-6"><h4 className="text-xs font-black text-[#FFB800] uppercase tracking-widest mb-3">B. Estrutura</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Tipo de mercado</label>
                  <select value={f.market_type} onChange={(e) => setF({ ...f, market_type: e.target.value as MarketType })} className={inputCls}>
                    <option value="binary">Binario</option><option value="multi_outcome">Multi-outcome</option><option value="over_under">Over/Under</option><option value="yes_no">Sim/Nao</option><option value="up_down">Sobe/Desce</option><option value="exact_value">Valor exato</option><option value="range">Faixa</option>
                  </select></div>
                <div><label className={labelCls}>Tipo de outcome</label>
                  <select value={f.outcome_type} onChange={(e) => { const v = e.target.value as OutcomeType; setF({ ...f, outcome_type: v, outcomes: defaultOutcomePresets[v] || defaultOutcomePresets.yes_no }); }} className={inputCls}>
                    <option value="yes_no">Sim/Nao</option><option value="up_down">Sobe/Desce</option><option value="above_below">Acima/Abaixo</option><option value="team_win_draw">Time/Empate/Time</option><option value="multiple_choice">Multipla escolha</option><option value="numeric_range">Faixa numerica</option>
                  </select></div>
              </div>
              <div className="mt-4"><label className={labelCls}>Outcomes *</label>
                <div className="space-y-2">
                  {f.outcomes.map((o, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={o.key} onChange={(e) => updateOutcome(i, "key", e.target.value.toUpperCase().replace(/\s/g, "_"))} className="bg-[#141d30] rounded-lg px-3 py-2 text-xs text-white border border-white/5 outline-none w-24 font-mono" placeholder="KEY" />
                      <input value={o.label} onChange={(e) => updateOutcome(i, "label", e.target.value)} className="bg-[#141d30] rounded-lg px-3 py-2 text-xs text-white border border-white/5 outline-none flex-1" placeholder="Label" />
                      <input type="color" value={o.color} onChange={(e) => updateOutcome(i, "color", e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                      {f.outcomes.length > 2 && <button onClick={() => removeOutcome(i)} className="text-[#FF6B5A] text-xs"><span className="material-symbols-outlined text-sm">close</span></button>}
                    </div>
                  ))}
                  <button onClick={addOutcome} className="text-[#00D4AA] text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-sm">add</span>Adicionar outcome</button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div><label className={labelCls}>Taxa casa (%)</label><input type="number" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Min bet (R$)</label><input type="number" value={f.min_bet} onChange={(e) => setF({ ...f, min_bet: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Max bet (R$)</label><input type="number" value={f.max_bet} onChange={(e) => setF({ ...f, max_bet: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Max liability (R$)</label><input type="number" value={f.max_liability} onChange={(e) => setF({ ...f, max_liability: e.target.value })} className={inputCls} /></div>
              </div>
            </div>

            {/* C. Timing */}
            <div className="mb-6"><h4 className="text-xs font-black text-[#FFB800] uppercase tracking-widest mb-3">C. Datas</h4>
              <div><label className={labelCls}>Fecha em (horas a partir de agora)</label><input type="number" value={f.close_hours} onChange={(e) => setF({ ...f, close_hours: e.target.value })} className={inputCls} /></div>
            </div>

            {/* D. Resolution */}
            <div className="mb-6"><h4 className="text-xs font-black text-[#FFB800] uppercase tracking-widest mb-3">D. Resolucao</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Tipo de resolucao</label>
                  <select value={f.resolution_type} onChange={(e) => setF({ ...f, resolution_type: e.target.value as ResolutionType })} className={inputCls}>
                    <option value="automatic">Automatica</option><option value="semi_automatic">Semi-automatica</option><option value="manual">Manual</option>
                  </select></div>
                <div><label className={labelCls}>Tipo de fonte</label>
                  <select value={f.source_type} onChange={(e) => setF({ ...f, source_type: e.target.value as SourceType })} className={inputCls}>
                    <option value="manual">Manual</option><option value="api">API</option><option value="scraper">Scraper</option><option value="rss">RSS</option><option value="hybrid">Hibrido</option>
                  </select></div>
                <div><label className={labelCls}>Nome da fonte</label><input value={f.source_name} onChange={(e) => setF({ ...f, source_name: e.target.value })} className={inputCls} placeholder="Ex: Binance, ESPN, INMET..." /></div>
                <div><label className={labelCls}>URL da fonte</label><input value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })} className={inputCls} placeholder="https://..." /></div>
              </div>
            </div>

            {/* E. Rule */}
            <div className="mb-6"><h4 className="text-xs font-black text-[#FFB800] uppercase tracking-widest mb-3">E. Regra Objetiva</h4>
              <div><label className={labelCls}>Expressao</label><input value={f.resolution_expr} onChange={(e) => setF({ ...f, resolution_expr: e.target.value })} className={inputCls + " font-mono"} placeholder="close_price > open_price | rain_mm > 0 | score_home > score_away" /></div>
              <div className="mt-2"><label className={labelCls}>Descricao da regra</label><input value={f.resolution_desc} onChange={(e) => setF({ ...f, resolution_desc: e.target.value })} className={inputCls} placeholder="Descricao legivel da regra de resolucao" /></div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl bg-[#212e4a] text-[#8B95A8] font-bold">Cancelar</button>
              <button onClick={handleCreate} disabled={!f.title || f.outcomes.length < 2} className="flex-1 py-3 rounded-xl kinetic-gradient text-[#003D2E] font-black disabled:opacity-40">Criar Mercado</button>
            </div>
          </div>
        </div>
      )}

      {/* RESOLVE MODAL */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setResolveModal(null)}>
          <div className="bg-[#0b1120] rounded-2xl p-6 w-full max-w-md border border-white/10" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline font-bold text-lg mb-2">Resolver Mercado</h3>
            <p className="text-sm text-[#8B95A8] mb-4">{resolveModal.title}</p>
            <p className="text-xs text-[#8B95A8] mb-1">Pool total: R$ {resolveModal.pool_total.toFixed(2)}</p>
            <div className="space-y-2 mb-4">
              <label className={labelCls}>Outcome vencedor *</label>
              {resolveModal.outcomes.map((o) => (
                <button key={o.key} onClick={() => setResolveOutcome(o.key)} className={`w-full p-3 rounded-xl border text-left flex justify-between items-center ${resolveOutcome === o.key ? "border-[#00D4AA] bg-[#00D4AA]/10" : "border-white/5 bg-[#141d30]"}`}>
                  <span className="font-bold" style={{ color: o.color }}>{o.label}</span>
                  <span className="text-xs text-[#8B95A8]">Pool: R$ {o.pool.toFixed(2)} | {o.payout_per_unit.toFixed(2)}x</span>
                </button>
              ))}
            </div>
            <div className="mb-4"><label className={labelCls}>Notas / Justificativa</label><textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} className={inputCls + " h-20"} placeholder="Obrigatorio para resolucao manual" /></div>
            <div className="flex gap-3">
              <button onClick={() => setResolveModal(null)} className="flex-1 py-3 rounded-xl bg-[#212e4a] text-[#8B95A8] font-bold">Cancelar</button>
              <button onClick={handleResolve} disabled={!resolveOutcome} className="flex-1 py-3 rounded-xl kinetic-gradient text-[#003D2E] font-black disabled:opacity-40">Confirmar Resolucao</button>
            </div>
          </div>
        </div>
      )}

      {/* MARKETS TABLE */}
      <div className="bg-[#0f1729] rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-[#8B95A8]">
              <th className="text-left p-3">Mercado</th><th className="text-left p-3">Cat.</th><th className="text-center p-3">Tipo</th><th className="text-right p-3">Pool</th><th className="text-center p-3">Resolucao</th><th className="text-center p-3">Status</th><th className="text-center p-3">Acoes</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-[#8B95A8]">Nenhum mercado encontrado</td></tr> :
              filtered.map((m) => {
                const meta = CATEGORY_META[m.category];
                return (
                  <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3"><div className="font-bold truncate max-w-[200px]">{m.title}</div><div className="text-[10px] text-[#8B95A8]">{m.short_description}</div></td>
                    <td className="p-3"><span className="material-symbols-outlined text-sm mr-1" style={{ color: meta?.color }}>{meta?.icon}</span><span className="text-xs">{meta?.label}</span></td>
                    <td className="p-3 text-center text-xs">{m.outcome_type}</td>
                    <td className="p-3 text-right font-mono font-bold">R$ {m.pool_total.toFixed(0)}</td>
                    <td className="p-3 text-center"><span className={`text-[10px] font-bold uppercase ${m.resolution_type === "automatic" ? "text-[#00D4AA]" : m.resolution_type === "manual" ? "text-[#FF6B5A]" : "text-[#FFB800]"}`}>{m.resolution_type}</span></td>
                    <td className="p-3 text-center"><span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${statusColors[m.status] || ""}`}>{m.status}</span></td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {m.status === "draft" && <button onClick={() => { const r = transitionMarket(m, "open"); if (r.success && r.market) { saveMarket(r.market); refresh(); } }} className="text-[#00D4AA] text-xs font-bold">Abrir</button>}
                        {m.status === "open" && <button onClick={() => { const r = transitionMarket(m, "frozen"); if (r.success && r.market) { saveMarket(r.market); refresh(); } }} className="text-[#FFB800] text-xs font-bold">Congelar</button>}
                        {m.status === "frozen" && <button onClick={() => { const r = transitionMarket(m, "open"); if (r.success && r.market) { saveMarket(r.market); refresh(); } }} className="text-[#00D4AA] text-xs font-bold">Reabrir</button>}
                        {["closed", "awaiting_resolution"].includes(m.status) && <button onClick={() => { setResolveModal(m); setResolveOutcome(""); }} className="text-[#FFB800] text-xs font-bold">Resolver</button>}
                        {!["resolved", "cancelled"].includes(m.status) && <button onClick={() => { const r = transitionMarket(m, "cancelled"); if (r.success && r.market) { saveMarket(r.market); refresh(); } }} className="text-[#FF6B5A] text-xs font-bold ml-2">Cancelar</button>}
                        {["draft", "cancelled", "resolved"].includes(m.status) && <button onClick={() => { deleteMarket(m.id); refresh(); }} className="text-[#5A6478] text-xs font-bold ml-2">Excluir</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
