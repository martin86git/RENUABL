/**
 * Proposals, as the screens ask for them: a business's branding and
 * pictures, working a job's proposal out and sending it, and what a customer
 * does from their private link. Everything is worked out and kept on the
 * server (`/api/design/brand`, `/api/design/jobs/<id>/proposal`,
 * `/api/proposal/<token>`); the screens only ever hold the customer's copy
 * of a proposal, never a cost. Each call answers with what was asked for, or
 * a plain message to show.
 */
import type { BrandImage, BrandKit, ImageKind } from "@/lib/domain/design/brand";
import type { Job } from "@/lib/domain/design/crm";
import type { ProposalChoice, ProposalState, ProposalStatus, ProposalView } from "@/lib/domain/design/proposal";

export type Answer<T> = ({ ok: true } & T) | { ok: false; message: string; problems?: string[]; signedOut?: boolean };

const UNREACHABLE = "We couldn't reach the server just now. Try again in a moment.";

async function ask<T>(path: string, init?: { method: string; body?: unknown; form?: FormData }): Promise<Answer<T>> {
  try {
    const res = await fetch(path, {
      method: init?.method ?? "GET",
      ...(init?.form ? { body: init.form } : {}),
      ...(init?.body !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify(init.body) } : {}),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as
      (Record<string, unknown> & { ok?: boolean; message?: string; problems?: string[] }) | null;
    if (res.ok && json?.ok) return json as { ok: true } & T;
    return {
      ok: false,
      message: json?.message ?? UNREACHABLE,
      ...(json?.problems ? { problems: json.problems } : {}),
      ...(res.status === 401 ? { signedOut: true } : {}),
    };
  } catch {
    return { ok: false, message: UNREACHABLE };
  }
}

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

/** `emailReady`: whether the server can email at all (it can't on a developer's own computer), for the page that lists who is told. */
export const loadBrand = () => ask<{ brand: BrandKit; images: BrandImage[]; emailReady?: boolean }>("/api/design/brand");
export const saveBrand = (patch: Partial<BrandKit>) => ask<{ brand: BrandKit }>("/api/design/brand", { method: "PUT", body: patch });

/** Sends a picture for the brand kit. The server checks it, makes it smaller and keeps only the picture itself. */
export function addBrandImage(kind: ImageKind, file: File) {
  const form = new FormData();
  form.set("kind", kind);
  form.set("file", file);
  return ask<{ image: BrandImage; images: BrandImage[] }>("/api/design/brand/files", { method: "POST", form });
}
export const removeBrandImage = (id: string) =>
  ask<{ images: BrandImage[] }>(`/api/design/brand/files/${encodeURIComponent(id)}`, { method: "DELETE" });

/** Where one of the business's own pictures is, for its own screens (the brand page, the preview). */
export const brandImageUrl = (id: string) => `/api/design/brand/files/${encodeURIComponent(id)}`;

// ---------------------------------------------------------------------------
// A job's proposal
// ---------------------------------------------------------------------------

const jobProposal = (jobId: string) => `/api/design/jobs/${encodeURIComponent(jobId)}/proposal`;

/** Every version sent for a job, newest first. Empty when none has been. */
export const loadProposal = (jobId: string) => ask<{ versions: ProposalStatus[] }>(jobProposal(jobId));

/**
 * The proposal as it would go out now. `view` is null when something stops
 * it being sent, and `problems` says what. `projectVersion` goes back with
 * `publishProposal`, so exactly what was previewed is what is published.
 */
export const previewProposal = (jobId: string, choice: Partial<ProposalChoice>) =>
  ask<{ view: ProposalView | null; problems: string[]; choice: ProposalChoice | null; projectVersion: number | null }>(
    `${jobProposal(jobId)}/preview`,
    { method: "POST", body: choice },
  );

export const publishProposal = (jobId: string, choice: Partial<ProposalChoice> & { projectVersion: number }) =>
  ask<{ proposal: ProposalStatus; versions: ProposalStatus[]; job: Job }>(jobProposal(jobId), { method: "POST", body: choice });

export const withdrawProposal = (jobId: string) => ask<{ versions: ProposalStatus[] }>(jobProposal(jobId), { method: "DELETE" });

/** Where the business previews and sends a job's proposal. */
export const proposalScreen = (jobId: string) => `/design/deals/${encodeURIComponent(jobId)}/proposal`;

/** A private link in full, for copying: the site's own address in front of the path. */
export const fullLink = (path: string) => (typeof window === "undefined" ? path : `${window.location.origin}${path}`);

/**
 * "Publish design" in the design tool, once the design has saved: works the
 * job's proposal out again from the saved design and publishes it with the
 * business's usual template and validity, so the proposal always matches
 * the design last published. Nothing is sent to anyone: the customer sees it
 * only when the business gives them the link. Null when done; otherwise
 * what to tell the person (the design itself is already saved either way).
 *
 * A proposal the customer has accepted is left as it is: changing what
 * someone agreed to is done on purpose, from the deal's proposal screen.
 */
export async function publishFromDesigner(jobId: string): Promise<string | null> {
  const sent = await loadProposal(jobId);
  if (!sent.ok) return `The design is saved. The proposal wasn't updated: ${sent.message}`;
  if (sent.versions[0]?.state === "accepted")
    return "The design is saved. The customer has already accepted the proposal, so it was left as they accepted it. To send a changed one, open View proposal.";
  const preview = await previewProposal(jobId, {});
  if (!preview.ok) return `The design is saved. The proposal wasn't updated: ${preview.message}`;
  if (!preview.view || preview.projectVersion === null)
    return `The design is saved. The proposal can't be published yet: ${preview.problems[0] ?? "something is missing."}`;
  const published = await publishProposal(jobId, { projectVersion: preview.projectVersion });
  return published.ok ? null : `The design is saved. The proposal wasn't updated: ${published.message}`;
}

/** What Publish says for a roof opened without a deal: a proposal is for a customer, and this roof has none yet. */
export const NO_DEAL =
  "The design is saved. A proposal is for a customer: open this roof from a deal (Sales, then the deal) to publish one.";
/** What Publish says when nobody is signed in. */
export const NEEDS_ACCOUNT = "The design is saved on this device. Sign in to your business to send proposals.";

// ---------------------------------------------------------------------------
// The customer's side
// ---------------------------------------------------------------------------

/** What a private link opens: where the proposal stands, the customer's copy (null once withdrawn), and who to contact. */
export interface OpenedProposal {
  state: ProposalState;
  view: ProposalView | null;
  business: Pick<ProposalView["business"], "name" | "phone" | "email" | "website">;
  accepted: { name: string; at: string } | null;
}

const link = (token: string) => `/api/proposal/${encodeURIComponent(token)}`;

/** Says the customer has opened their proposal. Never shown, never waited for. */
export const tellOpened = (token: string) => void ask<object>(link(token), { method: "POST", body: { action: "opened" } });
export const acceptProposal = (token: string, name: string, agree: boolean) =>
  ask<OpenedProposal>(link(token), { method: "POST", body: { action: "accept", name, agree } });
export const askQuestion = (token: string, text: string) =>
  ask<object>(link(token), { method: "POST", body: { action: "question", text } });

/** Where a proposal's pictures, its roof from above and its PDF are, by its private link. */
export const proposalUrls = (token: string) => ({
  image: (id: string) => `${link(token)}/file/${encodeURIComponent(id)}`,
  roof: `${link(token)}/roof`,
  pdf: `${link(token)}/pdf`,
});
