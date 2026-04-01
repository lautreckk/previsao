"use client";

import { useState, useEffect, useRef } from "react";
import { supportFAQ } from "@/lib/chatAgents";

interface SupportMessage { id: string; text: string; isBot: boolean; timestamp: Date; options?: string[]; }

export default function SupportChat({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => { if (!initialized.current && isOpen) { initialized.current = true; setMessages([{ id: "welcome", text: "Ola! Sou o assistente da Winify\nComo posso te ajudar?", isBot: true, timestamp: new Date(), options: supportFAQ.map((f) => f.question) }]); } }, [isOpen]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const addBotResponse = (text: string, delay = 1500, options?: string[]) => { setTyping(true); setTimeout(() => { setTyping(false); setMessages((prev) => [...prev, { id: `bot_${Date.now()}`, text, isBot: true, timestamp: new Date(), options }]); }, delay); };
  const handleFAQ = (question: string) => { setMessages((prev) => [...prev, { id: `user_${Date.now()}`, text: question, isBot: false, timestamp: new Date() }]); const faq = supportFAQ.find((f) => f.question === question); if (faq) addBotResponse(faq.answer, 2000, ["Tenho outra duvida", "Falar com atendente"]); };

  const handleSend = () => {
    if (!input.trim()) return; const text = input.trim();
    setMessages((prev) => [...prev, { id: `user_${Date.now()}`, text, isBot: false, timestamp: new Date() }]); setInput("");
    if (text.toLowerCase().includes("outra")) { addBotResponse("Claro! Selecione uma opcao ou digite sua pergunta:", 1500, supportFAQ.map((f) => f.question)); return; }
    if (text.toLowerCase().includes("atendente") || text.toLowerCase().includes("humano")) { addBotResponse("Nossos atendentes estao disponiveis de segunda a sexta, 9h-18h.", 2000, supportFAQ.map((f) => f.question)); return; }
    const lower = text.toLowerCase(); const matched = supportFAQ.find((f) => f.question.toLowerCase().split(" ").some((k) => k.length > 3 && lower.includes(k)));
    if (matched) addBotResponse(matched.answer, 2500, ["Tenho outra duvida", "Falar com atendente"]);
    else addBotResponse("Entendi! Veja se alguma opcao responde sua pergunta:", 2000, supportFAQ.map((f) => f.question));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-dim sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[380px] sm:h-[600px] sm:rounded-2xl sm:border sm:border-white/10 sm:shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 kinetic-gradient sm:rounded-t-2xl">
        <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#0a0a0a]">support_agent</span><div><h3 className="text-sm font-black font-headline text-[#0a0a0a]">Suporte Winify</h3><span className="text-[10px] text-[#0a0a0a]/80">Online agora</span></div></div>
        <button onClick={onClose} className="text-[#0a0a0a]/80 hover:text-[#0a0a0a]"><span className="material-symbols-outlined">close</span></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.isBot ? "" : "items-end"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2.5 ${msg.isBot ? "bg-surface-container" : "kinetic-gradient text-[#0a0a0a]"}`}>
              {msg.isBot && <div className="flex items-center gap-1.5 mb-1"><span className="material-symbols-outlined text-[#80FF00] text-xs">smart_toy</span><span className="text-[10px] font-bold text-[#80FF00]">Assistente</span></div>}
              <p className="text-sm whitespace-pre-line">{msg.text}</p>
            </div>
            {msg.options && <div className="flex flex-wrap gap-1.5 mt-2 max-w-[85%]">{msg.options.map((opt) => (<button key={opt} onClick={() => handleFAQ(opt)} className="text-xs bg-surface-container-highest text-[#80FF00] border border-[#80FF00]/30 rounded-full px-3 py-1.5 hover:bg-[#80FF00]/10 transition-colors active:scale-95">{opt}</button>))}</div>}
          </div>
        ))}
        {typing && (<div className="flex flex-col"><div className="bg-surface-container rounded-2xl px-3 py-2.5 max-w-[85%]"><div className="flex items-center gap-1.5 mb-1"><span className="material-symbols-outlined text-[#80FF00] text-xs">smart_toy</span><span className="text-[10px] font-bold text-[#80FF00]">Assistente</span></div><div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-on-surface-variant animate-bounce" style={{ animationDelay: "0ms" }} /><div className="w-2 h-2 rounded-full bg-on-surface-variant animate-bounce" style={{ animationDelay: "150ms" }} /><div className="w-2 h-2 rounded-full bg-on-surface-variant animate-bounce" style={{ animationDelay: "300ms" }} /></div></div></div>)}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-white/5 bg-surface-container sm:rounded-b-2xl">
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Digite sua duvida..." className="flex-1 bg-surface-container-highest rounded-full px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-[#80FF00]/40 border-none placeholder-on-surface-variant" />
          <button onClick={handleSend} className="w-10 h-10 rounded-full kinetic-gradient text-[#0a0a0a] flex items-center justify-center shrink-0 active:scale-95 transition-transform"><span className="material-symbols-outlined text-sm">send</span></button>
        </div>
      </div>
    </div>
  );
}
