import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { can } from "@/lib/domain/design/account";
import { designAccess } from "@/lib/server/design-context";
import { XERO_STATE_COOKIE, connectXero, xeroConfig } from "@/lib/server/xero";
import { xeroDone } from "../done";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** GET ?code&state from Xero: checks the state and keeps the business's Xero organisation. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const [kept = "", popup = "0"] = (jar.get(XERO_STATE_COOKIE)?.value ?? "").split("|");
  jar.delete({ name: XERO_STATE_COOKIE, path: "/api/auth/xero" });
  const done = (why: string) => xeroDone(why, { popup: popup === "1", origin: url.origin });
  const access = await designAccess();
  if (access.state !== "ready" || access.member.viewedBy) return done("signed-out");
  if (!can(access.member.role, "prices", access.member.permissions)) return done("failed");
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!code || !kept || !same(kept, state)) return done("failed");
  const config = xeroConfig(url.origin);
  if (!config) return done("off");
  const result = await connectXero(config, code, access.member.businessId, access.member.email).catch(() => "failed" as const);
  return done(result);
}
