/**
 * Server only. Live co-design (domain/design/live.ts): the private link a customer watches their roof being designed
 * on during the call. Under the designer's tenant rule (the business id first, from the signed-in member) for the
 * business's side; the customer's side is keyed by the link's token alone, and only while it is open.
 */
import { randomBytes } from "node:crypto";
import { LIVE_HOURS, cleanChoice, cleanLiveSnapshot, type LiveSnapshot } from "@/lib/domain/design/live";
import { query } from "./db";
import { jobById, record } from "./design-crm-repo";

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;

export interface LiveStatus {
  token: string;
  seenAt: string | null;
  choice: number | null;
  choiceAt: string | null;
  endsAt: string;
}

/**
 * Opens a live link for a roof (on a deal when there is one), or gives back the one already open for it: one open link
 * a roof at a time, open for `LIVE_HOURS`.
 */
export async function startLive(
  businessId: string,
  place: { lat: number; lng: number; jobId: string | null },
  by: string,
): Promise<LiveStatus | "missing"> {
  if (place.jobId && !(await jobById(businessId, place.jobId))) return "missing";
  const open = await query<LiveStatus & { lat: number; lng: number }>(
    `select token, lat, lng, ${moment("seen_at")} as "seenAt", choice, ${moment("choice_at")} as "choiceAt", ${moment("ends_at")} as "endsAt"
       from design_live where business_id = $1 and ended_at is null and ends_at > now() order by created_at desc limit 20`,
    [businessId],
  );
  const same = open.find((o) => close(o.lat, place.lat) && close(o.lng, place.lng));
  if (same) {
    const { lat: _lat, lng: _lng, ...status } = same;
    void _lat;
    void _lng;
    return status;
  }
  const token = randomBytes(24).toString("hex");
  const rows = await query<LiveStatus>(
    `insert into design_live (token, business_id, job_id, lat, lng, created_by, ends_at)
     values ($1, $2, $3, $4, $5, $6, now() + ($7 || ' hours')::interval)
     returning token, ${moment("seen_at")} as "seenAt", choice, ${moment("choice_at")} as "choiceAt", ${moment("ends_at")} as "endsAt"`,
    [token, businessId, place.jobId, place.lat, place.lng, by, String(LIVE_HOURS)],
  );
  return rows[0];
}

/** The designer's latest snapshot onto its open link; false for a link that isn't the business's or has ended. */
export async function pushLive(businessId: string, token: string, raw: unknown): Promise<boolean> {
  const snapshot = cleanLiveSnapshot(raw);
  const rows = await query<{ token: string }>(
    `update design_live set snapshot = $3 where business_id = $1 and token = $2 and ended_at is null and ends_at > now() returning token`,
    [businessId, token, JSON.stringify({ ...snapshot, at: new Date().toISOString() })],
  );
  return rows.length > 0;
}

/** Whether the customer is watching, and what they chose: for the business only. */
export async function liveStatus(businessId: string, token: string): Promise<LiveStatus | null> {
  const rows = await query<LiveStatus>(
    `select token, ${moment("seen_at")} as "seenAt", choice, ${moment("choice_at")} as "choiceAt", ${moment("ends_at")} as "endsAt"
       from design_live where business_id = $1 and token = $2`,
    [businessId, token],
  );
  return rows[0] ?? null;
}

/** Ends a link: the customer's page then says the live session has ended. */
export async function endLive(businessId: string, token: string): Promise<boolean> {
  const rows = await query<{ token: string }>(
    `update design_live set ended_at = now() where business_id = $1 and token = $2 and ended_at is null returning token`,
    [businessId, token],
  );
  return rows.length > 0;
}

export interface LiveForCustomer {
  business: string;
  snapshot: LiveSnapshot | null;
  choice: number | null;
  open: boolean;
  lat: number;
  lng: number;
}

/** What the customer's page shows, by the link's token: the business's name, the latest snapshot and their choice. */
export async function liveByToken(token: string, seen = false): Promise<LiveForCustomer | null> {
  const rows = await query<{
    business: string;
    brand: string | null;
    snapshot: LiveSnapshot | null;
    choice: number | null;
    open: boolean;
    lat: number;
    lng: number;
  }>(
    `select b.name as business, nullif(br.kit->>'name', '') as brand, l.snapshot, l.choice, l.lat, l.lng,
            (l.ended_at is null and l.ends_at > now()) as open
       from design_live l join businesses b on b.id = l.business_id
       left join design_brand br on br.business_id = l.business_id
      where l.token = $1`,
    [token],
  );
  const row = rows[0];
  if (!row) return null;
  if (seen && row.open) await query(`update design_live set seen_at = now() where token = $1`, [token]);
  return { business: row.brand || row.business, snapshot: row.snapshot, choice: row.choice, open: row.open, lat: row.lat, lng: row.lng };
}

/**
 * The customer's choice, only one of the designs they were shown and only while the link is open; written on the
 * deal's record once a choice changes.
 */
export async function chooseLive(token: string, raw: unknown): Promise<number | null | "closed"> {
  const rows = await query<{
    businessId: string;
    jobId: string | null;
    snapshot: LiveSnapshot | null;
    choice: number | null;
    open: boolean;
  }>(
    `select business_id as "businessId", job_id as "jobId", snapshot, choice, (ended_at is null and ends_at > now()) as open
       from design_live where token = $1`,
    [token],
  );
  const row = rows[0];
  if (!row || !row.open || !row.snapshot) return "closed";
  const choice = cleanChoice(raw, row.snapshot);
  if (choice === null) return null;
  await query(`update design_live set choice = $2, choice_at = now() where token = $1`, [token, choice]);
  if (row.jobId && row.choice !== choice) {
    const found = await jobById(row.businessId, row.jobId);
    const name = row.snapshot.designs.find((d) => d.at === choice)?.name ?? `Option ${choice + 1}`;
    if (found)
      await record(query, row.businessId, {
        customerId: found.customer.id,
        jobId: row.jobId,
        kind: "note",
        text: `On the live design, the customer chose ${name}.`,
        by: "customer",
      }).catch(() => undefined);
  }
  return choice;
}
