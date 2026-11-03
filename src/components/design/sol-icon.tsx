import { forwardRef, useId } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

/** The speech bubble Sol speaks from: rounded, its tail at the lower left. */
const BUBBLE = "M8 3H16A5 5 0 0 1 21 8V13A5 5 0 0 1 16 18H10.4L6 21.2V17.7A5 5 0 0 1 3 13V8A5 5 0 0 1 8 3Z";
/** The horizon inside it, and the sun half risen on it: RENUABL's sun, the one that keeps time on Today. */
const HORIZON: [number, number, number, number] = [6.6, 13.6, 17.4, 13.6];
const SUN = "M8.3 13.6A3.7 3.7 0 0 1 15.7 13.6Z";
/** Three short rays above the sun. */
const RAYS: [number, number, number, number][] = [
  [12, 6.3, 12, 7.6],
  [8.4, 7.9, 9.2, 8.7],
  [15.6, 7.9, 14.8, 8.7],
];

/**
 * Sol's mark (3 Nov 2026, Martin: the spark in a ring of rays read as any AI's and wasn't tied to RENUABL). A speech
 * bubble with the sun rising inside it: an assistant who speaks, and RENUABL's own sun on its horizon. Drawn like the
 * icons beside it (24 grid, the line's colour, the sun filled) and typed as one of them, for the small places.
 */
export const SolIcon = forwardRef<SVGSVGElement, LucideProps>(function SolIcon(
  { size = 24, color = "currentColor", strokeWidth = 2, absoluteStrokeWidth: _abs, ...rest },
  ref,
) {
  void _abs;
  const [x1, y1, x2, y2] = HORIZON;
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
      strokeLinejoin="round"
      {...rest}
    >
      <path d={BUBBLE} />
      <path d={SUN} fill={color} stroke="none" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {RAYS.map(([a, b, c, d], i) => (
        <line key={i} x1={a} y1={b} x2={c} y2={d} strokeWidth={Number(strokeWidth) * 0.75} />
      ))}
    </svg>
  );
}) as LucideIcon;

/**
 * Sol's mark at its fullest, for where he is introduced (the nav's round, his panel's head): the bubble in a fine orange
 * line, the sun lit from gold at its top to the signal orange, a soft glow behind it. Sized by its box; the colours are
 * its own, drawn for the graphite round it sits on.
 */
export function SolMark({ className, glow = true }: { className?: string; glow?: boolean }) {
  const id = useId().replace(/:/g, "");
  const [x1, y1, x2, y2] = HORIZON;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-sun`} x1="12" y1="9.9" x2="12" y2="13.6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD27A" />
          <stop offset="0.5" stopColor="#FF8A3D" />
          <stop offset="1" stopColor="#FF5A1F" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="12" cy="12.6" r="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF8A3D" stopOpacity="0.5" />
          <stop offset="1" stopColor="#FF5A1F" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={BUBBLE} stroke="#FF8A3D" strokeWidth={1.5} strokeLinejoin="round" />
      {glow && <circle cx="12" cy="12.6" r="6" fill={`url(#${id}-glow)`} />}
      <path d={SUN} fill={`url(#${id}-sun)`} />
      <g stroke="#FF8A3D" strokeLinecap="round">
        <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={1.3} />
        {RAYS.map(([a, b, c, d], i) => (
          <line key={i} x1={a} y1={b} x2={c} y2={d} strokeWidth={1.2} />
        ))}
      </g>
    </svg>
  );
}
