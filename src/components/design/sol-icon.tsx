import { forwardRef } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

const CX = 9.5;
const CY = 14.5;
// Seven rays, every eighth of the way round but the top right, which the spark takes.
const RAYS = [0, 1, 2, 3, 4, 5, 7].map((i) => {
  const a = (i * Math.PI) / 4;
  return [CX + 5.4 * Math.sin(a), CY - 5.4 * Math.cos(a), CX + 7.2 * Math.sin(a), CY - 7.2 * Math.cos(a)];
});

/**
 * Sol's mark (as Primero's assistant's): a rayed sun with a spark rising off its top right, where the eighth ray would
 * be. Drawn like the icons beside it (24 grid, the line's colour) and typed as one of them.
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
      <circle cx={CX} cy={CY} r={3.3} />
      {RAYS.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
      <path d="M17.6 1.6 Q18.2 5.3 22 5.9 Q18.2 6.5 17.6 10.2 Q17 6.5 13.2 5.9 Q17 5.3 17.6 1.6 Z" fill={color} stroke="none" />
    </svg>
  );
}) as LucideIcon;
