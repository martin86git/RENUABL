import type { BatteryPicture } from "@/lib/domain/design/sol-nudges";

/** What each drawing points out, under it. */
const CAPTIONS: Record<BatteryPicture, string> = {
  bollard: "Bollard in front",
  "fire-sheeting": "Sheeting behind",
  awning: "Awning over",
};

/**
 * A battery on a wall, with the one thing a question is about drawn in the signal orange (14 Nov 2026, Martin: asked
 * about a bollard or fire sheeting, the roof is no help, so Sol's question shows what it means). Line drawing only,
 * made for the dark bubble it sits in.
 */
export function BatteryWallPicture({ kind }: { kind: BatteryPicture }) {
  return (
    <figure className="shrink-0" aria-label={CAPTIONS[kind]}>
      <svg viewBox="0 0 96 76" className="h-[76px] w-24 rounded-xl bg-white/[0.06] ring-1 ring-white/10" aria-hidden>
        {/* The wall: brick courses, and the ground. */}
        <rect x="0" y="0" width="96" height="62" className="fill-white/[0.05]" />
        {[12, 24, 36, 48].map((y) => (
          <line key={y} x1="0" y1={y} x2="96" y2={y} className="stroke-white/10" strokeWidth="0.6" />
        ))}
        <line x1="0" y1="62" x2="96" y2="62" className="stroke-white/40" strokeWidth="1" />
        <rect x="0" y="62" width="96" height="14" className="fill-white/[0.03]" />

        {kind === "fire-sheeting" && (
          <g>
            <rect x="24" y="10" width="40" height="49" rx="1.5" className="fill-sun-line/20 stroke-sun-line" strokeWidth="1.2" />
            {[16, 24, 32, 40, 48].map((y) => (
              <line key={y} x1="25" y1={y} x2="33" y2={y - 6} className="stroke-sun-line/60" strokeWidth="0.8" />
            ))}
            {[16, 24, 32, 40, 48].map((y) => (
              <line key={`r${y}`} x1="55" y1={y} x2="63" y2={y - 6} className="stroke-sun-line/60" strokeWidth="0.8" />
            ))}
          </g>
        )}

        {kind === "awning" && (
          <g>
            <path d="M22 14 L68 14 L72 20 L18 20 Z" className="fill-sun-line/30 stroke-sun-line" strokeWidth="1.2" strokeLinejoin="round" />
            <line x1="22" y1="14" x2="22" y2="8" className="stroke-sun-line" strokeWidth="1" />
            <line x1="68" y1="14" x2="68" y2="8" className="stroke-sun-line" strokeWidth="1" />
            <circle cx="86" cy="8" r="3.5" className="fill-white/60" />
            {[0, 1, 2].map((k) => (
              <line key={k} x1={80 - k * 3} y1={13 + k * 2} x2={74 - k * 3} y2={19 + k * 2} className="stroke-white/35" strokeWidth="0.8" />
            ))}
          </g>
        )}

        {/* The battery on the wall: a tall unit with its light. */}
        <rect x="31" y="22" width="26" height="34" rx="3" className="fill-white/85" />
        <rect x="35" y="27" width="18" height="2" rx="1" className="fill-primary/40" />
        <circle cx="44" cy="49" r="1.6" className="fill-positive" />

        {kind === "bollard" && (
          <g>
            <rect x="66" y="40" width="7" height="22" rx="1.5" className="fill-sun-line" />
            <rect x="66" y="45" width="7" height="2.5" className="fill-white/80" />
            <rect x="66" y="52" width="7" height="2.5" className="fill-white/80" />
            {/* A car's nose coming in, to say what it's for. */}
            <path d="M96 52 L84 52 Q80 52 80 56 L80 62 L96 62" className="fill-white/15 stroke-white/40" strokeWidth="0.8" />
          </g>
        )}
      </svg>
      <figcaption className="mt-1 text-center text-[10px] leading-none text-white/55">{CAPTIONS[kind]}</figcaption>
    </figure>
  );
}
