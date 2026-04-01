"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { isAdminLoggedIn, getAdminSession, adminLogin, adminLogout } from "@/lib/engines/admin-auth";

const navItems: { href: string; icon: string; label: string; comingSoon?: boolean }[] = [
  { href: "/admin", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/markets", icon: "storefront", label: "Mercados" },
  { href: "/admin/monitor", icon: "monitor_heart", label: "Monitor" },
  { href: "/admin/users", icon: "group", label: "Usuarios" },
  { href: "/admin/pix", icon: "pix", label: "PIX" },
  { href: "/admin/finance", icon: "account_balance", label: "Financeiro" },
  { href: "/admin/api-keys", icon: "vpn_key", label: "API Keys" },
  { href: "/admin/affiliates", icon: "handshake", label: "Afiliados", comingSoon: true },
];

const mobileTabItems = navItems.slice(0, 4);
const moreSheetItems = navItems.slice(4);

/* ------------------------------------------------------------------ */
/*  Login Screen                                                       */
/* ------------------------------------------------------------------ */
function AdminLoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      const result = adminLogin(email, password);
      setLoading(false);
      if (result.success) {
        onLogin();
      } else {
        setError(result.error || "Erro ao autenticar");
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#0A0910] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-[#80FF00]/[0.04] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[320px] h-[320px] rounded-full bg-[#A0FF40]/[0.03] blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[380px] relative z-10">
        {/* Logo + badge */}
        <div className="text-center mb-10">
          <img src="/logo.png" alt="Winify" className="h-16 w-auto mx-auto mb-6" />
          <div className="inline-flex items-center gap-2 bg-white/[0.04] backdrop-blur-md px-4 py-1.5 rounded-full border border-white/[0.06]">
            <span className="material-symbols-outlined text-white/50 text-sm">shield</span>
            <span className="text-[11px] font-semibold text-white/50 uppercase tracking-[0.15em]">Painel Admin</span>
          </div>
        </div>

        {/* Glass card */}
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-3xl p-8 shadow-[0_8px_64px_rgba(0,0,0,0.4)]">
          <h2 className="text-[22px] font-semibold text-white tracking-tight text-center mb-1">
            Bem-vindo
          </h2>
          <p className="text-sm text-white/40 text-center mb-8">
            Insira suas credenciais para continuar
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/40 block pl-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@winify.com"
                required
                className="w-full bg-white/[0.04] rounded-xl px-4 py-3 text-[15px] text-white placeholder:text-white/20 outline-none border border-white/[0.06] focus:border-white/[0.15] focus:bg-white/[0.06] transition-all duration-300"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/40 block pl-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-white/[0.04] rounded-xl px-4 py-3 text-[15px] text-white placeholder:text-white/20 outline-none border border-white/[0.06] focus:border-white/[0.15] focus:bg-white/[0.06] transition-all duration-300"
              />
            </div>

            {error && (
              <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2.5">
                <span className="material-symbols-outlined text-red-400 text-base">error</span>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-white text-[#0a0f1a] font-semibold text-[15px] tracking-tight hover:bg-white/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-white/30 text-sm hover:text-white/60 transition-colors duration-300">
            Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  More Sheet (mobile bottom sheet for overflow nav items)            */
/* ------------------------------------------------------------------ */
function MoreSheet({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[70] lg:hidden transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="backdrop-blur-xl bg-[#12101A]/95 border-t border-white/[0.06] rounded-t-3xl px-6 pt-4 pb-8">
          {/* Handle */}
          <div className="w-10 h-1 rounded-full bg-white/[0.12] mx-auto mb-6" />
          <div className="space-y-1">
            {moreSheetItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 ${
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-white/50 active:bg-white/[0.04]"
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[15px] font-medium">{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#80FF00]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Layout                                                        */
/* ------------------------------------------------------------------ */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminName, setAdminName] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const session = getAdminSession();
    if (session) {
      setAuthenticated(true);
      setAdminName(session.name);
    }
    setChecking(false);
  }, []);

  const handleLogout = () => {
    adminLogout();
    setAuthenticated(false);
    setAdminName("");
  };

  // Close more sheet on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  /* Loading state */
  if (checking) {
    return (
      <div className="min-h-screen bg-[#0A0910] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    );
  }

  /* Auth gate */
  if (!authenticated) {
    return (
      <AdminLoginScreen
        onLogin={() => {
          setAuthenticated(true);
          const s = getAdminSession();
          if (s) setAdminName(s.name);
        }}
      />
    );
  }

  /* Breadcrumb label */
  const currentItem = navItems.find((n) => n.href === pathname);
  const breadcrumb = currentItem?.label ?? "Admin";

  /* Check if a "more" item is active */
  const moreItemActive = moreSheetItems.some((item) => pathname === item.href);

  return (
    <div className="min-h-screen bg-[#0A0910] text-white">
      {/* ============ DESKTOP SIDEBAR (lg+) ============ */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-full w-[260px] flex-col z-40 backdrop-blur-xl bg-[#0b1120]/80 border-r border-white/[0.06]">
        {/* Sidebar header */}
        <div className="px-6 pt-7 pb-6 flex items-center gap-3">
          <img src="/logo.png" alt="Winify" className="h-9 w-auto" />
          <span className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em]">
            Admin
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                  isActive
                    ? "bg-white/[0.07] text-white"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
                }`}
              >
                {/* Active pill indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-[#80FF00]" />
                )}
                <span
                  className={`material-symbols-outlined text-xl transition-colors duration-200 ${
                    isActive ? "text-[#80FF00]" : "text-white/30 group-hover:text-white/50"
                  }`}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                {item.label}
                {item.comingSoon && (
                  <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-white/25 bg-white/[0.04] px-2 py-0.5 rounded-full">Em breve</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="px-4 py-5 border-t border-white/[0.06] space-y-3">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center">
              <span className="material-symbols-outlined text-white/40 text-sm">person</span>
            </div>
            <span className="text-xs text-white/40 truncate flex-1">{adminName}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-white/30 hover:text-red-400 text-xs px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-all duration-200 flex-1"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Sair
            </button>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-white/30 hover:text-white/60 text-xs px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-all duration-200 flex-1"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Site
            </Link>
          </div>
        </div>
      </aside>

      {/* ============ MAIN CONTENT ============ */}
      <div className="lg:pl-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0A0910]/80 border-b border-white/[0.04]">
          <div className="h-12 lg:h-14 flex items-center px-5 lg:px-8">
            <span className="text-[13px] lg:text-sm text-white/30 font-medium">
              Admin
            </span>
            <span className="text-white/15 mx-2 text-sm">/</span>
            <span className="text-[13px] lg:text-sm text-white/70 font-medium">
              {breadcrumb}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-white/25 hidden sm:block">Online</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* ============ MOBILE BOTTOM TAB BAR ============ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0b1120]/90 border-t border-white/[0.06] safe-area-pb">
        <div className="flex items-center justify-around h-16 px-2">
          {mobileTabItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-all duration-200 ${
                  isActive ? "text-white" : "text-white/30 active:text-white/50"
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 w-6 h-[2px] rounded-full bg-[#80FF00]" />
                )}
                <span
                  className={`material-symbols-outlined text-[22px] transition-all duration-200 ${
                    isActive ? "text-[#80FF00]" : ""
                  }`}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          {/* "Mais" tab */}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 py-1 rounded-xl transition-all duration-200 ${
              moreItemActive ? "text-white" : "text-white/30 active:text-white/50"
            }`}
          >
            {moreItemActive && (
              <div className="absolute top-0 w-6 h-[2px] rounded-full bg-[#80FF00]" />
            )}
            <span
              className={`material-symbols-outlined text-[22px] ${
                moreItemActive ? "text-[#80FF00]" : ""
              }`}
              style={moreItemActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              more_horiz
            </span>
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} pathname={pathname} />
    </div>
  );
}
