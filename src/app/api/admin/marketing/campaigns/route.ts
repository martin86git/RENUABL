import { starterContent } from "@/lib/domain/marketing/edm";
import { createCampaign, listCampaigns } from "@/lib/server/marketing-campaigns-repo";
import { marketingStaff, readJson, unauthorised } from "@/lib/server/marketing-staff";

/** GET (staff): every campaign with its counts. POST {name?}: a new draft, started from the starter email. */
export async function GET() {
  if (!(await marketingStaff())) return unauthorised();
  return Response.json({ ok: true, campaigns: await listCampaigns() });
}

export async function POST(request: Request) {
  const staff = await marketingStaff();
  if (!staff) return unauthorised();
  const b = (await readJson(request)) ?? {};
  const name = typeof b.name === "string" && b.name.trim() ? b.name.replace(/\s+/g, " ").trim().slice(0, 80) : "New campaign";
  return Response.json({ ok: true, id: await createCampaign(name, starterContent(), staff.email) });
}
