"use client";

import { useEffect, useState } from "react";
import type { HandoverRecord } from "@/lib/domain/handover";
import { loadHandover, type Backend } from "@/lib/services/handover";

/** The job's installation record, from RENUABL's storage or this device. */
export function useInstallationRecord(recordKey: string, reference: string) {
  const [record, setRecord] = useState<HandoverRecord | null>(null);
  const [backend, setBackend] = useState<Backend>("server");
  useEffect(() => {
    let live = true;
    void loadHandover(recordKey, reference).then((r) => {
      if (!live) return;
      setRecord(r.record);
      setBackend(r.backend);
    });
    return () => {
      live = false;
    };
  }, [recordKey, reference]);
  return { record, setRecord, backend };
}

export const FIELD = "w-full rounded-xl bg-canvas px-4 py-3 text-[15px] text-ink outline-none ring-1 ring-line focus:ring-ink/40";
