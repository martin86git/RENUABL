"use client";

import { House } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/primitives";
import { ROOF_FIT_NOTE, roofFit, roofSummary, type RoofInsights } from "@/lib/domain/solar-roof";
import { fetchRoofInsights } from "@/lib/services/consumer";

/**
 * "Your roof": from Google's satellite roof data, whether the recommended
 * panels fit. Shown only when Google has data for the home; an estimate,
 * confirmed on the call.
 */
export function RoofCheck({ lat, lng, panelCount }: { lat?: number; lng?: number; panelCount: number }) {
  const [roof, setRoof] = useState<RoofInsights | null>(null);
  useEffect(() => {
    if (typeof lat !== "number" || typeof lng !== "number") return;
    let live = true;
    void fetchRoofInsights(lat, lng).then((r) => live && setRoof(r));
    return () => {
      live = false;
    };
  }, [lat, lng]);
  if (!roof || panelCount <= 0) return null;
  const fit = roofFit(roof, panelCount);
  return (
    <Card className="flex gap-4 p-5">
      <House className="mt-0.5 h-6 w-6 shrink-0 text-ink" strokeWidth={1.3} aria-hidden />
      <div>
        <p className="text-[15px] text-ink">Your roof</p>
        <p className="mt-0.5 text-[14px] text-muted">{roofSummary(roof)}</p>
        <p className="mt-2 text-[14px] text-ink-2">
          Your system uses {panelCount} panels. {ROOF_FIT_NOTE[fit]}
        </p>
        <p className="mt-2 text-[12px] text-muted">
          From Google&apos;s satellite roof data. An estimate: we confirm it before you pay anything.
        </p>
      </div>
    </Card>
  );
}
