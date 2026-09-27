import { PREVIEW_MODE } from "@/lib/config";
import { siteUrl, variationDecidedSms } from "@/lib/domain/sms";
import { decideVariation, isVariationAction } from "@/lib/domain/variations";
import { getRecord, saveRecord, validKey } from "@/lib/server/handover-store";
import { currentPartner } from "@/lib/server/partner-context";
import { sendSms } from "@/lib/server/sms";
import { storageConfigured } from "@/lib/server/storage";

/**
 * POST { action }: the customer approves or declines a variation from their
 * installation record (its private link), or the partner withdraws it
 * (preview portal only). Only a variation still waiting can change.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/jobs/[key]/variations/[id]">) {
  const { key, id } = await ctx.params;
  if (!validKey(key) || !/^var_[a-z0-9]{4,24}$/.test(id)) return Response.json({ ok: false }, { status: 404 });
  if (!storageConfigured()) return Response.json({ ok: false, notConfigured: true }, { status: 503 });
  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const action = body.action;
  if (!isVariationAction(action) || (action === "withdraw" && !PREVIEW_MODE)) return Response.json({ ok: false }, { status: 400 });
  const existing = await getRecord(key);
  if (!existing) return Response.json({ ok: false }, { status: 404 });
  const variations = decideVariation(existing.variations, id, action, new Date().toISOString());
  if (!variations) return Response.json({ ok: false, message: "This has already been answered." }, { status: 409 });
  const record = await saveRecord({ ...existing, variations });

  const partner = currentPartner();
  const site = siteUrl();
  if (action !== "withdraw" && partner.mobile && site) {
    await sendSms(
      partner.mobile,
      variationDecidedSms({ reference: existing.jobReference, approved: action === "approve", link: `${site}/installer/jobs` }),
    );
  }
  return Response.json({ ok: true, record });
}
