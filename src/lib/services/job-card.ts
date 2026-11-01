/**
 * The installation job card, as the screens reach it: the business's own card for a job (`/api/design/jobs/[id]/card`)
 * and an installer's, behind their private link (`/api/job/[token]`).
 */
import type { JobNote } from "@/lib/domain/design/job-card";
import type { AsBuilt, AsBuiltInput } from "@/lib/domain/design/as-built";
import type { JobCardView } from "@/lib/server/design-job-card-repo";
import { ask, type Answer } from "./crm";
import { prepareBillFile } from "./consumer";

export type { JobCardView };

const teamPath = (jobId: string) => `/api/design/jobs/${encodeURIComponent(jobId)}/card`;
const linkPath = (token: string) => `/api/job/${encodeURIComponent(token)}`;

export const loadJobCard = (jobId: string) => ask<{ card: JobCardView }>(teamPath(jobId));
export const sendJobCard = (jobId: string, installerId: string) =>
  ask<{ to: string; card: JobCardView }>(teamPath(jobId), { method: "PUT", body: { send: installerId } });
export const loadInstallerCard = (token: string) => ask<{ card: JobCardView; installer: string }>(linkPath(token));
/** What was really installed: kept by the team, or by the installer through their link (named for them). */
export const saveAsBuilt = (where: { jobId: string } | { token: string }, asBuilt: AsBuiltInput, person = "") =>
  "jobId" in where
    ? ask<{ asBuilt: AsBuilt }>(`/api/design/jobs/${encodeURIComponent(where.jobId)}/as-built`, { method: "PUT", body: { asBuilt } })
    : ask<{ asBuilt: AsBuilt }>(`${linkPath(where.token)}/as-built`, { method: "PUT", body: { asBuilt, person } });

/** Where a file on the card is served: the team's own way, or through the installer's link. */
export const teamFileHref = (jobId: string, fileId: string) => `${teamPath(jobId)}/files/${encodeURIComponent(fileId)}`;
export const linkFileHref = (token: string, fileId: string) => `${linkPath(token)}/files/${encodeURIComponent(fileId)}`;
export const linkRoofHref = (token: string) => `${linkPath(token)}/roof`;

/** A note with its photos, each photo made smaller in the browser first so it goes quickly over a phone's connection. */
export async function addNote(
  where: { jobId: string } | { token: string },
  text: string,
  files: File[],
  person = "",
): Promise<Answer<{ note: JobNote }>> {
  const form = new FormData();
  form.set("text", text);
  if (person) form.set("person", person);
  for (const f of files) form.append("files", f.type.startsWith("image/") ? await prepareBillFile(f, 1_200_000) : f);
  try {
    const res = await fetch("jobId" in where ? teamPath(where.jobId) : linkPath(where.token), {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as ({ ok?: boolean; message?: string; note?: JobNote } & object) | null;
    if (res.ok && json?.ok && json.note) return { ok: true, note: json.note };
    return { ok: false, message: json?.message ?? "That didn't go. Check your connection and try again." };
  } catch {
    return { ok: false, message: "That didn't go. Check your connection and try again." };
  }
}
