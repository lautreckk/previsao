"use client";

import { useCallback, useRef } from "react";

/**
 * Synthesize sounds using Web Audio API (no mp3 files needed).
 */
function synthWin(ctx: AudioContext) {
  const now = ctx.currentTime;
  // Ascending arpeggio — cheerful
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, now + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.3);
  });
}

function synthLoss(ctx: AudioContext) {
  const now = ctx.currentTime;
  // Descending — sad trombone
  [400, 350, 300].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, now + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.15);
    osc.stop(now + i * 0.15 + 0.25);
  });
}

function synthBet(ctx: AudioContext) {
  const now = ctx.currentTime;
  // Quick click/pop
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

function synthMoney(ctx: AudioContext) {
  const now = ctx.currentTime;
  // Cash register "cha-ching"
  [1200, 1600].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, now + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.15);
  });
}

const SYNTHS = { win: synthWin, loss: synthLoss, bet: synthBet, money: synthMoney };
type SoundKey = keyof typeof SYNTHS;

/**
 * Hook for playing UI sound effects via Web Audio API.
 * No external audio files needed — all synthesized.
 */
export function useSounds() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current && typeof window !== "undefined") {
      ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback((key: SoundKey) => {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    SYNTHS[key](ctx);
  }, [getCtx]);

  return {
    playWin: useCallback(() => play("win"), [play]),
    playLoss: useCallback(() => play("loss"), [play]),
    playBet: useCallback(() => play("bet"), [play]),
    playMoney: useCallback(() => play("money"), [play]),
    play,
  };
}
