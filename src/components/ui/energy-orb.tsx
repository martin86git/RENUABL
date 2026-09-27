"use client";

import { useId } from "react";
import { cn } from "./primitives";

/**
 * The RENUABL "energy object": a soft, friendly, abstract mascot.
 * Pure SVG + CSS so it renders instantly and respects reduced motion.
 */
export function EnergyOrb({ className, size, mood = "calm" }: { className?: string; size?: number; mood?: "calm" | "happy" }) {
  // Unique gradient ids: several orbs (some display:none) can share a page.
  const uid = useId().replace(/:/g, "");
  const body = `orb-body-${uid}`;
  const ring = `orb-ring-${uid}`;
  return (
    <div className={cn("relative animate-orb-float", className)} style={size ? { width: size, height: size } : undefined} aria-hidden>
      <div
        className="absolute inset-[8%] rounded-full blur-3xl opacity-60"
        style={{ background: "radial-gradient(circle at 35% 35%, var(--sun), var(--coral) 45%, var(--lilac) 80%)" }}
      />
      <svg viewBox="0 0 200 200" className="relative h-full w-full">
        <defs>
          <radialGradient id={body} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#FFF4DE" />
            <stop offset="35%" stopColor="#FFC56B" />
            <stop offset="70%" stopColor="#FF8A66" />
            <stop offset="100%" stopColor="#B9A7FF" />
          </radialGradient>
          <linearGradient id={ring} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8FD3FF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#B9A7FF" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <g className="animate-orb-spin" style={{ transformOrigin: "100px 100px" }}>
          <ellipse cx="100" cy="100" rx="92" ry="34" fill="none" stroke={`url(#${ring})`} strokeWidth="2" transform="rotate(-18 100 100)" />
          <circle cx="182" cy="76" r="5" fill="#8FD3FF" />
        </g>
        <circle cx="100" cy="100" r="66" fill={`url(#${body})`} />
        <ellipse cx="80" cy="74" rx="22" ry="14" fill="#fff" opacity="0.45" />
        {/* face */}
        <circle cx="86" cy="104" r="4.2" fill="#2A1E3F" />
        <circle cx="114" cy="104" r="4.2" fill="#2A1E3F" />
        <path
          d={mood === "happy" ? "M88 118 Q100 130 112 118" : "M91 119 Q100 125 109 119"}
          fill="none"
          stroke="#2A1E3F"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx="76" cy="116" r="6" fill="#FF7A59" opacity="0.35" />
        <circle cx="124" cy="116" r="6" fill="#FF7A59" opacity="0.35" />
      </svg>
    </div>
  );
}
