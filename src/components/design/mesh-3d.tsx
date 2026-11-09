"use client";

import { Box, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { capturedWords } from "@/lib/domain/design/nearmap";
import { showNearmapMesh } from "@/lib/services/house-3d";

/**
 * The roof in 3D from Nearmap's own model (9 Nov 2026, Martin: "try Nearmap's 3D model"), to turn round and judge the
 * roof, its faces, what stands on it and what shades it. Opened from the picture's corner; loads only when opened; read
 * through RENUABL's server, never with Nearmap's key in the browser. For looking only: the design is drawn on the picture.
 */
export function Mesh3dButton({ lat, lng }: { lat: number; lng: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="See the roof in 3D (Nearmap)"
        className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <Box className="size-3.5" aria-hidden />
        3D
      </button>
      {/* On the page body: the picture's corner sits in a moved (transformed) part of the page, where a fixed window can't cover the screen. */}
      {open && createPortal(<Mesh3dWindow lat={lat} lng={lng} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Mesh3dWindow({ lat, lng, onClose }: { lat: number; lng: number; onClose: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  // The model's detail still coming in: said, so a half-loaded view isn't taken for the finished one.
  const [filling, setFilling] = useState(true);
  const [state, setState] = useState<{ kind: "loading" } | { kind: "ready"; captured: string } | { kind: "failed"; words: string }>({
    kind: "loading",
  });
  useEffect(() => {
    if (!el.current) return;
    // A container of its own for each viewer: set up twice (React does in development), two viewers sharing one place
    // left a grey or empty view as the first one's clean-up took the second's with it.
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;inset:0";
    el.current.appendChild(host);
    let close: (() => void) | undefined;
    let live = true;
    showNearmapMesh(host, { lat, lng }, (loading) => live && setFilling(loading))
      .then((got) => {
        if (!live) {
          got.close();
          host.remove();
          return;
        }
        close = got.close;
        setState({ kind: "ready", captured: got.captured });
      })
      .catch((e: unknown) => live && setState({ kind: "failed", words: e instanceof Error ? e.message : "The 3D view didn't load." }));
    return () => {
      live = false;
      close?.();
      if (close) host.remove();
    };
  }, [lat, lng]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]"
      onPointerDown={onClose}
      data-popup
    >
      <div
        className="relative h-[min(86dvh,56rem)] w-[min(96vw,90rem)] overflow-hidden rounded-[24px] bg-[#1f2326] shadow-[0_30px_80px_rgba(11,11,12,0.4)]"
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="The roof in 3D"
      >
        <div ref={el} className="absolute inset-0" />
        <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white/90 backdrop-blur">
          Nearmap 3D{state.kind === "ready" && state.captured ? ` · ${capturedWords(state.captured)}` : ""} · drag to turn, scroll to zoom
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the 3D view"
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/90 text-ink shadow hover:bg-white"
        >
          <X className="size-4" aria-hidden />
        </button>
        {state.kind === "loading" && (
          <p className="absolute inset-0 grid place-items-center text-sm text-white/80">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Loading Nearmap&apos;s 3D model
            </span>
          </p>
        )}
        {state.kind === "ready" && filling && (
          <p className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs text-white/90 backdrop-blur">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading detail…
          </p>
        )}
        {state.kind === "failed" && (
          <p className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-white/80">{state.words}</p>
        )}
      </div>
    </div>
  );
}
