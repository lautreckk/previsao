// ============================================================
// WINIFY - MULTI-PLATFORM TRACKING (PIXELS & EVENTS)
// ============================================================
// Supported: Meta (Facebook), TikTok, Google Ads, Kwai, Taboola
//
// HOW TO CONFIGURE:
// 1. Add your pixel IDs in layout.tsx (search for "TRACKING PIXELS")
// 2. Events fire automatically at the right moments:
//    - PageView: on every page load (all platforms)
//    - Lead/CompleteRegistration: on signup (criar-conta + AuthModal)
//    - Purchase/Deposit: on confirmed deposit (deposito page)
//    - InitiateCheckout: when user starts deposit flow
//    - AddToCart: when user selects a bet amount
// ============================================================

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    ttq: {
      track: (event: string, data?: Record<string, unknown>) => void;
      identify: (data: Record<string, unknown>) => void;
      page: () => void;
    };
    gtag: (...args: unknown[]) => void;
    kwaiq: {
      track: (event: string, data?: Record<string, unknown>) => void;
      page: () => void;
    };
    _tfa: Array<{ notify: string; [key: string]: unknown }>;
  }
}

// ============================================================
// HELPERS
// ============================================================

function hasFbq(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

function hasTtq(): boolean {
  return typeof window !== "undefined" && !!window.ttq && typeof window.ttq.track === "function";
}

function hasGtag(): boolean {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

function hasKwai(): boolean {
  return typeof window !== "undefined" && !!window.kwaiq && typeof window.kwaiq.track === "function";
}

function hasTaboola(): boolean {
  return typeof window !== "undefined" && Array.isArray(window._tfa);
}

// ============================================================
// PAGE VIEW - fires on every page load
// ============================================================

export function trackPageView() {
  // Meta - PageView (auto-fired by pixel init, but can be called manually)
  if (hasFbq()) {
    window.fbq("track", "PageView");
  }

  // TikTok - page view
  if (hasTtq()) {
    window.ttq.page();
  }

  // Google Ads - page_view (auto-tracked by gtag)

  // Kwai - page view
  if (hasKwai()) {
    window.kwaiq.page();
  }

  // Taboola - page view
  if (hasTaboola()) {
    window._tfa.push({ notify: "event", name: "page_view" });
  }
}

// ============================================================
// LEAD / COMPLETE REGISTRATION - fires on signup
// ============================================================

export function trackLead(data?: { email?: string; name?: string; phone?: string }) {
  const eventData = {
    content_name: "signup",
    ...(data || {}),
  };

  // Meta - Lead + CompleteRegistration
  if (hasFbq()) {
    window.fbq("track", "Lead", eventData);
    window.fbq("track", "CompleteRegistration", {
      content_name: "signup",
      status: "complete",
      currency: "BRL",
      value: 0,
    });
  }

  // TikTok - CompleteRegistration
  if (hasTtq()) {
    window.ttq.track("CompleteRegistration", {
      content_type: "product",
      content_id: "signup",
      description: "user_registration",
    });
    // Also identify the user for better attribution
    if (data?.email) {
      window.ttq.identify({ email: data.email });
    }
  }

  // Google Ads - sign_up conversion
  if (hasGtag()) {
    window.gtag("event", "sign_up", {
      method: "email",
      event_category: "engagement",
    });
    // Also fire as conversion (configure conversion ID in layout.tsx)
    window.gtag("event", "conversion", {
      send_to: "AW-XXXXXXXXXX/LEAD_CONVERSION_LABEL", // TODO: Replace with your Google Ads conversion ID
      value: 0,
      currency: "BRL",
    });
  }

  // Kwai - complete_registration
  if (hasKwai()) {
    window.kwaiq.track("completeRegistration", {
      content_type: "signup",
    });
  }

  // Taboola - Lead
  if (hasTaboola()) {
    window._tfa.push({
      notify: "event",
      name: "lead",
      id: "TABOOLA_PIXEL_ID", // TODO: Replace with your Taboola pixel ID
    });
  }
}

// ============================================================
// INITIATE CHECKOUT - fires when user starts deposit flow
// ============================================================

export function trackInitiateCheckout(amount: number) {
  // Meta - InitiateCheckout
  if (hasFbq()) {
    window.fbq("track", "InitiateCheckout", {
      value: amount,
      currency: "BRL",
      content_name: "deposit",
      content_category: "payment",
    });
  }

  // TikTok - InitiateCheckout
  if (hasTtq()) {
    window.ttq.track("InitiateCheckout", {
      content_type: "product",
      content_id: "deposit",
      value: amount,
      currency: "BRL",
    });
  }

  // Google Ads - begin_checkout
  if (hasGtag()) {
    window.gtag("event", "begin_checkout", {
      value: amount,
      currency: "BRL",
      items: [{ item_name: "deposit", price: amount }],
    });
  }

  // Kwai - initiate_checkout
  if (hasKwai()) {
    window.kwaiq.track("initiateCheckout", {
      value: amount,
      currency: "BRL",
    });
  }

  // Taboola - checkout
  if (hasTaboola()) {
    window._tfa.push({
      notify: "event",
      name: "checkout",
      id: "TABOOLA_PIXEL_ID", // TODO: Replace
      revenue: amount,
      currency: "BRL",
    });
  }
}

// ============================================================
// PURCHASE - fires when deposit is confirmed
// ============================================================

export function trackPurchase(amount: number, currency: string = "BRL") {
  // Meta - Purchase
  if (hasFbq()) {
    window.fbq("track", "Purchase", {
      value: amount,
      currency,
      content_name: "deposit",
      content_type: "product",
      content_category: "payment",
    });
  }

  // TikTok - CompletePayment
  if (hasTtq()) {
    window.ttq.track("CompletePayment", {
      content_type: "product",
      content_id: "deposit",
      value: amount,
      currency,
      quantity: 1,
      description: "pix_deposit",
    });
  }

  // Google Ads - purchase conversion
  if (hasGtag()) {
    window.gtag("event", "purchase", {
      value: amount,
      currency,
      transaction_id: `dep_${Date.now()}`,
      items: [{ item_name: "deposit", price: amount, quantity: 1 }],
    });
    // Fire as conversion event
    window.gtag("event", "conversion", {
      send_to: "AW-XXXXXXXXXX/PURCHASE_CONVERSION_LABEL", // TODO: Replace with your Google Ads conversion ID
      value: amount,
      currency,
      transaction_id: `dep_${Date.now()}`,
    });
  }

  // Kwai - purchase
  if (hasKwai()) {
    window.kwaiq.track("purchase", {
      value: amount,
      currency,
    });
  }

  // Taboola - purchase
  if (hasTaboola()) {
    window._tfa.push({
      notify: "event",
      name: "purchase",
      id: "TABOOLA_PIXEL_ID", // TODO: Replace
      revenue: amount,
      currency,
      quantity: 1,
    });
  }
}

// ============================================================
// ADD TO CART - fires when user selects a bet / prediction
// ============================================================

export function trackAddToCart(data?: { marketName?: string; amount?: number }) {
  // Meta - AddToCart
  if (hasFbq()) {
    window.fbq("track", "AddToCart", {
      content_name: data?.marketName || "bet",
      value: data?.amount || 0,
      currency: "BRL",
    });
  }

  // TikTok - AddToCart
  if (hasTtq()) {
    window.ttq.track("AddToCart", {
      content_type: "product",
      content_id: data?.marketName || "bet",
      value: data?.amount || 0,
      currency: "BRL",
    });
  }

  // Google Ads - add_to_cart
  if (hasGtag()) {
    window.gtag("event", "add_to_cart", {
      value: data?.amount || 0,
      currency: "BRL",
      items: [{ item_name: data?.marketName || "bet", price: data?.amount || 0 }],
    });
  }

  // Kwai - add_to_cart
  if (hasKwai()) {
    window.kwaiq.track("addToCart", {
      value: data?.amount || 0,
      currency: "BRL",
    });
  }

  // Taboola - add_to_cart
  if (hasTaboola()) {
    window._tfa.push({
      notify: "event",
      name: "add_to_cart",
      id: "TABOOLA_PIXEL_ID", // TODO: Replace
      revenue: data?.amount || 0,
      currency: "BRL",
    });
  }
}

// ============================================================
// VIEW CONTENT - fires when user views a market detail page
// ============================================================

export function trackViewContent(data?: { marketName?: string; category?: string }) {
  // Meta - ViewContent
  if (hasFbq()) {
    window.fbq("track", "ViewContent", {
      content_name: data?.marketName || "market",
      content_category: data?.category || "prediction",
      content_type: "product",
    });
  }

  // TikTok - ViewContent
  if (hasTtq()) {
    window.ttq.track("ViewContent", {
      content_type: "product",
      content_id: data?.marketName || "market",
      description: data?.category || "prediction",
    });
  }

  // Google Ads - view_item
  if (hasGtag()) {
    window.gtag("event", "view_item", {
      items: [{ item_name: data?.marketName || "market", item_category: data?.category || "prediction" }],
    });
  }

  // Kwai - view_content
  if (hasKwai()) {
    window.kwaiq.track("contentView", {
      content_type: data?.category || "prediction",
    });
  }

  // Taboola - view_content
  if (hasTaboola()) {
    window._tfa.push({
      notify: "event",
      name: "view_content",
      id: "TABOOLA_PIXEL_ID", // TODO: Replace
    });
  }
}
