/**
 * Server only. The RENUABL Business demo (domain/design/demo.ts). Nothing makes a demo business any more (27 Nov 2026,
 * Martin: no self-serve demo; `openDemo`, which made one in a press, was removed). What is left is for the demo
 * accounts opened before: who they are, kept as a sales lead with the demo named for their company; and demos cleared
 * once they are old.
 */
import { DEMO_DAYS, DEMO_DOMAIN, demoSourceWords, type DemoDetails, type DemoSource } from "@/lib/domain/design/demo";
import { query } from "./db";
import { recordLead } from "./design-billing-repo";
import { renameBusiness, saveProfile, type Member } from "./design-repo";

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
