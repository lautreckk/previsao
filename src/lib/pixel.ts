// Meta Pixel helper - fires Lead on signup, Purchase on deposit
declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

export function trackLead(data?: { email?: string; name?: string }) {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "Lead", {
      content_name: "signup",
      ...(data || {}),
    });
  }
}

export function trackPurchase(amount: number, currency: string = "BRL") {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "Purchase", {
      value: amount,
      currency,
      content_name: "deposit",
    });
  }
}
