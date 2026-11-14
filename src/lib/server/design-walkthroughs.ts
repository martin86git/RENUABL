/**
 * Server only. Recorded walkthroughs of a deal's design (domain/design/walkthrough.ts). Under the designer's tenant
 * rule: every function takes the business id first, from the signed-in member only. The video sits in private Blob
 * storage under `walkthroughPrefix(business, job)`, put there straight from the browser with a short-lived token that
 * may only write under that prefix; this table keeps where it is, its length and its captions. The customer reaches the
 * newest shown one only through their proposal link.
 */
import { randomBytes } from "node:crypto";
import { BlobNotFoundError, del, get, head } from "@vercel/blob";
import {
  MAX_SECONDS,
  cleanCues,
  isWalkthroughPath,
  lengthWords,
  videoType,
  type Cue,
  type Walkthrough,
} from "@/lib/domain/design/walkthrough";
import { isProposalToken } from "@/lib/domain/design/proposal";
import { addActivity } from "./design-crm-repo";
import { query } from "./db";

/** The deal a proposal link belongs to, for its walkthrough. Null for a link we never made, or one taken back. */
export async function dealBehindLink(token: string): Promise<{ businessId: string; jobId: string } | null> {
  if (!isProposalToken(token)) return null;
  const rows = await query<{ businessId: string; jobId: string }>(
    `select business_id as "businessId", job_id as "jobId" from design_proposals where token = $1 and withdrawn_at is null`,
    [token],
  );
  return rows[0] ?? null;
}

interface Row {
  id: string;
  blobPath: string;
  contentType: string;
  seconds: string | number;
  cues: Cue[];
  shown: boolean;
  createdAt: Date | string;
  createdBy: string;
}

const COLS = `id, blob_path as "blobPath", content_type as "contentType", seconds, cues, shown,
  created_at as "createdAt", created_by as "createdBy"`;

const asWalkthrough = (r: Row): Walkthrough => ({
  id: r.id,
  seconds: Number(r.seconds),
  cues: r.cues ?? [],
  shown: r.shown,
  createdAt: new Date(r.createdAt).toISOString(),
  createdBy: r.createdBy,
});

/** Blob credentials: the token when there is one (client uploads need it). */
export function blobToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

export class WalkthroughRefusal extends Error {}

/** The deal's walkthroughs, newest first. */
export async function walkthroughsFor(businessId: string, jobId: string): Promise<Walkthrough[]> {
  const rows = await query<Row>(
    `select ${COLS} from design_walkthroughs where business_id = $1 and job_id = $2 order by created_at desc limit 20`,
    [businessId, jobId],
  );
  return rows.map(asWalkthrough);
}

/**
 * Keeps a recording the browser has just put in storage: only a path under this business and deal, only one that is
 * really there and is a video, its length and captions cleaned. Written on the deal's record. It becomes the one the
 * customer sees.
 */
export async function keepWalkthrough(
  businessId: string,
  jobId: string,
  customerId: string,
  by: string,
  input: { path: unknown; seconds: unknown; cues: unknown },
): Promise<Walkthrough> {
  if (!isWalkthroughPath(input.path, businessId, jobId)) throw new WalkthroughRefusal("That recording isn't this deal's.");
  const token = blobToken();
  if (!token) throw new WalkthroughRefusal("Storage for recordings isn't set up.");
  const blob = await head(input.path, { token }).catch(() => null);
  const type = videoType(blob?.contentType);
  if (!blob || !type) throw new WalkthroughRefusal("The recording didn't arrive. Try sending it again.");
  const seconds = Math.min(MAX_SECONDS, Math.max(1, Math.round(Number(input.seconds) || 0)));
  const cues = cleanCues(input.cues, seconds);
  const id = `wt_${randomBytes(9).toString("hex")}`;
  const rows = await query<Row>(
    `insert into design_walkthroughs (id, business_id, job_id, blob_path, content_type, seconds, cues, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning ${COLS}`,
    [id, businessId, jobId, input.path, type, seconds, JSON.stringify(cues), by],
  );
  await addActivity(
    businessId,
    customerId,
    { jobId, kind: "note", text: `Recorded a walkthrough of the design (${lengthWords(seconds)}). It plays on the customer's proposal.` },
    by,
  ).catch(() => undefined);
  return asWalkthrough(rows[0]);
}

/** Shows or hides one on the customer's page. */
export async function showWalkthrough(businessId: string, jobId: string, id: string, shown: boolean): Promise<boolean> {
  const rows = await query(`update design_walkthroughs set shown = $4 where business_id = $1 and job_id = $2 and id = $3 returning id`, [
    businessId,
    jobId,
    id,
    shown,
  ]);
  return rows.length > 0;
}

/** Deletes one, and its video. */
export async function removeWalkthrough(businessId: string, jobId: string, id: string): Promise<boolean> {
  const rows = await query<{ blobPath: string }>(
    `delete from design_walkthroughs where business_id = $1 and job_id = $2 and id = $3 returning blob_path as "blobPath"`,
    [businessId, jobId, id],
  );
  const token = blobToken();
  if (rows[0] && token) await del(rows[0].blobPath, { token }).catch(() => undefined);
  return rows.length > 0;
}

/** The newest walkthrough shown on a deal: what its customer's proposal page plays. */
export async function shownWalkthrough(
  businessId: string,
  jobId: string,
): Promise<(Walkthrough & { blobPath: string; contentType: string }) | null> {
  const rows = await query<Row>(
    `select ${COLS} from design_walkthroughs where business_id = $1 and job_id = $2 and shown order by created_at desc limit 1`,
    [businessId, jobId],
  );
  return rows[0] ? { ...asWalkthrough(rows[0]), blobPath: rows[0].blobPath, contentType: rows[0].contentType } : null;
}

/** One walkthrough's video for the business's own player. */
export async function walkthroughFile(
  businessId: string,
  jobId: string,
  id: string,
): Promise<{ blobPath: string; contentType: string } | null> {
  const rows = await query<{ blobPath: string; contentType: string }>(
    `select blob_path as "blobPath", content_type as "contentType" from design_walkthroughs where business_id = $1 and job_id = $2 and id = $3`,
    [businessId, jobId, id],
  );
  return rows[0] ?? null;
}

/**
 * A stored video as a response, passing on the browser's Range so it can seek. Private: only our routes call this,
 * after checking who may see it.
 */
export async function videoResponse(file: { blobPath: string; contentType: string }, request: Request): Promise<Response> {
  const token = blobToken();
  if (!token) return new Response(null, { status: 404 });
  const range = request.headers.get("range");
  try {
    const res = await get(file.blobPath, { access: "private", token, ...(range ? { headers: { range } } : {}) });
    if (!res?.stream) return new Response(null, { status: 404 });
    const headers = new Headers({
      "Content-Type": file.contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    const passOn = ["content-range", "content-length"];
    for (const h of passOn) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    const partial = Boolean(range && headers.get("content-range"));
    if (!headers.get("content-length") && typeof res.blob.size === "number" && !partial)
      headers.set("Content-Length", String(res.blob.size));
    return new Response(res.stream, { status: partial ? 206 : 200, headers });
  } catch (e) {
    if (e instanceof BlobNotFoundError) return new Response(null, { status: 404 });
    throw e;
  }
}
