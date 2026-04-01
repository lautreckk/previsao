"use client";

import { FileText } from "lucide-react";

interface BettingSlipProps {
  isOpen: boolean;
  chatOpen?: boolean;
}

export default function BettingSlip({ isOpen, chatOpen }: BettingSlipProps) {
  if (!isOpen) return null;

  return (
    <aside
      className="hidden xl:flex flex-col w-72 fixed top-[88px] bottom-0 border-l border-[hsl(0,0%,18%)] bg-[hsl(0,0%,11%)] z-10 transition-all duration-300"
      style={{ right: chatOpen ? '264px' : '32px' }}
    >
      {/* Header */}
      <div className="p-4 border-b border-[hsl(0,0%,18%)]">
        <div className="inline-flex rounded-full bg-[hsl(0,0%,14%)] px-3 py-1 text-sm font-semibold text-[hsl(0,0%,95%)]">
          1. Escolha sua Previsão
        </div>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center flex-1 text-center px-4">
        <FileText size={40} className="text-[hsl(0,0%,55%)] mb-3" />
        <p className="text-sm text-[hsl(0,0%,55%)]">
          Você ainda não escolheu um mercado.
        </p>
      </div>

      {/* Footer */}
      <p className="text-[10px] text-[hsl(0,0%,55%)] p-4 text-center border-t border-[hsl(0,0%,18%)]">
        Ao realizar uma previsão você aceita os{" "}
        <span className="text-[#80FF00] hover:underline cursor-pointer">Termos de Serviço</span>.
      </p>
    </aside>
  );
}
