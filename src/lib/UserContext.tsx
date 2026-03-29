"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "./supabase";

export interface User {
  id: string;
  name: string;
  email: string;
  cpf: string;
  balance: number;
  createdAt: string;
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
    id: u.id as string, name: u.name as string, email: u.email as string,
    cpf: (u.cpf || "") as string, balance: Number(u.balance) || 0,
    password: (u.password || "") as string, createdAt: String(u.created_at || ""),
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
          setUser({
            id: data.id, name: data.name, email: data.email,
            cpf: data.cpf || "", balance: Number(data.balance) || 0,
            createdAt: data.created_at,
          });
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

  const refreshUser = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("users").select("*").eq("id", user.id).single();
    if (data) {
      setUser({ id: data.id, name: data.name, email: data.email, cpf: data.cpf || "", balance: Number(data.balance) || 0, createdAt: data.created_at });
    }
  }, [user]);

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

    setUser({ id: newId, name, email: normalizedEmail, cpf, balance: 0, createdAt: new Date().toISOString() });
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
      setUser({ id: found.id, name: found.name, email: found.email, cpf: found.cpf || "", balance: Number(found.balance) || 0, createdAt: found.created_at });
      localStorage.setItem("previsao_session", normalizedEmail);
      return true;
    }

    // User not found - auto-register
    const newId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from("users").insert({
      id: newId, name: normalizedEmail.split("@")[0], email: normalizedEmail, cpf: "", password, balance: 0,
    });
    if (error) return false;

    setUser({ id: newId, name: normalizedEmail.split("@")[0], email: normalizedEmail, cpf: "", balance: 0, createdAt: new Date().toISOString() });
    localStorage.setItem("previsao_session", normalizedEmail);
    await _refreshUserCache();
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setBets([]);
    localStorage.removeItem("previsao_session");
  }, []);

  const addBalance = useCallback((amount: number) => {
    setUser((prev) => {
      if (!prev) return prev;
      const newBalance = prev.balance + amount;
      // Update Supabase async
      supabase.from("users").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("id", prev.id).then();
      return { ...prev, balance: newBalance };
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

  return (
    <UserContext.Provider value={{ user, bets, login, register, logout, addBalance, placeBet, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}
