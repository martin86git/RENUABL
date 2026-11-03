/**
 * A roof design Sol shows in his chat (3 Nov 2026, Martin: "show me the rooftop design of the next upcoming install" is
 * a core feature). The turn keeps only which deal and how to title it; the drawing itself (the panel layout and the
 * strings over the roof photo) is read fresh from the deal's job card when the chat shows it, by someone who may see
 * that deal, so nothing drawn is kept in the conversation and a design changed since is shown as it is now. Pure, tested.
 */

/** Designs one answer may show. */
export const DESIGNS_PER_TURN = 2;

export interface SolDesignShown {
  /** The deal (job) whose roof design is shown. */
  jobId: string;
  /** The customer and the address, as Sol named it. */
  title: string;
}

const isJobId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const words = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** One shown design as kept, or null when it isn't one. */
export function cleanDesignShown(raw: unknown): SolDesignShown | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isJobId(r.jobId)) return null;
  return { jobId: r.jobId, title: words(r.title, 160) || "Roof design" };
}

/** The designs on a turn: cleaned, each deal once, at most `DESIGNS_PER_TURN`. */
export function cleanDesignsShown(raw: unknown): SolDesignShown[] {
  const out: SolDesignShown[] = [];
  for (const d of Array.isArray(raw) ? raw : []) {
    const c = cleanDesignShown(d);
    if (c && !out.some((o) => o.jobId === c.jobId)) out.push(c);
    if (out.length >= DESIGNS_PER_TURN) break;
  }
  return out;
}

/** Where the design opens: the deal with its design drawer open. */
export const designHref = (jobId: string) => `/design/deals/${encodeURIComponent(jobId)}?design=1`;
