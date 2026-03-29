"use client";

import { useState, useEffect } from "react";

export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  formatted: string;
  urgency: "expired" | "critical" | "warning" | "normal";
}

export function useCountdown(endsAt: number): CountdownResult {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const diff = Math.max(0, endsAt - now);
  const totalSeconds = Math.floor(diff / 1000);
  const isExpired = totalSeconds <= 0;

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let formatted: string;
  if (isExpired) {
    formatted = "Encerrado";
  } else if (days > 0) {
    formatted = `${days}d ${hours}h ${String(minutes).padStart(2, "0")}m`;
  } else if (hours > 0) {
    formatted = `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  } else {
    formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  let urgency: CountdownResult["urgency"];
  if (isExpired) {
    urgency = "expired";
  } else if (totalSeconds < 60) {
    urgency = "critical";
  } else if (totalSeconds < 300) {
    urgency = "warning";
  } else {
    urgency = "normal";
  }

  return { days, hours, minutes, seconds, totalSeconds, isExpired, formatted, urgency };
}
