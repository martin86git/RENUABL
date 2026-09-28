"use client";

import { useEffect, useMemo, useState } from "react";
import { boxOnFrame, boxPixels, type Obstruction } from "@/lib/domain/obstructions";
import { designView, frameSize, framing, metresPerPixel, panelOutline, type RoofModel } from "@/lib/domain/roof-layout";
import { fetchRoofPhotoFrame, roofPhotoSrc } from "@/lib/services/consumer";

/** An obstruction box found on the satellite photo, moved with it. */
function shifted(b: { x0: number; y0: number; x1: number; y1: number }, by: { x: number; y: number } | null) {
  return by ? { x0: b.x0 + by.x, y0: b.y0 + by.y, x1: b.x1 + by.x, y1: b.y1 + by.y } : b;
}

type PhotoInfo = Awaited<ReturnType<typeof fetchRoofPhotoFrame>>;

/**
 * How to show the roof: the sharp satellite photo moved into line with Google
 * Solar's (when they match clearly), else Google Solar's own photo (it lines up
 * with the panel spots exactly), else the satellite photo as it is.
 */
function useRoofPhoto(centre: { lat: number; lng: number }) {
  const key = `${centre.lat},${centre.lng}`;
  const [got, setGot] = useState<{ key: string; info: PhotoInfo } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchRoofPhotoFrame(centre.lat, centre.lng).then((info) => {
      if (!cancelled) setGot({ key, info });
    });
    return () => {
      cancelled = true;
    };
  }, [key, centre.lat, centre.lng]);
  const loading = !got || got.key !== key;
  const info = loading ? null : got.info;
  return { loading, shift: info?.shift ?? null, frame: info && !info.shift ? info.frame : null };
}

/**
 * Panels drawn on an aerial photo of the roof: Google Solar's own photo when
 * there is one, else the Maps Static satellite view. View-only for customers;
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
  const photo = useRoofPhoto(centre);
  const satellite = useMemo(() => designView(centre), [centre]);
  const image = photo.frame ?? satellite;
  const frame = useMemo(() => framing(model, image), [model, image]);
  const size = frameSize(image);
  // Lines and labels keep the same look whatever the photo's scale.
  const k = 0.06 / metresPerPixel(image);
  const chosen = new Set(selected);
  const blocked = new Set(flagged);
  const outlines = useMemo(() => model.slots.map((s) => panelOutline(s, model, image)), [model, image]);
  const points = (i: number) => outlines[i].map((p) => `${p.x},${p.y}`).join(" ");

  if (photo.loading) {
    return (
      <div className={className}>
        <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-surface-2" aria-busy="true" aria-label="Loading the roof photo" />
      </div>
    );
  }

  return (
    <div className={className}>
      <svg
        viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
        className="block h-auto w-full rounded-xl bg-[#2a2f33]"
        role="img"
        aria-label={`Panel layout: ${selected.length} panels on the roof`}
      >
        {!imageFailed && (
          <image
            href={photo.frame ? roofPhotoSrc(centre.lat, centre.lng) : imageSrc}
            x={photo.shift?.x ?? 0}
            y={photo.shift?.y ?? 0}
            width={size.w}
            height={size.h}
            preserveAspectRatio="none"
            onError={() => setImageFailed(true)}
          />
        )}
        {model.slots.map((_, i) =>
          chosen.has(i) ? (
            <polygon
              key={i}
              points={points(i)}
              fill="#15202b"
              fillOpacity={0.92}
              stroke={blocked.has(i) ? "#f5b54a" : "#e8edf2"}
              strokeWidth={(blocked.has(i) ? 3 : 1.4) * k}
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
              strokeWidth={1 * k}
              strokeDasharray={`${4 * k} ${3 * k}`}
              onClick={() => onToggle?.(i)}
              className="cursor-pointer"
            >
              <title>Add a panel here</title>
            </polygon>
          ) : null,
        )}
        {obstructions.map((o, i) => {
          const b = photo.frame ? boxOnFrame(o, satellite, photo.frame) : shifted(boxPixels(o, satellite), photo.shift);
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
                strokeWidth={2 * k}
              />
              <text
                x={b.x0}
                y={b.y0 - 4 * k}
                fill="#f5b54a"
                fontSize={13 * k}
                fontFamily="Inter, sans-serif"
                stroke="#15202b"
                strokeWidth={3 * k}
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
