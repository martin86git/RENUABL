/**
 * Server only. The satellite view of a job's roof, for the partner the job
 * belongs to. Needs GOOGLE_MAPS_API_KEY with the Maps Static API enabled.
 */
import { roofViewUrl, type RoofViewSize } from "@/lib/domain/roof-view";
import type { Address } from "@/lib/domain/types";
import { currentSession } from "./accounts";
import { dbConfigured, query } from "./db";
import { portalContext } from "./portal";

/**
 * The home's address, only for the signed-in partner whose accepted job it is,
 * or the signed-in customer whose home it is (never for offers or the sample portal).
 */
export async function ownedJobAddress(recordKey: string): Promise<Address | null> {
  if (!dbConfigured()) return null;
  const ctx = await portalContext();
  if (ctx?.kind === "partner") {
    const rows = await query<{ address: Address }>(`select address from jobs where record_key = $1 and partner_id = $2`, [
      recordKey,
      ctx.partner.id,
    ]);
    if (rows[0]) return rows[0].address;
  }
  const session = await currentSession();
  if (session?.role !== "customer") return null;
  const rows = await query<{ address: Address }>(`select address from jobs where record_key = $1 and customer_email = $2`, [
    recordKey,
    session.email,
  ]);
  return rows[0]?.address ?? null;
}

export async function roofViewFor(recordKey: string, size: RoofViewSize): Promise<Response | null> {
  const address = await ownedJobAddress(recordKey);
  return address ? satelliteImage(address, size) : null;
}

/** The satellite image for an address (the caller checks who may see it). */
export async function satelliteImage(address: Address, size: RoofViewSize): Promise<Response | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return null;
  const url = roofViewUrl(address, size, key);
  if (!url) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) {
    console.error(`roof view failed: Google ${res.status}`);
    return null;
  }
  return new Response(res.body, {
    headers: { "content-type": type, "cache-control": "private, max-age=86400" },
  });
}
