import { emptyHandover } from "@/lib/domain/handover";
import { siteUrl, variationSentSms } from "@/lib/domain/sms";
import { addVariation, cleanVariationInput } from "@/lib/domain/variations";
import { getRecord, saveRecord, validKey } from "@/lib/server/handover-store";
import { currentPartner, customerMobileFor, mayWriteRecord } from "@/lib/server/partner-context";
import { sendSms } from "@/lib/server/sms";
import { storageConfigured } from "@/lib/server/storage";

/**
 * POST { jobReference, reason, items: [{ label, amount }] } from the partner
 * portal (the job's own partner): prices the variation on the server and sends it to
 * the customer to approve. Texts the customer a link when they can be reached.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/jobs/[key]/variations">) {
  const { key } = await ctx.params;
  if (!validKey(key) || !(await mayWriteRecord(key))) return Response.json({ ok: false }, { status: 404 });
  const partner = await currentPartner();
  if (!partner) return Response.json({ ok: false }, { status: 404 });
  if (!storageConfigured()) return Response.json({ ok: false, notConfigured: true }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const input = cleanVariationInput(body);
  if (!input)
    return Response.json({ ok: false, message: "Add what the work is, a price for each item, and why it's needed." }, { status: 422 });
  const reference = typeof body.jobReference === "string" ? body.jobReference.slice(0, 20) : "";
  const existing = (await getRecord(key)) ?? emptyHandover(key, reference);
  const now = new Date().toISOString();
  const id = `var_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const record = await saveRecord({ ...existing, variations: addVariation(existing.variations, input, partner, { id, now }) });

  const customer = await customerMobileFor(key);
  const site = siteUrl();
  if (customer && site) {
    await sendSms(customer.mobile, variationSentSms({ customer: customer.name, link: `${site}/my/installation?record=${key}` }));
  }
  return Response.json({ ok: true, record });
}
