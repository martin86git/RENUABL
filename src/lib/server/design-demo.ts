/**
 * Server only. The RENUABL Business demo (domain/design/demo.ts): a demo business of the visitor's own, made in one
 * press with the example deals in it and a small allowance of Sol's answers; later, who they are, kept as a sales lead
 * with the demo named for their company; and demos cleared once they are old.
 */
import { randomBytes } from "node:crypto";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import {
  DEMO_BUSINESS,
  DEMO_DAYS,
  DEMO_DOMAIN,
  DEMO_SOL_CREDITS,
  demoEmail,
  demoSourceWords,
  type DemoDetails,
  type DemoSource,
} from "@/lib/domain/design/demo";
import { todayInMarket } from "@/lib/domain/market";
import { query } from "./db";
import { creditSolPack, recordLead } from "./design-billing-repo";
import { addExampleDeals } from "./design-feed";
import { createBusiness, markWelcomed, renameBusiness, saveProfile, type Member } from "./design-repo";

/**
 * A new demo business, ready to open: the welcome skipped (Today opens on its deals), the example deals in, Sol's
 * allowance given. Nobody's name is on it yet. Answers the owner's email to sign in as.
 */
export async function openDemo(from: DemoSource | null = null): Promise<string> {
  const email = demoEmail(randomBytes(8).toString("hex"));
  const member = await createBusiness(email, DEMO_BUSINESS, BUSINESS_TERMS_VERSION, "retailer");
  if (from) {
    await query(`update businesses set demo_source = $2, demo_campaign = $3 where id = $1`, [
      member.businessId,
      from.source,
      from.campaign || null,
    ]);
  }
  await markWelcomed(member.businessId, email);
  await creditSolPack(member.businessId, `demo:${member.businessId}`, DEMO_SOL_CREDITS, null, todayInMarket());
  // The deals are what make the demo worth opening, but a demo without them still opens.
  await addExampleDeals(member.businessId).catch((e) => console.error("demo example deals failed", e instanceof Error ? e.message : e));
  return email;
}

/**
 * Who is trying this demo: kept as a sales lead first (so it is ours even if a later step fails), then their name put
 * on the demo's owner and the demo named for their company, so its proposals carry it.
 */
export async function keepDemoDetails(member: Member, details: DemoDetails): Promise<DemoSource | null> {
  const from = await demoSourceOf(member.businessId);
  await recordLead("demo", {
    email: details.email,
    name: [details.firstName, details.lastName].filter(Boolean).join(" "),
    business: details.company,
    note: `Demo account ${member.email}${from ? ` · came from ${demoSourceWords(from)}` : ""}`,
  });
  await saveProfile(member.businessId, member.email, { firstName: details.firstName, lastName: details.lastName, mobile: "" });
  await renameBusiness(member.businessId, details.company);
  return from;
}

/** Where a demo business came from, when its button was pressed on a page with a `utm_source`. */
export async function demoSourceOf(businessId: string): Promise<DemoSource | null> {
  const rows = await query<{ demo_source: string | null; demo_campaign: string | null }>(
    `select demo_source, demo_campaign from businesses where id = $1`,
    [businessId],
  );
  const row = rows[0];
  return row?.demo_source ? { source: row.demo_source, campaign: row.demo_campaign ?? "" } : null;
}

/** Clears demo businesses opened more than `DEMO_DAYS` ago, with their sessions. Answers how many went. */
export async function clearOldDemos(): Promise<number> {
  const gone = await query<{ created_by: string }>(
    `delete from businesses where created_by like $1 and created_at < now() - ($2 || ' days')::interval returning created_by`,
    [`%@${DEMO_DOMAIN}`, String(DEMO_DAYS)],
  );
  if (gone.length) await query(`delete from sessions where email = any($1)`, [gone.map((g) => g.created_by)]);
  return gone.length;
}
