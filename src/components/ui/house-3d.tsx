"use client";

import { Box, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { house3dAvailable, showHouse3d } from "@/lib/services/house-3d";

/**
 * "See it in 3D": Google's photorealistic 3D model of the home, to spin around
 * and judge the roof, shading and access. Loads only when opened.
 */
export function House3d({ at, label = "See it in 3D" }: { at: { lat: number; lng: number }; label?: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const ref = useRef<HTMLDivElement>(null);
  const { lat, lng } = at;

  useEffect(() => {
    if (!open || !ref.current) return;
    let cleanup: (() => void) | undefined;
    let live = true;
    showHouse3d(ref.current, { lat, lng })
      .then((c) => {
        cleanup = c;
        if (live) setState("ready");
        else c();
      })
      .catch(() => live && setState("failed"));
    return () => {
      live = false;
      cleanup?.();
    };
  }, [open, lat, lng]);

  if (!house3dAvailable()) return null;
  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Box className="h-4 w-4" /> {label}
      </Button>
    );
  }
  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#2a2f33]">
        <div ref={ref} className="absolute inset-0" />
        {state === "loading" && (
          <p className="absolute inset-0 grid place-items-center text-[14px] text-white/80">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading 3D view
            </span>
          </p>
        )}
        {state === "failed" && (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-[14px] text-white/80">
            The 3D view isn&apos;t available for this home.
          </p>
        )}
      </div>
      <p className="mt-1.5 text-[12px] text-muted">
        Drag to turn, scroll or pinch to zoom. 3D imagery from Google; it can be a few years old.
      </p>
    </div>
  );
}
