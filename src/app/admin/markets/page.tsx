"use client";

import { useEffect, useState } from "react";
import { getMarkets, saveMarket, deleteMarket, initializeStore, saveSettlement, saveBets, getBets, saveLedgerEntry } from "@/lib/engines/store";
import { createMarket, transitionMarket, CreateMarketParams } from "@/lib/engines/market-engine";
import { resolveMarket } from "@/lib/engines/settlement";
import { recalcMarket } from "@/lib/engines/parimutuel";
import { CATEGORY_META } from "@/lib/engines/types";
import type { PredictionMarket, MarketStatus, MarketCategory, MarketType, OutcomeType, ResolutionType, SourceType } from "@/lib/engines/types";

/* ── Status badge config ── */
const statusConfig: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  draft:               { dot: "bg-gray-400",    bg: "bg-white/[0.04]", text: "text-gray-400",   label: "Draft" },
  scheduled:           { dot: "bg-[#3b82f6]",   bg: "bg-[#3b82f6]/10", text: "text-[#3b82f6]",  label: "Scheduled" },
  open:                { dot: "bg-[#10b981]",    bg: "bg-[#10b981]/10", text: "text-[#10b981]",  label: "Open" },
  frozen:              { dot: "bg-[#f59e0b]",    bg: "bg-[#f59e0b]/10", text: "text-[#f59e0b]",  label: "Frozen" },
  closed:              { dot: "bg-[#ef4444]",    bg: "bg-[#ef4444]/10", text: "text-[#ef4444]",  label: "Closed" },
  awaiting_resolution: { dot: "bg-[#f59e0b]",    bg: "bg-[#f59e0b]/10", text: "text-[#f59e0b]",  label: "Awaiting" },
  resolved:            { dot: "bg-[#3b82f6]",    bg: "bg-[#3b82f6]/10", text: "text-[#3b82f6]",  label: "Resolved" },
  cancelled:           { dot: "bg-gray-500",     bg: "bg-white/[0.04]", text: "text-gray-500",   label: "Cancelled" },
};

const defaultOutcomePresets: Record<string, { key: string; label: string; color: string }[]> = {
  yes_no: [{ key: "YES", label: "Sim", color: "#10b981" }, { key: "NO", label: "Nao", color: "#ef4444" }],
  up_down: [{ key: "UP", label: "Sobe", color: "#10b981" }, { key: "DOWN", label: "Desce", color: "#ef4444" }],
  above_below: [{ key: "ABOVE", label: "Acima", color: "#10b981" }, { key: "BELOW", label: "Abaixo", color: "#ef4444" }],
  team_win_draw: [{ key: "HOME", label: "Time A", color: "#10b981" }, { key: "DRAW", label: "Empate", color: "#f59e0b" }, { key: "AWAY", label: "Time B", color: "#ef4444" }],
  multiple_choice: [{ key: "A", label: "Opcao A", color: "#10b981" }, { key: "B", label: "Opcao B", color: "#f59e0b" }, { key: "C", label: "Opcao C", color: "#ef4444" }],
  numeric_range: [{ key: "RANGE_1", label: "Faixa 1", color: "#10b981" }, { key: "RANGE_2", label: "Faixa 2", color: "#f59e0b" }, { key: "RANGE_3", label: "Faixa 3", color: "#ef4444" }],
};

/* ── Shared style tokens ── */
const inputCls =
  "w-full bg-white/[0.04] rounded-xl px-4 py-3 text-white/90 text-sm border border-white/[0.06] outline-none transition-all placeholder:text-white/20 focus:border-white/[0.14] focus:bg-white/[0.06] focus:ring-1 focus:ring-white/[0.08]";
const labelCls =
  "text-[11px] text-white/40 uppercase tracking-wider font-semibold block mb-1.5";
const sectionTitleCls =
  "text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4";
const dividerCls = "border-t border-white/[0.06]";

/* ── Pill button helper ── */
function ActionPill({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-[11px] font-semibold transition-all active:scale-95"
      style={{ color, backgroundColor: `${color}14`, border: `1px solid ${color}20` }}
    >
      {children}
    </button>
  );
}

/* ── Status badge ── */
function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

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
    const colors = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#6b7280"];
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

  const allStatuses = ["draft", "scheduled", "open", "frozen", "closed", "awaiting_resolution", "resolved", "cancelled"];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Mercados</h2>
          <p className="text-sm text-white/30 mt-0.5">{filtered.length} de {markets.length} mercados</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#0a0f1a] text-sm font-semibold transition-all hover:bg-white/90 active:scale-[0.97]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 5v14m-7-7h14" /></svg>
          Nova Previsao
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex gap-2.5 flex-wrap items-center">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" /></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="bg-white/[0.04] rounded-full pl-9 pr-4 py-2 text-sm text-white/80 border border-white/[0.06] outline-none w-56 transition-all placeholder:text-white/20 focus:border-white/[0.12] focus:bg-white/[0.06] focus:w-72"
          />
        </div>

        {/* Segmented: Category */}
        <div className="inline-flex bg-white/[0.04] rounded-full border border-white/[0.06] p-0.5">
          <button onClick={() => setFilterCat("all")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterCat === "all" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"}`}>Todas</button>
          {Object.entries(CATEGORY_META).map(([k, v]) => (
            <button key={k} onClick={() => setFilterCat(k)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${filterCat === k ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"}`}>{v.label}</button>
          ))}
        </div>

        {/* Segmented: Status */}
        <div className="inline-flex bg-white/[0.04] rounded-full border border-white/[0.06] p-0.5 overflow-x-auto">
          <button onClick={() => setFilterStatus("all")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterStatus === "all" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"}`}>Todos</button>
          {allStatuses.map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${filterStatus === s ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"}`}>
              {statusConfig[s]?.label || s}
            </button>
          ))}
        </div>

        {/* Segmented: Resolution */}
        <div className="inline-flex bg-white/[0.04] rounded-full border border-white/[0.06] p-0.5">
          <button onClick={() => setFilterRes("all")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterRes === "all" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"}`}>Toda</button>
          <button onClick={() => setFilterRes("automatic")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterRes === "automatic" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"}`}>Auto</button>
          <button onClick={() => setFilterRes("semi_automatic")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterRes === "semi_automatic" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"}`}>Semi</button>
          <button onClick={() => setFilterRes("manual")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterRes === "manual" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"}`}>Manual</button>
        </div>
      </div>

      {/* ── CREATE MODAL (sheet-style) ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto" onClick={() => setShowCreate(false)}>
          <div
            className="bg-[#12101A] rounded-2xl w-full max-w-2xl mx-auto my-10 border border-white/[0.06] shadow-2xl shadow-black/40 animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <h3 className="text-lg font-semibold text-white">Nova Previsao</h3>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.1] transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-6 py-6 space-y-8">
              {/* A. Info */}
              <section>
                <h4 className={sectionTitleCls}>Informacoes</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2"><label className={labelCls}>Titulo</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inputCls} placeholder="Ex: Bitcoin fecha acima de $100k em marco?" /></div>
                  <div className="md:col-span-2"><label className={labelCls}>Descricao curta</label><input value={f.short_desc} onChange={(e) => setF({ ...f, short_desc: e.target.value })} className={inputCls} placeholder="Uma frase resumindo" /></div>
                  <div className="md:col-span-2"><label className={labelCls}>Descricao completa</label><textarea value={f.full_desc} onChange={(e) => setF({ ...f, full_desc: e.target.value })} className={inputCls + " h-20 resize-none"} placeholder="Detalhes, contexto, regras" /></div>
                  <div><label className={labelCls}>Categoria</label><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as MarketCategory })} className={inputCls}>{Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                  <div><label className={labelCls}>Subcategoria</label><input value={f.subcategory} onChange={(e) => setF({ ...f, subcategory: e.target.value })} className={inputCls} placeholder="Ex: Libertadores, Bitcoin..." /></div>
                  <div><label className={labelCls}>Pais</label><input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} className={inputCls} /></div>
                  <div className="flex items-center gap-3 pt-5">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={f.is_featured} onChange={(e) => setF({ ...f, is_featured: e.target.checked })} className="sr-only peer" />
                      <div className="w-9 h-5 bg-white/[0.08] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/40 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10b981] peer-checked:after:bg-white" />
                    </label>
                    <span className="text-sm text-white/60">Destaque na home</span>
                  </div>
                </div>
              </section>

              <div className={dividerCls} />

              {/* B. Structure */}
              <section>
                <h4 className={sectionTitleCls}>Estrutura</h4>
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

                {/* Outcomes editor */}
                <div className="mt-5">
                  <label className={labelCls}>Outcomes</label>
                  <div className="space-y-2">
                    {f.outcomes.map((o, i) => (
                      <div key={i} className="flex gap-2 items-center bg-white/[0.02] rounded-xl px-3 py-2 border border-white/[0.04]">
                        <input value={o.key} onChange={(e) => updateOutcome(i, "key", e.target.value.toUpperCase().replace(/\s/g, "_"))} className="bg-transparent rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none w-20 font-mono border border-white/[0.06] focus:border-white/[0.12]" placeholder="KEY" />
                        <input value={o.label} onChange={(e) => updateOutcome(i, "label", e.target.value)} className="bg-transparent rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none flex-1 border border-white/[0.06] focus:border-white/[0.12]" placeholder="Label" />
                        <input type="color" value={o.color} onChange={(e) => updateOutcome(i, "color", e.target.value)} className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0" />
                        {f.outcomes.length > 2 && (
                          <button onClick={() => removeOutcome(i)} className="w-6 h-6 rounded-full bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M6 18 18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={addOutcome} className="inline-flex items-center gap-1.5 text-[#10b981] text-xs font-semibold mt-1 hover:text-[#34d399] transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 5v14m-7-7h14" /></svg>
                      Adicionar outcome
                    </button>
                  </div>
                </div>

                {/* Numeric params */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                  <div><label className={labelCls}>Taxa casa (%)</label><input type="number" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value })} className={inputCls} /></div>
                  <div><label className={labelCls}>Min bet (R$)</label><input type="number" value={f.min_bet} onChange={(e) => setF({ ...f, min_bet: e.target.value })} className={inputCls} /></div>
                  <div><label className={labelCls}>Max bet (R$)</label><input type="number" value={f.max_bet} onChange={(e) => setF({ ...f, max_bet: e.target.value })} className={inputCls} /></div>
                  <div><label className={labelCls}>Max liability (R$)</label><input type="number" value={f.max_liability} onChange={(e) => setF({ ...f, max_liability: e.target.value })} className={inputCls} /></div>
                </div>
              </section>

              <div className={dividerCls} />

              {/* C. Timing */}
              <section>
                <h4 className={sectionTitleCls}>Datas</h4>
                <div className="max-w-xs"><label className={labelCls}>Fecha em (horas a partir de agora)</label><input type="number" value={f.close_hours} onChange={(e) => setF({ ...f, close_hours: e.target.value })} className={inputCls} /></div>
              </section>

              <div className={dividerCls} />

              {/* D. Resolution */}
              <section>
                <h4 className={sectionTitleCls}>Resolucao</h4>
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
              </section>

              <div className={dividerCls} />

              {/* E. Rule */}
              <section>
                <h4 className={sectionTitleCls}>Regra Objetiva</h4>
                <div><label className={labelCls}>Expressao</label><input value={f.resolution_expr} onChange={(e) => setF({ ...f, resolution_expr: e.target.value })} className={inputCls + " font-mono"} placeholder="close_price > open_price | rain_mm > 0 | score_home > score_away" /></div>
                <div className="mt-3"><label className={labelCls}>Descricao da regra</label><input value={f.resolution_desc} onChange={(e) => setF({ ...f, resolution_desc: e.target.value })} className={inputCls} placeholder="Descricao legivel da regra de resolucao" /></div>
              </section>
            </div>

            {/* Sheet footer */}
            <div className="flex gap-3 px-6 py-5 border-t border-white/[0.06]">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl bg-white/[0.04] text-white/40 font-semibold text-sm hover:bg-white/[0.08] transition-all">Cancelar</button>
              <button onClick={handleCreate} disabled={!f.title || f.outcomes.length < 2} className="flex-1 py-3 rounded-xl bg-white text-[#0a0f1a] font-semibold text-sm transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none">Criar Mercado</button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESOLVE MODAL (centered) ── */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setResolveModal(null)}>
          <div
            className="bg-[#12101A] rounded-2xl w-full max-w-md border border-white/[0.06] shadow-2xl shadow-black/40 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-lg font-semibold text-white">Resolver Mercado</h3>
              <p className="text-sm text-white/40 mt-1 leading-relaxed">{resolveModal.title}</p>
              <p className="text-xs text-white/25 mt-2 font-mono">Pool total: R$ {resolveModal.pool_total.toFixed(2)}</p>
            </div>

            <div className={dividerCls} />

            {/* Outcome selection as radio cards */}
            <div className="px-6 py-5 space-y-2.5">
              <label className={labelCls}>Outcome vencedor</label>
              {resolveModal.outcomes.map((o) => {
                const selected = resolveOutcome === o.key;
                return (
                  <button
                    key={o.key}
                    onClick={() => setResolveOutcome(o.key)}
                    className={`w-full p-4 rounded-xl border text-left flex justify-between items-center transition-all ${
                      selected
                        ? "border-[#10b981]/40 bg-[#10b981]/[0.06]"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Radio indicator */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selected ? "border-[#10b981]" : "border-white/[0.15]"}`}>
                        {selected && <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />}
                      </div>
                      <span className="font-semibold text-sm" style={{ color: o.color }}>{o.label}</span>
                    </div>
                    <span className="text-[11px] text-white/30 font-mono">R$ {o.pool.toFixed(2)} &middot; {o.payout_per_unit.toFixed(2)}x</span>
                  </button>
                );
              })}
            </div>

            <div className={dividerCls} />

            {/* Notes */}
            <div className="px-6 py-4">
              <label className={labelCls}>Notas / Justificativa</label>
              <textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} className={inputCls + " h-20 resize-none"} placeholder="Obrigatorio para resolucao manual" />
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-5 border-t border-white/[0.06]">
              <button onClick={() => setResolveModal(null)} className="flex-1 py-3 rounded-xl bg-white/[0.04] text-white/40 font-semibold text-sm hover:bg-white/[0.08] transition-all">Cancelar</button>
              <button onClick={handleResolve} disabled={!resolveOutcome} className="flex-1 py-3 rounded-xl bg-[#10b981] text-white font-semibold text-sm transition-all hover:bg-[#059669] active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none">Confirmar Resolucao</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MARKETS: Desktop table ── */}
      <div className="hidden md:block bg-[#12101A] rounded-2xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-5 py-3.5 text-[11px] uppercase tracking-wider text-white/25 font-semibold">Mercado</th>
              <th className="text-left px-4 py-3.5 text-[11px] uppercase tracking-wider text-white/25 font-semibold">Categoria</th>
              <th className="text-center px-4 py-3.5 text-[11px] uppercase tracking-wider text-white/25 font-semibold">Tipo</th>
              <th className="text-right px-4 py-3.5 text-[11px] uppercase tracking-wider text-white/25 font-semibold">Pool</th>
              <th className="text-center px-4 py-3.5 text-[11px] uppercase tracking-wider text-white/25 font-semibold">Resolucao</th>
              <th className="text-center px-4 py-3.5 text-[11px] uppercase tracking-wider text-white/25 font-semibold">Status</th>
              <th className="text-center px-4 py-3.5 text-[11px] uppercase tracking-wider text-white/25 font-semibold">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-16 text-center text-white/20 text-sm">Nenhum mercado encontrado</td></tr>
            ) : (
              filtered.map((m) => {
                const meta = CATEGORY_META[m.category];
                return (
                  <tr key={m.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-white/90 truncate max-w-[240px]">{m.title}</div>
                      <div className="text-[11px] text-white/25 mt-0.5 truncate max-w-[240px]">{m.short_description}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
                        <span className="material-symbols-outlined text-sm" style={{ color: meta?.color }}>{meta?.icon}</span>
                        {meta?.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-xs text-white/40">{m.outcome_type}</td>
                    <td className="px-4 py-4 text-right font-mono text-sm font-medium text-white/70">R$ {m.pool_total.toFixed(0)}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-[11px] font-semibold ${m.resolution_type === "automatic" ? "text-[#10b981]" : m.resolution_type === "manual" ? "text-[#ef4444]" : "text-[#f59e0b]"}`}>
                        {m.resolution_type === "automatic" ? "Auto" : m.resolution_type === "manual" ? "Manual" : "Semi"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {m.status === "draft" && <ActionPill onClick={() => { const r = transitionMarket(m, "open"); if (r.success && r.market) { saveMarket(r.market); refresh(); } }} color="#10b981">Abrir</ActionPill>}
                        {m.status === "open" && <ActionPill onClick={() => { const r = transitionMarket(m, "frozen"); if (r.success && r.market) { saveMarket(r.market); refresh(); } }} color="#f59e0b">Congelar</ActionPill>}
                        {m.status === "frozen" && <ActionPill onClick={() => { const r = transitionMarket(m, "open"); if (r.success && r.market) { saveMarket(r.market); refresh(); } }} color="#10b981">Reabrir</ActionPill>}
                        {["closed", "awaiting_resolution"].includes(m.status) && <ActionPill onClick={() => { setResolveModal(m); setResolveOutcome(""); }} color="#f59e0b">Resolver</ActionPill>}
                        {!["resolved", "cancelled"].includes(m.status) && <ActionPill onClick={() => { const r = transitionMarket(m, "cancelled"); if (r.success && r.market) { saveMarket(r.market); refresh(); } }} color="#ef4444">Cancelar</ActionPill>}
                        {["draft", "cancelled", "resolved"].includes(m.status) && <ActionPill onClick={() => { deleteMarket(m.id); refresh(); }} color="#6b7280">Excluir</ActionPill>}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── MARKETS: Mobile cards ── */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-white/20 text-sm">Nenhum mercado encontrado</div>
        ) : (
          filtered.map((m) => {
            const meta = CATEGORY_META[m.category];
            return (
              <div key={m.id} className="bg-[#12101A] rounded-2xl border border-white/[0.06] p-4 space-y-3">
                {/* Card header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-white/90 text-sm leading-snug">{m.title}</h3>
                    <p className="text-[11px] text-white/25 mt-0.5 truncate">{m.short_description}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>

                {/* Card meta row */}
                <div className="flex items-center gap-4 text-xs text-white/40">
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm" style={{ color: meta?.color }}>{meta?.icon}</span>
                    {meta?.label}
                  </span>
                  <span className="font-mono font-medium text-white/60">R$ {m.pool_total.toFixed(0)}</span>
                  <span className={`font-semibold ${m.resolution_type === "automatic" ? "text-[#10b981]" : m.resolution_type === "manual" ? "text-[#ef4444]" : "text-[#f59e0b]"}`}>
                    {m.resolution_type === "automatic" ? "Auto" : m.resolution_type === "manual" ? "Manual" : "Semi"}
                  </span>
                </div>

                {/* Card actions */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {m.status === "draft" && <ActionPill onClick={() => { const r = transitionMarket(m, "open"); if (r.success && r.market) { saveMarket(r.market); refresh(); } }} color="#10b981">Abrir</ActionPill>}
                  {m.status === "open" && <ActionPill onClick={() => { const r = transitionMarket(m, "frozen"); if (r.success && r.market) { saveMarket(r.market); refresh(); } }} color="#f59e0b">Congelar</ActionPill>}
                  {m.status === "frozen" && <ActionPill onClick={() => { const r = transitionMarket(m, "open"); if (r.success && r.market) { saveMarket(r.market); refresh(); } }} color="#10b981">Reabrir</ActionPill>}
                  {["closed", "awaiting_resolution"].includes(m.status) && <ActionPill onClick={() => { setResolveModal(m); setResolveOutcome(""); }} color="#f59e0b">Resolver</ActionPill>}
                  {!["resolved", "cancelled"].includes(m.status) && <ActionPill onClick={() => { const r = transitionMarket(m, "cancelled"); if (r.success && r.market) { saveMarket(r.market); refresh(); } }} color="#ef4444">Cancelar</ActionPill>}
                  {["draft", "cancelled", "resolved"].includes(m.status) && <ActionPill onClick={() => { deleteMarket(m.id); refresh(); }} color="#6b7280">Excluir</ActionPill>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
