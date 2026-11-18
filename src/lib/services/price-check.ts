"use client";

import { useEffect, useState } from "react";
import { cleanPoints, type PricePoint } from "@/lib/domain/design/price-check";

/** The business's published proposals as price points (domain/design/price-check.ts), read once a few minutes and shared. */
let kept: { at: number; points: PricePoint[] } | null = null;
let asking: Promise<PricePoint[]> | null = null;
const FRESH_MS = 5 * 60_000;

async function load(): Promise<PricePoint[]> {
  if (kept && Date.now() - kept.at < FRESH_MS) return kept.points;
  asking ??= fetch("/api/design/price-check")
    .then(async (res) => {
      const data = res.ok ? ((await res.json()) as { points?: unknown }) : {};
      const points = cleanPoints(data.points);
      kept = { at: Date.now(), points };
      return points;
    })
    // Signed out, an installer, or someone who doesn't see costs: no history, and the checks that need it say nothing.
    .catch(() => [])
    .finally(() => {
      asking = null;
    });
  return asking;
}

/** The price points, or an empty list until they come (or when there are none to have). */
export function usePricePoints(on: boolean): PricePoint[] {
  const [points, setPoints] = useState<PricePoint[]>(kept?.points ?? []);
  useEffect(() => {
    if (!on) return;
    let live = true;
    void load().then((p) => live && setPoints(p));
    return () => {
      live = false;
    };
  }, [on]);
  return points;
}
