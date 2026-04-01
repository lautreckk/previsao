"use client";

import { CheckCircle2 } from "lucide-react";

interface OddsButtonProps {
  label: string;
  odds: string;
  variant: "sim" | "nao";
  size?: "sm" | "lg";
  onClick?: (e: React.MouseEvent) => void;
}

export default function OddsButton({ label, odds, variant, size = "sm", onClick }: OddsButtonProps) {
  const isYes = variant === "sim";

  if (size === "lg") {
    return (
      <button
        onClick={onClick}
        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-base font-bold transition-opacity hover:opacity-80 ${
          isYes
            ? "border-[hsl(142,70%,45%)]/40 bg-[hsl(142,70%,45%)]/15 text-[hsl(142,70%,45%)]"
            : "border-[hsl(0,84%,60%)]/40 bg-[hsl(0,84%,60%)]/15 text-[hsl(0,84%,60%)]"
        }`}
      >
        <CheckCircle2 size={16} />
        {label} {odds}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80 ${
        isYes
          ? "bg-[hsl(142,70%,45%)]/15 text-[hsl(142,70%,45%)]"
          : "bg-[hsl(0,84%,60%)]/15 text-[hsl(0,84%,60%)]"
      }`}
    >
      <CheckCircle2 size={12} />
      {label} {odds}
    </button>
  );
}
