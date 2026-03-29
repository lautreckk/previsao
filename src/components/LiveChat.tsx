"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@/lib/UserContext";
import { ChatMessage, getPreloadedMessages, getRandomMessage, getResponseToUser } from "@/lib/chatAgents";

const userColors: Record<string, string> = {};
const colorPalette = ["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD","#98D8C8","#F7DC6F","#BB8FCE","#85C1E9","#F0B27A","#82E0AA","#F1948A","#AED6F1","#D2B4DE","#A3E4D7","#FAD7A0","#D5F5E3","#FADBD8","#E8DAEF"];
function getUserColor(name: string): string { if (!userColors[name]) { userColors[name] = colorPalette[Object.keys(userColors).length % colorPalette.length]; } return userColors[name]; }

export default function LiveChat({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => { if (!initialized.current && isOpen) { initialized.current = true; setMessages(getPreloadedMessages()); } }, [isOpen]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => { if (Math.random() > 0.3) { const msg = getRandomMessage(); setTyping(msg.user); setTimeout(() => { setTyping(null); setMessages((prev) => [...prev.slice(-80), msg]); }, 2000 + Math.random() * 2000); } }, 8000 + Math.random() * 7000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const sendMessage = useCallback(() => {
    if (!input.trim() || !user) return;
    const userMsg: ChatMessage = { id: `user_${Date.now()}`, user: user.name.split(" ")[0].toLowerCase(), text: input.trim(), predictions: 0, timestamp: new Date() };
    setMessages((prev) => [...prev.slice(-80), userMsg]); const text = input; setInput("");
    const responses = getResponseToUser(text);
    if (responses.length > 0) { setTimeout(() => { setTyping(responses[0].user); setTimeout(() => { setTyping(null); setMessages((prev) => [...prev.slice(-80), responses[0]]); }, 2000 + Math.random() * 1000); }, 1500 + Math.random() * 2000); }
  }, [input, user]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-dim sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[380px] sm:h-[600px] sm:rounded-2xl sm:border sm:border-white/10 sm:shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface-container sm:rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#00D4AA]">forum</span>
          <div><h3 className="text-sm font-black font-headline text-white">Chat ao Vivo</h3><div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse-live" /><span className="text-[10px] text-on-surface-variant">{237 + Math.floor(Math.random() * 50)} online</span></div></div>
        </div>
        <button onClick={onClose} className="text-on-surface-variant hover:text-white"><span className="material-symbols-outlined">close</span></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
        {messages.map((msg) => {
          const isMe = user && msg.user === user.name.split(" ")[0].toLowerCase();
          return (<div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : ""}`}><div className={`max-w-[85%] ${isMe ? "bg-[#00D4AA]/20" : "bg-surface-container"} rounded-2xl px-3 py-2`}><div className="flex items-center gap-1.5 mb-0.5"><span className="text-xs font-bold" style={{ color: isMe ? "#00D4AA" : getUserColor(msg.user) }}>{msg.user}</span>{msg.predictions > 0 && <span className="text-[9px] text-on-surface-variant">{msg.predictions} previsoes</span>}</div><p className="text-sm text-gray-200 break-words">{msg.text}</p></div></div>);
        })}
        {typing && (<div className="flex flex-col"><div className="bg-surface-container rounded-2xl px-3 py-2 max-w-[85%]"><span className="text-xs font-bold" style={{ color: getUserColor(typing) }}>{typing}</span><div className="flex gap-1 mt-1"><div className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-bounce" style={{ animationDelay: "0ms" }} /><div className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-bounce" style={{ animationDelay: "150ms" }} /><div className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-bounce" style={{ animationDelay: "300ms" }} /></div></div></div>)}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-white/5 bg-surface-container sm:rounded-b-2xl">
        {user ? (
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Manda mensagem..." className="flex-1 bg-surface-container-highest rounded-full px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#00D4AA]/40 border-none placeholder-on-surface-variant" />
            <button onClick={sendMessage} className="w-10 h-10 rounded-full kinetic-gradient text-[#003D2E] flex items-center justify-center shrink-0 active:scale-95 transition-transform"><span className="material-symbols-outlined text-sm">send</span></button>
          </div>
        ) : (<p className="text-center text-sm text-on-surface-variant"><a href="/login" className="text-[#00D4AA] font-bold">Faca login</a> para enviar mensagens</p>)}
      </div>
    </div>
  );
}
