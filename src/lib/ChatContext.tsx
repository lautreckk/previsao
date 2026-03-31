"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";

export interface ChatMessage {
  user: string;
  text: string;
  id: number;
  ts: number;
}

interface ChatContextType {
  messages: ChatMessage[];
  sendMessage: (text: string, username?: string) => void;
  onlineCount: number;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be inside ChatProvider");
  return ctx;
}

// Avatar colors (deterministic from username)
const AVATAR_COLORS = [
  "from-[#FF6B6B] to-[#EE5A24]", "from-[#00D4AA] to-[#00B894]",
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
  { min: 20, icon: "trending_up", color: "text-[#00D4AA]", label: "Regular" },
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
  { user: "@cadu99", text: "bora de over galera" },
  { user: "@ana_sp", text: "fiz R$ 200 no dolar" },
  { user: "@lucas_rj", text: "under com forca agr" },
  { user: "@gabi_santos", text: "alguem mais ta no petroleo?" },
  { user: "@pedro_mg", text: "kkk perdi tudo no flamengo" },
  { user: "@bia_costa", text: "primeira vez aqui, como funciona?" },
  { user: "@rafael_sp22", text: "to indo de sim" },
  { user: "@carol_df", text: "essa odd ta boa demais" },
  { user: "@thiago_rj", text: "GG quem foi de over" },
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

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineCount] = useState(() => 580 + Math.floor(Math.random() * 120));
  const messageQueue = useRef<{ user: string; text: string }[]>([]);
  const fetchingRef = useRef(false);
  const initializedRef = useRef(false);
  const replyTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Add a message to chat (used by both auto and reply systems)
  const addMessage = useCallback((user: string, text: string) => {
    const now = Date.now();
    setMessages((prev) => [
      ...prev.slice(-(MAX_MESSAGES - 1)),
      { user, text, id: now + Math.random(), ts: now },
    ]);
  }, []);

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
          // Schedule replies with delays
          for (const reply of data.replies) {
            const timer = setTimeout(() => {
              addMessage(reply.user, reply.text);
            }, (reply.delay || 3) * 1000);
            replyTimers.current.push(timer);
          }
          return;
        }
      }
    } catch {
      // Fallback below
    }

    // Fallback: use static replies
    const lower = message.toLowerCase();
    const isNegative = ["golpe", "scam", "roubo", "nao paga", "n paga", "lixo", "fraude", "piramide", "fake", "calote", "roubando"].some((w) => lower.includes(w));
    const fallbacks = isNegative ? FALLBACK_REPLIES_NEGATIVE : FALLBACK_REPLIES_QUESTION;
    const count = 1 + Math.floor(Math.random() * 2); // 1-2 replies
    const shuffled = [...fallbacks].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      const reply = shuffled[i];
      const timer = setTimeout(() => {
        addMessage(reply.user, reply.text);
      }, (3 + i * 4) * 1000);
      replyTimers.current.push(timer);
    }
  }, [addMessage]);

  // Fetch a batch of AI-generated messages
  const fetchBatch = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch("/api/chat/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: "mercados de crypto, esportes, entretenimento e clima" }),
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
  }, []);

  // Get next message from queue (AI or fallback)
  const getNextMessage = useCallback((): { user: string; text: string } => {
    if (messageQueue.current.length > 0) {
      return messageQueue.current.shift()!;
    }
    return FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
  }, []);

  // Initialize: fetch first batch and seed initial messages
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

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
  }, [fetchBatch]);

  // Cleanup reply timers on unmount
  useEffect(() => {
    return () => {
      replyTimers.current.forEach(clearTimeout);
    };
  }, []);

  // Auto-add messages at random intervals
  useEffect(() => {
    const iv = setInterval(() => {
      const msg = getNextMessage();
      addMessage(msg.user, msg.text);

      if (messageQueue.current.length < 3) {
        fetchBatch();
      }
    }, 4000 + Math.random() * 6000);

    return () => clearInterval(iv);
  }, [getNextMessage, fetchBatch, addMessage]);

  // User sends a message
  const sendMessage = useCallback((text: string, username?: string) => {
    if (!text.trim()) return;
    const trimmed = text.trim();
    const user = username || "@voce";
    addMessage(user, trimmed);

    // Check if this message should trigger bot replies
    if (shouldReply(trimmed)) {
      fetchReplies(trimmed, user);
    }
  }, [addMessage, fetchReplies]);

  return (
    <ChatContext.Provider value={{ messages, sendMessage, onlineCount }}>
      {children}
    </ChatContext.Provider>
  );
}
