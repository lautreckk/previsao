"use client";

import { useState, useEffect, useRef } from "react";

interface OddsUpdateIndicatorProps {
  currentOdds: number;
  /** Duration in ms before the indicator fades out */
  fadeDuration?: number;
}

type Direction = "up" | "down" | null;

export function OddsUpdateIndicator({
  currentOdds,
  fadeDuration = 2000,
}: OddsUpdateIndicatorProps) {
  const [direction, setDirection] = useState<Direction>(null);
  const [animating, setAnimating] = useState(false);
  const prevOddsRef = useRef<number>(currentOdds);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevOddsRef.current;

    if (prev !== currentOdds && prev !== 0) {
      const dir: Direction = currentOdds > prev ? "up" : "down";
      setDirection(dir);
      setAnimating(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setAnimating(false);
        setDirection(null);
      }, fadeDuration);
    }

    prevOddsRef.current = currentOdds;
  }, [currentOdds, fadeDuration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!animating || direction === null) return null;

  const isUp = direction === "up";

  return (
    <span
      className={`inline-flex items-center transition-opacity duration-500 ${
        animating ? "opacity-100" : "opacity-0"
      }`}
    >
      <span
        className={`text-xs font-bold ${
          isUp ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {isUp ? "\u25B2" : "\u25BC"}
      </span>
    </span>
  );
}
