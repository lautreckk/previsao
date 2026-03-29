// Store de pagamentos confirmados (em memória para o serverless)
// Em produção, substituir por Redis/DB

interface ConfirmedPayment {
  transactionId: string;
  externalId: string;
  amount: number;
  confirmedAt: number;
}

// Global map que persiste enquanto a instância serverless estiver ativa
const globalStore = globalThis as unknown as {
  __confirmedPayments?: Map<string, ConfirmedPayment>;
};

if (!globalStore.__confirmedPayments) {
  globalStore.__confirmedPayments = new Map();
}

export const confirmedPayments = globalStore.__confirmedPayments;

export function markPaymentConfirmed(transactionId: string, externalId: string, amount: number) {
  confirmedPayments.set(transactionId, {
    transactionId,
    externalId,
    amount,
    confirmedAt: Date.now(),
  });
  // Também indexar por external_id
  confirmedPayments.set(externalId, {
    transactionId,
    externalId,
    amount,
    confirmedAt: Date.now(),
  });
}

export function isPaymentConfirmed(id: string): ConfirmedPayment | undefined {
  return confirmedPayments.get(id);
}

// Limpar pagamentos com mais de 1 hora (evitar memory leak)
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  for (const [key, val] of confirmedPayments) {
    if (val.confirmedAt < oneHourAgo) {
      confirmedPayments.delete(key);
    }
  }
}, 600000);
