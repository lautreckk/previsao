"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";

export default function DepositoPage() {
  const router = useRouter();
  const [step, setStep] = useState<"amount" | "form" | "qrcode" | "success">("amount");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{
    qrCode: string;
    qrCodeBase64?: string;
    transactionId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const presetAmounts = [10, 25, 50, 100, 250, 500];

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleGeneratePix = async () => {
    if (!amount || parseFloat(amount) < 1 || !name || !cpf || !email) return;
    setLoading(true);

    try {
      const res = await fetch("/api/bspay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          name,
          document: cpf.replace(/\D/g, ""),
          email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Erro ao gerar QR Code PIX");
        setLoading(false);
        return;
      }

      setPixData({
        qrCode: data.qrCode,
        qrCodeBase64: data.qrCodeBase64,
        transactionId: data.transactionId,
      });
      setStep("qrcode");
    } catch {
      alert("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = async () => {
    if (!pixData?.qrCode) return;
    try {
      await navigator.clipboard.writeText(pixData.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = pixData.qrCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCheckStatus = async () => {
    if (!pixData?.transactionId) return;
    setCheckingStatus(true);
    try {
      const res = await fetch(`/api/bspay?txId=${pixData.transactionId}`);
      const data = await res.json();
      if (data.status === "PAID") {
        setStep("success");
      } else {
        alert("Pagamento ainda não confirmado. Aguarde alguns instantes.");
      }
    } catch {
      alert("Erro ao verificar status.");
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#121212]/90 backdrop-blur-md border-b border-[#2A2A2A] px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white">
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-semibold">Depositar via PIX</h1>
      </div>

      <div className="p-4 max-w-md mx-auto">
        {/* Step: Amount */}
        {step === "amount" && (
          <div className="flex flex-col gap-4 animate-fade-in-up">
            <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2A2A2A]">
              <h2 className="text-sm font-semibold text-[#9CA3AF] mb-3">Qual valor deseja depositar?</h2>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {presetAmounts.map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(String(val))}
                    className={`py-3 rounded-lg text-sm font-semibold transition-colors ${
                      amount === String(val)
                        ? "bg-[#00C853] text-white"
                        : "bg-[#2A2A2A] text-gray-300 hover:bg-[#333]"
                    }`}
                  >
                    R$ {val}
                  </button>
                ))}
              </div>

              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-lg font-semibold">
                  R$
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="1"
                  className="w-full bg-[#2A2A2A] rounded-lg pl-10 pr-4 py-4 text-white text-2xl font-bold outline-none focus:ring-2 focus:ring-[#00C853] border-none"
                />
              </div>

              <p className="text-xs text-[#9CA3AF] mb-4">Valor mínimo: R$ 1,00</p>

              <button
                onClick={() => {
                  if (parseFloat(amount) >= 1) setStep("form");
                }}
                disabled={!amount || parseFloat(amount) < 1}
                className="w-full py-3 rounded-xl bg-[#00C853] text-white font-semibold text-base disabled:opacity-40 transition-opacity"
              >
                Continuar
              </button>
            </div>

            <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2A2A2A]">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-icons-outlined text-[#00C853] text-sm">verified</span>
                <span className="text-sm font-semibold">Depósito Instantâneo</span>
              </div>
              <p className="text-xs text-[#9CA3AF]">
                Pagamentos via PIX são confirmados em segundos. Seu saldo é creditado automaticamente.
              </p>
            </div>
          </div>
        )}

        {/* Step: Form */}
        {step === "form" && (
          <div className="flex flex-col gap-4 animate-fade-in-up">
            <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2A2A2A]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[#9CA3AF]">Dados do pagador</h2>
                <span className="text-lg font-bold text-[#00C853]">R$ {parseFloat(amount).toFixed(2)}</span>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-[#9CA3AF] mb-1 block">Nome completo</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full bg-[#2A2A2A] rounded-lg px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-[#00C853] border-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9CA3AF] mb-1 block">CPF</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="w-full bg-[#2A2A2A] rounded-lg px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-[#00C853] border-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9CA3AF] mb-1 block">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-[#2A2A2A] rounded-lg px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-[#00C853] border-none"
                  />
                </div>
              </div>

              <button
                onClick={handleGeneratePix}
                disabled={loading || !name || !cpf || !email || cpf.replace(/\D/g, "").length < 11}
                className="w-full py-3 rounded-xl bg-[#00C853] text-white font-semibold text-base disabled:opacity-40 transition-opacity mt-4 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Gerando PIX...
                  </>
                ) : (
                  "Gerar QR Code PIX"
                )}
              </button>
            </div>

            <button
              onClick={() => setStep("amount")}
              className="text-[#9CA3AF] text-sm font-medium text-center"
            >
              Voltar
            </button>
          </div>
        )}

        {/* Step: QR Code */}
        {step === "qrcode" && pixData && (
          <div className="flex flex-col gap-4 animate-fade-in-up">
            <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2A2A2A] text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="material-icons-outlined text-[#00C853]">pix</span>
                <h2 className="text-lg font-bold">PIX QR Code</h2>
              </div>
              <p className="text-2xl font-bold text-[#00C853] mb-4">R$ {parseFloat(amount).toFixed(2)}</p>

              {/* QR Code display */}
              <div className="bg-white rounded-xl p-4 inline-block mb-4">
                {pixData.qrCodeBase64 ? (
                  <img
                    src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <span className="material-icons-outlined text-6xl text-gray-400">qr_code_2</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-[#9CA3AF] mb-3">
                Escaneie o QR Code acima ou copie o código PIX abaixo
              </p>

              {/* Pix copia e cola */}
              <div className="bg-[#2A2A2A] rounded-lg p-3 mb-3">
                <p className="text-xs text-[#9CA3AF] mb-1">Código PIX (copia e cola)</p>
                <p className="text-xs text-white break-all font-mono leading-5 max-h-16 overflow-y-auto">
                  {pixData.qrCode}
                </p>
              </div>

              <button
                onClick={handleCopyPix}
                className={`w-full py-3 rounded-xl font-semibold text-base transition-colors ${
                  copied
                    ? "bg-[#00C853] text-white"
                    : "bg-[#2A2A2A] text-white border border-[#00C853]"
                }`}
              >
                {copied ? "Copiado!" : "Copiar Código PIX"}
              </button>
            </div>

            <button
              onClick={handleCheckStatus}
              disabled={checkingStatus}
              className="w-full py-3 rounded-xl bg-[#00C853]/10 text-[#00C853] border border-[#00C853]/30 font-semibold text-base flex items-center justify-center gap-2"
            >
              {checkingStatus ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verificando...
                </>
              ) : (
                <>
                  <span className="material-icons-outlined text-sm">refresh</span>
                  Já paguei - verificar
                </>
              )}
            </button>

            <div className="bg-[#1E1E1E] rounded-xl p-4 border border-[#2A2A2A]">
              <p className="text-xs text-[#9CA3AF] flex items-start gap-2">
                <span className="material-icons-outlined text-yellow-500 text-sm shrink-0 mt-0.5">info</span>
                O QR Code expira em 30 minutos. Após o pagamento, seu saldo será creditado automaticamente em alguns segundos.
              </p>
            </div>
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <div className="flex flex-col gap-4 animate-fade-in-up text-center py-8">
            <div className="bg-[#1E1E1E] rounded-xl p-8 border border-[#2A2A2A]">
              <div className="w-16 h-16 rounded-full bg-[#00C853]/20 flex items-center justify-center mx-auto mb-4">
                <span className="material-icons-outlined text-[#00C853] text-3xl">check_circle</span>
              </div>
              <h2 className="text-xl font-bold mb-2">Depósito Confirmado!</h2>
              <p className="text-3xl font-bold text-[#00C853] mb-2">R$ {parseFloat(amount).toFixed(2)}</p>
              <p className="text-sm text-[#9CA3AF]">Seu saldo foi atualizado com sucesso.</p>
            </div>

            <button
              onClick={() => router.push("/")}
              className="w-full py-3 rounded-xl bg-[#00C853] text-white font-semibold text-base"
            >
              Ir para Mercados
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
