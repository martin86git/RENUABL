"use client";

import { upload } from "@vercel/blob/client";
import type { Cue, Walkthrough } from "@/lib/domain/design/walkthrough";

/**
 * The recorded walkthrough of a deal's design (domain/design/walkthrough.ts), as the screens reach it. The video goes
 * straight from the browser into private storage (`upload`, with a token our route only gives for this deal); the
 * server then keeps where it is and its captions.
 */

type Answer<T> = ({ ok: true } & T) | { ok: false; message: string };

async function call<T>(url: string, init?: RequestInit): Promise<Answer<T>> {
  try {
    const res = await fetch(url, init);
    const body = (await res.json().catch(() => null)) as (Answer<T> & { message?: string }) | null;
    if (!body) return { ok: false, message: "That didn't work. Try again." };
    return body;
  } catch {
    return { ok: false, message: "You seem to be offline. Try again." };
  }
}

const base = (jobId: string) => `/api/design/jobs/${encodeURIComponent(jobId)}/walkthrough`;

export function loadWalkthroughs(jobId: string) {
  return call<{ walkthroughs: Walkthrough[]; storage: boolean; prefix: string }>(base(jobId));
}

/** Sol tidies the captions (times kept); on any trouble they come back as they were. */
export async function tidyCaptions(jobId: string, cues: Cue[], seconds: number): Promise<Cue[]> {
  const res = await call<{ cues: Cue[] }>(base(jobId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ do: "tidy", cues, seconds }),
  });
  return res.ok ? res.cues : cues;
}

/**
 * Sends a recording: the video into storage (progress 0 to 1 as it goes), then the server keeps it with its captions.
 * The file's name is ours and random, under the deal's own place, which is all the upload token allows.
 */
export async function sendWalkthrough(
  jobId: string,
  prefix: string,
  video: Blob,
  seconds: number,
  cues: Cue[],
  onProgress: (share: number) => void,
): Promise<Answer<{ walkthrough: Walkthrough }>> {
  const type = video.type.split(";")[0] || "video/webm";
  const ext = type === "video/mp4" ? "mp4" : "webm";
  const name = `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const path = `${prefix}${name}`;
  try {
    await upload(path, new File([video], name, { type }), {
      access: "private",
      contentType: type,
      handleUploadUrl: `${base(jobId)}/upload`,
      multipart: video.size > 20 * 1024 * 1024,
      onUploadProgress: ({ percentage }) => onProgress(percentage / 100),
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error && /storage/i.test(e.message) ? e.message : "The recording couldn't be sent. Try again.",
    };
  }
  return call<{ walkthrough: Walkthrough }>(base(jobId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ do: "keep", path, seconds, cues }),
  });
}

export function showWalkthroughOnProposal(jobId: string, id: string, shown: boolean) {
  return call<object>(base(jobId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ do: "show", walkthrough: id, shown }),
  });
}

export function deleteWalkthrough(jobId: string, id: string) {
  return call<object>(`${base(jobId)}?walkthrough=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export const walkthroughVideoUrl = (jobId: string, id: string) => `${base(jobId)}/${encodeURIComponent(id)}/video`;

/** Told while a walkthrough records, so the designer puts away anything the customer mustn't see (the quote's costs). */
export const PRESENTING_EVENT = "renuabl:presenting";
export function setPresenting(on: boolean) {
  window.dispatchEvent(new CustomEvent(PRESENTING_EVENT, { detail: on }));
}

/** For the customer's page: the walkthrough shown on their proposal, if any. */
export async function proposalWalkthrough(token: string): Promise<{ id: string; seconds: number } | null> {
  const res = await call<{ walkthrough: { id: string; seconds: number } | null }>(`/api/proposal/${encodeURIComponent(token)}/walkthrough`);
  return res.ok ? res.walkthrough : null;
}
