// ============================================================
// WINIFY - ADMIN AUTHENTICATION
// ============================================================

const ADMIN_KEY = "winify_admin_session";
const ADMIN_USERS_KEY = "winify_admin_users";

export interface AdminCredential {
  email: string;
  password: string;
  name: string;
  role: string;
}

// Default admin - change in production
const DEFAULT_ADMINS: AdminCredential[] = [
  { email: "admin@winify.com.br", password: "W1n!fy@Adm2026#Mx", name: "Admin Master", role: "super_admin" },
];

function getAdminUsers(): AdminCredential[] {
  if (typeof window === "undefined") return DEFAULT_ADMINS;
  try {
    const stored = JSON.parse(localStorage.getItem(ADMIN_USERS_KEY) || "null");
    if (!stored || stored.length === 0) {
      localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(DEFAULT_ADMINS));
      return DEFAULT_ADMINS;
    }
    return stored;
  } catch {
    return DEFAULT_ADMINS;
  }
}

export function adminLogin(email: string, password: string): { success: boolean; admin?: AdminCredential; error?: string } {
  const admins = getAdminUsers();
  const found = admins.find((a) => a.email === email && a.password === password);
  if (!found) return { success: false, error: "Credenciais invalidas" };

  if (typeof window !== "undefined") {
    localStorage.setItem(ADMIN_KEY, JSON.stringify({ email: found.email, name: found.name, role: found.role, loginAt: Date.now() }));
  }
  return { success: true, admin: found };
}

export function getAdminSession(): { email: string; name: string; role: string; loginAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const session = JSON.parse(localStorage.getItem(ADMIN_KEY) || "null");
    if (!session) return null;
    // Session expires after 8 hours
    if (Date.now() - session.loginAt > 8 * 60 * 60 * 1000) {
      localStorage.removeItem(ADMIN_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function adminLogout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ADMIN_KEY);
  }
}

export function isAdminLoggedIn(): boolean {
  return getAdminSession() !== null;
}
