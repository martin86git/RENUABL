"use client";

import { useMemo, useState } from "react";
import { boxPixels, type Obstruction } from "@/lib/domain/obstructions";
import { designView, framing, panelOutline, type RoofModel } from "@/lib/domain/roof-layout";

/**
 * Panels drawn on the satellite image of the roof. View-only for customers;
 * for partners (editable), every spot Google found shows faintly and tapping
 * one adds or removes a panel.
 */
export function RoofDesigner({
  model,
  centre,
  imageSrc,
  selected,
  editable = false,
  onToggle,
  obstructions = [],
  flagged = [],
  className,
}: {
  model: RoofModel;
  centre: { lat: number; lng: number };
  imageSrc: string;
  selected: number[];
  editable?: boolean;
  onToggle?: (index: number) => void;
  /** Things on the roof to avoid, drawn as amber boxes. */
  obstructions?: Obstruction[];
  /** Panel spots that overlap one (outlined amber when chosen). */
  flagged?: number[];
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const view = useMemo(() => designView(centre), [centre]);
  const frame = useMemo(() => framing(model, view), [model, view]);
  const full = view.size * view.scale;
  const chosen = new Set(selected);
  const blocked = new Set(flagged);
  const outlines = useMemo(() => model.slots.map((s) => panelOutline(s, model, view)), [model, view]);
  const points = (i: number) => outlines[i].map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className={className}>
      <svg
        viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
        className="block h-auto w-full rounded-xl bg-[#2a2f33]"
        role="img"
        aria-label={`Panel layout: ${selected.length} panels on the roof`}
      >
        {!imageFailed && (
          <image href={imageSrc} x={0} y={0} width={full} height={full} preserveAspectRatio="none" onError={() => setImageFailed(true)} />
        )}
        {model.slots.map((_, i) =>
          chosen.has(i) ? (
            <polygon
              key={i}
              points={points(i)}
              fill="#15202b"
              fillOpacity={0.92}
              stroke={blocked.has(i) ? "#f5b54a" : "#e8edf2"}
              strokeWidth={blocked.has(i) ? 3 : 1.4}
              onClick={editable ? () => onToggle?.(i) : undefined}
              className={editable ? "cursor-pointer" : undefined}
            >
              {editable && <title>Remove this panel</title>}
            </polygon>
          ) : editable ? (
            <polygon
              key={i}
              points={points(i)}
              fill="#ffffff"
              fillOpacity={0.06}
              stroke="#ffffff"
              strokeOpacity={0.55}
              strokeWidth={1}
              strokeDasharray="4 3"
              onClick={() => onToggle?.(i)}
              className="cursor-pointer"
            >
              <title>Add a panel here</title>
            </polygon>
          ) : null,
        )}
        {obstructions.map((o, i) => {
          const b = boxPixels(o, view);
          return (
            <g key={`o${i}`} pointerEvents="none">
              <rect
                x={b.x0}
                y={b.y0}
                width={b.x1 - b.x0}
                height={b.y1 - b.y0}
                fill="#f5b54a"
                fillOpacity={0.18}
                stroke="#f5b54a"
                strokeWidth={2}
              />
              <text
                x={b.x0}
                y={b.y0 - 4}
                fill="#f5b54a"
                fontSize={13}
                fontFamily="Inter, sans-serif"
                stroke="#15202b"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {o.type}
              </text>
            </g>
          );
        })}
      </svg>
      {imageFailed && <p className="mt-1.5 text-[12px] text-muted">The satellite image didn&apos;t load; the layout is still to scale.</p>}
    </div>
  );
}
