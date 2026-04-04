// ============================================================
// WINIFY - ADMIN AUTHENTICATION
// Uses HttpOnly cookie (set by server) + localStorage for UI state only
// ============================================================

const ADMIN_SESSION_KEY = "winify_admin_session";
const ADMIN_SECRET_KEY = "winify_admin_secret";

export interface AdminCredential {
  email: string;
  password: string;
  name: string;
  role: string;
}

export async function adminLogin(email: string, password: string): Promise<{ success: boolean; admin?: Omit<AdminCredential, "password">; error?: string }> {
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin", // Ensures HttpOnly cookie is set
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Credenciais invalidas" };
    }

    if (typeof window !== "undefined") {
      // Store UI session info (non-sensitive)
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
        email: data.admin.email,
        name: data.admin.name,
        role: data.admin.role,
        loginAt: Date.now(),
      }));
      // Store signed token for header-based auth (fallback for API calls)
      // This is a time-limited HMAC token, NOT the raw ADMIN_SECRET
      if (data.token) localStorage.setItem(ADMIN_SECRET_KEY, data.token);
    }

    return { success: true, admin: data.admin };
  } catch {
    return { success: false, error: "Erro de conexao" };
  }
}

export function getAdminSession(): { email: string; name: string; role: string; loginAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const session = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "null");
    if (!session) return null;
    // Session expires after 8 hours
    if (Date.now() - session.loginAt > 8 * 60 * 60 * 1000) {
      adminLogout();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function getAdminSecret(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ADMIN_SECRET_KEY) || "";
}

export function adminLogout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_SECRET_KEY);
    // Clear HttpOnly cookie via server endpoint
    fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
  }
}

export function isAdminLoggedIn(): boolean {
  return getAdminSession() !== null;
}
