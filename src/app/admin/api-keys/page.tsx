"use client";

import { useState, useEffect, useCallback } from "react";

interface ApiKey {
  id: string;
  key: string;
  name: string;
  owner_id: string;
  permissions: string[];
  rate_limit_per_minute: number;
  is_active: boolean;
  request_count: number;
  last_used_at: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  total_requests: number;
}

const ADMIN_SECRET = "admin";

const inputCls =
  "w-full bg-white/[0.04] rounded-xl px-4 py-3 text-white/90 text-sm border border-white/[0.06] outline-none transition-all placeholder:text-white/20 focus:border-white/[0.14] focus:bg-white/[0.06] focus:ring-1 focus:ring-white/[0.08]";
const labelCls =
  "text-[11px] text-white/40 uppercase tracking-wider font-semibold block mb-1.5";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, total_requests: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Create form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRateLimit, setFormRateLimit] = useState(60);
  const [formPerms, setFormPerms] = useState<string[]>(["read"]);
  const [creating, setCreating] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/api-keys", {
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      const data = await res.json();
      setKeys(data.keys || []);
      setStats(data.stats || { total: 0, active: 0, inactive: 0, total_requests: 0 });
    } catch (err) {
      console.error("Failed to fetch keys:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({
          name: formName.trim(),
          owner_id: formEmail.trim() || formName.trim().toLowerCase().replace(/\s+/g, "_"),
          permissions: formPerms,
          rate_limit_per_minute: formRateLimit,
        }),
      });
      const data = await res.json();
      if (data.raw_key) {
        setNewKeyRevealed(data.raw_key);
        setFormName("");
        setFormEmail("");
        setFormRateLimit(60);
        setFormPerms(["read"]);
        fetchKeys();
      }
    } catch (err) {
      console.error("Create failed:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    setTogglingId(id);
    try {
      await fetch("/api/admin/api-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ id, is_active: !currentActive }),
      });
      fetchKeys();
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch("/api/admin/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
        body: JSON.stringify({ id }),
      });
      setDeleteConfirm(null);
      fetchKeys();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskKey = (key: string) => {
    if (key.length < 12) return key;
    return key.slice(0, 8) + "..." + key.slice(-4);
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const permToggle = (perm: string) => {
    setFormPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  // ---- KPI Cards ----
  const kpis = [
    { label: "Total Clientes", value: stats.total, icon: "group", color: "#5B9DFF" },
    { label: "Keys Ativas", value: stats.active, icon: "check_circle", color: "#10b981" },
    { label: "Keys Inativas", value: stats.inactive, icon: "cancel", color: "#ef4444" },
    { label: "Total Requests", value: stats.total_requests.toLocaleString("pt-BR"), icon: "trending_up", color: "#80FF00" },
  ];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-[#80FF00] rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl pb-24 lg:pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">API Keys</h1>
          <p className="text-white/40 text-sm mt-1">Gerencie as chaves de acesso dos seus clientes</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setNewKeyRevealed(null); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#80FF00] text-black font-semibold text-sm rounded-xl hover:bg-[#80FF00]/80 active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nova API Key
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-white/[0.06] overflow-hidden p-4 sm:p-5"
            style={{ background: `linear-gradient(135deg, #111827 0%, ${k.color}08 100%)` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-sm" style={{ color: k.color }}>{k.icon}</span>
              <span className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">{k.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#12101A] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
          <span className="material-symbols-outlined text-[#80FF00]">vpn_key</span>
          <h2 className="text-white font-semibold">Chaves de API ({keys.length})</h2>
        </div>

        {keys.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-white/20 mb-3 block">key_off</span>
            <p className="text-white/40 text-sm">Nenhuma API key criada ainda</p>
            <p className="text-white/20 text-xs mt-1">Clique em &quot;Nova API Key&quot; para criar a primeira</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-6 py-3 text-left text-[11px] text-white/40 uppercase tracking-wider font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left text-[11px] text-white/40 uppercase tracking-wider font-semibold">Key</th>
                  <th className="px-4 py-3 text-center text-[11px] text-white/40 uppercase tracking-wider font-semibold">Status</th>
                  <th className="px-4 py-3 text-right text-[11px] text-white/40 uppercase tracking-wider font-semibold">Requests</th>
                  <th className="px-4 py-3 text-right text-[11px] text-white/40 uppercase tracking-wider font-semibold hidden md:table-cell">Rate Limit</th>
                  <th className="px-4 py-3 text-right text-[11px] text-white/40 uppercase tracking-wider font-semibold hidden lg:table-cell">Ultimo Uso</th>
                  <th className="px-4 py-3 text-right text-[11px] text-white/40 uppercase tracking-wider font-semibold hidden lg:table-cell">Criada</th>
                  <th className="px-6 py-3 text-right text-[11px] text-white/40 uppercase tracking-wider font-semibold">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-white">{k.name}</div>
                      <div className="text-[11px] text-white/30">{k.owner_id}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-white/60 bg-white/[0.04] px-2 py-1 rounded-lg font-mono">
                          {maskKey(k.key)}
                        </code>
                        <button
                          onClick={() => copyToClipboard(k.key)}
                          className="text-white/30 hover:text-white/60 transition-colors"
                          title="Copiar key completa"
                        >
                          <span className="material-symbols-outlined text-[16px]">content_copy</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => handleToggle(k.id, k.is_active)}
                        disabled={togglingId === k.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                          k.is_active
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}
                      >
                        {togglingId === k.id ? (
                          <span className="animate-spin material-symbols-outlined text-[12px]">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-[12px]">
                            {k.is_active ? "check_circle" : "cancel"}
                          </span>
                        )}
                        {k.is_active ? "Ativa" : "Inativa"}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right text-white/70 font-mono text-xs">
                      {(k.request_count || 0).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3.5 text-right text-white/40 text-xs hidden md:table-cell">
                      {k.rate_limit_per_minute}/min
                    </td>
                    <td className="px-4 py-3.5 text-right text-white/30 text-xs hidden lg:table-cell">
                      {formatDate(k.last_used_at)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-white/30 text-xs hidden lg:table-cell">
                      {formatDate(k.created_at)}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {deleteConfirm === k.id ? (
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleDelete(k.id)}
                            className="text-[11px] px-2.5 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-[11px] px-2.5 py-1 bg-white/[0.04] text-white/40 rounded-lg hover:bg-white/[0.08] transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(k.id)}
                          className="text-white/20 hover:text-red-400 transition-colors"
                          title="Deletar"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Permissions legend */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#12101A] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
          <span className="material-symbols-outlined text-[#5B9DFF]">info</span>
          <h2 className="text-white font-semibold text-sm">Como Usar</h2>
        </div>
        <div className="px-6 py-4 space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <code className="bg-white/[0.04] px-2 py-1 rounded-lg text-xs text-[#80FF00] font-mono shrink-0">curl</code>
            <code className="text-white/60 text-xs break-all">
              curl &quot;https://seu-app.vercel.app/api/v1/prices/crypto?symbols=BTC,ETH&currency=BRL&quot; -H &quot;x-api-key: wfp_xxx&quot;
            </code>
          </div>
          <div className="flex items-start gap-3">
            <code className="bg-white/[0.04] px-2 py-1 rounded-lg text-xs text-[#A0FF40] font-mono shrink-0">fetch</code>
            <code className="text-white/60 text-xs break-all">
              {`fetch("/api/v1/weather?city=sao-paulo", { headers: { "x-api-key": "wfp_xxx" } })`}
            </code>
          </div>
          <p className="text-white/30 text-xs">Endpoints disponiveis: /api/v1/health, /api/v1/prices/crypto, /api/v1/prices/forex, /api/v1/prices/stocks, /api/v1/weather, /api/v1/sports, /api/v1/resolve</p>
        </div>
      </div>

      {/* ---- Create Modal ---- */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreate(false); setNewKeyRevealed(null); }}>
          <div
            className="w-full max-w-lg rounded-2xl border border-white/[0.06] bg-[#12101A] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#80FF00]">add_circle</span>
                <h3 className="text-white font-semibold">Nova API Key</h3>
              </div>
              <button onClick={() => { setShowCreate(false); setNewKeyRevealed(null); }} className="text-white/30 hover:text-white/60">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {newKeyRevealed ? (
              /* Key revealed screen */
              <div className="p-6 space-y-4">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                  <span className="material-symbols-outlined text-emerald-400 text-3xl mb-2 block">check_circle</span>
                  <p className="text-emerald-400 font-semibold text-sm mb-1">API Key criada com sucesso!</p>
                  <p className="text-white/40 text-xs">Copie agora — ela nao sera exibida novamente completa.</p>
                </div>
                <div className="relative">
                  <code className="block w-full bg-white/[0.04] rounded-xl px-4 py-3.5 text-[#80FF00] text-sm font-mono border border-white/[0.06] break-all select-all">
                    {newKeyRevealed}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newKeyRevealed)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-[#80FF00] text-black text-xs font-semibold rounded-lg hover:bg-[#80FF00]/80 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                </div>
                <button
                  onClick={() => { setShowCreate(false); setNewKeyRevealed(null); }}
                  className="w-full py-3 bg-white/[0.04] text-white/60 rounded-xl text-sm hover:bg-white/[0.08] transition-all"
                >
                  Fechar
                </button>
              </div>
            ) : (
              /* Create form */
              <div className="p-6 space-y-4">
                <div>
                  <label className={labelCls}>Nome do Cliente *</label>
                  <input
                    type="text"
                    placeholder="Ex: App do Joao, Empresa X..."
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Email / Identificador</label>
                  <input
                    type="text"
                    placeholder="Ex: joao@empresa.com (opcional)"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Rate Limit (req/min)</label>
                  <input
                    type="number"
                    value={formRateLimit}
                    onChange={(e) => setFormRateLimit(parseInt(e.target.value) || 60)}
                    min={1}
                    max={9999}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Permissoes</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {["read", "write", "resolve"].map((perm) => (
                      <button
                        key={perm}
                        onClick={() => permToggle(perm)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          formPerms.includes(perm)
                            ? "bg-[#80FF00]/10 text-[#80FF00] border-[#80FF00]/20"
                            : "bg-white/[0.02] text-white/30 border-white/[0.06] hover:border-white/[0.12]"
                        }`}
                      >
                        {perm === "read" && "Leitura (precos, clima, esportes)"}
                        {perm === "write" && "Escrita (criar mercados, apostas)"}
                        {perm === "resolve" && "Resolver (fechar mercados)"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-3 bg-white/[0.04] text-white/60 rounded-xl text-sm hover:bg-white/[0.08] transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!formName.trim() || creating}
                    className="flex-1 py-3 bg-[#80FF00] text-black font-semibold rounded-xl text-sm hover:bg-[#80FF00]/80 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <span className="animate-spin material-symbols-outlined text-[16px]">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">vpn_key</span>
                    )}
                    {creating ? "Gerando..." : "Gerar API Key"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
