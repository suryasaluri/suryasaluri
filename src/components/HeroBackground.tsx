import { useMemo } from "react";
import type { HeroAnimation } from "@/lib/db-types";

// Pure-CSS hero backgrounds, picked by admins on /admin/website. Deterministic
// per-particle values so the layout doesn't jump between renders.
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  left: `${((i * 37) % 100).toFixed(1)}%`,
  duration: 10 + ((i * 7) % 9),
  delay: (i * 1.3) % 10,
  drift: `${(((i * 53) % 60) - 30).toFixed(0)}px`,
}));

export function HeroBackground({ animation }: { animation: HeroAnimation }) {
  const particles = useMemo(() => PARTICLES, []);

  if (animation === "none") return null;

  if (animation === "aurora") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="hero-aurora-blob-a absolute left-1/4 top-0 h-[32rem] w-[32rem] rounded-full blur-3xl" />
        <div className="hero-aurora-blob-b absolute right-1/4 top-10 h-[28rem] w-[28rem] rounded-full blur-3xl" />
      </div>
    );
  }

  if (animation === "grid_pulse") {
    return (
      <div className="hero-grid-pulse grid-bg pointer-events-none absolute inset-0" aria-hidden />
    );
  }

  // particles
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          className="hero-particle"
          style={{
            left: p.left,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            ["--drift" as string]: p.drift,
          }}
        />
      ))}
    </div>
  );
}
