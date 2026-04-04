"use client";

import { useState } from "react";

interface AdminDateFilterProps {
  startDate: string;
  endDate: string;
  onChangeStart: (date: string) => void;
  onChangeEnd: (date: string) => void;
  onFilter: () => void;
}

export default function AdminDateFilter({ startDate, endDate, onChangeStart, onChangeEnd, onFilter }: AdminDateFilterProps) {
  const setPreset = (days: number | "today" | "all") => {
    const end = new Date();
    onChangeEnd(end.toISOString().slice(0, 10));
    if (days === "today") {
      onChangeStart(new Date().toISOString().slice(0, 10));
    } else if (days === "all") {
      onChangeStart("2024-01-01");
    } else {
      onChangeStart(new Date(Date.now() - days * 86400000).toISOString().slice(0, 10));
    }
    setTimeout(onFilter, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onFilter();
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Presets */}
      <div className="flex items-center gap-0.5 bg-[#12101A] border border-white/[0.06] rounded-lg p-0.5">
        {[
          { label: "Hoje", value: "today" as const },
          { label: "7d", value: 7 },
          { label: "30d", value: 30 },
          { label: "Tudo", value: "all" as const },
        ].map((p) => (
          <button
            key={String(p.value)}
            onClick={() => setPreset(p.value)}
            className="px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all text-white/30 hover:text-white hover:bg-white/[0.06]"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date range + Filter button */}
      <form onSubmit={(e) => { e.preventDefault(); onFilter(); }} className="flex items-center gap-0 bg-[#12101A] border border-white/[0.06] rounded-lg overflow-hidden">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onChangeStart(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-transparent text-[11px] text-white/70 outline-none px-2.5 py-2 [color-scheme:dark] w-[115px] focus:bg-white/[0.04]"
        />
        <span className="text-white/15 text-[10px] px-1">→</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onChangeEnd(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-transparent text-[11px] text-white/70 outline-none px-2.5 py-2 [color-scheme:dark] w-[115px] focus:bg-white/[0.04]"
        />
        <button
          type="submit"
          className="px-3 py-2 bg-[#80FF00] text-[#0a0a0a] text-[11px] font-black uppercase tracking-wider hover:opacity-90 transition-opacity"
        >
          Filtrar
        </button>
      </form>
    </div>
  );
}
