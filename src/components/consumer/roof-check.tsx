"use client";

import { House } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { RoofDesigner } from "@/components/ui/roof-designer";
import { autoLayout, type RoofModel } from "@/lib/domain/roof-layout";
import { ROOF_FIT_NOTE, roofFit, roofSummary, type RoofInsights } from "@/lib/domain/solar-roof";
import { PREVIEW_MODE } from "@/lib/config";
import { roofImageSrc } from "@/lib/services/consumer";

/**
 * "Your roof": the recommended panels drawn on a satellite image of the home
 * (Google's roof model picks the sunniest spots), and whether they fit. Shown
 * only when Google has data for the home; always an estimate, confirmed on the call.
 */
export function RoofCheck({
  roof,
  model,
  centre,
  panelCount,
  reason,
  loading = false,
}: {
  roof: RoofInsights | null | undefined;
  model: RoofModel | null | undefined;
  centre: { lat?: number; lng?: number } | null;
  panelCount: number;
  /** Why there's no roof data, if known (shown in preview only). */
  reason?: string;
  /** Google's roof is still loading. */
  loading?: boolean;
}) {
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
      <p className="rounded-lg border border-line bg-surface p-4 text-[13px] text-muted">Preview only: no panel layout because {why}</p>
    );
  }
  const fit = roofFit(roof, panelCount);
  const canDraw = model && typeof centre?.lat === "number" && typeof centre.lng === "number";
  return (
    <Card className="overflow-hidden">
      {canDraw && (
        <RoofDesigner
          model={model}
          centre={{ lat: centre.lat!, lng: centre.lng! }}
          imageSrc={roofImageSrc(centre.lat!, centre.lng!)}
          selected={autoLayout(model, panelCount)}
          className="p-2 pb-0"
        />
      )}
      <div className="flex gap-4 p-5">
        <House className="mt-0.5 h-6 w-6 shrink-0 text-ink" strokeWidth={1.3} aria-hidden />
        <div>
          <p className="text-[15px] text-ink">{canDraw ? "Your panels on your roof" : "Your roof"}</p>
          <p className="mt-0.5 text-[14px] text-muted">{roofSummary(roof)}</p>
          <p className="mt-2 text-[14px] text-ink-2">
            Your system uses {panelCount} panels
            {canDraw
              ? ", placed on the sunniest parts of your roof, allowing for its tilt, direction and shade from trees and buildings"
              : ""}
            . {ROOF_FIT_NOTE[fit]}
          </p>
          <p className="mt-2 text-[12px] text-muted">
            From Google&apos;s satellite roof data, which also shapes your savings estimate. A first layout: your installation partner
            confirms it before anything is installed.
          </p>
        </div>
      </div>
    </Card>
  );
}
