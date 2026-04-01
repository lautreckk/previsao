"use client";

import { useState, useEffect } from "react";

// ============================================================
// TRACKING CONFIG - stored in localStorage (admin-only)
// In production, move to Supabase `settings` table for persistence
// ============================================================

const STORAGE_KEY = "winify_tracking_config";

interface PlatformConfig {
  enabled: boolean;
  pixelId: string;
  conversionLabel?: string; // Google Ads specific
  notes?: string;
}

interface TrackingConfig {
  meta: PlatformConfig;
  tiktok: PlatformConfig;
  google: PlatformConfig & { measurementId: string; adsId: string };
  kwai: PlatformConfig;
  taboola: PlatformConfig;
}

const DEFAULT_CONFIG: TrackingConfig = {
  meta: { enabled: true, pixelId: "1226111416400460" },
  tiktok: { enabled: false, pixelId: "" },
  google: { enabled: false, pixelId: "", measurementId: "", adsId: "", conversionLabel: "" },
  kwai: { enabled: false, pixelId: "" },
  taboola: { enabled: false, pixelId: "" },
};

function loadConfig(): TrackingConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

function saveConfig(config: TrackingConfig) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}

// ============================================================
// EVENT LOG (last 50 events for debugging)
// ============================================================

const EVENT_LOG_KEY = "winify_tracking_events";

interface TrackingEvent {
  ts: number;
  platform: string;
  event: string;
  data?: Record<string, unknown>;
}

function getEventLog(): TrackingEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EVENT_LOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

// ============================================================
// PLATFORMS DATA
// ============================================================

const PLATFORMS = [
  {
    key: "meta" as const,
    name: "Meta Ads",
    subtitle: "Facebook & Instagram",
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Facebook_Logo_%282019%29.png/600px-Facebook_Logo_%282019%29.png",
    color: "#1877F2",
    bgColor: "bg-[#1877F2]/10",
    borderColor: "border-[#1877F2]/20",
    events: [
      { name: "PageView", trigger: "Toda página", auto: true },
      { name: "Lead", trigger: "Cadastro do usuário", auto: true },
      { name: "CompleteRegistration", trigger: "Cadastro do usuário", auto: true },
      { name: "InitiateCheckout", trigger: "Gera QR Code PIX", auto: true },
      { name: "Purchase", trigger: "Depósito confirmado (valor em BRL)", auto: true },
      { name: "ViewContent", trigger: "Abre página de mercado", auto: true },
      { name: "AddToCart", trigger: "Faz uma aposta", auto: true },
    ],
    fields: [
      { key: "pixelId", label: "Pixel ID", placeholder: "Ex: 1226111416400460" },
    ],
  },
  {
    key: "tiktok" as const,
    name: "TikTok Ads",
    subtitle: "TikTok for Business",
    icon: "https://sf16-scmcdn-sg.ibytedtos.com/goofy/tiktok/web/node/_next/static/images/logo-7328701c910ebbccb5f8.svg",
    color: "#00F2EA",
    bgColor: "bg-[#00F2EA]/10",
    borderColor: "border-[#00F2EA]/20",
    events: [
      { name: "PageView", trigger: "Toda página", auto: true },
      { name: "CompleteRegistration", trigger: "Cadastro do usuário", auto: true },
      { name: "InitiateCheckout", trigger: "Gera QR Code PIX", auto: true },
      { name: "CompletePayment", trigger: "Depósito confirmado", auto: true },
      { name: "ViewContent", trigger: "Abre página de mercado", auto: true },
      { name: "AddToCart", trigger: "Faz uma aposta", auto: true },
    ],
    fields: [
      { key: "pixelId", label: "Pixel ID", placeholder: "Ex: CXXXXXXXXXXXXXXX" },
    ],
  },
  {
    key: "google" as const,
    name: "Google Ads",
    subtitle: "Google Ads & GA4",
    icon: "https://www.gstatic.com/images/branding/product/2x/ads_48dp.png",
    color: "#4285F4",
    bgColor: "bg-[#4285F4]/10",
    borderColor: "border-[#4285F4]/20",
    events: [
      { name: "page_view", trigger: "Toda página", auto: true },
      { name: "sign_up", trigger: "Cadastro do usuário", auto: true },
      { name: "conversion (Lead)", trigger: "Cadastro (precisa configurar label)", auto: true },
      { name: "begin_checkout", trigger: "Gera QR Code PIX", auto: true },
      { name: "purchase", trigger: "Depósito confirmado", auto: true },
      { name: "conversion (Purchase)", trigger: "Depósito (precisa configurar label)", auto: true },
      { name: "view_item", trigger: "Abre página de mercado", auto: true },
      { name: "add_to_cart", trigger: "Faz uma aposta", auto: true },
    ],
    fields: [
      { key: "measurementId", label: "GA4 Measurement ID", placeholder: "Ex: G-XXXXXXXXXX" },
      { key: "adsId", label: "Google Ads ID", placeholder: "Ex: AW-XXXXXXXXXX" },
      { key: "conversionLabel", label: "Conversion Label (Lead)", placeholder: "Ex: AbCdEfGhIjK" },
    ],
  },
  {
    key: "kwai" as const,
    name: "Kwai Ads",
    subtitle: "Kwai for Business",
    icon: "https://play-lh.googleusercontent.com/X3k-UoJ3p-P-tEuoH9g5mHpIbVl3t6TLqoKDj-k8fYVZhBN0O6lFcP6YaGA4R5L-EQ",
    color: "#FF4906",
    bgColor: "bg-[#FF4906]/10",
    borderColor: "border-[#FF4906]/20",
    events: [
      { name: "PageView", trigger: "Toda página", auto: true },
      { name: "completeRegistration", trigger: "Cadastro do usuário", auto: true },
      { name: "initiateCheckout", trigger: "Gera QR Code PIX", auto: true },
      { name: "purchase", trigger: "Depósito confirmado", auto: true },
      { name: "contentView", trigger: "Abre página de mercado", auto: true },
      { name: "addToCart", trigger: "Faz uma aposta", auto: true },
    ],
    fields: [
      { key: "pixelId", label: "Pixel ID", placeholder: "Ex: 123456789" },
    ],
  },
  {
    key: "taboola" as const,
    name: "Taboola Ads",
    subtitle: "Taboola Pixel",
    icon: "https://www.taboola.com/wp-content/uploads/2023/10/taboola-logo.svg",
    color: "#0060FF",
    bgColor: "bg-[#0060FF]/10",
    borderColor: "border-[#0060FF]/20",
    events: [
      { name: "page_view", trigger: "Toda página", auto: true },
      { name: "lead", trigger: "Cadastro do usuário", auto: true },
      { name: "checkout", trigger: "Gera QR Code PIX", auto: true },
      { name: "purchase", trigger: "Depósito confirmado", auto: true },
      { name: "view_content", trigger: "Abre página de mercado", auto: true },
      { name: "add_to_cart", trigger: "Faz uma aposta", auto: true },
    ],
    fields: [
      { key: "pixelId", label: "Pixel ID", placeholder: "Ex: 1234567" },
    ],
  },
];

// ============================================================
// PAGE COMPONENT
// ============================================================

export default function TrackingPage() {
  const [config, setConfig] = useState<TrackingConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<TrackingEvent[]>([]);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
    setEventLog(getEventLog());
  }, []);

  const handleSave = () => {
    saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updatePlatform = (platform: keyof TrackingConfig, field: string, value: string | boolean) => {
    setConfig((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }));
  };

  const enabledCount = Object.values(config).filter((p) => p.enabled).length;

  const inputCls = "w-full bg-white/[0.04] rounded-xl px-4 py-3 text-white/90 text-sm border border-white/[0.06] outline-none transition-all placeholder:text-white/20 focus:border-white/[0.14] focus:bg-white/[0.06] focus:ring-1 focus:ring-white/[0.08] font-mono";
  const labelCls = "text-[11px] text-white/40 uppercase tracking-wider font-semibold block mb-1.5";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-headline tracking-tight">Rastreamento</h1>
          <p className="text-sm text-white/40 mt-1">Configure os pixels de rastreamento para cada plataforma de anúncios</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLog(!showLog)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.06] transition-all text-sm"
          >
            <span className="material-symbols-outlined text-base">bug_report</span>
            Log
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              saved
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-[#80FF00] text-[#0a0a0a] hover:opacity-90 active:scale-[0.98]"
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {saved ? "check_circle" : "save"}
            </span>
            {saved ? "Salvo!" : "Salvar"}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">Plataformas</p>
          <p className="text-2xl font-black mt-1">{enabledCount}<span className="text-white/30 text-lg">/{PLATFORMS.length}</span></p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">Eventos</p>
          <p className="text-2xl font-black mt-1">7</p>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">Status</p>
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full ${enabledCount > 0 ? "bg-emerald-400" : "bg-white/20"}`} />
            <span className={`text-sm font-semibold ${enabledCount > 0 ? "text-emerald-400" : "text-white/30"}`}>
              {enabledCount > 0 ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">Eventos Log</p>
          <p className="text-2xl font-black mt-1">{eventLog.length}</p>
        </div>
      </div>

      {/* Event Log (collapsible) */}
      {showLog && (
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold">Log de Eventos (últimos 50)</h3>
            <button
              onClick={() => {
                localStorage.removeItem(EVENT_LOG_KEY);
                setEventLog([]);
              }}
              className="text-xs text-white/30 hover:text-red-400 transition-colors"
            >
              Limpar
            </button>
          </div>
          {eventLog.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-6">Nenhum evento registrado ainda. Os eventos aparecerão aqui conforme os usuários interagem com o site.</p>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {eventLog.slice().reverse().map((ev, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] text-xs">
                  <span className="text-white/20 font-mono w-16 shrink-0">
                    {new Date(ev.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/[0.06] text-white/50 font-semibold shrink-0">{ev.platform}</span>
                  <span className="text-[#80FF00] font-semibold">{ev.event}</span>
                  {ev.data && <span className="text-white/20 truncate">{JSON.stringify(ev.data)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Platform Cards */}
      <div className="space-y-3">
        {PLATFORMS.map((platform) => {
          const pConfig = config[platform.key] as PlatformConfig & Record<string, unknown>;
          const isExpanded = expandedPlatform === platform.key;

          return (
            <div
              key={platform.key}
              className={`backdrop-blur-xl bg-white/[0.03] border rounded-2xl overflow-hidden transition-all duration-300 ${
                pConfig.enabled ? `${platform.borderColor}` : "border-white/[0.06]"
              }`}
            >
              {/* Platform header */}
              <div
                className="flex items-center gap-4 p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedPlatform(isExpanded ? null : platform.key)}
              >
                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl ${platform.bgColor} flex items-center justify-center shrink-0 overflow-hidden`}>
                  <img
                    src={platform.icon}
                    alt={platform.name}
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="material-symbols-outlined text-xl" style="color: ${platform.color}">ads_click</span>`;
                    }}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold">{platform.name}</h3>
                    {pConfig.enabled && pConfig.pixelId && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">ATIVO</span>
                    )}
                    {pConfig.enabled && !pConfig.pixelId && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">SEM ID</span>
                    )}
                    {!pConfig.enabled && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/[0.04] text-white/30 border border-white/[0.06]">INATIVO</span>
                    )}
                  </div>
                  <p className="text-xs text-white/30 mt-0.5">{platform.subtitle}</p>
                </div>

                {/* Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePlatform(platform.key, "enabled", !pConfig.enabled);
                  }}
                  className={`w-11 h-6 rounded-full transition-all duration-300 relative shrink-0 ${
                    pConfig.enabled ? "bg-[#80FF00]" : "bg-white/[0.08]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all duration-300 ${
                      pConfig.enabled ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>

                {/* Expand arrow */}
                <span
                  className={`material-symbols-outlined text-white/30 text-lg transition-transform duration-300 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                >
                  expand_more
                </span>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-white/[0.06] p-5 space-y-5 animate-fade-in-up">
                  {/* Config fields */}
                  <div className="space-y-4">
                    <h4 className="text-[11px] text-white/30 uppercase tracking-widest font-semibold">Configuração</h4>
                    {platform.fields.map((field) => (
                      <div key={field.key}>
                        <label className={labelCls}>{field.label}</label>
                        <input
                          type="text"
                          value={String((pConfig as Record<string, unknown>)[field.key] || "")}
                          onChange={(e) => updatePlatform(platform.key, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className={inputCls}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Events table */}
                  <div>
                    <h4 className="text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-3">Eventos Trackeados</h4>
                    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-white/[0.02]">
                            <th className="text-left text-[10px] text-white/30 uppercase tracking-wider font-semibold px-4 py-2.5">Evento</th>
                            <th className="text-left text-[10px] text-white/30 uppercase tracking-wider font-semibold px-4 py-2.5">Quando Dispara</th>
                            <th className="text-center text-[10px] text-white/30 uppercase tracking-wider font-semibold px-4 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {platform.events.map((event, i) => (
                            <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-2.5">
                                <code className="text-xs font-mono text-[#80FF00]">{event.name}</code>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-white/50">{event.trigger}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  Auto
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Helper text */}
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <span className="material-symbols-outlined text-white/20 text-lg mt-0.5">info</span>
                    <div className="text-xs text-white/30 leading-relaxed">
                      {platform.key === "meta" && (
                        <>Obtenha seu Pixel ID em <span className="text-white/50">Facebook Events Manager → Fontes de Dados → Pixel</span>. Os eventos Lead e Purchase já estão configurados automaticamente.</>
                      )}
                      {platform.key === "tiktok" && (
                        <>Obtenha seu Pixel ID em <span className="text-white/50">TikTok Ads Manager → Ativos → Eventos</span>. O CompletePayment é o evento equivalente ao Purchase.</>
                      )}
                      {platform.key === "google" && (
                        <>Configure o GA4 Measurement ID e o Google Ads ID. Para conversões, crie as ações de conversão no Google Ads e insira o <span className="text-white/50">Conversion Label</span>.</>
                      )}
                      {platform.key === "kwai" && (
                        <>Obtenha seu Pixel ID no <span className="text-white/50">Kwai Business Center → Ferramentas → Pixel</span>. Todos os eventos padrão são disparados automaticamente.</>
                      )}
                      {platform.key === "taboola" && (
                        <>Obtenha seu Pixel ID no <span className="text-white/50">Taboola Ads → Tracking → Universal Pixel</span>. Eventos são disparados via _tfa array.</>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Events Summary */}
      <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-sm font-bold mb-4">Mapa de Eventos</h3>
        <p className="text-xs text-white/30 mb-5">Todos os eventos são disparados automaticamente nos momentos corretos. Não é necessário configuração adicional além dos Pixel IDs.</p>

        <div className="rounded-xl border border-white/[0.06] overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="text-left text-[10px] text-white/30 uppercase tracking-wider font-semibold px-4 py-3">Ação do Usuário</th>
                <th className="text-center text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-3">Meta</th>
                <th className="text-center text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-3">TikTok</th>
                <th className="text-center text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-3">Google</th>
                <th className="text-center text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-3">Kwai</th>
                <th className="text-center text-[10px] text-white/30 uppercase tracking-wider font-semibold px-3 py-3">Taboola</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {[
                { action: "Visita uma página", meta: "PageView", tiktok: "page()", google: "page_view", kwai: "page()", taboola: "page_view" },
                { action: "Se cadastra", meta: "Lead + CompleteRegistration", tiktok: "CompleteRegistration", google: "sign_up + conversion", kwai: "completeRegistration", taboola: "lead" },
                { action: "Gera PIX para depósito", meta: "InitiateCheckout", tiktok: "InitiateCheckout", google: "begin_checkout", kwai: "initiateCheckout", taboola: "checkout" },
                { action: "Depósito confirmado", meta: "Purchase", tiktok: "CompletePayment", google: "purchase + conversion", kwai: "purchase", taboola: "purchase" },
                { action: "Abre um mercado", meta: "ViewContent", tiktok: "ViewContent", google: "view_item", kwai: "contentView", taboola: "view_content" },
                { action: "Faz uma aposta", meta: "AddToCart", tiktok: "AddToCart", google: "add_to_cart", kwai: "addToCart", taboola: "add_to_cart" },
              ].map((row, i) => (
                <tr key={i} className="border-t border-white/[0.04]">
                  <td className="px-4 py-3 text-white/70 font-medium">{row.action}</td>
                  <td className="px-3 py-3 text-center"><code className="text-[10px] text-[#1877F2] bg-[#1877F2]/10 px-1.5 py-0.5 rounded">{row.meta}</code></td>
                  <td className="px-3 py-3 text-center"><code className="text-[10px] text-[#00F2EA] bg-[#00F2EA]/10 px-1.5 py-0.5 rounded">{row.tiktok}</code></td>
                  <td className="px-3 py-3 text-center"><code className="text-[10px] text-[#4285F4] bg-[#4285F4]/10 px-1.5 py-0.5 rounded">{row.google}</code></td>
                  <td className="px-3 py-3 text-center"><code className="text-[10px] text-[#FF4906] bg-[#FF4906]/10 px-1.5 py-0.5 rounded">{row.kwai}</code></td>
                  <td className="px-3 py-3 text-center"><code className="text-[10px] text-[#0060FF] bg-[#0060FF]/10 px-1.5 py-0.5 rounded">{row.taboola}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
