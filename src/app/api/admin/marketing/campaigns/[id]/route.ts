import { after } from "next/server";
import { normaliseEmail } from "@/lib/domain/accounts";
import { cleanContent, contentProblem } from "@/lib/domain/marketing/edm";
import { SEND_CONFIRM_WORD, cleanSendAt } from "@/lib/domain/marketing/sequences";
import {
  campaignById,
  campaignRecipients,
  cancelCampaign,
  deleteCampaign,
  duplicateCampaign,
  saveCampaign,
  scheduleCampaign,
} from "@/lib/server/marketing-campaigns-repo";
import { reachOf, runMarketing, sendTest } from "@/lib/server/marketing-send";
import { marketingStaff, readJson, refuse, unauthorised } from "@/lib/server/marketing-staff";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 300;

const ID = /^mca_[0-9a-f]+$/;

/** GET (staff): the campaign, how many its list reaches now, and (once sent) who opened and clicked. */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/marketing/campaigns/[id]">) {
  if (!(await marketingStaff())) return unauthorised();
  const { id } = await ctx.params;
  const c = ID.test(id) ? await campaignById(id) : null;
  if (!c) return refuse("Not found", 404);
  const [reach, recipients] = await Promise.all([
    c.listId ? reachOf(c.listId) : Promise.resolve(null),
    c.status === "draft" ? Promise.resolve([]) : campaignRecipients(id),
  ]);
  return Response.json({ ok: true, campaign: c, reach, recipients });
}

/** PUT (staff) {name, content, listId}: saves a draft. */
export async function PUT(request: Request, ctx: RouteContext<"/api/admin/marketing/campaigns/[id]">) {
  if (!(await marketingStaff())) return unauthorised();
  const { id } = await ctx.params;
  const b = await readJson(request);
  if (!b || !ID.test(id)) return refuse("Bad request", 400);
  const name = typeof b.name === "string" ? b.name.replace(/\s+/g, " ").trim().slice(0, 80) || "Untitled" : "Untitled";
  const listId = typeof b.listId === "string" && /^ml_[0-9a-f]+$/.test(b.listId) ? b.listId : null;
  const ok = await saveCampaign(id, { name, content: cleanContent(b.content), listId });
  return ok ? Response.json({ ok: true }) : refuse("Only a draft can be changed. Cancel it first.", 409);
}

/**
 * POST (staff) {do}:
 * - "test" {to?, content?}: one copy to the staff member's own address (or one typed), marked [Test], no tracking.
 * - "send" {confirm: "SEND", at?}: the deliberate send, now or at a time; the cron queues it then. Refused unless
 *   the email is ready, a list is chosen and someone on it may be emailed.
 * - "cancel": back to a draft while scheduled, or stops a send under way.
 * - "duplicate".
 */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/marketing/campaigns/[id]">) {
  const staff = await marketingStaff();
  if (!staff) return unauthorised();
  const { id } = await ctx.params;
  const b = await readJson(request);
  if (!b || !ID.test(id)) return refuse("Bad request", 400);
  const c = await campaignById(id);
  if (!c) return refuse("Not found", 404);
  if (b.do === "test") {
    if (!allow(request, "marketing-test", 30)) return refuse("Too many tests in an hour. Try again later.", 429);
    const to = b.to ? normaliseEmail(b.to) : staff.email;
    if (!to) return refuse("Enter an email address for the test.");
    const content = cleanContent(b.content ?? c.content);
    const problem = contentProblem(content);
    if (problem) return refuse(problem);
    const r = await sendTest(content, to).catch((e: unknown) => (e instanceof Error ? e.message : "failed"));
    if (r === "sent") return Response.json({ ok: true, to });
    return refuse(r === "skipped" ? "Email isn't set up on this site." : `Not sent: ${r}`);
  }
  if (b.do === "send") {
    if (b.confirm !== SEND_CONFIRM_WORD) return refuse(`Type ${SEND_CONFIRM_WORD} to send.`);
    if (c.status !== "draft") return refuse("This campaign isn't a draft.", 409);
    const problem = contentProblem(c.content);
    if (problem) return refuse(problem);
    if (!c.listId) return refuse("Choose a list to send to.");
    const reach = await reachOf(c.listId);
    if (!reach.emailable) return refuse("Nobody on that list may be emailed yet (consent, unsubscribes or bounces).");
    const when = cleanSendAt(b.at ?? null);
    if ("problem" in when) return refuse(when.problem);
    if (!(await scheduleCampaign(id, when.at, staff.email))) return refuse("It couldn't be scheduled. Refresh and try again.", 409);
    // Sent now: queue it and send the first batch after answering (the cron carries on hourly, in the sending hours).
    if (when.at.getTime() <= Date.now() + 60_000) after(() => runMarketing().catch((e) => console.error("marketing run", e)));
    return Response.json({ ok: true, at: when.at.toISOString(), reach });
  }
  if (b.do === "cancel") {
    const state = await cancelCampaign(id);
    return state ? Response.json({ ok: true, state }) : refuse("Nothing to cancel.", 409);
  }
  if (b.do === "duplicate") return Response.json({ ok: true, id: await duplicateCampaign(id, staff.email) });
  return refuse("Bad request", 400);
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/marketing/campaigns/[id]">) {
  if (!(await marketingStaff())) return unauthorised();
  const { id } = await ctx.params;
  return ID.test(id) && (await deleteCampaign(id))
    ? Response.json({ ok: true })
    : refuse("Only a draft or a stopped campaign can be deleted.", 409);
}
