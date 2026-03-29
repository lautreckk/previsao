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

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-headline font-black text-2xl tracking-tight">Transacoes PIX</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-[#8B95A8]">
            <div className="w-2 h-2 rounded-full bg-[#00FFB8] animate-pulse" />Auto 10s
          </div>
          <button onClick={refresh} className="text-xs text-[#5B9DFF] font-bold hover:underline flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">refresh</span>Atualizar
          </button>
        </div>
      </div>

      {/* Alert message */}
      {message && (
        <div className={`rounded-2xl p-4 flex items-center gap-3 border animate-fade-in-up ${message.type === "success" ? "bg-[#00FFB8]/10 border-[#00FFB8]/30 text-[#00FFB8]" : "bg-[#FF5252]/10 border-[#FF5252]/30 text-[#FF5252]"}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{message.type === "success" ? "check_circle" : "error"}</span>
          <p className="text-sm font-bold flex-1">{message.text}</p>
          <button onClick={() => setMessage(null)} className="opacity-60 hover:opacity-100"><span className="material-symbols-outlined text-sm">close</span></button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#0a1222] rounded-2xl p-4 border border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B95A8] mb-1">PIX Gerados</p>
          <p className="font-headline font-black text-2xl text-white">{totalGenerated}</p>
        </div>
        <div className="bg-[#0a1222] rounded-2xl p-4 border border-[#00FFB8]/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B95A8] mb-1">PIX Pagos</p>
          <p className="font-headline font-black text-2xl text-[#00FFB8]">{totalPaid}</p>
        </div>
        <div className="bg-[#0a1222] rounded-2xl p-4 border border-[#FFC700]/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B95A8] mb-1">PIX Pendentes</p>
          <p className="font-headline font-black text-2xl text-[#FFC700]">{totalPending}</p>
        </div>
        <div className="bg-[#0a1222] rounded-2xl p-4 border border-[#00FFB8]/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B95A8] mb-1">Valor Pago</p>
          <p className="font-headline font-black text-xl text-[#00FFB8]">R$ {totalAmountPaid.toFixed(2)}</p>
        </div>
        <div className="bg-[#0a1222] rounded-2xl p-4 border border-[#FFC700]/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B95A8] mb-1">Valor Pendente</p>
          <p className="font-headline font-black text-xl text-[#FFC700]">R$ {totalAmountPending.toFixed(2)}</p>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {[["all", "Todos"], ["paid", "Pagos"], ["pending", "Pendentes"]].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === key ? "bg-[#00FFB8]/10 text-[#00FFB8] border border-[#00FFB8]/30" : "text-[#8B95A8] hover:text-white"}`}>{label} ({key === "all" ? txs.length : key === "paid" ? totalPaid : totalPending})</button>
          ))}
        </div>
        {totalPending > 0 && (
          <button
            onClick={bulkConfirm}
            disabled={bulkConfirming}
            className="px-5 py-2.5 rounded-xl bg-[#00FFB8] text-[#003D2E] font-black text-sm uppercase tracking-wider hover:bg-[#00FFB8]/90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {bulkConfirming ? (
              <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Processando...</>
            ) : (
              <><span className="material-symbols-outlined text-sm">done_all</span>Confirmar Todos Pendentes ({totalPending})</>
            )}
          </button>
        )}
      </div>

      {/* Warning about webhook */}
      {totalPending > 0 && (
        <div className="bg-[#FFC700]/10 border border-[#FFC700]/30 rounded-2xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-[#FFC700] mt-0.5">warning</span>
          <div>
            <p className="text-sm font-bold text-[#FFC700] mb-1">Depositos pendentes detectados</p>
            <p className="text-xs text-[#8B95A8]">O webhook da BSPay pode nao estar chegando. Verifique a URL de callback (WEBHOOK_BASE_URL) e confira no painel da BSPay quais depositos foram pagos. Use o botao &quot;Confirmar&quot; para creditar manualmente.</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#0a1222] rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-[#8B95A8]">
                <th className="text-left p-3">Usuario</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-center p-3">Status</th>
                <th className="text-left p-3">IDs</th>
                <th className="text-left p-3">Data</th>
                <th className="text-center p-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-6 text-center text-[#8B95A8]">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-[#8B95A8]">Nenhuma transacao</td></tr>
              ) : filtered.map((tx) => (
                <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-3">
                    <p className="text-xs font-bold text-white">{tx.user_email || "—"}</p>
                    <p className="text-[10px] text-[#8B95A8] font-mono">{tx.user_id?.slice(0, 16) || "sem user_id"}</p>
                  </td>
                  <td className="p-3 text-right">
                    <span className="font-mono font-black text-white">R$ {Number(tx.amount).toFixed(2)}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${tx.status === "paid" ? "bg-[#00FFB8]/10 text-[#00FFB8]" : "bg-[#FFC700]/10 text-[#FFC700]"}`}>
                      {tx.status === "paid" ? "PAGO" : "PENDENTE"}
                    </span>
                  </td>
                  <td className="p-3">
                    <p className="font-mono text-[10px] text-[#8B95A8] truncate max-w-[180px]" title={tx.external_id}>ext: {tx.external_id || "—"}</p>
                    <p className="font-mono text-[10px] text-[#8B95A8] truncate max-w-[180px]" title={tx.id}>id: {tx.id}</p>
                    {tx.transaction_id && <p className="font-mono text-[10px] text-[#8B95A8] truncate max-w-[180px]" title={tx.transaction_id}>tx: {tx.transaction_id}</p>}
                  </td>
                  <td className="p-3">
                    <p className="text-xs text-[#8B95A8]">{new Date(tx.created_at).toLocaleString("pt-BR")}</p>
                    {tx.paid_at && <p className="text-[10px] text-[#00FFB8]">Pago: {new Date(tx.paid_at).toLocaleString("pt-BR")}</p>}
                  </td>
                  <td className="p-3 text-center">
                    {tx.status === "pending" ? (
                      <button
                        onClick={() => confirmPix(tx.id)}
                        disabled={confirming === tx.id}
                        className="px-3 py-1.5 rounded-lg bg-[#00FFB8] text-[#003D2E] font-black text-[10px] uppercase tracking-wider hover:bg-[#00FFB8]/80 active:scale-95 transition-all disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {confirming === tx.id ? (
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        ) : (
                          <span className="material-symbols-outlined text-xs">check</span>
                        )}
                        Confirmar
                      </button>
                    ) : (
                      <span className="material-symbols-outlined text-[#00FFB8] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    )}
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
