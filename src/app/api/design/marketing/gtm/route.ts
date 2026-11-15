import { GTM_CAMPAIGN_NAME, GTM_LAUNCH, GTM_SEQUENCE_NAME, gtmSequence } from "@/lib/domain/marketing/gtm-drafts";
import { answer } from "@/lib/server/design-context";
import { isRenuablBusiness } from "@/lib/server/marketing-access";
import { createCampaign, createSequence, listCampaigns, listSequences } from "@/lib/server/marketing-campaigns-repo";
import { marketingMember, refuse } from "@/lib/server/marketing-guard";

/**
 * RENUABL's own go-to-market drafts (domain/marketing/gtm-drafts.ts), only for RENUABL's own business.
 * GET: whether to offer them and whether they are there. POST (members who may publish): adds the launch campaign and
 * the nurture sequence as drafts, each once by name; nothing is scheduled, sent or switched on.
 */
async function state(businessId: string) {
  const [campaigns, sequences] = await Promise.all([listCampaigns(businessId), listSequences(businessId)]);
  return {
    campaign: campaigns.find((c) => c.name === GTM_CAMPAIGN_NAME)?.id ?? null,
    sequence: sequences.find((s) => s.name === GTM_SEQUENCE_NAME)?.id ?? null,
  };
}

export async function GET() {
  return answer(async () => {
    const gate = await marketingMember("design");
    if ("refuse" in gate) return gate.refuse;
    const b = gate.member.businessId;
    if (!(await isRenuablBusiness(b))) return Response.json({ ok: true, offer: false });
    const s = await state(b);
    return Response.json({ ok: true, offer: true, made: Boolean(s.campaign && s.sequence) });
  });
}

export async function POST() {
  return answer(async () => {
    const gate = await marketingMember("publish");
    if ("refuse" in gate) return gate.refuse;
    const { businessId, email } = gate.member;
    if (!(await isRenuablBusiness(businessId))) return refuse("These drafts are for RENUABL's own business.", 403);
    const s = await state(businessId);
    const campaign = s.campaign ?? (await createCampaign(businessId, GTM_CAMPAIGN_NAME, GTM_LAUNCH, email));
    const sequence = s.sequence ?? (await createSequence(businessId, gtmSequence(campaign), email));
    return Response.json({ ok: true, campaign, sequence, added: { campaign: !s.campaign, sequence: !s.sequence } });
  });
}
