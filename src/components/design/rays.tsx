"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { VOICE_AGENTS } from "@/lib/domain/design/sales-page";

/**
 * The voice agents on the /business page (18 Nov 2026, Martin: "RENUABL is a brand that takes itself quite seriously…
 * use our current audio style icons… give them a body (a circle) for the audio waves to sit within"; the audio marks
 * voice apart from text, which is Sol). The product's own mark for a phone assistant, the sound wave on graphite, set in
 * a circle with a fine ring and a soft glow in the role's colour: Sales, Bookings, Tech support (`VOICE_AGENTS`). The
 * bars move only while the agent is talking. Still with reduced motion.
 */

const BARS = [0.42, 0.72, 1, 0.62, 0.38];

/** One voice agent, by role: `i` 0 is Sales, 1 Bookings, 2 Tech support. `live` moves its voice. */
export function Ray({
  i,
  size,
  live = false,
  className,
}: {
  i: number;
  size: number;
  live?: boolean;
  /** Kept for the callers that pass it; the voice agents don't follow the pointer. */
  look?: { x: number; y: number };
  className?: string;
}) {
  const agent = VOICE_AGENTS[i % VOICE_AGENTS.length];
  const tint = agent.colour;
  return (
    <span
      className={clsx("relative inline-grid shrink-0 place-items-center rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 35% 30%, #34373e 0%, #1d1f24 60%, #141519 100%)",
        boxShadow: `0 0 0 1px ${tint}55, 0 ${size * 0.12}px ${size * 0.35}px -${size * 0.12}px ${tint}66, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
      aria-hidden
    >
      <span className="flex items-center" style={{ height: size * 0.4, gap: Math.max(2, size * 0.055) }}>
        {BARS.map((v, k) => (
          <span
            key={k}
            className={clsx("rounded-full", live && "agent-wave")}
            style={{
              width: Math.max(2, size * 0.06),
              height: `${v * 100}%`,
              background: tint,
              animationDelay: `${k * 110}ms`,
            }}
          />
        ))}
      </span>
    </span>
  );
}

/** The voice moving while an agent talks. */
export function RayStyles() {
  return (
    <style>{`
      @keyframes agent-wave { 0%,100% { transform: scaleY(0.45); } 50% { transform: scaleY(1.08); } }
      .agent-wave { animation: agent-wave 0.9s ease-in-out infinite; transform-origin: center; }
      @media (prefers-reduced-motion: reduce) { .agent-wave { animation: none; } }
    `}</style>
  );
}

/** Where the pointer is over an element, -1 to 1 each way. */
export function useLook(root: React.RefObject<HTMLElement | null>, live: boolean) {
  const [look, setLook] = useState({ x: 0, y: 0 });
  const frame = useRef(0);
  useEffect(() => {
    if (!live) return;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const el = root.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        setLook({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
      });
    };
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame.current);
    };
  }, [live, root]);
  return look;
}
