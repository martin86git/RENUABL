/**
 * Server only. WHOOP October-offer claims: one row per order, counted against
 * the cap in a transaction with an advisory lock so two reservations at once
 * can't take claim 51. Released claims don't count.
 */
import { WHOOP_OFFER, nextWhoopStatus, whoopOfferOpen, type WhoopStatus } from "@/lib/domain/whoop-offer";
import { todayInMarket } from "@/lib/domain/market";
import { dbConfigured, query, transaction } from "./db";

const LOCK = 7_171_050;

export interface WhoopClaim {
  job_reference: string;
  status: WhoopStatus;
  claimed_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
}

export async function heldClaims(): Promise<number> {
  const rows = await query<{ n: string }>(`select count(*)::text as n from whoop_claims where status <> 'released'`);
  return Number(rows[0]?.n ?? 0);
}

/** Whether the offer is open. Without a database nothing can be counted, so it stays closed. */
export async function whoopOpen(today: string = todayInMarket()): Promise<boolean> {
  if (!dbConfigured()) return false;
  try {
    return whoopOfferOpen(await heldClaims(), today);
  } catch (e) {
    console.error("whoop count failed", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Claims a WHOOP for this order if one is left. Returns true when the order holds a claim. */
export async function claimWhoop(reference: string, today: string = todayInMarket()): Promise<boolean> {
  return transaction(async (q) => {
    await q(`select pg_advisory_xact_lock($1)`, [LOCK]);
    const existing = await q<{ status: WhoopStatus }>(`select status from whoop_claims where job_reference = $1`, [reference]);
    if (existing[0] && existing[0].status !== "released") return true;
    if (today > WHOOP_OFFER.endsOn) return false;
    const held = Number((await q<{ n: string }>(`select count(*)::text as n from whoop_claims where status <> 'released'`))[0]?.n ?? 0);
    if (held >= WHOOP_OFFER.cap) return false;
    await q(
      `insert into whoop_claims (job_reference, status) values ($1, 'claimed')
       on conflict (job_reference) do update set status = 'claimed', claimed_at = now(), released_at = null`,
      [reference],
    );
    return true;
  });
}

/** Moves a claim along (claimed → shipped → delivered) or releases an unshipped one. */
export async function setWhoopStatus(reference: string, next: WhoopStatus): Promise<boolean> {
  const rows = await query<{ status: WhoopStatus }>(`select status from whoop_claims where job_reference = $1`, [reference]);
  if (!rows[0] || !nextWhoopStatus(rows[0].status, next)) return false;
  const stamp = next === "shipped" ? "shipped_at" : next === "delivered" ? "delivered_at" : "released_at";
  await query(`update whoop_claims set status = $2, ${stamp} = now() where job_reference = $1`, [reference, next]);
  return true;
}

export async function whoopClaimFor(reference: string): Promise<WhoopClaim | null> {
  const rows = await query<WhoopClaim>(`select * from whoop_claims where job_reference = $1`, [reference]);
  return rows[0] ?? null;
}

export async function listWhoopClaims(): Promise<(WhoopClaim & { name: string | null; install_date: string | null })[]> {
  return query(
    `select w.*, j.customer->>'name' as name,
            to_char(j.install_date, 'YYYY-MM-DD') as install_date
     from whoop_claims w left join jobs j on j.reference = w.job_reference
     order by w.claimed_at`,
  );
}
