"use client";

import { useMemo, useState } from "react";
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
  className,
}: {
  model: RoofModel;
  centre: { lat: number; lng: number };
  imageSrc: string;
  selected: number[];
  editable?: boolean;
  onToggle?: (index: number) => void;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const view = useMemo(() => designView(centre), [centre]);
  const frame = useMemo(() => framing(model, view), [model, view]);
  const full = view.size * view.scale;
  const chosen = new Set(selected);
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
              stroke="#e8edf2"
              strokeWidth={1.4}
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
      </svg>
      {imageFailed && <p className="mt-1.5 text-[12px] text-muted">The satellite image didn&apos;t load; the layout is still to scale.</p>}
    </div>
  );
}
