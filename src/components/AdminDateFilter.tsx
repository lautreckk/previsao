"use client";

import { useState } from "react";

interface AdminDateFilterProps {
  startDate: string;
  endDate: string;
  onChangeStart: (date: string) => void;
  onChangeEnd: (date: string) => void;
}

export default function AdminDateFilter({ startDate, endDate, onChangeStart, onChangeEnd }: AdminDateFilterProps) {
  const [open, setOpen] = useState(false);

  const setPreset = (days: number | "today" | "all") => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    onChangeEnd(end.toISOString().slice(0, 10));

    if (days === "today") {
      onChangeStart(new Date().toISOString().slice(0, 10));
    } else if (days === "all") {
      onChangeStart("2024-01-01");
    } else {
      const start = new Date(Date.now() - days * 86400000);
      onChangeStart(start.toISOString().slice(0, 10));
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Quick presets */}
      <div className="flex items-center gap-1 bg-[#12101A] border border-white/[0.06] rounded-lg p-1">
        {[
          { label: "Hoje", value: "today" as const },
          { label: "7d", value: 7 },
          { label: "30d", value: 30 },
          { label: "Tudo", value: "all" as const },
        ].map((p) => (
          <button
            key={String(p.value)}
            onClick={() => setPreset(p.value)}
            className="px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all text-white/30 hover:text-white/60"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date inputs */}
      <div className="flex items-center gap-1.5 bg-[#12101A] border border-white/[0.06] rounded-lg p-1">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onChangeStart(e.target.value)}
          className="bg-transparent text-[11px] text-white/70 outline-none px-2 py-1.5 rounded-md focus:bg-white/[0.04] [color-scheme:dark] w-[120px]"
        />
        <span className="text-white/20 text-[10px]">até</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onChangeEnd(e.target.value)}
          className="bg-transparent text-[11px] text-white/70 outline-none px-2 py-1.5 rounded-md focus:bg-white/[0.04] [color-scheme:dark] w-[120px]"
        />
      </div>
    </div>
  );
}
