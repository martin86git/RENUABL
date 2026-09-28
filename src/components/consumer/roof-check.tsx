"use client";

import { House } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/primitives";
import { isUnitAddress, ROOF_FIT_NOTE, roofFit, roofSummary, SHARED_ROOF_NOTE, type RoofInsights } from "@/lib/domain/solar-roof";
import { PREVIEW_MODE } from "@/lib/config";
import { roofImageSrc } from "@/lib/services/consumer";
import { SunMap } from "./sun-map";

/**
 * "Your roof": a satellite photo of the home with what Google's roof data says
 * about it (room for panels, direction, pitch) and whether the system fits.
 * No panels are drawn: an automatic layout isn't reliable enough to show
 * customers, so the installation partner designs it (partner portal) and
 * confirms it on the call. Shown only when Google has data for the home.
 */
export function RoofCheck({
  roof,
  centre,
  panelCount,
  reason,
  loading = false,
}: {
  roof: RoofInsights | null | undefined;
  centre: { lat?: number; lng?: number; line?: string } | null;
  panelCount: number;
  /** Why there's no roof data, if known (shown in preview only). */
  reason?: string;
  /** Google's roof is still loading. */
  loading?: boolean;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  if (loading && panelCount > 0) {
    return (
      <Card className="overflow-hidden" aria-busy="true">
        <div className="aspect-[4/3] w-full animate-pulse bg-surface-2" />
        <p className="p-5 text-[15px] text-ink">Looking at your roof from above…</p>
      </Card>
    );
  }
  if (!roof || panelCount <= 0) {
    if (!PREVIEW_MODE || panelCount <= 0) return null;
    const why =
      typeof centre?.lat !== "number"
        ? "this address has no map location. Choose it from the address suggestions."
        : reason === "no-coverage"
          ? "Google has no roof data for this home."
          : `Google's roof data didn't load (${reason ?? "still loading"}).`;
    return (
      <p className="rounded-lg border border-line bg-surface p-4 text-[13px] text-muted">Preview only: no roof details because {why}</p>
    );
  }
  const fit = roofFit(roof, panelCount);
  const hasPhoto = typeof centre?.lat === "number" && typeof centre.lng === "number" && !photoFailed;
  const photo = hasPhoto ? (
    // eslint-disable-next-line @next/next/no-img-element -- our own server route, already sized by Google
    <img
      src={roofImageSrc(centre.lat!, centre.lng!)}
      alt="Your home from above"
      className="aspect-[4/3] w-full rounded-xl bg-surface-2 object-cover"
      onError={() => setPhotoFailed(true)}
    />
  ) : null;
  return (
    <Card className="overflow-hidden">
      {hasPhoto && (
        <div className="p-2 pb-0">{PREVIEW_MODE ? <SunMap centre={{ lat: centre.lat!, lng: centre.lng! }} fallback={photo} /> : photo}</div>
      )}
      <div className="flex gap-4 p-5">
        <House className="mt-0.5 h-6 w-6 shrink-0 text-ink" strokeWidth={1.3} aria-hidden />
        <div>
          <p className="text-[15px] text-ink">Your roof</p>
          <p className="mt-0.5 text-[14px] text-muted">{roofSummary(roof)}</p>
          <p className="mt-2 text-[14px] text-ink-2">
            Your system uses {panelCount} panels. {ROOF_FIT_NOTE[fit]}
          </p>
          {isUnitAddress(centre?.line) && <p className="mt-2 text-[14px] text-ink-2">{SHARED_ROOF_NOTE}</p>}
          <p className="mt-2 text-[14px] text-ink-2">
            Your installation partner designs your panel layout and confirms it with you on your call.
          </p>
          <p className="mt-2 text-[12px] text-muted">From Google&apos;s satellite roof data, which also shapes your savings estimate.</p>
        </div>
      </div>
    </Card>
  );
}
