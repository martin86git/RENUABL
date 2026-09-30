/**
 * Server only. Who the partner portal is showing: a signed-in, approved
 * partner (their own jobs from the database), or the sample portal (in preview,
 * or through the private demo link). Nobody else gets in.
 */
import { cookies } from "next/headers";
import { PREVIEW_MODE } from "@/lib/config";
import { DEMO_COOKIE } from "@/lib/domain/accounts";
import { currentSession } from "./accounts";
import { dbConfigured } from "./db";
import { demoCookieValid } from "./demo-access";
import type { PartnerRow } from "./partners-repo";

export type PortalContext = { kind: "partner"; partner: PartnerRow; email: string } | { kind: "demo" };

export async function portalContext(): Promise<PortalContext | null> {
  if (dbConfigured()) {
    const s = await currentSession();
    if (s?.role === "partner" && s.partner) return { kind: "partner", partner: s.partner, email: s.email };
  }
  // The sample portal: in preview with the demo cookie, or live through the private /demo/<key> link.
  if (demoCookieValid((await cookies()).get(DEMO_COOKIE)?.value, { preview: PREVIEW_MODE })) return { kind: "demo" };
  return null;
}
