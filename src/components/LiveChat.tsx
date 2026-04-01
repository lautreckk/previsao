"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useUser } from "@/lib/UserContext";
import { useChat, avatarColor, getUserBadge } from "@/lib/ChatContext";

export default function LiveChat({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useUser();
  const { messages: chatMsgs, sendMessage, onlineCount } = useChat();
  const [input, setInput] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unread, setUnread] = useState(0);
  const prevCount = useRef(chatMsgs.length);

  useEffect(() => {
    if (chatMsgs.length > prevCount.current && !isAtBottom) {
      setUnread((c) => c + (chatMsgs.length - prevCount.current));
    }
    prevCount.current = chatMsgs.length;
    if (isAtBottom) chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMsgs, isAtBottom]);

  const handleScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    const at = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setIsAtBottom(at);
    if (at) setUnread(0);
  }, []);

  const send = useCallback(() => {
    if (!input.trim() || !user) return;
    const username = `@${user.name.split(" ")[0].toLowerCase()}`;
    sendMessage(input.trim(), username);
    setInput("");
    setIsAtBottom(true);
  }, [input, user, sendMessage]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#080d1a] sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[380px] sm:h-[600px] sm:rounded-2xl sm:border sm:border-white/[0.06] sm:shadow-2xl sm:shadow-black/60">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0D0B14] sm:rounded-t-2xl shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E09520]/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#E09520] text-base">forum</span>
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider leading-none text-white">Chat ao Vivo</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E09520] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E09520]" />
              </span>
              <span className="text-[10px] text-[#E09520] font-bold">{onlineCount} online</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[#1A1722] flex items-center justify-center text-white/30 hover:text-white hover:bg-[#2a3444] transition-colors">
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      {/* Messages */}
      <div ref={chatRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 no-scrollbar relative">
        {chatMsgs.map((msg, idx) => {
          const prevMsg = idx > 0 ? chatMsgs[idx - 1] : null;
          const isGrouped = prevMsg?.user === msg.user;
          const badge = getUserBadge(msg.text);
          const timeAgo = Math.max(0, Math.floor((Date.now() - msg.ts) / 60000));
          const timeStr = timeAgo === 0 ? "agora" : `${timeAgo}min`;

          return (
            <div key={msg.id} className={`group flex gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#1A1722]/60 transition-colors ${isGrouped ? "mt-0" : "mt-2"}`}>
              {!isGrouped ? (
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(msg.user)} flex items-center justify-center text-[11px] font-black text-white shrink-0 mt-0.5`}>
                  {msg.user.replace("@", "").charAt(0).toUpperCase()}
                </div>
              ) : (
                <div className="w-8 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                {!isGrouped && (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[#E09520] font-bold text-xs truncate">{msg.user}</span>
                    {badge && (
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#1A1722] border border-white/[0.06] ${badge.color}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>{badge.icon}</span>
                        <span className="text-[9px] font-black uppercase">{badge.label}</span>
                      </span>
                    )}
                    <span className="text-[10px] text-[#3a4a5a] ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">{timeStr}</span>
                  </div>
                )}
                <p className="text-[13px] text-[#c8cdd4] break-words leading-relaxed">{msg.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unread indicator */}
      {!isAtBottom && unread > 0 && (
        <button
          onClick={() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); setIsAtBottom(true); setUnread(0); }}
          className="absolute bottom-[68px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-[#E09520] text-[#1A0E00] px-3 py-1.5 rounded-full text-xs font-black shadow-[0_4px_12px_rgba(224,149,32,0.4)] animate-bounce"
        >
          <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
          {unread} {unread === 1 ? "nova" : "novas"}
        </button>
      )}

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/[0.06] shrink-0 bg-[#0a1020] sm:rounded-b-2xl">
        {user ? (
          <>
            <div className="flex items-center gap-2 bg-[#1A1722] rounded-xl border border-white/[0.06] focus-within:border-[#E09520]/40 transition-colors px-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Enviar mensagem..."
                className="flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder-[#5A6478]"
              />
              <button className="text-white/30 hover:text-white transition-colors p-1">
                <span className="material-symbols-outlined text-lg">mood</span>
              </button>
              <button onClick={send} className="text-white/30 hover:text-[#E09520] transition-colors p-1">
                <span className="material-symbols-outlined text-lg">send</span>
              </button>
            </div>
            <p className="text-[10px] text-[#3a4a5a] mt-1.5 text-center">
              Seja respeitoso. Siga as <span className="text-[#E09520]/70 hover:text-[#E09520] cursor-pointer">regras da comunidade</span>
            </p>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs text-white/30 mb-2">Faca login para participar do chat</p>
            <a href="/login" className="inline-block px-4 py-2 rounded-lg bg-[#E09520]/10 text-[#E09520] text-xs font-bold border border-[#E09520]/30 hover:bg-[#E09520]/20 transition-colors">
              Entrar
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
