"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { isAdminLoggedIn, getAdminSession, adminLogin, adminLogout } from "@/lib/engines/admin-auth";

const navItems = [
  { href: "/admin", icon: "dashboard", label: "Dashboard" },
  { href: "/admin/markets", icon: "storefront", label: "Mercados" },
  { href: "/admin/monitor", icon: "monitor_heart", label: "Monitor" },
  { href: "/admin/users", icon: "group", label: "Usuarios" },
  { href: "/admin/pix", icon: "pix", label: "PIX" },
  { href: "/admin/finance", icon: "account_balance", label: "Financeiro" },
  { href: "/admin/affiliates", icon: "handshake", label: "Afiliados" },
];

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
    <div className="min-h-screen bg-[#060b16] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Winify" className="h-20 w-auto mx-auto mb-4" />
          <div className="inline-flex items-center gap-2 bg-[#FFB800]/10 px-4 py-1.5 rounded-full border border-[#FFB800]/20 mb-4">
            <span className="material-symbols-outlined text-[#FFB800] text-sm">shield</span>
            <span className="text-xs font-bold text-[#FFB800] uppercase tracking-widest">Painel Admin</span>
          </div>
          <p className="text-sm text-[#8B95A8]">Acesso restrito. Insira suas credenciais.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[#8B95A8] uppercase tracking-wider font-bold block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@winify.com"
              required
              className="w-full bg-[#0b1120] rounded-2xl px-4 py-3.5 text-white text-sm outline-none focus:ring-2 focus:ring-[#00D4AA]/40 border border-white/5"
            />
          </div>
          <div>
            <label className="text-xs text-[#8B95A8] uppercase tracking-wider font-bold block mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-[#0b1120] rounded-2xl px-4 py-3.5 text-white text-sm outline-none focus:ring-2 focus:ring-[#00D4AA]/40 border border-white/5"
            />
          </div>

          {error && (
            <div className="bg-[#FF6B5A]/10 border border-[#FF6B5A]/30 rounded-xl p-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FF6B5A] text-sm">error</span>
              <p className="text-[#FF6B5A] text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#00D4AA] via-[#00B894] to-[#FFB800] text-[#003D2E] font-black font-headline text-base uppercase tracking-wider shadow-[0_10px_30px_rgba(0,212,170,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <><span className="material-symbols-outlined text-lg">login</span>Entrar</>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/" className="text-[#8B95A8] text-sm hover:text-white transition-colors">
            ← Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminName, setAdminName] = useState("");

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

  if (checking) {
    return <div className="min-h-screen bg-[#060b16] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#00D4AA] border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!authenticated) {
    return <AdminLoginScreen onLogin={() => { setAuthenticated(true); const s = getAdminSession(); if (s) setAdminName(s.name); }} />;
  }

  return (
    <div className="min-h-screen bg-[#060b16] text-white flex overflow-x-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static top-0 left-0 h-full w-64 bg-[#0b1120] border-r border-white/5 z-50 transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} flex flex-col`}>
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <img src="/logo.png" alt="Winify" className="h-10 w-auto" />
          <div>
            <span className="text-xs font-bold text-[#FFB800] uppercase tracking-widest">Admin</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#00D4AA]/10 text-[#00D4AA]"
                    : "text-[#8B95A8] hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-xl" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/5 space-y-3">
          <div className="flex items-center gap-2 text-xs text-[#8B95A8]">
            <span className="material-symbols-outlined text-sm text-[#00D4AA]">person</span>
            <span className="truncate">{adminName}</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-[#FF6B5A] hover:text-[#FF6B5A]/80 text-sm w-full">
            <span className="material-symbols-outlined text-lg">logout</span>
            Sair
          </button>
          <Link href="/" className="flex items-center gap-2 text-[#8B95A8] hover:text-white text-sm">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Voltar ao site
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/5 flex items-center px-4 gap-4 bg-[#0b1120]/80 backdrop-blur-xl sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-[#8B95A8]">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="font-headline font-bold text-sm uppercase tracking-wider text-[#8B95A8]">
            Painel Administrativo
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse" />
            <span className="text-xs text-[#8B95A8]">Sistema ativo</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
