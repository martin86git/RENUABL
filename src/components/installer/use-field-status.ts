"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { advanceStatus, currentFieldStatus, nextFieldStatus, FIELD_STATUS_FLOW } from "@/lib/domain/job-status";
import type { StatusEvent } from "@/lib/domain/types";
import { updateJobStatus } from "@/lib/services/field";

interface Queued extends StatusEvent {
  jobId: string;
}

const key = (jobId: string) => `renuabl.field-queue.${jobId}`;

function readQueue(jobId: string): Queued[] {
  try {
    return JSON.parse(window.localStorage.getItem(key(jobId)) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(jobId: string, q: Queued[]) {
  try {
    window.localStorage.setItem(key(jobId), JSON.stringify(q));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Sequential field status with timestamps and offline-friendly queueing.
 * Each change is recorded locally first, then synced when a connection exists.
 */
export function useFieldStatus(jobId: string, initial: StatusEvent[]) {
  const [history, setHistory] = useState<StatusEvent[]>(initial);
  const [pending, setPending] = useState<Queued[]>([]);
  const [online, setOnline] = useState(true);
  const [lastSync, setLastSync] = useState<{ label: string; notified: boolean } | null>(null);
  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    const queue = readQueue(jobId);
    if (!queue.length) return;
    flushing.current = true;
    try {
      for (const item of queue) {
        const res = await updateJobStatus(item.jobId, item.status, item.at);
        const remaining = readQueue(jobId).filter((q) => q.at !== item.at || q.status !== item.status);
        writeQueue(jobId, remaining);
        setPending(remaining);
        setLastSync({ label: FIELD_STATUS_FLOW.find((f) => f.id === res.status)!.label, notified: res.customerNotified });
      }
    } finally {
      flushing.current = false;
    }
  }, [jobId]);

  useEffect(() => {
    // Restore anything captured offline before a reload.
    const queued = readQueue(jobId);
    /* eslint-disable react-hooks/set-state-in-effect -- sync with browser-only state after mount */
    if (queued.length) {
      setPending(queued);
      setHistory((h) => [...h, ...queued.filter((q) => !h.some((e) => e.status === q.status))]);
    }
    setOnline(navigator.onLine);
    /* eslint-enable react-hooks/set-state-in-effect */
    const up = () => {
      setOnline(true);
      void flush();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    void flush();
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [jobId, flush]);

  const advance = useCallback(() => {
    const next = advanceStatus(history);
    if (next === history) return;
    const event = next[next.length - 1];
    setHistory(next);
    const queue = [...readQueue(jobId), { ...event, jobId }];
    writeQueue(jobId, queue);
    setPending(queue);
    void flush();
  }, [history, jobId, flush]);

  const current = currentFieldStatus(history);
  return { history, current, next: nextFieldStatus(current), advance, pending, online, lastSync };
}
