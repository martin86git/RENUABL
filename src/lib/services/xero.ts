/**
 * Xero for the business's own books, as the browser sees it (domain/design/xero.ts): Settings → Xero reads where it
 * stands, saves its choices, raises an invoice or sends a bill by hand, and connects in a small window over the page.
 */
import { XERO_MESSAGE, type XeroResult, type XeroSettings } from "@/lib/domain/design/xero";

export interface XeroLink {
  kind: "invoice" | "bill";
  ref: string;
  jobId: string | null;
  xeroId: string | null;
  number: string;
  status: string;
  total: number | null;
  error: string | null;
  customer: string;
  at: string;
}

export interface XeroView {
  available: boolean;
  connection: {
    tenantName: string;
    connectedBy: string;
    connectedAt: string;
    syncedAt: string | null;
    problem: string | null;
    settings: XeroSettings;
  } | null;
  recent: XeroLink[];
  toInvoice: { jobId: string; customer: string; title: string; signedAt: string; youPay: number }[];
  toBill: { id: string; jobId: string; customer: string; installer: string; number: string; subTotal: number; status: string }[];
}

type Answer = { ok: true; number?: string; paid?: number; bills?: number } | { ok: false; message: string };

export async function loadXero(): Promise<XeroView | { error: string }> {
  try {
    const res = await fetch("/api/design/xero", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as XeroView & { ok?: boolean; message?: string };
    return res.ok && json.ok ? json : { error: json.message ?? "Xero couldn't be loaded." };
  } catch {
    return { error: "Xero couldn't be loaded." };
  }
}

async function post(body: unknown): Promise<Answer> {
  try {
    const res = await fetch("/api/design/xero", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Answer & { message?: string };
    return res.ok && json.ok
      ? json
      : { ok: false, message: (json as { message?: string }).message ?? "That didn't go through. Please try again." };
  } catch {
    return { ok: false, message: "We couldn't reach the server just now. Check your connection and try again." };
  }
}

export const saveXeroSettings = (settings: XeroSettings) => post({ do: "settings", settings });
export const raiseXeroInvoice = (jobId: string) => post({ do: "invoice", jobId });
export const sendXeroBill = (id: string) => post({ do: "bill", id });
export const syncXeroNow = () => post({ do: "sync" });
export const disconnectXero = () => post({ do: "disconnect" });

/** Opens Xero's sign-in in a small window over the page; answers how it went once the window tells us. */
export function connectXeroHere(): Promise<XeroResult> {
  const w = window.open("/api/auth/xero?popup=1", "renuabl-xero", "width=560,height=720");
  if (!w) {
    window.location.href = "/api/auth/xero";
    return new Promise(() => {});
  }
  return new Promise((resolve) => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || (e.data as { type?: string })?.type !== XERO_MESSAGE) return;
      finish((e.data as { result: XeroResult }).result);
    };
    const timer = window.setInterval(() => w.closed && finish("failed"), 800);
    let done = false;
    function finish(r: XeroResult) {
      if (done) return;
      done = true;
      window.clearInterval(timer);
      window.removeEventListener("message", onMessage);
      resolve(r);
    }
    window.addEventListener("message", onMessage);
  });
}
