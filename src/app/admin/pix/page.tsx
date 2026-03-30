"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface PixTx {
  id: string; user_id: string | null; user_email: string; amount: number;
  status: string; external_id: string; transaction_id: string;
  created_at: string; paid_at: string | null;
}

export default function AdminPix() {
  const [txs, setTxs] = useState<PixTx[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase.from("pix_transactions").select("*").order("created_at", { ascending: false }).limit(200);
    setTxs((data as PixTx[]) || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); const iv = setInterval(refresh, 10000); return () => clearInterval(iv); }, []);

  const showMsg = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Confirm a single PIX deposit
  const confirmPix = async (pixId: string) => {
    setConfirming(pixId);
    try {
      const res = await fetch("/api/admin/confirm-pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixId }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg(`Confirmado! ${data.userEmail} recebeu R$ ${data.amount.toFixed(2)} (saldo: R$ ${data.newBalance.toFixed(2)})`, "success");
        refresh();
      } else if (data.alreadyPaid) {
        showMsg("Ja estava confirmado", "success");
        refresh();
      } else {
        showMsg(data.error || "Erro ao confirmar", "error");
      }
    } catch {
      showMsg("Erro de conexao", "error");
    }
    setConfirming(null);
  };

  // Bulk confirm all pending
  const bulkConfirm = async () => {
    if (!confirm("Confirmar TODOS os depositos pendentes e creditar saldo dos usuarios?")) return;
    setBulkConfirming(true);
    try {
      const res = await fetch("/api/admin/confirm-pix", { method: "PUT" });
      const data = await res.json();
      if (data.success) {
        showMsg(`${data.confirmed} de ${data.total} depositos confirmados!`, "success");
        refresh();
      } else {
        showMsg(data.message || data.error || "Nenhum pendente", "success");
      }
    } catch {
      showMsg("Erro de conexao", "error");
    }
    setBulkConfirming(false);
  };

  const filtered = filter === "all" ? txs : txs.filter((t) => t.status === filter);
  const totalGenerated = txs.length;
  const totalPaid = txs.filter((t) => t.status === "paid").length;
  const totalPending = txs.filter((t) => t.status === "pending").length;
  const totalAmountPaid = txs.filter((t) => t.status === "paid").reduce((s, t) => s + Number(t.amount), 0);
  const totalAmountPending = txs.filter((t) => t.status === "pending").reduce((s, t) => s + Number(t.amount), 0);

  const filterTabs: [string, string][] = [["all", "Todos"], ["paid", "Pagos"], ["pending", "Pendentes"]];

  const Spinner = ({ size = "h-4 w-4" }: { size?: string }) => (
    <svg className={`animate-spin ${size}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-headline font-black text-2xl tracking-tight text-white">
            Transacoes PIX
          </h2>
          <p className="text-xs text-white/40 mt-0.5">Gestao de depositos e confirmacoes</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-white/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Auto 10s
          </div>
          <button
            onClick={refresh}
            className="text-xs text-white/50 hover:text-white/80 transition-colors font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.06] hover:border-white/[0.12] bg-white/[0.03]"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>Atualizar
          </button>
        </div>
      </div>

      {/* Alert message */}
      {message && (
        <div
          className={`
            rounded-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-xl border transition-all
            ${message.type === "success"
              ? "bg-emerald-500/[0.08] border-emerald-500/[0.15] text-emerald-400"
              : "bg-red-500/[0.08] border-red-500/[0.15] text-red-400"
            }
          `}
        >
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            {message.type === "success" ? "check_circle" : "error"}
          </span>
          <p className="text-sm font-medium flex-1">{message.text}</p>
          <button
            onClick={() => setMessage(null)}
            className="opacity-40 hover:opacity-80 transition-opacity"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "PIX Gerados", value: totalGenerated.toString(), accent: "text-white" },
          { label: "PIX Pagos", value: totalPaid.toString(), accent: "text-emerald-400" },
          { label: "PIX Pendentes", value: totalPending.toString(), accent: "text-amber-400" },
          { label: "Valor Pago", value: `R$ ${totalAmountPaid.toFixed(2)}`, accent: "text-emerald-400", small: true },
          { label: "Valor Pendente", value: `R$ ${totalAmountPending.toFixed(2)}`, accent: "text-amber-400", small: true },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111827]/80 backdrop-blur-xl p-4"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
            <p className="relative text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-2">
              {kpi.label}
            </p>
            <p className={`relative font-headline font-black ${kpi.small ? "text-lg" : "text-2xl"} ${kpi.accent} tracking-tight`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter tabs + Bulk action */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Pill-shaped segmented control */}
        <div className="inline-flex items-center rounded-full bg-white/[0.04] border border-white/[0.06] p-1">
          {filterTabs.map(([key, label]) => {
            const count = key === "all" ? txs.length : key === "paid" ? totalPaid : totalPending;
            const isActive = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`
                  relative px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200
                  ${isActive
                    ? "bg-white/[0.10] text-white shadow-sm"
                    : "text-white/35 hover:text-white/60"
                  }
                `}
              >
                {label}
                <span className={`ml-1.5 ${isActive ? "text-white/60" : "text-white/20"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {totalPending > 0 && (
          <button
            onClick={bulkConfirm}
            disabled={bulkConfirming}
            className="
              px-5 py-2 rounded-full text-xs font-bold tracking-wide
              bg-emerald-500/90 text-white
              hover:bg-emerald-500 active:scale-[0.97]
              transition-all disabled:opacity-40
              flex items-center gap-2
              shadow-[0_0_20px_rgba(16,185,129,0.15)]
            "
          >
            {bulkConfirming ? (
              <><Spinner size="h-3.5 w-3.5" />Processando...</>
            ) : (
              <><span className="material-symbols-outlined text-sm">done_all</span>Confirmar Todos ({totalPending})</>
            )}
          </button>
        )}
      </div>

      {/* Warning banner */}
      {totalPending > 0 && (
        <div className="rounded-2xl border border-amber-500/[0.12] bg-amber-500/[0.05] backdrop-blur-xl px-4 py-3 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-400/70 text-lg mt-0.5">info</span>
          <div>
            <p className="text-xs font-semibold text-amber-400/80 mb-0.5">Depositos pendentes detectados</p>
            <p className="text-[11px] text-white/30 leading-relaxed">
              O webhook da BSPay pode nao estar chegando. Verifique a URL de callback (WEBHOOK_BASE_URL) e confira no painel da BSPay quais depositos foram pagos. Use o botao &quot;Confirmar&quot; para creditar manualmente.
            </p>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Usuario", "Valor", "Status", "IDs", "Data", "Acoes"].map((h, i) => (
                  <th
                    key={h}
                    className={`
                      px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/25
                      ${i === 1 || i === 2 || i === 5 ? "text-center" : "text-left"}
                    `}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-white/20">
                      <Spinner size="h-5 w-5" />
                      <span className="text-xs">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-white/20 text-xs">
                    Nenhuma transacao encontrada
                  </td>
                </tr>
              ) : filtered.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-white/80">{tx.user_email || "---"}</p>
                    <p className="text-[10px] text-white/20 font-mono mt-0.5">{tx.user_id?.slice(0, 16) || "sem user_id"}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono font-bold text-white/90 text-sm">
                      R$ {Number(tx.amount).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`
                        inline-flex items-center text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full
                        ${tx.status === "paid"
                          ? "bg-emerald-500/[0.1] text-emerald-400"
                          : "bg-amber-500/[0.1] text-amber-400"
                        }
                      `}
                    >
                      {tx.status === "paid" ? "Pago" : "Pendente"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-[10px] text-white/20 truncate max-w-[180px]" title={tx.external_id}>
                      ext: {tx.external_id || "---"}
                    </p>
                    <p className="font-mono text-[10px] text-white/20 truncate max-w-[180px]" title={tx.id}>
                      id: {tx.id}
                    </p>
                    {tx.transaction_id && (
                      <p className="font-mono text-[10px] text-white/20 truncate max-w-[180px]" title={tx.transaction_id}>
                        tx: {tx.transaction_id}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-white/30">{new Date(tx.created_at).toLocaleString("pt-BR")}</p>
                    {tx.paid_at && (
                      <p className="text-[10px] text-emerald-400/60 mt-0.5">
                        Pago: {new Date(tx.paid_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tx.status === "pending" ? (
                      <button
                        onClick={() => confirmPix(tx.id)}
                        disabled={confirming === tx.id}
                        className="
                          inline-flex items-center gap-1.5
                          px-3.5 py-1.5 rounded-full
                          bg-emerald-500/90 text-white
                          text-[10px] font-bold tracking-wide
                          hover:bg-emerald-500 active:scale-95
                          transition-all disabled:opacity-40
                          shadow-[0_0_12px_rgba(16,185,129,0.12)]
                        "
                      >
                        {confirming === tx.id ? (
                          <Spinner size="h-3 w-3" />
                        ) : (
                          <span className="material-symbols-outlined text-xs">check</span>
                        )}
                        Confirmar
                      </button>
                    ) : (
                      <span
                        className="material-symbols-outlined text-emerald-400/60 text-lg"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        verified
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-white/20 py-10">
            <Spinner size="h-5 w-5" />
            <span className="text-xs">Carregando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-white/20 text-xs py-10">
            Nenhuma transacao encontrada
          </div>
        ) : filtered.map((tx) => (
          <div
            key={tx.id}
            className="rounded-2xl border border-white/[0.06] bg-[#111827]/60 backdrop-blur-xl p-4 space-y-3"
          >
            {/* Card header: user + status */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/80 truncate">{tx.user_email || "---"}</p>
                <p className="text-[10px] text-white/20 font-mono mt-0.5">{tx.user_id?.slice(0, 16) || "sem user_id"}</p>
              </div>
              <span
                className={`
                  flex-shrink-0 inline-flex items-center text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full
                  ${tx.status === "paid"
                    ? "bg-emerald-500/[0.1] text-emerald-400"
                    : "bg-amber-500/[0.1] text-amber-400"
                  }
                `}
              >
                {tx.status === "paid" ? "Pago" : "Pendente"}
              </span>
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-white/90 text-lg">
                R$ {Number(tx.amount).toFixed(2)}
              </span>
              <span className="text-[10px] text-white/20">
                {new Date(tx.created_at).toLocaleString("pt-BR")}
              </span>
            </div>

            {/* IDs (collapsed) */}
            <div className="space-y-0.5">
              <p className="font-mono text-[10px] text-white/15 truncate" title={tx.external_id}>
                ext: {tx.external_id || "---"}
              </p>
              <p className="font-mono text-[10px] text-white/15 truncate" title={tx.id}>
                id: {tx.id}
              </p>
              {tx.transaction_id && (
                <p className="font-mono text-[10px] text-white/15 truncate" title={tx.transaction_id}>
                  tx: {tx.transaction_id}
                </p>
              )}
            </div>

            {/* Paid at + action */}
            <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
              {tx.paid_at ? (
                <p className="text-[10px] text-emerald-400/60">
                  Pago: {new Date(tx.paid_at).toLocaleString("pt-BR")}
                </p>
              ) : (
                <span />
              )}
              {tx.status === "pending" ? (
                <button
                  onClick={() => confirmPix(tx.id)}
                  disabled={confirming === tx.id}
                  className="
                    inline-flex items-center gap-1.5
                    px-4 py-1.5 rounded-full
                    bg-emerald-500/90 text-white
                    text-[11px] font-bold tracking-wide
                    hover:bg-emerald-500 active:scale-95
                    transition-all disabled:opacity-40
                    shadow-[0_0_12px_rgba(16,185,129,0.12)]
                  "
                >
                  {confirming === tx.id ? (
                    <Spinner size="h-3 w-3" />
                  ) : (
                    <span className="material-symbols-outlined text-xs">check</span>
                  )}
                  Confirmar
                </button>
              ) : (
                <span
                  className="material-symbols-outlined text-emerald-400/60 text-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
