import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { todayInMarket } from "@/lib/domain/market";
import { edmSolPrompt } from "@/lib/domain/marketing/edm-sol";
import { withPictures } from "@/lib/domain/marketing/gtm-drafts";
import {
  UPDATES_NEEDS,
  cleanUpdatesAnswer,
  updatesAsk,
  updatesBrief,
  updatesCampaignName,
  updatesEmail,
  updatesSchema,
  updatesWeek,
  withoutEmptyPictures,
} from "@/lib/domain/marketing/product-updates";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { readWithClaude } from "@/lib/server/claude-reader";
import { answer } from "@/lib/server/design-context";
import { marketingImage } from "@/lib/server/design-images";
import { isRenuablBusiness, senderFor } from "@/lib/server/marketing-access";
import { createCampaign, listCampaigns, saveImage } from "@/lib/server/marketing-campaigns-repo";
import { marketingMember, refuse } from "@/lib/server/marketing-guard";
import { allow } from "@/lib/server/rate-limit";
import { withSolCredit } from "@/lib/server/sol-credits";

/**
 * RENUABL's weekly product updates email, "Launch Day" (domain/marketing/product-updates.ts), only for RENUABL's own
 * business. GET: whether to offer it, how many changes the Updates list has for the week to today, and this week's
 * draft when it is already there. POST (members who may publish): Sol writes the week up from the Updates list (one
 * deep answer, use "marketing"; by rule when he can't), the masthead and bands are read from marketing/launch/ into
 * Marketing's pictures, and it is added as a draft campaign, once a week by name. Nothing is scheduled or sent.
 */
export const maxDuration = 60;

async function draftOf(businessId: string, name: string) {
  return (await listCampaigns(businessId)).find((c) => c.name === name)?.id ?? null;
}

export async function GET() {
  return answer(async () => {
    const gate = await marketingMember("design");
    if ("refuse" in gate) return gate.refuse;
    const b = gate.member.businessId;
    if (!(await isRenuablBusiness(b))) return Response.json({ ok: true, offer: false });
    const week = updatesWeek(todayInMarket());
    return Response.json({
      ok: true,
      offer: true,
      count: week.updates.length,
      from: week.from,
      to: week.to,
      id: await draftOf(b, updatesCampaignName(week)),
    });
  });
}

export async function POST(request: Request) {
  return answer(async () => {
    const gate = await marketingMember("publish");
    if ("refuse" in gate) return gate.refuse;
    const { businessId, email } = gate.member;
    if (!(await isRenuablBusiness(businessId))) return refuse("This email is for RENUABL's own business.", 403);
    if (!allow(request, "marketing-updates", 20)) return refuse("Too many in the last hour. Try again shortly.", 429);
    const week = updatesWeek(todayInMarket());
    if (!week.updates.length) return refuse("Nothing is on the Updates list for this week yet.");
    const name = updatesCampaignName(week);
    const there = await draftOf(businessId, name);
    if (there) return Response.json({ ok: true, id: there, added: false, bySol: false });

    // Sol writes it up; any failure (no key, no credits, a bad answer) leaves the plain email made by rule.
    const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
    const business = (await senderFor(businessId)).name || "RENUABL";
    const written = apiKey
      ? await withSolCredit(
          businessId,
          "marketing",
          email,
          (ai) =>
            readWithClaude<unknown>(
              [],
              updatesSchema(),
              edmSolPrompt("all", {
                business,
                brief: updatesBrief(week),
                draft: { subject: "", preview: "", heading: "", text: "" },
                ask: updatesAsk(week),
              }),
              apiKey,
              ai,
            ),
          "deep",
          "product updates email written",
        )
          .then((out) => (out === "out" ? null : cleanUpdatesAnswer(out, week)))
          .catch((e) => {
            console.error("product updates email failed", redactSecrets(e instanceof Error ? e.message : String(e)));
            return null;
          })
      : null;

    const ids: Record<string, string> = {};
    for (const [key, p] of Object.entries(UPDATES_NEEDS)) {
      const bytes = await readFile(join(process.cwd(), "marketing", "launch", p.file)).catch(() => null);
      if (!bytes) continue;
      const img = await marketingImage(new Uint8Array(bytes));
      if ("problem" in img) continue;
      ids[key] = await saveImage(businessId, img, email);
    }
    const content = withoutEmptyPictures(withPictures(updatesEmail(week, written)!, ids));
    const id = await createCampaign(businessId, name, content, email);
    return Response.json({ ok: true, id, added: true, bySol: Boolean(written) });
  });
}
