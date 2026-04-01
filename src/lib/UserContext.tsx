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
  register: (name: string, email: string, cpf: string, password: string, phone?: string) => Promise<boolean>;
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

// ---- ADMIN FUNCTIONS (Supabase) ----

export async function getAllRegisteredUsersAsync(): Promise<(User & { password: string })[]> {
  const { data } = await supabase.from("users").select("*").order("created_at", { ascending: false });
  if (!data) return [];
  return data.map((u: Record<string, unknown>) => ({
    ...mapDbUser(u),
    password: (u.password || "") as string,
  }));
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
  const { error } = await supabase.from("users").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", userId);
  if (!error) await _refreshUserCache();
  return !error;
}

export async function adminAddBalance(userId: string, amount: number): Promise<boolean> {
  // Get current balance first
  const { data } = await supabase.from("users").select("balance").eq("id", userId).single();
  if (!data) return false;
  const newBalance = Number(data.balance) + amount;
  return adminSetBalance(userId, Math.max(0, newBalance));
}

export async function adminUpdateUser(userId: string, data: { name?: string; email?: string; cpf?: string; password?: string }): Promise<boolean> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.email !== undefined) updates.email = data.email.toLowerCase();
  if (data.cpf !== undefined) updates.cpf = data.cpf;
  if (data.password !== undefined && data.password.length >= 6) updates.password = data.password;
  const { error } = await supabase.from("users").update(updates).eq("id", userId);
  if (!error) await _refreshUserCache();
  return !error;
}

export async function adminGetUserPassword(userId: string): Promise<string | null> {
  const { data } = await supabase.from("users").select("password").eq("id", userId).single();
  return data?.password || null;
}

export async function adminDeleteUser(userId: string): Promise<boolean> {
  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (!error) await _refreshUserCache();
  return !error;
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

  // Restore session from localStorage (session key only, data from Supabase)
  useEffect(() => {
    const restoreSession = async () => {
      try {
        _refreshUserCache().catch(() => {}); // non-blocking cache refresh

        const sessionEmail = localStorage.getItem("previsao_session");
        if (!sessionEmail) return;

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
          // Load user bets
          const { data: betData } = await supabase
            .from("bets")
            .select("*")
            .eq("user_id", data.id)
            .order("created_at", { ascending: false });
          if (betData) {
            setBets(betData.map((b: Record<string, unknown>) => ({
              id: b.id as string, marketId: b.market_id as string, marketTitle: b.outcome_label as string,
              optionId: b.outcome_key as string, optionName: b.outcome_label as string,
              amount: Number(b.amount), odds: 0, potentialWin: Number(b.payout_at_entry),
              status: b.status as "pending" | "won" | "lost",
              createdAt: String(b.created_at),
            })));
          }
        } else {
          // User not found in Supabase but has session - clear stale session
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
    const { data } = await supabase.from("users").select("*").eq("id", uid).single();
    if (data) {
      setUser((prev) => {
        if (!prev || prev.id !== uid) return prev;
        return mapDbUser(data);
      });
    }
  }, []);

  // Auto-refresh balance every 15 seconds (reads from Supabase, never from cache)
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

  const register = useCallback(async (name: string, email: string, cpf: string, password: string, phone?: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();

    // Check if exists
    const { data: existing } = await supabase.from("users").select("id").eq("email", normalizedEmail).single();
    if (existing) return false;

    const newId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from("users").insert({
      id: newId, name, email: normalizedEmail, cpf, password, balance: 0, phone: phone || "",
    });
    if (error) return false;

    setUser({ ...NEW_USER_DEFAULTS, id: newId, name, email: normalizedEmail, cpf, phone: phone || "", avatar_url: "", balance: 0, createdAt: new Date().toISOString() } as User);
    localStorage.setItem("previsao_session", normalizedEmail);
    await _refreshUserCache();
    return true;
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();

    // Try to find user
    const { data: found } = await supabase.from("users").select("*").eq("email", normalizedEmail).single();

    if (found) {
      // User exists - check password
      if (found.password !== password) return false;
      setUser(mapDbUser(found));
      localStorage.setItem("previsao_session", normalizedEmail);
      return true;
    }

    // User not found - auto-register
    const newId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from("users").insert({
      id: newId, name: normalizedEmail.split("@")[0], email: normalizedEmail, cpf: "", password, balance: 0,
    });
    if (error) return false;

    setUser({ ...NEW_USER_DEFAULTS, id: newId, name: normalizedEmail.split("@")[0], email: normalizedEmail, cpf: "", phone: "", avatar_url: "", balance: 0, createdAt: new Date().toISOString() } as User);
    localStorage.setItem("previsao_session", normalizedEmail);
    await _refreshUserCache();
    return true;
  }, []);

  const togglePublicProfile = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const newVal = !user.is_public;
    const { error } = await supabase.from("users").update({ is_public: newVal, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) return false;
    setUser((prev) => prev ? { ...prev, is_public: newVal } : prev);
    return true;
  }, [user]);

  const logout = useCallback(() => {
    setUser(null);
    setBets([]);
    localStorage.removeItem("previsao_session");
  }, []);

  const addBalance = useCallback((amount: number) => {
    // Only update local React state. The server-side API routes handle DB updates.
    // This avoids race conditions where the client overwrites the server's correct balance.
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

    // Save bet to Supabase
    supabase.from("bets").insert({
      id: bet.id, user_id: user.id, market_id: betData.marketId,
      outcome_key: betData.optionId, outcome_label: betData.optionName,
      amount: betData.amount, payout_at_entry: betData.potentialWin,
      final_payout: 0, status: "pending",
    }).then();

    return true;
  }, [user, addBalance]);

  const updateProfile = useCallback(async (data: { name?: string; email?: string; phone?: string; cpf?: string; bio?: string; avatar_url?: string }): Promise<boolean> => {
    if (!user) return false;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.email !== undefined) updates.email = data.email.toLowerCase();
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.cpf !== undefined) updates.cpf = data.cpf;
    if (data.bio !== undefined) updates.bio = data.bio;
    if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url;
    const { error } = await supabase.from("users").update(updates).eq("id", user.id);
    if (error) return false;
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
  }, [user]);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<boolean> => {
    if (!user) return false;
    const { data } = await supabase.from("users").select("password").eq("id", user.id).single();
    if (!data || data.password !== oldPassword) return false;
    const { error } = await supabase.from("users").update({ password: newPassword, updated_at: new Date().toISOString() }).eq("id", user.id);
    return !error;
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
