"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";

/**
 * The Rays (17 Nov 2026, Martin: the voice agents as characters, "the army you wished you always had", their family
 * named as Bots and Dots are; then, after a first try with panels and plugs on them: "take the inspiration from grok bots
 * but make them all more sun related… they dont all have to have rays… they can be like sol"). Sol is the sun and the
 * Rays are what he sends out, so every Ray is a sun: glass orbs like Sol, one wearing his orbit, a sun rising, a sun with
 * soft rays, an eclipse, a haloed sun, a sunset on the sea. What sets each apart is its colour and its eyes. They blink
 * now and then, glance towards the pointer and bob a little. Still with reduced motion.
 */

type EyeKind = "oval" | "dot" | "happy" | "tall";

/** Each sun: its colour, its body (lit as glass), what's drawn over it, and its eyes. */
const SUNS: {
  colour: string;
  body: (fill: string) => React.ReactNode;
  over?: (colour: string) => React.ReactNode;
  /** Drawn on its face only, clipped to it: the eclipse's shadow. */
  shade?: React.ReactNode;
  eyes: { kind: EyeKind; at: [number, number] };
}[] = [
  {
    // A glass orb, Sol's little sibling.
    colour: "#F5B544",
    body: (fill) => <circle cx="50" cy="52" r="34" fill={fill} />,
    eyes: { kind: "oval", at: [50, 54] },
  },
  {
    // An orb wearing Sol's orbit, its node bright.
    colour: "#F0644B",
    body: (fill) => <circle cx="50" cy="52" r="30" fill={fill} />,
    over: () => (
      <g>
        <ellipse
          cx="50"
          cy="52"
          rx="44"
          ry="15"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.55"
          strokeWidth="2.4"
          transform="rotate(-18 50 52)"
        />
        <circle cx="88" cy="38" r="4.5" fill="#fff" />
      </g>
    ),
    eyes: { kind: "dot", at: [50, 52] },
  },
  {
    // A sun rising on the horizon.
    colour: "#FF7A2F",
    body: (fill) => <path d="M12 78 A38 38 0 0 1 88 78 Z" fill={fill} />,
    over: () => <rect x="4" y="77" width="92" height="3.5" rx="1.75" fill="#fff" fillOpacity="0.55" />,
    eyes: { kind: "happy", at: [50, 60] },
  },
  {
    // A sun with a few soft, round rays, like petals.
    colour: "#FFC861",
    body: (fill) => (
      <g fill={fill}>
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse key={i} cx="50" cy="16" rx="9" ry="11" transform={`rotate(${i * 45} 50 52)`} />
        ))}
        <circle cx="50" cy="52" r="28" />
      </g>
    ),
    eyes: { kind: "tall", at: [50, 53] },
  },
  {
    // An eclipse: a shadow sliding across its face.
    colour: "#E05A8A",
    body: (fill) => <circle cx="50" cy="52" r="33" fill={fill} />,
    shade: <circle cx="84" cy="44" r="30" fill="#2a0d1c" fillOpacity="0.5" />,
    eyes: { kind: "oval", at: [44, 53] },
  },
  {
    // A sun in a glowing halo.
    colour: "#8B6CF0",
    body: (fill) => <circle cx="50" cy="52" r="29" fill={fill} />,
    over: (colour) => (
      <g>
        <circle cx="50" cy="52" r="39" fill="none" stroke={mix(colour, 0.45)} strokeOpacity="0.7" strokeWidth="4" />
        <circle cx="50" cy="52" r="46" fill="none" stroke={mix(colour, 0.6)} strokeOpacity="0.35" strokeWidth="2.5" />
      </g>
    ),
    eyes: { kind: "dot", at: [50, 53] },
  },
  {
    // A sunset on the sea: its lower half in the water.
    colour: "#3F7FE8",
    body: (fill) => <circle cx="50" cy="50" r="33" fill={fill} />,
    over: () => (
      <g>
        <path d="M17 62 L83 62 A33 33 0 0 1 17 62 Z" fill="#0b1a33" fillOpacity="0.4" />
        <path d="M24 70 h52 M30 76 h40 M38 81 h24" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      </g>
    ),
    eyes: { kind: "happy", at: [50, 49] },
  },
];
const SHAPES = SUNS;

/** The eyes, by kind, round where they sit. */
function Eyes({ kind, at: [x, y] }: { kind: EyeKind; at: [number, number] }) {
  const ink = "#141416";
  if (kind === "dot")
    return (
      <>
        <circle cx={x - 9} cy={y} r="5" fill={ink} />
        <circle cx={x + 9} cy={y} r="5" fill={ink} />
      </>
    );
  if (kind === "happy")
    return (
      <>
        <path d={`M${x - 15} ${y + 2} q6 -9 12 0`} fill="none" stroke={ink} strokeWidth="4.5" strokeLinecap="round" />
        <path d={`M${x + 3} ${y + 2} q6 -9 12 0`} fill="none" stroke={ink} strokeWidth="4.5" strokeLinecap="round" />
      </>
    );
  if (kind === "tall")
    return (
      <>
        <rect x={x - 12} y={y - 9} width="7" height="18" rx="3.5" fill={ink} />
        <rect x={x + 5} y={y - 9} width="7" height="18" rx="3.5" fill={ink} />
      </>
    );
  return (
    <>
      <ellipse cx={x - 9} cy={y} rx="5" ry="8" fill={ink} />
      <ellipse cx={x + 9} cy={y} rx="5" ry="8" fill={ink} />
    </>
  );
}

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
  const [ex, ey] = shape.eyes.at;
  // A small glance, calm rather than cute (17 Nov 2026, Martin).
  const dx = look.x * 2;
  const dy = look.y * 1.5;
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
          {shape.shade}
          <path d="M28 40 Q36 26 54 24" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="5" strokeLinecap="round" />
        </g>
        {shape.over?.(colour)}
        <g
          className="ray-blink"
          style={{
            transform: `translate(${dx}px, ${dy}px)`,
            transformOrigin: `${ex}px ${ey}px`,
            transition: "transform 700ms ease-out",
            animationDelay: `${1200 + ((i * 1630) % 5200)}ms`,
            animationPlayState: live ? "running" : "paused",
          }}
        >
          <Eyes kind={shape.eyes.kind} at={shape.eyes.at} />
        </g>
      </svg>
    </span>
  );
}

/** The motion the Rays share: a small bob and a blink every few seconds. */
export function RayStyles() {
  return (
    <style>{`
      @keyframes ray-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2.5%); } }
      @keyframes ray-blink { 0%,96%,100% { scale: 1 1; } 98% { scale: 1 0.1; } }
      .ray-bob { animation: ray-bob 5.5s ease-in-out infinite; }
      .ray-blink { animation: ray-blink 9s ease-in-out infinite; }
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
