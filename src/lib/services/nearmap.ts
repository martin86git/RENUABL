/** The roof's pictures for the designer: Google's, or a Nearmap capture the business fetched (server/nearmap.ts). */

export interface KeptCapture {
  survey: string;
  captured: string | null;
  fetchedAt: string;
}
export interface NearmapSurvey {
  id: string;
  captured: string;
  resources: string[];
}
export interface RoofImagery {
  ready: boolean;
  use: string;
  kept: KeptCapture[];
  surveys?: NearmapSurvey[] | null;
}

type Answer<T> = ({ ok: true } & T) | { ok: false; message: string };

async function call<T>(url: string, init?: RequestInit): Promise<Answer<T>> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && data.ok) return data as { ok: true } & T;
    return { ok: false, message: typeof data.message === "string" ? data.message : "That didn't work. Try again." };
  } catch {
    return { ok: false, message: "You seem to be offline." };
  }
}
const json = (method: string, body: unknown) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const at = (lat: number, lng: number) => `lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`;

export const loadImagery = (lat: number, lng: number, surveys = false) =>
  call<RoofImagery>(`/api/design/roof/nearmap?${at(lat, lng)}${surveys ? "&surveys=1" : ""}`);
export const fetchNearmap = (lat: number, lng: number, survey?: string) =>
  call<RoofImagery & { survey: string; captured: string | null }>("/api/design/roof/nearmap", json("POST", { lat, lng, survey }));
export const chooseImagery = (lat: number, lng: number, use: string) =>
  call<RoofImagery>("/api/design/roof/nearmap", json("PUT", { lat, lng, use }));
export const nearmapPictureHref = (lat: number, lng: number, survey: string) =>
  `/api/design/roof/nearmap/picture?${at(lat, lng)}&survey=${encodeURIComponent(survey)}`;
