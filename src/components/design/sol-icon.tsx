import { forwardRef, useId } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

/** A four-pointed sparkle with its sides drawn in, centred on (cx, cy) and reaching r from it: the AI's mark. */
function sparkle(cx: number, cy: number, r: number): string {
  const k = r * 0.22;
  const p = (x: number, y: number) => `${Math.round((cx + x) * 100) / 100} ${Math.round((cy + y) * 100) / 100}`;
  return `M${p(0, -r)}C${p(k, -k)} ${p(k, -k)} ${p(r, 0)}C${p(k, k)} ${p(k, k)} ${p(0, r)}C${p(-k, k)} ${p(-k, k)} ${p(-r, 0)}C${p(-k, -k)} ${p(-k, -k)} ${p(0, -r)}Z`;
}

/**
 * Sol's mark, small, as his round shows it (3 Nov 2026, Martin: update it everywhere): one large sun disc with no rays,
 * low and to the left, and the AI's two stars floating diagonally above it to the right. Drawn like the icons beside it
 * (24 grid, the line's colour, filled) and typed as one of them.
 */
export const SolIcon = forwardRef<SVGSVGElement, LucideProps>(function SolIcon(
  { size = 24, color = "currentColor", strokeWidth: _w, absoluteStrokeWidth: _abs, ...rest },
  ref,
) {
  void _w;
  void _abs;
  return (
    <svg ref={ref} width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <circle cx="9.4" cy="14.6" r="7.4" fill={color} />
      <path d={sparkle(18.4, 5.6, 4.6)} fill={color} />
      <path d={sparkle(22.1, 1.9, 1.9)} fill={color} />
    </svg>
  );
}) as LucideIcon;

/**
 * Sol's mark in his own colours at small sizes, where his round would be too much (a chat line, a box): the gold-to-
 * orange sun and its stars, as over his round.
 */
export function SolBadge({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-sun`} x1="9.4" y1="7" x2="9.4" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD27A" />
          <stop offset="0.55" stopColor="#FF8A3D" />
          <stop offset="1" stopColor="#FF5A1F" />
        </linearGradient>
        <linearGradient id={`${id}-star`} x1="14" y1="0" x2="24" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD27A" />
          <stop offset="1" stopColor="#FF5A1F" />
        </linearGradient>
      </defs>
      <circle cx="9.4" cy="14.6" r="7.4" fill={`url(#${id}-sun)`} />
      <path d={sparkle(18.4, 5.6, 4.6)} fill={`url(#${id}-star)`} />
      <path d={sparkle(22.1, 1.9, 1.9)} fill={`url(#${id}-star)`} />
    </svg>
  );
}

/**
 * Sol himself: a standalone sun (14 Nov 2026, Martin: "remove the black ring from around Sol. so he'll be standalone
 * sun… a little bit bigger… a little more ai tech. but still fundamentally the sun"). One disc, lit like a glass orb:
 * a hot pale core high and to the left, gold through the signal orange to a deeper rim, a fine highlight along its
 * top; and round it one hair-thin orbit with a small bright node travelling it, the only "machine" in the mark. No
 * rays, no dark round behind him. Sized by its box, which it fills; the colours are its own. `glow` adds the soft halo.
 */
export function SolMark({ className, glow = true }: { className?: string; glow?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className ? `sol-sun ${className}` : "sol-sun"} aria-hidden>
      <defs>
        <radialGradient id={`${id}-sun`} cx="9.4" cy="8.2" r="13.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFF1C2" />
          <stop offset="0.22" stopColor="#FFD27A" />
          <stop offset="0.58" stopColor="#FF8A3D" />
          <stop offset="0.9" stopColor="#FF5A1F" />
          <stop offset="1" stopColor="#E8480F" />
        </radialGradient>
        <radialGradient id={`${id}-glow`} cx="12" cy="12" r="12" gradientUnits="userSpaceOnUse">
          <stop offset="0.72" stopColor="#FF8A3D" stopOpacity="0.38" />
          <stop offset="1" stopColor="#FF5A1F" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-orbit`} x1="2" y1="20" x2="22" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF5A1F" stopOpacity="0" />
          <stop offset="0.55" stopColor="#FF8A3D" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFD27A" />
        </linearGradient>
      </defs>
      {glow && <circle cx="12" cy="12" r="12" fill={`url(#${id}-glow)`} />}
      <circle cx="12" cy="12" r="9" fill={`url(#${id}-sun)`} />
      {/* The light along his top edge. */}
      <path d="M5.9 8.6A7.2 7.2 0 0 1 13.4 4.9" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.7" strokeLinecap="round" />
      {/* His orbit: most of a ring, fading in from nothing, a small bright node at its head. It turns slowly. */}
      <g className="sol-orbit">
        <path d="M4.07 19.93A11.2 11.2 0 1 1 19.93 4.07" stroke={`url(#${id}-orbit)`} strokeWidth="0.55" strokeLinecap="round" />
        <circle cx="19.93" cy="4.07" r="1.15" fill="#FFD27A" />
        <circle cx="19.93" cy="4.07" r="0.5" fill="#fff" />
      </g>
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
