/**
 * Live co-design (domain/design/live.ts) from the browser: the business's side (start, push, status, end) and the
 * customer's (watch, choose).
 */
import type { LiveSnapshot } from "@/lib/domain/design/live";

export interface LiveStatus {
  token: string;
  seenAt: string | null;
  choice: number | null;
  choiceAt: string | null;
  endsAt: string;
}

const json = (method: string, body: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

type Answer<T> = ({ ok: true } & T) | { ok: false; message: string; gone?: boolean };

async function call<T>(url: string, init?: RequestInit): Promise<Answer<T>> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && data.ok) return data as { ok: true } & T;
    return {
      ok: false,
      message: typeof data.message === "string" ? data.message : "That didn't work. Try again.",
      ...(data.gone === true ? { gone: true } : {}),
    };
  } catch {
    return { ok: false, message: "You seem to be offline." };
  }
}

export const startLive = (place: { lat: number; lng: number; jobId: string | null }) =>
  call<{ status: LiveStatus }>("/api/design/live", json("POST", place));
export const pushLive = (token: string, snapshot: LiveSnapshot) => call<object>("/api/design/live", json("PUT", { token, snapshot }));
export const liveStatus = (token: string) => call<{ status: LiveStatus }>(`/api/design/live?token=${token}`);
export const endLive = (token: string) => call<object>("/api/design/live", json("DELETE", { token }));

export interface LiveForCustomer {
  business: string;
  snapshot: LiveSnapshot | null;
  choice: number | null;
  open: boolean;
}

export const watchLive = (token: string) => call<LiveForCustomer>(`/api/live/${token}`);
export const chooseLive = (token: string, choice: number) => call<{ choice: number }>(`/api/live/${token}`, json("POST", { choice }));
export const liveLink = (token: string) => `${typeof window === "undefined" ? "" : window.location.origin}/live/${token}`;
export const liveRoofHref = (token: string) => `/api/live/${token}/roof`;
