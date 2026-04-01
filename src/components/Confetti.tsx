"use client";
import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  scale: number;
  vx: number;
  vy: number;
}

export default function Confetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) return;
    const colors = ["#80FF00", "#00FFB8", "#FF5252", "#5B9DFF", "#E040FB", "#80FF00"];
    const newParticles: Particle[] = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 30,
      y: 30,
      rotation: Math.random() * 360,
      color: colors[Math.floor(Math.random() * colors.length)],
      scale: 0.5 + Math.random() * 0.8,
      vx: (Math.random() - 0.5) * 8,
      vy: -3 - Math.random() * 5,
    }));
    setParticles(newParticles);
    const timer = setTimeout(() => setParticles([]), 3000);
    return () => clearTimeout(timer);
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-3 h-3 rounded-sm"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
            animation: `confetti-fall 2.5s ease-out forwards`,
            animationDelay: `${Math.random() * 0.3}s`,
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}
