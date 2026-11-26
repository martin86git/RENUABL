import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  GTM_CAMPAIGN_NAME,
  GTM_LAUNCH,
  GTM_PICTURES,
  GTM_SEQUENCE_NAME,
  gtmSequence,
  withPictures,
} from "@/lib/domain/marketing/gtm-drafts";
import { GTM_SOL, GTM_SOL_CAMPAIGN_NAME, GTM_SOL_NEEDS, GTM_SOL_PICTURES } from "@/lib/domain/marketing/gtm-sol-draft";
import { answer } from "@/lib/server/design-context";
import { marketingImage } from "@/lib/server/design-images";
import { isRenuablBusiness } from "@/lib/server/marketing-access";
import { createCampaign, createSequence, listCampaigns, listSequences, saveImage } from "@/lib/server/marketing-campaigns-repo";
import { marketingMember, refuse } from "@/lib/server/marketing-guard";

/**
 * RENUABL's own launch drafts (domain/marketing/gtm-drafts.ts, "One giant leap"), only for RENUABL's own business.
 * GET: whether to offer them and whether they are there. POST (members who may publish): reads the drafts' pictures from
 * marketing/launch/ (kept out of the public folder, so nobody can open them by address) into RENUABL's Marketing pictures (redrawn as any upload is), then adds the launch
 * campaign, the series and the Meet Sol campaign (gtm-sol-draft.ts) as drafts, each once by name; nothing is scheduled,
 * sent or switched on.
 */
export const maxDuration = 60;

async function state(businessId: string) {
  const [campaigns, sequences] = await Promise.all([listCampaigns(businessId), listSequences(businessId)]);
  return {
    campaign: campaigns.find((c) => c.name === GTM_CAMPAIGN_NAME)?.id ?? null,
    sequence: sequences.find((s) => s.name === GTM_SEQUENCE_NAME)?.id ?? null,
    sol: campaigns.find((c) => c.name === GTM_SOL_CAMPAIGN_NAME)?.id ?? null,
  };
}

/** Each picture read from marketing/launch/ and kept as a Marketing picture: key → its id. One that fails is left out. */
async function pictures(businessId: string, by: string, which: Record<string, { file: string }>): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const [key, p] of Object.entries(which)) {
    const bytes = await readFile(join(process.cwd(), "marketing", "launch", p.file)).catch(() => null);
    if (!bytes) continue;
    const img = await marketingImage(new Uint8Array(bytes));
    if ("problem" in img) continue;
    ids[key] = await saveImage(businessId, img, by);
  }
  return ids;
}

export async function GET() {
  return answer(async () => {
    const gate = await marketingMember("design");
    if ("refuse" in gate) return gate.refuse;
    const b = gate.member.businessId;
    if (!(await isRenuablBusiness(b))) return Response.json({ ok: true, offer: false });
    const s = await state(b);
    return Response.json({ ok: true, offer: true, made: Boolean(s.campaign && s.sequence && s.sol) });
  });
}

export async function POST() {
  return answer(async () => {
    const gate = await marketingMember("publish");
    if ("refuse" in gate) return gate.refuse;
    const { businessId, email } = gate.member;
    if (!(await isRenuablBusiness(businessId))) return refuse("These drafts are for RENUABL's own business.", 403);
    const s = await state(businessId);
    // Only the pictures the missing drafts need: all of them for the launch or its series, three for Meet Sol alone.
    const which = s.campaign && s.sequence ? (s.sol ? {} : GTM_SOL_NEEDS) : { ...GTM_PICTURES, ...(s.sol ? {} : GTM_SOL_PICTURES) };
    const ids = await pictures(businessId, email, which);
    const campaign = s.campaign ?? (await createCampaign(businessId, GTM_CAMPAIGN_NAME, withPictures(GTM_LAUNCH, ids), email));
    const sequence = s.sequence ?? (await createSequence(businessId, gtmSequence(campaign, ids), email));
    const sol = s.sol ?? (await createCampaign(businessId, GTM_SOL_CAMPAIGN_NAME, withPictures(GTM_SOL, ids), email));
    return Response.json({
      ok: true,
      campaign,
      sequence,
      sol,
      pictures: Object.keys(ids).length,
      added: { campaign: !s.campaign, sequence: !s.sequence, sol: !s.sol },
    });
  });
}
