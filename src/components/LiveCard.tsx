"use client";

import Link from "next/link";

export default function LiveCard() {
  return (
    <Link
      href="/camera"
      className="relative rounded-xl overflow-hidden mb-5 cursor-pointer group block h-36 sm:h-44 lg:h-48"
    >
      {/* Background - gradient only, no conflicting image text */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0d1117] via-[#1a2332] to-[#0d1117]" />
      <img
        src="https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&q=80"
        alt="Ao Vivo - Rodovia"
        className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0d1117]/90 via-transparent to-[#0d1117]/70" />

      {/* Badge */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
        <span className="flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          AO VIVO
        </span>
      </div>

      {/* Text */}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 max-w-[80%]">
        <p className="text-base sm:text-xl lg:text-2xl font-black text-white leading-tight">
          Quantos carros passam
        </p>
        <p className="text-base sm:text-xl lg:text-2xl font-black text-[#80FF00] leading-tight">
          nos próximos 5 minutos?
        </p>
      </div>

      {/* Arrow */}
      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-[#80FF00]/20 transition-colors">
        <span className="text-white/60 text-lg">→</span>
      </div>
    </Link>
  );
}
