"use client";

import { useState } from "react";
import { Send, ChevronLeft, ChevronRight } from "lucide-react";
import { useChat, getUserBadge } from "@/lib/ChatContext";
import { useUser } from "@/lib/UserContext";
import Link from "next/link";
import Icon from "@/components/Icon";

interface ChatPanelDesktopProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function ChatPanelDesktop({ isOpen, onToggle }: ChatPanelDesktopProps) {
  const [message, setMessage] = useState("");
  const { user } = useUser();
  const { messages: chatMsgs, sendMessage, onlineCount } = useChat();

  const handleSend = () => {
    if (!message.trim() || !user) return;
    const username = `@${user.name.split(" ")[0].toLowerCase()}`;
    sendMessage(message.trim(), username, user?.avatar_url || undefined);
    setMessage("");
  };

  return (
    <>
      {/* Vertical "AO VIVO" tab on far right edge */}
      <button
        onClick={onToggle}
        className="hidden xl:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-[hsl(0,0%,11%)] border border-r-0 border-[hsl(0,0%,18%)] rounded-l-xl items-center justify-center w-8 cursor-pointer hover:bg-[hsl(0,0%,14%)] transition-colors flex-col gap-1 py-4"
      >
        {isOpen ? <ChevronRight size={14} className="text-[hsl(0,0%,55%)]" /> : <ChevronLeft size={14} className="text-[hsl(0,0%,55%)]" />}
        <div className="flex items-center gap-1 mt-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#80FF00] animate-pulse" />
          <span className="text-[10px] text-[hsl(0,0%,55%)] font-bold">{onlineCount}</span>
        </div>
        <span className="text-[10px] text-[hsl(0,0%,55%)]">online</span>
        <div className="mt-3" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
          <span className="text-[11px] font-bold text-[hsl(0,0%,95%)] tracking-wider">AO VIVO</span>
        </div>
      </button>

      {/* Expanded chat panel */}
      {isOpen && (
        <aside className="hidden xl:flex flex-col w-64 fixed right-8 top-[88px] bottom-0 border-l border-[hsl(0,0%,18%)] bg-[hsl(0,0%,11%)] z-20">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(0,0%,18%)]">
            <h3 className="text-sm font-bold text-[hsl(0,0%,95%)]">CHAT AO VIVO</h3>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#80FF00] animate-pulse" />
              <span className="text-[10px] text-[hsl(0,0%,55%)]">{onlineCount} online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
            {chatMsgs.map((msg) => {
              const badge = getUserBadge(msg.text);
              return (
                <div key={msg.id}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-xs font-bold text-[#80FF00]">{msg.user}</p>
                    {badge && (
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,18%)] ${badge.color}`}>
                        <Icon name={badge.icon} size={9} />
                        <span className="text-[8px] font-black uppercase">{badge.label}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[hsl(0,0%,95%)]">{msg.text}</p>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-2 border-t border-[hsl(0,0%,18%)]">
            {user ? (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Enviar mensagem..."
                    className="flex-1 bg-[hsl(0,0%,14%)] text-[hsl(0,0%,95%)] placeholder:text-[hsl(0,0%,55%)] px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-[#80FF00]/50"
                  />
                  <button onClick={handleSend} className="bg-[#80FF00] text-[#0a0a0a] p-2 rounded-lg hover:opacity-90 transition-opacity">
                    <Send size={14} />
                  </button>
                </div>
                <p className="text-[9px] text-[hsl(0,0%,55%)] text-center mt-1">
                  Seja respeitoso. Siga as <span className="text-[#80FF00] cursor-pointer hover:underline">regras da comunidade</span>
                </p>
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-[hsl(0,0%,55%)] mb-2">Faça login para participar do chat</p>
                <Link href="/login" className="inline-block px-4 py-2 rounded-lg bg-[#80FF00]/10 text-[#80FF00] text-xs font-bold border border-[#80FF00]/30 hover:bg-[#80FF00]/20 transition-colors">Entrar</Link>
              </div>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
