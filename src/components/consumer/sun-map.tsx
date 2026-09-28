"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { designView, geoFrameOnView, metresPerPixel, type GeoFrame } from "@/lib/domain/roof-layout";
import { sunColour, sunSummaryText, type SunSummary } from "@/lib/domain/sun-map";
import { fetchSunMap, roofImageSrc, roofPhotoSrc, sunMapSrc } from "@/lib/services/consumer";

/** The roof with about 4 m around it, at least 20 m across and no narrower than 4:3, inside the image. */
function crop(pts: { x: number; y: number }[], mpp: number, fw: number, fh: number) {
  const pad = 4 / mpp;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [cx, cy] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  let w = Math.max(Math.max(...xs) - Math.min(...xs) + 2 * pad, 20 / mpp);
  let h = Math.max(Math.max(...ys) - Math.min(...ys) + 2 * pad, w * 0.75);
  w = Math.min(fw, Math.max(w, h * 1.33));
  h = Math.min(fh, h);
  return { x0: Math.max(0, Math.min(fw - w, cx - w / 2)), y0: Math.max(0, Math.min(fh - h, cy - h / 2)), w, h };
}

type Info = { frame: GeoFrame; summary: SunSummary; box: [number, number, number, number]; shift: { x: number; y: number } | null };

/**
 * The sun map: Google Solar's measured yearly sunlight coloured over the
 * home's roof (yellow = most sun, blue = least; direction and shade included),
 * on the sharp satellite photo when it lines up, else on Google Solar's photo.
 * Shows `fallback` while it can't be had. Preview only for now.
 */
export function SunMap({ centre, fallback }: { centre: { lat: number; lng: number }; fallback: ReactNode }) {
  const key = `${centre.lat},${centre.lng}`;
  const [got, setGot] = useState<{ key: string; info: Info | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchSunMap(centre.lat, centre.lng).then((info) => {
      if (!cancelled) setGot({ key, info });
    });
    return () => {
      cancelled = true;
    };
  }, [key, centre.lat, centre.lng]);
  const info = got?.key === key ? got.info : undefined;
  const view = useMemo(() => designView(centre), [centre]);

  if (info === undefined) {
    return (
      <div
        className="aspect-[4/3] w-full animate-pulse rounded-xl bg-surface-2"
        aria-busy="true"
        aria-label="Loading your roof's sunlight"
      />
    );
  }
  if (info === null) return <>{fallback}</>;

  const { frame, shift, summary, box } = info;
  const overlay = sunMapSrc(centre.lat, centre.lng);
  let svg: ReactNode;
  if (shift) {
    // The sharp satellite photo, moved into line; the sun layer placed on it from its UTM grid.
    const m = geoFrameOnView(frame, view);
    const place = (x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
    const full = view.size * view.scale;
    const { x0, y0, w, h } = crop(
      [place(box[0], box[1]), place(box[2], box[1]), place(box[0], box[3]), place(box[2], box[3])],
      metresPerPixel(view),
      full,
      full,
    );
    svg = (
      <svg
        viewBox={`${x0} ${y0} ${w} ${h}`}
        className="block h-auto w-full rounded-xl bg-[#2a2f33]"
        role="img"
        aria-label="Sunlight on your roof"
      >
        <image href={roofImageSrc(centre.lat, centre.lng)} x={shift.x} y={shift.y} width={full} height={full} preserveAspectRatio="none" />
        <image href={overlay} width={frame.width} height={frame.height} transform={`matrix(${m.join(" ")})`} preserveAspectRatio="none" />
      </svg>
    );
  } else {
    const { x0, y0, w, h } = crop(
      [
        { x: box[0], y: box[1] },
        { x: box[2], y: box[3] },
      ],
      metresPerPixel(frame),
      frame.width,
      frame.height,
    );
    svg = (
      <svg
        viewBox={`${x0} ${y0} ${w} ${h}`}
        className="block h-auto w-full rounded-xl bg-[#2a2f33]"
        role="img"
        aria-label="Sunlight on your roof"
      >
        <image href={roofPhotoSrc(centre.lat, centre.lng)} width={frame.width} height={frame.height} preserveAspectRatio="none" />
        <image href={overlay} width={frame.width} height={frame.height} preserveAspectRatio="none" />
      </svg>
    );
  }

  const gradient = [0, 0.25, 0.5, 0.75, 1].map((t) => `rgb(${sunColour(t).join(",")}) ${t * 100}%`).join(", ");
  return (
    <div>
      {svg}
      <div className="mt-3 flex items-center gap-2 px-1 text-[12px] text-muted">
        <span>Less sun</span>
        <span className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${gradient})` }} aria-hidden />
        <span>More sun</span>
      </div>
      <ul className="mt-2 space-y-1 px-1 text-[14px] text-ink-2">
        {sunSummaryText(summary).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="mt-1 px-1 text-[12px] text-muted">
        Google&apos;s measured sunlight over a year, allowing for which way each part faces and shade from trees and buildings. Preview
        only.
      </p>
    </div>
  );
}
