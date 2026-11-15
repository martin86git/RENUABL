import { starterContent } from "@/lib/domain/marketing/edm";
import { answer } from "@/lib/server/design-context";
import { createCampaign, listCampaigns } from "@/lib/server/marketing-campaigns-repo";
import { marketingMember, readJson } from "@/lib/server/marketing-guard";

/** GET: every campaign of the business with its counts. POST {name?} (members who may publish): a new draft from the starter email. */
export async function GET() {
  return answer(async () => {
    const gate = await marketingMember("design");
    if ("refuse" in gate) return gate.refuse;
    return Response.json({ ok: true, campaigns: await listCampaigns(gate.member.businessId) });
  });
}

export async function POST(request: Request) {
  return answer(async () => {
    const gate = await marketingMember("publish");
    if ("refuse" in gate) return gate.refuse;
    const b = (await readJson(request)) ?? {};
    const name = typeof b.name === "string" && b.name.trim() ? b.name.replace(/\s+/g, " ").trim().slice(0, 80) : "New campaign";
    return Response.json({ ok: true, id: await createCampaign(gate.member.businessId, name, starterContent(), gate.member.email) });
  });
}
