import { forwardRef, useId } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

/** The spark at the heart of Sol's sun: four points, its sides drawn in, the one shape that says "he thinks". */
const SPARK = "M12 5.6 C12.5 10.3 13.7 11.5 18.4 12 C13.7 12.5 12.5 13.7 12 18.4 C11.5 13.7 10.3 12.5 5.6 12 C10.3 11.5 11.5 10.3 12 5.6 Z";

/** Eight rays round it: the four in line with the spark's points longer, the four between them short. */
const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const [r1, r2] = i % 2 ? [8.1, 9.5] : [8.4, 11.3];
  const at = (r: number) => [12 + r * Math.sin(a), 12 - r * Math.cos(a)].map((n) => Math.round(n * 100) / 100);
  return [...at(r1), ...at(r2)];
});

/**
 * Sol's mark (1 Nov 2026, Martin: the rayed sun with a spark off its corner didn't do him justice). A sun whose core is
 * a spark: the sun he is named for and the thinking he does, one shape, read from the middle out. Drawn like the icons
 * beside it (24 grid, the line's colour, the spark filled) and typed as one of them, for the small places.
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
      strokeLinejoin="round"
      {...rest}
    >
      <path d={SPARK} fill={color} stroke="none" />
      {RAYS.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </svg>
  );
}) as LucideIcon;

/**
 * Sol's mark at its fullest, for where he is introduced (the nav's round, his panel's head): the spark lit from gold
 * at its top to the signal orange, the rays in orange, a soft glow behind. Sized by its box; the colours are its own,
 * drawn for the graphite round it sits on.
 */
export function SolMark({ className, glow = true }: { className?: string; glow?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-spark`} x1="12" y1="5.6" x2="12" y2="18.4" gradientUnits="userSpaceOnUse">
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
      <g stroke="#FF6A2E" strokeWidth={1.7} strokeLinecap="round">
        {RAYS.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} opacity={i % 2 ? 0.7 : 1} />
        ))}
      </g>
      <path d={SPARK} fill={`url(#${id}-spark)`} />
    </svg>
  );
}
