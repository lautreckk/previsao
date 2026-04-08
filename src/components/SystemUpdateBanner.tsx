"use client";

import { useState, useEffect } from "react";

const CURRENT_VERSION = "2026-04-08-v2";

export default function SystemUpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("palpitex_version");
    if (stored !== CURRENT_VERSION) {
      setShow(true);
    }
  }, []);

  function handleUpdate() {
    // Clear old cached data
    const keysToKeep = ["winify_age_verified", "sb-lascuhuavugcmcicnnqi-auth-token"];
    const saved: Record<string, string> = {};
    for (const k of keysToKeep) {
      const v = localStorage.getItem(k);
      if (v) saved[k] = v;
    }
    localStorage.clear();
    for (const [k, v] of Object.entries(saved)) {
      localStorage.setItem(k, v);
    }
    localStorage.setItem("palpitex_version", CURRENT_VERSION);
    window.location.reload();
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#161b22] border border-[#80FF00]/30 rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl shadow-[#80FF00]/10 text-center">
        <div className="text-3xl mb-3">🔄</div>
        <h2 className="text-white text-lg font-bold mb-2">Atualização do Sistema</h2>
        <p className="text-white/60 text-sm mb-5 leading-relaxed">
          Uma nova versão está disponível com melhorias e câmeras ao vivo. Atualize para continuar com a melhor experiência.
        </p>
        <button
          onClick={handleUpdate}
          className="w-full bg-[#80FF00] text-[#0a0a0a] font-bold py-3 rounded-xl text-sm hover:bg-[#6de600] transition-colors"
        >
          Atualizar agora
        </button>
      </div>
    </div>
  );
}
