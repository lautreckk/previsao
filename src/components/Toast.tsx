"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastType = "success" | "error" | "info" | "win" | "loss";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}

const TYPE_STYLES: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: { bg: "bg-[#80FF00]/10", icon: "✅", border: "border-[#80FF00]/30" },
  error: { bg: "bg-red-500/10", icon: "❌", border: "border-red-500/30" },
  info: { bg: "bg-blue-500/10", icon: "ℹ️", border: "border-blue-500/30" },
  win: { bg: "bg-[#80FF00]/15", icon: "🎉", border: "border-[#80FF00]/40" },
  loss: { bg: "bg-red-500/10", icon: "😔", border: "border-red-500/30" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info", duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4">
        {toasts.map((t) => {
          const style = TYPE_STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`animate-slide-up pointer-events-auto ${style.bg} border ${style.border} backdrop-blur-xl rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl shadow-black/40`}
            >
              <span className="text-lg shrink-0">{style.icon}</span>
              <p className="text-sm text-white font-medium flex-1">{t.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
