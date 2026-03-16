"use client";

import { Market } from "@/lib/markets";
import Link from "next/link";

function StatusBadge({ status, timeLeft }: { status: Market["status"]; timeLeft?: string }) {
  if (status === "live") {
    return (
      <div className="flex items-center justify-between w-full pt-2 border-t border-[#2A2A2A] mt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse-live" />
          <span className="text-xs font-semibold text-yellow-500 uppercase">Ao Vivo</span>
        </div>
        {timeLeft && (
          <div className="flex items-center gap-1 text-[#9CA3AF]">
            <span className="material-icons-outlined text-sm">schedule</span>
            <span className="text-xs font-medium">{timeLeft}</span>
          </div>
        )}
      </div>
    );
  }

  if (status === "closing") {
    return (
      <div className="flex items-center justify-between w-full pt-2 border-t border-[#2A2A2A] mt-1">
        <div className="h-4" />
        {timeLeft && (
          <div className="flex items-center gap-1 text-[#FF3B30]">
            <span className="material-icons-outlined text-sm">timer</span>
            <span className="text-xs font-medium">{timeLeft}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between w-full pt-2 border-t border-[#2A2A2A] mt-1">
      <div className="h-4" />
      {timeLeft && (
        <div className="flex items-center gap-1 text-yellow-500">
          <span className="material-icons-outlined text-sm">schedule</span>
          <span className="text-xs font-medium">{timeLeft}</span>
        </div>
      )}
    </div>
  );
}

function OptionBar({ option }: { option: Market["options"][0] }) {
  const isGreen = option.color === "green" || option.color === "blue";
  const barColor = option.color === "red" ? "rgba(255,59,48,0.2)" : "rgba(0,200,83,0.2)";
  const textColor = option.color === "red" ? "#FF3B30" : "#00C853";
  const borderColor = option.color === "red" ? "rgba(255,59,48,0.3)" : "rgba(0,200,83,0.3)";
  const bgColor = option.color === "red" ? "rgba(255,59,48,0.1)" : "rgba(0,200,83,0.1)";

  const icon = option.color === "red" ? "arrow_drop_down" : option.color === "gray" ? "drag_handle" : "arrow_drop_up";

  return (
    <div className="relative w-full bg-[#2A2A2A] rounded-lg h-10 flex items-center px-3 justify-between overflow-hidden">
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{ width: `${option.probability}%`, backgroundColor: barColor }}
      />
      <div className="flex items-center gap-2 z-10">
        <span className="material-icons-outlined text-sm" style={{ color: textColor }}>
          {icon}
        </span>
        <span className="text-sm font-medium text-gray-200">
          {option.name}{" "}
          <span className="text-xs text-[#9CA3AF] ml-1">{option.odds}x</span>
        </span>
      </div>
      <span
        className="text-sm font-bold z-10 px-2 py-0.5 rounded-md"
        style={{ color: textColor, borderColor, backgroundColor: bgColor, border: `1px solid ${borderColor}` }}
      >
        {option.probability}%
      </span>
    </div>
  );
}

export default function MarketCard({ market }: { market: Market }) {
  return (
    <div className="bg-[#1E1E1E] rounded-xl p-4 shadow-sm border border-[#2A2A2A] flex flex-col gap-4 animate-fade-in-up">
      <Link href={`/evento/${market.id}`} className="flex flex-col gap-3 cursor-pointer">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] bg-[#2A2A2A] px-2 py-0.5 rounded-sm w-max">
              {market.category}
            </span>
            <div className="flex items-start gap-2">
              {market.image ? (
                <img
                  alt={market.title}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                  src={market.image}
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-green-900 flex items-center justify-center shrink-0">
                  <span className="material-icons-outlined text-white text-sm">{market.categoryIcon}</span>
                </div>
              )}
              <h2 className="text-base font-semibold leading-tight text-white line-clamp-2">
                {market.title}
              </h2>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {market.options.slice(0, 3).map((option) => (
            <OptionBar key={option.id} option={option} />
          ))}
        </div>

        <StatusBadge status={market.status} timeLeft={market.timeLeft} />
      </Link>
    </div>
  );
}
