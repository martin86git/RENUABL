"use client";

/**
 * The small rows Today's Performance counts from (domain/design/performance.ts), asked for as Today opens so a press on
 * Performance finds them ready, without waiting for the whole deals list (22 Nov 2026, Martin).
 */
import { useSyncExternalStore } from "react";
import { unpackPerfRows, type PackedPerfRow, type PerfRow } from "@/lib/domain/design/performance";
import { ask } from "./crm";

let rows: PerfRow[] | null = null;
let asking: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Asks for the rows again (one at a time); the ones already here stay on show meanwhile. */
export function loadPerfRows(): Promise<void> {
  if (asking) return asking;
  asking = ask<{ rows: PackedPerfRow[] }>("/api/design/performance")
    .then((r) => {
      const read = r.ok ? unpackPerfRows(r.rows) : null;
      if (read) {
        rows = read;
        listeners.forEach((l) => l());
      }
    })
    .finally(() => {
      asking = null;
    });
  return asking;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The rows once they are here, else null (the panel falls back to the deals list). */
export function usePerfRows(): PerfRow[] | null {
  return useSyncExternalStore(
    subscribe,
    () => rows,
    () => null,
  );
}
