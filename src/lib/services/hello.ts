/**
 * A new lead's own page (domain/design/first-contact.ts), as the screens ask for it: the lead's side by the page's
 * private link (`/api/hello/<token>`), the business's side by the signed-in member making the link for a deal.
 */
import type { HelloView, HomeAnswer } from "@/lib/domain/design/first-contact";

type Answer<T> = ({ ok: true } & T) | { ok: false; message: string };
const UNREACHABLE = "We couldn't reach the server just now. Try again in a moment.";

async function ask<T>(path: string, body?: unknown): Promise<Answer<T>> {
  try {
    const res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as (Record<string, unknown> & { ok?: boolean; message?: string }) | null;
    if (res.ok && json?.ok) return json as { ok: true } & T;
    return { ok: false, message: json?.message ?? UNREACHABLE };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

const page = (token: string) => `/api/hello/${encodeURIComponent(token)}`;
/** Told once the page is really in a browser, so a link preview doesn't count as the lead having opened it. */
export const loadHello = (token: string, seen = false) => ask<{ view: HelloView }>(`${page(token)}${seen ? "?seen=1" : ""}`);
export const answerHome = (token: string, home: HomeAnswer) => ask<{ view: HelloView }>(page(token), { home });
export const helloRoofUrl = (token: string) => `${page(token)}/roof`;

/** The business's side: the deal's lead page, made the first time it is asked for. */
export const leadPageFor = (jobId: string) => ask<{ path: string }>(`/api/design/jobs/${encodeURIComponent(jobId)}/hello`, {});
