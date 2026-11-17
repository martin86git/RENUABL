"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";

/**
 * The Rays (17 Nov 2026, Martin: the voice agents as characters, "the army you wished you always had", their family
 * named as Bots and Dots are). Sol is the sun and the Rays are what he sends out, so every Ray is a sun (Martin: a
 * variation of the sun in different colours, each with a characteristic of its own, emblematic of solar): long rays,
 * a headset (they're voice agents), a bolt, a battery, a panel worn as a cap, a charge plug, a short corona. Each has two
 * eyes that blink now and then and glance towards the pointer, and bobs a little. Still with reduced motion.
 */

const INK = "#1b1d22";

/** Tapered rays round the disc: `n` of them, reaching `to` out from the middle, `w` wide where they leave it. */
function raysOf(n: number, _from: number, to: number, w: number, turn = 0) {
  const base = 52 - 24;
  return Array.from({ length: n }, (_, i) => (
    <path
      key={i}
      d={`M${50 - w / 2} ${base} L50 ${52 - to} L${50 + w / 2} ${base} Z`}
      strokeLinejoin="round"
      transform={`rotate(${turn + (i * 360) / n} 50 52)`}
    />
  ));
}

/** Each sun: its colour, its body (the disc and its rays, lit as glass) and its emblem, drawn over it in its own colours. */
const SUNS: { colour: string; body: (fill: string) => React.ReactNode; emblem?: React.ReactNode }[] = [
  {
    // The classic: long, even rays.
    colour: "#F5B544",
    body: (fill) => (
      <g fill={fill} stroke={fill} strokeWidth="4" strokeLinejoin="round">
        {raysOf(8, 30, 48, 13)}
        <circle cx="50" cy="52" r="28" />
      </g>
    ),
  },
  {
    // The voice agent: a headset over the top, the microphone at its mouth.
    colour: "#8B6CF0",
    body: (fill) => (
      <g fill={fill} stroke={fill} strokeWidth="4" strokeLinejoin="round">
        {raysOf(10, 30, 42, 11, 18)}
        <circle cx="50" cy="52" r="28" />
      </g>
    ),
    emblem: (
      <g>
        <path d="M24 52 A26 26 0 0 1 76 52" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        <path d="M24 52 A26 26 0 0 1 76 52" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M78 61 Q78 74 62 74" fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round" />
        <path d="M78 61 Q78 74 62 74" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="16" y="44" width="12" height="18" rx="5" fill="#fff" stroke={INK} strokeWidth="2" />
        <rect x="72" y="44" width="12" height="18" rx="5" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="60" cy="74" r="4.5" fill="#fff" stroke={INK} strokeWidth="2" />
      </g>
    ),
  },
  {
    // The bolt: a flash of charge on its brow.
    colour: "#F0644B",
    body: (fill) => (
      <g fill={fill} stroke={fill} strokeWidth="4" strokeLinejoin="round">
        {raysOf(8, 30, 45, 12, 22.5)}
        <circle cx="50" cy="52" r="28" />
      </g>
    ),
    emblem: <path d="M55 14 L43 31 L50 31 L46 44 L59 26 L52 26 Z" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />,
  },
  {
    // The battery: a charge badge at its side, filling up.
    colour: "#2BB5A0",
    body: (fill) => (
      <g fill={fill} stroke={fill} strokeWidth="4" strokeLinejoin="round">
        {raysOf(12, 30, 41, 9)}
        <circle cx="50" cy="52" r="28" />
      </g>
    ),
    emblem: (
      <g transform="rotate(-12 74 78)">
        <rect x="60" y="70" width="28" height="16" rx="4" fill={INK} stroke="#fff" strokeWidth="2" />
        <rect x="88" y="75" width="4" height="6" rx="1.5" fill="#fff" />
        <rect x="63.5" y="73.5" width="6" height="9" rx="1.5" fill="#7CF0B4" />
        <rect x="71" y="73.5" width="6" height="9" rx="1.5" fill="#7CF0B4" />
        <rect x="78.5" y="73.5" width="6" height="9" rx="1.5" fill="#7CF0B4" opacity="0.35" />
      </g>
    ),
  },
  {
    // The panel: a solar panel worn as a cap.
    colour: "#4F8EF7",
    body: (fill) => (
      <g fill={fill} stroke={fill} strokeWidth="4" strokeLinejoin="round">
        {raysOf(8, 30, 45, 12, 22.5)}
        <circle cx="50" cy="52" r="28" />
      </g>
    ),
    emblem: (
      <g transform="rotate(-8 50 26)">
        <path d="M26 30 L74 30 L68 14 L32 14 Z" fill="#1e2b47" stroke="#cfe0ff" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M38.7 14 L36 30 M50 14 L50 30 M61.3 14 L64 30 M29 22 L71 22" stroke="#cfe0ff" strokeWidth="1.2" />
      </g>
    ),
  },
  {
    // The plug: a charging cable trailing from it.
    colour: "#E05A8A",
    body: (fill) => (
      <g fill={fill} stroke={fill} strokeWidth="4" strokeLinejoin="round">
        {raysOf(9, 30, 44, 12)}
        <circle cx="50" cy="52" r="28" />
      </g>
    ),
    emblem: (
      <g>
        <path d="M66 74 Q76 92 90 84" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <path d="M66 74 Q76 92 90 84" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <rect x="86" y="76" width="11" height="14" rx="3" fill="#fff" stroke={INK} strokeWidth="2" transform="rotate(-30 91 82)" />
        <path d="M93 73 L97 69 M97 79 L101 75" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </g>
    ),
  },
  {
    // The corona: a ring of short sparks.
    colour: "#FF7A2F",
    body: (fill) => (
      <g fill={fill} stroke={fill} strokeWidth="4" strokeLinejoin="round">
        {raysOf(16, 31, 40, 7)}
        <circle cx="50" cy="52" r="28" />
      </g>
    ),
  },
];
const SHAPES = SUNS;
/** Every sun's eyes sit on its face. */
const EYES: [number, number] = [50, 54];

export const RAY_COUNT = SHAPES.length;

/** A colour mixed towards white (t > 0) or black (t < 0), for the glass's light and rim. */
function mix(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** One Ray. `look` is where the pointer is, -1 to 1 each way; `blinkAt` staggers the blinks. */
export function Ray({
  i,
  size,
  look = { x: 0, y: 0 },
  live = true,
  className,
}: {
  i: number;
  size: number;
  look?: { x: number; y: number };
  live?: boolean;
  className?: string;
}) {
  const shape = SHAPES[i % SHAPES.length];
  const colour = shape.colour;
  // Glass, as Sol is (17 Nov 2026, Martin): lit from the top left, a deeper rim, a shine across the top, a soft glow.
  const id = useId().replace(/:/g, "");
  const fill = `url(#ray-${id})`;
  const [ex, ey] = EYES;
  const dx = look.x * 4;
  const dy = look.y * 3;
  return (
    <span
      className={clsx("ray-bob inline-block", className)}
      style={{ width: size, height: size, animationDelay: `${(i * 370) % 2200}ms`, animationPlayState: live ? "running" : "paused" }}
    >
      <svg
        viewBox="0 0 100 100"
        className="size-full overflow-visible"
        style={{ filter: `drop-shadow(0 6px 10px ${colour}55)` }}
        aria-hidden
      >
        <defs>
          <radialGradient id={`ray-${id}`} cx="34%" cy="28%" r="78%">
            <stop offset="0%" stopColor={mix(colour, 0.6)} />
            <stop offset="45%" stopColor={colour} />
            <stop offset="100%" stopColor={mix(colour, -0.28)} />
          </radialGradient>
          <clipPath id={`ray-clip-${id}`}>{shape.body("#000")}</clipPath>
        </defs>
        {shape.body(fill)}
        <g clipPath={`url(#ray-clip-${id})`}>
          <path d="M30 42 Q38 30 54 28" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="5" strokeLinecap="round" />
        </g>
        {shape.emblem}
        <g
          className="ray-blink"
          style={{
            transform: `translate(${dx}px, ${dy}px)`,
            transformOrigin: `${ex}px ${ey}px`,
            transition: "transform 400ms ease-out",
            animationDelay: `${1200 + ((i * 1630) % 5200)}ms`,
            animationPlayState: live ? "running" : "paused",
          }}
        >
          <ellipse cx={ex - 9} cy={ey} rx="5" ry="8" fill="#141416" />
          <ellipse cx={ex + 9} cy={ey} rx="5" ry="8" fill="#141416" />
        </g>
      </svg>
    </span>
  );
}

/** The motion the Rays share: a small bob and a blink every few seconds. */
export function RayStyles() {
  return (
    <style>{`
      @keyframes ray-bob { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-6%) rotate(-3deg); } }
      @keyframes ray-blink { 0%,94%,100% { scale: 1 1; } 97% { scale: 1 0.1; } }
      .ray-bob { animation: ray-bob 3.6s ease-in-out infinite; }
      .ray-blink { animation: ray-blink 6.5s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .ray-bob, .ray-blink { animation: none; } }
    `}</style>
  );
}

/** Where the pointer is over an element, -1 to 1 each way, for the Rays to glance at. */
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
