"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";

/**
 * The Rays (17 Nov 2026, Martin: the voice agents as characters, "the army you wished you always had", their family
 * named as Bots and Dots are). Sol is the sun; the Rays are what he sends out, so every one is a sun shape of our own:
 * a sunburst, a rising half-sun, a flare, a sparkle, a corona, a lens, a dawn hexagon. Each has two eyes that blink now
 * and then and glance towards the pointer, and bobs a little. Colours run from sunrise to dusk. Still with reduced motion.
 */

const COLOURS = ["#F5B544", "#FF7A2F", "#F0644B", "#FFC861", "#E05A8A", "#8B6CF0", "#4F8EF7", "#2BB5A0"];

/** The body of each shape, in a 100 × 100 box; `eyes` is where its eyes sit. */
const SHAPES: { body: (fill: string) => React.ReactNode; eyes: [number, number] }[] = [
  {
    // A sunburst: a disc with eight rounded rays.
    body: (fill) => (
      <g fill={fill}>
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="45" y="4" width="10" height="22" rx="5" transform={`rotate(${i * 45} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="31" />
      </g>
    ),
    eyes: [50, 50],
  },
  {
    // A half-sun rising, with three short rays.
    body: (fill) => (
      <g fill={fill}>
        <path d="M10 82 a40 40 0 0 1 80 0 Z" />
        <rect x="46" y="14" width="8" height="16" rx="4" />
        <rect x="46" y="14" width="8" height="16" rx="4" transform="rotate(-38 50 82)" />
        <rect x="46" y="14" width="8" height="16" rx="4" transform="rotate(38 50 82)" />
      </g>
    ),
    eyes: [50, 64],
  },
  {
    // A flare, rising like a flame.
    body: (fill) => <path fill={fill} d="M50 6 C66 28 84 44 84 64 a34 30 0 0 1 -68 0 C16 44 34 28 50 6 Z" />,
    eyes: [50, 64],
  },
  {
    // A sparkle, as Sol's stars are.
    body: (fill) => <path fill={fill} d="M50 4 C55 36 64 45 96 50 C64 55 55 64 50 96 C45 64 36 55 4 50 C36 45 45 36 50 4 Z" />,
    eyes: [50, 50],
  },
  {
    // A dawn hexagon.
    body: (fill) => (
      <path fill={fill} stroke={fill} strokeWidth="10" strokeLinejoin="round" d="M50 12 L83 31 L83 69 L50 88 L17 69 L17 31 Z" />
    ),
    eyes: [50, 50],
  },
  {
    // A lens, the sun low on the horizon.
    body: (fill) => <path fill={fill} d="M6 50 C26 18 74 18 94 50 C74 82 26 82 6 50 Z" />,
    eyes: [50, 50],
  },
  {
    // A corona: a disc in a ring of short dashes.
    body: (fill) => (
      <g fill={fill}>
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x="47" y="5" width="6" height="11" rx="3" transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="30" />
      </g>
    ),
    eyes: [50, 50],
  },
  {
    // A rounded sun-square, tilted.
    body: (fill) => <rect x="16" y="16" width="68" height="68" rx="22" fill={fill} transform="rotate(-10 50 50)" />,
    eyes: [50, 50],
  },
];

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
  const colour = COLOURS[i % COLOURS.length];
  // Glass, as Sol is (17 Nov 2026, Martin): lit from the top left, a deeper rim, a shine across the top, a soft glow.
  const id = useId().replace(/:/g, "");
  const fill = `url(#ray-${id})`;
  const [ex, ey] = shape.eyes;
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
          <path d="M26 34 Q36 20 56 18" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" />
        </g>
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
          <ellipse cx={ex - 10} cy={ey} rx="6" ry="9" fill="#141416" />
          <ellipse cx={ex + 10} cy={ey} rx="6" ry="9" fill="#141416" />
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
