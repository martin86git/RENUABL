import { forwardRef, useId } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

/** A four-pointed sparkle with its sides drawn in, centred on (cx, cy) and reaching r from it: the AI's mark. */
function sparkle(cx: number, cy: number, r: number): string {
  const k = r * 0.22;
  const p = (x: number, y: number) => `${Math.round((cx + x) * 100) / 100} ${Math.round((cy + y) * 100) / 100}`;
  return `M${p(0, -r)}C${p(k, -k)} ${p(k, -k)} ${p(r, 0)}C${p(k, k)} ${p(k, k)} ${p(0, r)}C${p(-k, k)} ${p(-k, k)} ${p(-r, 0)}C${p(-k, -k)} ${p(-k, -k)} ${p(0, -r)}Z`;
}

/** The sun: a disc and eight short rays round it. */
const SUN = { cx: 12, cy: 12, r: 4.4 };
const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const at = (r: number) => [SUN.cx + r * Math.sin(a), SUN.cy - r * Math.cos(a)].map((n) => Math.round(n * 100) / 100);
  return [...at(6.8), ...at(9.4)];
});

/**
 * Sol's mark, small (3 Nov 2026, Martin: the speech bubble didn't read as AI; just a sun, with the AI's stars floating
 * above it). A sun, and a small sparkle off its top right corner, drawn like the icons beside it (24 grid, the line's
 * colour, the disc filled) and typed as one of them.
 */
export const SolIcon = forwardRef<SVGSVGElement, LucideProps>(function SolIcon(
  { size = 24, color = "currentColor", strokeWidth = 2, absoluteStrokeWidth: _abs, ...rest },
  ref,
) {
  void _abs;
  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      {...rest}
    >
      <circle cx={SUN.cx - 1.5} cy={SUN.cy + 1.5} r={SUN.r - 0.6} fill={color} stroke="none" />
      {RAYS.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1 - 1.5} y1={y1 + 1.5} x2={x2 - 1.5} y2={y2 + 1.5} />
      ))}
      <path d={sparkle(20.2, 3.8, 3.6)} fill={color} stroke="none" />
    </svg>
  );
}) as LucideIcon;

/**
 * Sol's sun at its fullest, for his graphite round and his panel's head: the disc lit from gold at its top to the
 * signal orange, eight orange rays, a soft glow behind. Sized by its box; the colours are its own.
 */
export function SolMark({ className, glow = true }: { className?: string; glow?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-sun`} x1="12" y1="7.6" x2="12" y2="16.4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD27A" />
          <stop offset="0.55" stopColor="#FF8A3D" />
          <stop offset="1" stopColor="#FF5A1F" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="12" cy="12" r="9" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF8A3D" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FF5A1F" stopOpacity="0" />
        </radialGradient>
      </defs>
      {glow && <circle cx="12" cy="12" r="9" fill={`url(#${id}-glow)`} />}
      <g stroke="#FF7A33" strokeWidth={1.6} strokeLinecap="round">
        {RAYS.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <circle cx={SUN.cx} cy={SUN.cy} r={SUN.r} fill={`url(#${id}-sun)`} />
    </svg>
  );
}

/**
 * The AI's stars that float over Sol's round, diagonally above it and outside it: a larger sparkle and a smaller one,
 * gold to orange. Placed by whoever draws the round.
 */
export function SolStars({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-star`} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD27A" />
          <stop offset="1" stopColor="#FF5A1F" />
        </linearGradient>
      </defs>
      <path d={sparkle(9, 15, 8.4)} fill={`url(#${id}-star)`} />
      <path d={sparkle(19.4, 4.8, 4.2)} fill={`url(#${id}-star)`} />
    </svg>
  );
}
