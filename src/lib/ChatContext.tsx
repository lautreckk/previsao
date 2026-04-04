"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export interface ChatMessage {
  user: string;
  text: string;
  id: number;
  ts: number;
  avatar_url?: string;
  user_id?: string;
}

interface ChatContextType {
  messages: ChatMessage[];
  sendMessage: (text: string, username?: string, avatarUrl?: string) => void;
  onlineCount: number;
  marketId?: string | null;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be inside ChatProvider");
  return ctx;
}

// Avatar colors (deterministic from username)
const AVATAR_COLORS = [
  "from-[#FF6B6B] to-[#EE5A24]", "from-[#F5A623] to-[#C4841A]",
  "from-[#6C5CE7] to-[#A29BFE]", "from-[#FDCB6E] to-[#F39C12]",
  "from-[#00CEFF] to-[#0984E3]", "from-[#FD79A8] to-[#E84393]",
  "from-[#55E6C1] to-[#58B19F]", "from-[#FF9FF3] to-[#F368E0]",
];

export function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Badge tiers based on fake prediction count
const BADGES: { min: number; icon: string; color: string; label: string }[] = [
  { min: 100, icon: "local_fire_department", color: "text-[#FF6B6B]", label: "Top" },
  { min: 50, icon: "bolt", color: "text-[#FDCB6E]", label: "Ativo" },
  { min: 20, icon: "trending_up", color: "text-[#10B981]", label: "Regular" },
];

export function getUserBadge(text: string) {
  const match = text.match(/(\d+)\s*previsoes/);
  const count = match ? parseInt(match[1]) : 0;
  return BADGES.find((b) => count >= b.min) || null;
}

// Fallback messages for when AI is unavailable
const FALLBACK_MESSAGES = [
  { user: "@joao_silva22", text: "acertei 3 seguidas no btc" },
  { user: "@mari_bh", text: "quem ta no bbb hj?" },
  { user: "@cadu99", text: "bora de mais galera" },
  { user: "@ana_sp", text: "fiz R$ 200 no dolar" },
  { user: "@lucas_rj", text: "menos com forca agr" },
  { user: "@gabi_santos", text: "alguem mais ta no petroleo?" },
  { user: "@pedro_mg", text: "kkk perdi tudo no flamengo" },
  { user: "@bia_costa", text: "primeira vez aqui, como funciona?" },
  { user: "@rafael_sp22", text: "to indo de sim" },
  { user: "@carol_df", text: "essa odd ta boa demais" },
  { user: "@thiago_rj", text: "GG quem foi de mais" },
  { user: "@juju_ba", text: "mano acertei dnv kkk" },
  { user: "@victor_pr", text: "qual o melhor mercado agr?" },
  { user: "@amanda_ce", text: "sobe ou desce? to na duvida" },
  { user: "@diego_rs", text: "fiz 5x no bitcoin 5min" },
  { user: "@lari_go", text: "esse mercado do bbb ta maluco" },
  { user: "@bruno_sp", text: "quem apostou no nao?" },
  { user: "@nat_rj", text: "R$ 500 na virginia stories" },
  { user: "@edu_sc", text: "vamo q vamo" },
  { user: "@fer_mg", text: "achei que ia perder mas deu gg" },
];

// Detect if a message needs a bot reply
function shouldReply(text: string): boolean {
  const lower = text.toLowerCase();
  // Questions
  if (lower.includes("?")) return true;
  const questionWords = ["como", "o que", "qual", "quem", "onde", "quando", "porque", "pq", "oq", "quanto", "funciona", "explica", "ajuda", "alguem"];
  if (questionWords.some((w) => lower.includes(w))) return true;
  // Negative sentiment
  const negativeWords = ["golpe", "scam", "roubo", "fraude", "nao paga", "n paga", "nao funciona", "lixo", "porcaria", "pessimo", "horrivel", "furada", "piramide", "bot", "fake", "mentira", "enganando", "calote", "cuidado", "nao confio", "n confio", "perdi tudo", "roubando"];
  if (negativeWords.some((w) => lower.includes(w))) return true;
  return false;
}

// Fallback replies for when AI is unavailable
const FALLBACK_REPLIES_QUESTION = [
  { user: "@lucas_mod", text: "e simples mano, escolhe o mercado, aposta se vai subir ou descer e pronto" },
  { user: "@ana_sp22", text: "eu comecei semana passada, bem facil de usar" },
  { user: "@pedro_rj", text: "bota pouco no inicio pra pegar o jeito" },
];
const FALLBACK_REPLIES_NEGATIVE = [
  { user: "@cadu_sp", text: "eu ja saquei varias vezes irmao, paga normal" },
  { user: "@mari_bh22", text: "calma bro, demora um pouquinho mas cai sim" },
  { user: "@thiago_pr", text: "eu tb achava no inicio mas fiz 3 saques ja kkk" },
];

const MAX_MESSAGES = 60;

interface ChatProviderProps {
  children: ReactNode;
  marketId?: string | null;
}

export function ChatProvider({ children, marketId = null }: ChatProviderProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Deterministic online count based on marketId hash
  const [onlineCount] = useState(() => {
    if (!marketId) return 580 + Math.floor(Math.random() * 120);
    let hash = 0;
    for (let i = 0; i < marketId.length; i++) hash = marketId.charCodeAt(i) + ((hash << 5) - hash);
    const tier = Math.abs(hash) % 100;
    if (tier < 10) return 150 + Math.abs(hash % 200); // 10% hot: 150-350
    if (tier < 40) return 40 + Math.abs(hash % 80);   // 30% medium: 40-120
    if (tier < 70) return 12 + Math.abs(hash % 30);    // 30% normal: 12-42
    return 3 + Math.abs(hash % 12);                     // 30% quiet: 3-15
  });
  const messageQueue = useRef<{ user: string; text: string; avatar_url?: string }[]>([]);
  const fetchingRef = useRef(false);
  const initializedRef = useRef(false);
  const replyTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Add a message to chat (used by both auto and reply systems)
  const addMessage = useCallback((user: string, text: string, avatarUrl?: string, userId?: string) => {
    const now = Date.now();
    setMessages((prev) => [
      ...prev.slice(-(MAX_MESSAGES - 1)),
      { user, text, id: now + Math.random(), ts: now, avatar_url: avatarUrl, user_id: userId },
    ]);
  }, []);

  // Save message to Supabase (fire-and-forget)
  const persistMessage = useCallback((username: string, text: string, avatarUrl?: string) => {
    supabase.from("chat_messages").insert({
      username,
      message: text,
      avatar_url: avatarUrl || "",
      market_id: marketId || null,
      predictions_count: 0,
    }).then(() => {});
  }, [marketId]);

  // Fetch contextual replies for a user message
  const fetchReplies = useCallback(async (message: string, username: string) => {
    try {
      const res = await fetch("/api/chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, username }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.replies?.length > 0) {
          for (const reply of data.replies) {
            const timer = setTimeout(() => {
              addMessage(reply.user, reply.text);
              persistMessage(reply.user, reply.text);
            }, (reply.delay || 3) * 1000);
            replyTimers.current.push(timer);
          }
          return;
        }
      }
    } catch {
      // Fallback below
    }

    const lower = message.toLowerCase();
    const isNegative = ["golpe", "scam", "roubo", "nao paga", "n paga", "lixo", "fraude", "piramide", "fake", "calote", "roubando"].some((w) => lower.includes(w));
    const fallbacks = isNegative ? FALLBACK_REPLIES_NEGATIVE : FALLBACK_REPLIES_QUESTION;
    const count = 1 + Math.floor(Math.random() * 2);
    const shuffled = [...fallbacks].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      const reply = shuffled[i];
      const timer = setTimeout(() => {
        addMessage(reply.user, reply.text);
        persistMessage(reply.user, reply.text);
      }, (3 + i * 4) * 1000);
      replyTimers.current.push(timer);
    }
  }, [addMessage, persistMessage]);

  // Fetch a batch of AI-generated messages
  const fetchBatch = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch("/api/chat/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: marketId ? "mercado especifico de previsao" : "mercados de crypto, esportes, entretenimento e clima" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.messages?.length > 0) {
          messageQueue.current.push(...data.messages);
        }
      }
    } catch {
      // Silently fail, use fallback
    }
    fetchingRef.current = false;
  }, [marketId]);

  // Get next message from queue (AI or fallback)
  const getNextMessage = useCallback((): { user: string; text: string } => {
    if (messageQueue.current.length > 0) {
      return messageQueue.current.shift()!;
    }
    return FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
  }, []);

  // Initialize: load messages from Supabase, then fallback
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      try {
        let query = supabase
          .from("chat_messages")
          .select("user_id, username, message, avatar_url, created_at, predictions_count")
          .order("created_at", { ascending: true })
          .limit(40);

        if (marketId) {
          query = query.eq("market_id", marketId);
        } else {
          query = query.is("market_id", null);
        }

        const { data } = await query;
        if (data && data.length > 0) {
          const loaded: ChatMessage[] = data.map((row, i) => ({
            user: row.username,
            text: row.message,
            id: new Date(row.created_at).getTime() + i,
            ts: new Date(row.created_at).getTime(),
            avatar_url: row.avatar_url || undefined,
            user_id: row.user_id || undefined,
          }));
          setMessages(loaded);
          fetchBatch();
          return;
        }
      } catch {
        // Fallback below
      }

      // Fallback: use static messages
      const now = Date.now();
      const initial: ChatMessage[] = [];
      const shuffled = [...FALLBACK_MESSAGES].sort(() => Math.random() - 0.5);
      for (let i = 0; i < 8; i++) {
        const msg = shuffled[i];
        initial.push({
          user: msg.user,
          text: msg.text,
          id: now - (8 - i) * 30000 + i,
          ts: now - (8 - i) * 30000,
        });
      }
      setMessages(initial);
      fetchBatch();
    })();
  }, [fetchBatch, marketId]);

  // Supabase Realtime: listen for new messages from other users
  useEffect(() => {
    const channel = supabase
      .channel("chat-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as { username?: string; message?: string; avatar_url?: string; user_id?: string; market_id?: string | null; created_at?: string };
          // Only show messages for same scope (global or same market)
          const msgMarket = row.market_id || null;
          if (marketId !== msgMarket) return;
          // Avoid duplicating own messages (already added locally)
          const ts = row.created_at ? new Date(row.created_at).getTime() : Date.now();
          const isDuplicate = messages.some((m) => Math.abs(m.ts - ts) < 2000 && m.user === (row.username || ""));
          if (isDuplicate) return;
          addMessage(row.username || "@user", row.message || "", row.avatar_url || undefined, row.user_id || undefined);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, addMessage]);

  // Cleanup reply timers on unmount
  useEffect(() => {
    return () => {
      replyTimers.current.forEach(clearTimeout);
    };
  }, []);

  // Auto-add messages at random intervals
  useEffect(() => {
    // Market-specific chats are slower (8-15s), home chat is faster (4-10s)
    const minDelay = marketId ? 8000 : 4000;
    const maxExtra = marketId ? 7000 : 6000;

    const iv = setInterval(() => {
      const msg = getNextMessage();
      addMessage(msg.user, msg.text);

      if (messageQueue.current.length < 3) {
        fetchBatch();
      }
    }, minDelay + Math.random() * maxExtra);

    return () => clearInterval(iv);
  }, [getNextMessage, fetchBatch, addMessage, marketId]);

  // User sends a message
  const sendMessage = useCallback((text: string, username?: string, avatarUrl?: string) => {
    if (!text.trim()) return;
    const trimmed = text.trim();
    const user = username || "@voce";
    addMessage(user, trimmed, avatarUrl);
    persistMessage(user, trimmed, avatarUrl);

    if (shouldReply(trimmed)) {
      fetchReplies(trimmed, user);
    }
  }, [addMessage, persistMessage, fetchReplies]);

  return (
    <ChatContext.Provider value={{ messages, sendMessage, onlineCount, marketId }}>
      {children}
    </ChatContext.Provider>
  );
}
