/**
 * A deal's call transcripts for its timeline (`/api/design/jobs/[id]/call-transcripts`), asked once a deal while its
 * page is open and shared by every call entry on it.
 */
"use client";

import { useEffect, useState } from "react";
import type { CallTranscript } from "@/lib/domain/call-transcript";

const asked = new Map<string, { at: number; list: Promise<CallTranscript[]> }>();
const FRESH_MS = 30_000;

function load(jobId: string): Promise<CallTranscript[]> {
  const hit = asked.get(jobId);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.list;
  const list = fetch(`/api/design/jobs/${encodeURIComponent(jobId)}/call-transcripts`, { cache: "no-store" })
    .then((r) => r.json())
    .then((j: { ok?: boolean; transcripts?: CallTranscript[] }) => (j.ok && Array.isArray(j.transcripts) ? j.transcripts : []))
    .catch(() => []);
  asked.set(jobId, { at: Date.now(), list });
  return list;
}

export function useCallTranscripts(jobId: string | null): CallTranscript[] {
  const [list, setList] = useState<CallTranscript[]>([]);
  useEffect(() => {
    if (!jobId) return;
    let live = true;
    void load(jobId).then((l) => live && setList(l));
    return () => {
      live = false;
    };
  }, [jobId]);
  return list;
}
