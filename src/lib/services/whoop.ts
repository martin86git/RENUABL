"use client";

/** Whether the October WHOOP offer is open, asked once per page. Hidden until the server says it's open. */
import { useEffect, useState } from "react";

let pending: Promise<boolean> | null = null;

function fetchOpen(): Promise<boolean> {
  pending ??= fetch("/api/offers/whoop")
    .then((r) => r.json() as Promise<{ open?: boolean }>)
    .then((j) => j.open === true)
    .catch(() => false);
  return pending;
}

export function useWhoopOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    void fetchOpen().then((v) => live && setOpen(v));
    return () => {
      live = false;
    };
  }, []);
  return open;
}
