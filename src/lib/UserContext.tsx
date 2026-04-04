"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "./supabase";

export interface User {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  avatar_url: string;
  balance: number;
  createdAt: string;
  is_public: boolean;
  is_bot: boolean;
  bio: string;
  level: number;
  total_predictions: number;
  total_wins: number;
  total_losses: number;
  total_wagered: number;
  total_returns: number;
  win_streak: number;
  best_streak: number;
  rank_position: number;
}

// Level system
export const LEVELS = [
  { level: 1, name: "Novato", min: 0 },
  { level: 2, name: "Aprendiz", min: 10 },
  { level: 3, name: "Regular", min: 30 },
  { level: 4, name: "Ativo", min: 50 },
  { level: 5, name: "Expert", min: 100 },
  { level: 6, name: "Mestre", min: 200 },
  { level: 7, name: "Lenda", min: 350 },
  { level: 8, name: "Elite", min: 500 },
] as const;

export function calcLevel(totalPredictions: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalPredictions >= LEVELS[i].min) return LEVELS[i].level;
  }
  return 1;
}

export function getLevelName(level: number): string {
  return LEVELS.find((l) => l.level === level)?.name || "Novato";
}

export interface Bet {
  id: string;
  marketId: string;
  marketTitle: string;
  optionId: string;
  optionName: string;
  amount: number;
  odds: number;
  potentialWin: number;
  status: "pending" | "won" | "lost";
  createdAt: string;
}

interface UserContextType {
  user: User | null;
  bets: Bet[];
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, cpf: string, password: string, phone?: string, referralCode?: string) => Promise<boolean>;
  logout: () => void;
  addBalance: (amount: number) => void;
  placeBet: (bet: Omit<Bet, "id" | "status" | "createdAt">) => boolean;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { name?: string; email?: string; phone?: string; cpf?: string; bio?: string; avatar_url?: string }) => Promise<boolean>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  uploadAvatar: (file: File) => Promise<string | null>;
  togglePublicProfile: () => Promise<boolean>;
}

const UserContext = createContext<UserContextType | null>(null);

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be inside UserProvider");
  return ctx;
}

const SESSION_TOKEN_KEY = "previsao_session_token";

/** Get session token from localStorage */
function getSessionToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SESSION_TOKEN_KEY) || "";
}

/** Standard headers with session token for authenticated API calls */
function getAuthHeaders(): HeadersInit {
  const token = getSessionToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { "x-session-token": token } : {}),
  };
}

/** Admin headers (includes admin secret + session token) */
function getAdminHeaders(): HeadersInit {
  let secret = "";
  if (typeof window !== "undefined") {
    secret = localStorage.getItem("winify_admin_secret") || "";
  }
  return {
    ...getAuthHeaders(),
    ...(secret ? { "x-admin-secret": secret } : {}),
  };
}

// ---- ADMIN FUNCTIONS (via API routes — server-side only) ----

export async function getAllRegisteredUsersAsync(): Promise<(User & { password: string })[]> {
  try {
    const res = await fetch("/api/auth/admin/users", { headers: getAdminHeaders() });
    if (!res.ok) return [];
    const { users } = await res.json();
    if (!users) return [];
    return users.map((u: Record<string, unknown>) => ({
      ...mapDbUser(u),
      password: (u.password || "") as string,
    }));
  } catch {
    return [];
  }
}

// Sync version that reads from cache for compatibility
let _cachedUsers: (User & { password: string })[] = [];
export function getAllRegisteredUsers(): (User & { password: string })[] {
  return _cachedUsers;
}

async function _refreshUserCache() {
  _cachedUsers = await getAllRegisteredUsersAsync();
}

export async function adminSetBalance(userId: string, newBalance: number): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/admin/balance", {
      method: "PUT",
      headers: getAdminHeaders(),
      body: JSON.stringify({ userId, balance: newBalance }),
    });
    if (res.ok) await _refreshUserCache();
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminAddBalance(userId: string, amount: number): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/admin/balance", {
      method: "PUT",
      headers: getAdminHeaders(),
      body: JSON.stringify({ userId, delta: amount }),
    });
    if (res.ok) await _refreshUserCache();
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminUpdateUser(userId: string, data: { name?: string; email?: string; cpf?: string; password?: string }): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/admin/users", {
      method: "PUT",
      headers: getAdminHeaders(),
      body: JSON.stringify({ userId, ...data }),
    });
    if (res.ok) await _refreshUserCache();
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminGetUserPassword(userId: string): Promise<string | null> {
  try {
    const users = await getAllRegisteredUsersAsync();
    const user = users.find((u) => u.id === userId);
    return user?.password || null;
  } catch {
    return null;
  }
}

export async function adminDeleteUser(userId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/admin/users", {
      method: "DELETE",
      headers: getAdminHeaders(),
      body: JSON.stringify({ userId }),
    });
    if (res.ok) await _refreshUserCache();
    return res.ok;
  } catch {
    return false;
  }
}

// Map Supabase row to User object
function mapDbUser(data: Record<string, unknown>): User {
  return {
    id: data.id as string,
    name: data.name as string,
    email: data.email as string,
    cpf: (data.cpf || "") as string,
    phone: (data.phone || "") as string,
    avatar_url: (data.avatar_url || "") as string,
    balance: Number(data.balance) || 0,
    createdAt: String(data.created_at || ""),
    is_public: !!data.is_public,
    is_bot: !!data.is_bot,
    bio: (data.bio || "") as string,
    level: Number(data.level) || 1,
    total_predictions: Number(data.total_predictions) || 0,
    total_wins: Number(data.total_wins) || 0,
    total_losses: Number(data.total_losses) || 0,
    total_wagered: Number(data.total_wagered) || 0,
    total_returns: Number(data.total_returns) || 0,
    win_streak: Number(data.win_streak) || 0,
    best_streak: Number(data.best_streak) || 0,
    rank_position: Number(data.rank_position) || 0,
  };
}

const NEW_USER_DEFAULTS: Partial<User> = {
  phone: "", avatar_url: "", is_public: false, is_bot: false, bio: "",
  level: 1, total_predictions: 0, total_wins: 0, total_losses: 0,
  total_wagered: 0, total_returns: 0, win_streak: 0, best_streak: 0, rank_position: 0,
};

// ---- PROVIDER ----

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);

  // Restore session from localStorage — reads via anon key (no password column exposed)
  useEffect(() => {
    const restoreSession = async () => {
      try {
        _refreshUserCache().catch(() => {}); // non-blocking cache refresh

        const sessionEmail = localStorage.getItem("previsao_session");
        if (!sessionEmail) return;

        // anon key can still SELECT users (without password column)
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("email", sessionEmail.toLowerCase())
          .maybeSingle();

        if (error) {
          console.error("Session restore error:", error.message);
          return;
        }

        if (data) {
          setUser(mapDbUser(data));
          // Load user bets from prediction_bets
          const { data: betData } = await supabase
            .from("prediction_bets")
            .select("*, prediction_markets(title)")
            .eq("user_id", data.id)
            .order("created_at", { ascending: false })
            .limit(100);
          if (betData) {
            setBets(betData.map((b: Record<string, unknown>) => {
              const market = b.prediction_markets as Record<string, unknown> | null;
              return {
                id: b.id as string, marketId: b.market_id as string,
                marketTitle: (market?.title as string) || (b.outcome_label as string),
                optionId: b.outcome_key as string, optionName: b.outcome_label as string,
                amount: Number(b.amount), odds: Number(b.odds) || 0,
                potentialWin: Number(b.final_payout) || Number(b.amount) * (Number(b.odds) || 1),
                status: b.status as "pending" | "won" | "lost",
                createdAt: String(b.created_at),
              };
            }));
          }
        } else {
          console.warn("Session email not found in DB, clearing:", sessionEmail);
          localStorage.removeItem("previsao_session");
        }
      } catch (err) {
        console.error("Session restore failed:", err);
      }
    };
    restoreSession();
  }, []);

  // Store user ID in a ref so callbacks don't depend on the full user object
  const userIdRef = useRef<string | null>(null);
  useEffect(() => { userIdRef.current = user?.id ?? null; }, [user?.id]);

  const refreshUser = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    // anon key can still SELECT users (without password column)
    const { data } = await supabase.from("users").select("*").eq("id", uid).single();
    if (data) {
      setUser((prev) => {
        if (!prev || prev.id !== uid) return prev;
        return mapDbUser(data);
      });
    }
  }, []);

  // Auto-refresh balance every 15 seconds (anon key can read balance column)
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const iv = setInterval(() => {
      supabase.from("users").select("balance").eq("id", uid).single().then(({ data }) => {
        if (data) {
          setUser((prev) => {
            if (!prev || prev.id !== uid) return prev;
            const dbBalance = Number(data.balance) || 0;
            if (dbBalance !== prev.balance) {
              return { ...prev, balance: dbBalance };
            }
            return prev;
          });
        }
      });
    }, 15000);
    return () => clearInterval(iv);
  }, [user?.id]);

  // Realtime: listen for bet status changes (pending -> won/lost/refunded)
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    const channel = supabase
      .channel(`user-bets-${uid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "prediction_bets", filter: `user_id=eq.${uid}` },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          const newStatus = updated.status as string;
          const betId = updated.id as string;

          setBets((prev) =>
            prev.map((b) =>
              b.id === betId
                ? { ...b, status: newStatus as "pending" | "won" | "lost", potentialWin: Number(updated.final_payout) || b.potentialWin }
                : b
            )
          );

          if (newStatus === "won" || newStatus === "lost" || newStatus === "refunded") {
            supabase.from("users").select("balance, total_wins, total_losses, total_returns").eq("id", uid).single().then(({ data }) => {
              if (data) {
                setUser((prev) => {
                  if (!prev || prev.id !== uid) return prev;
                  return {
                    ...prev,
                    balance: Number(data.balance) || prev.balance,
                    total_wins: Number(data.total_wins) || prev.total_wins,
                    total_losses: Number(data.total_losses) || prev.total_losses,
                    total_returns: Number(data.total_returns) || prev.total_returns,
                  };
                });
              }
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // LOGIN — via server-side API route (password never exposed to client)
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) return false;

      const { user: userData, sessionToken } = await res.json();
      if (!userData) return false;

      setUser(mapDbUser(userData));
      localStorage.setItem("previsao_session", userData.email);
      if (sessionToken) localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
      await _refreshUserCache();
      return true;
    } catch {
      return false;
    }
  }, []);

  // REGISTER — via server-side API route
  const register = useCallback(async (name: string, email: string, cpf: string, password: string, phone?: string, referralCode?: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, cpf, password, phone, referralCode }),
      });

      if (!res.ok) return false;

      const { user: userData, sessionToken } = await res.json();
      if (!userData) return false;

      setUser({
        ...NEW_USER_DEFAULTS,
        ...mapDbUser(userData),
      } as User);
      localStorage.setItem("previsao_session", userData.email);
      if (sessionToken) localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
      await _refreshUserCache();

      // Track affiliate referral
      if (referralCode) {
        try {
          await fetch("/api/affiliates/track", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: "register", code: referralCode, user_id: userData.id, user_name: name, user_email: userData.email }),
          });
        } catch { /* ignore tracking errors */ }
      }

      return true;
    } catch {
      return false;
    }
  }, []);

  // TOGGLE PUBLIC PROFILE — via server-side API route
  const togglePublicProfile = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const newVal = !user.is_public;
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: user.id, is_public: newVal }),
      });
      if (!res.ok) return false;
      setUser((prev) => prev ? { ...prev, is_public: newVal } : prev);
      return true;
    } catch {
      return false;
    }
  }, [user]);

  const logout = useCallback(() => {
    setUser(null);
    setBets([]);
    localStorage.removeItem("previsao_session");
    localStorage.removeItem(SESSION_TOKEN_KEY);
  }, []);

  const addBalance = useCallback((amount: number) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, balance: prev.balance + amount };
    });
  }, []);

  const placeBet = useCallback((betData: Omit<Bet, "id" | "status" | "createdAt">): boolean => {
    if (!user) return false;
    if (user.balance < betData.amount) return false;

    const bet: Bet = {
      ...betData,
      id: `${user.id.slice(0, 8)}_bet_${Date.now()}`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    setBets((prev) => [...prev, bet]);
    addBalance(-betData.amount);

    return true;
  }, [user, addBalance]);

  // UPDATE PROFILE — via server-side API route
  const updateProfile = useCallback(async (data: { name?: string; email?: string; phone?: string; cpf?: string; bio?: string; avatar_url?: string }): Promise<boolean> => {
    if (!user) return false;
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: user.id, ...data }),
      });
      if (!res.ok) return false;
      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...(data.name !== undefined && { name: data.name }),
          ...(data.email !== undefined && { email: data.email.toLowerCase() }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.cpf !== undefined && { cpf: data.cpf }),
          ...(data.bio !== undefined && { bio: data.bio }),
          ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
        };
      });
      if (data.email) localStorage.setItem("previsao_session", data.email.toLowerCase());
      return true;
    } catch {
      return false;
    }
  }, [user]);

  // CHANGE PASSWORD — via server-side API route (password never on client)
  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId: user.id, oldPassword, newPassword }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [user]);

  const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      await supabase.storage.createBucket("avatars", { public: true });
      const { error: retryErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (retryErr) return null;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = urlData.publicUrl + "?t=" + Date.now();
    await updateProfile({ avatar_url: url });
    return url;
  }, [user, updateProfile]);

  return (
    <UserContext.Provider value={{ user, bets, login, register, logout, addBalance, placeBet, refreshUser, updateProfile, changePassword, uploadAvatar, togglePublicProfile }}>
      {children}
    </UserContext.Provider>
  );
}
