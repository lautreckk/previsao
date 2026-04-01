"use client";

interface AgeVerificationModalProps {
  onConfirm: () => void;
}

export default function AgeVerificationModal({ onConfirm }: AgeVerificationModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#121212]/80 backdrop-blur-sm">
      <div className="bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,18%)] rounded-2xl p-8 max-w-md w-full mx-4 text-center">
        <h2 className="text-2xl font-bold text-[#80FF00] mb-2">PALPITEX</h2>
        <h3 className="text-lg font-semibold text-[hsl(0,0%,95%)] mb-3">
          Você tem mais de 18 anos?
        </h3>
        <p className="text-[hsl(0,0%,55%)] text-sm mb-6">
          O acesso à nossa plataforma é permitido apenas para maiores de idade.
          Confirme que você possui 18 anos ou mais para continuar.
        </p>
        <button
          onClick={onConfirm}
          className="w-full bg-[#80FF00] text-[#0a0a0a] font-bold py-3 rounded-lg mb-3 hover:opacity-90 transition-opacity"
        >
          SIM, TENHO MAIS DE 18 ANOS
        </button>
        <button className="w-full border border-[hsl(0,0%,18%)] text-[hsl(0,0%,95%)] font-bold py-3 rounded-lg hover:bg-[hsl(0,0%,14%)] transition-colors">
          NÃO
        </button>
        <p className="text-[hsl(0,0%,55%)] text-xs mt-4">
          Jogar com responsabilidade é essencial. Caso você não atenda aos
          requisitos legais, pedimos que encerre a navegação.
        </p>
      </div>
    </div>
  );
}
