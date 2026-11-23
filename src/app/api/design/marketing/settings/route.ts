import { cleanBrand, senderProblem } from "@/lib/domain/marketing/edm";
import { cleanDailyCap } from "@/lib/domain/marketing/sequences";
import { siteUrl } from "@/lib/domain/sms";
import { answer } from "@/lib/server/design-context";
import { emailProvider } from "@/lib/server/email";
import { isRenuablBusiness, senderFor } from "@/lib/server/marketing-access";
import { marketingSettings, ownsImage, saveMarketingSettings } from "@/lib/server/marketing-campaigns-repo";
import { marketingMember, readJson, refuse } from "@/lib/server/marketing-guard";

/**
 * GET: the business's sender name, reply-to, colour and footer, daily cap and pause, who its emails are from (its brand
 * kit), and what's set up for sending (yes/no only). PUT (members who may change settings): saves them. PUT `{logoId}`
 * alone (members who may publish, as they build emails): sets or clears the logo, leaving the rest as it was.
 */
export async function GET() {
  return answer(async () => {
    const gate = await marketingMember("design");
    if ("refuse" in gate) return gate.refuse;
    const biz = gate.member.businessId;
    const [settings, sender, renuabl] = await Promise.all([marketingSettings(biz), senderFor(biz), isRenuablBusiness(biz)]);
    return Response.json({
      ok: true,
      settings,
      sender,
      renuabl,
      ready: {
        sender: !senderProblem(sender),
        email: Boolean(emailProvider()),
        siteUrl: Boolean(siteUrl()),
        cron: Boolean(process.env.CRON_SECRET?.trim()),
        bounces: Boolean(process.env.SENDGRID_WEBHOOK_PUBLIC_KEY?.trim() || process.env.RESEND_WEBHOOK_SECRET?.trim()),
      },
    });
  });
}

export async function PUT(request: Request) {
  return answer(async () => {
    const b = await readJson(request);
    if (!b) return refuse("Bad request", 400);
    const logoOnly = "logoId" in b && !("brand" in b);
    const gate = await marketingMember(logoOnly ? "publish" : "prices");
    if ("refuse" in gate) return gate.refuse;
    const biz = gate.member.businessId;
    if (logoOnly) {
      const now = await marketingSettings(biz);
      const id = cleanBrand({ logoId: b.logoId }).logoId;
      if (b.logoId !== null && (!id || !(await ownsImage(biz, id)))) return refuse("That picture isn't one of yours.", 400);
      await saveMarketingSettings(biz, { ...now, brand: { ...now.brand, logoId: id } }, gate.member.email);
      return Response.json({ ok: true, settings: await marketingSettings(biz) });
    }
    const brand = cleanBrand(b.brand);
    if (brand.logoId && !(await ownsImage(biz, brand.logoId))) brand.logoId = null;
    await saveMarketingSettings(biz, { brand, dailyCap: cleanDailyCap(b.dailyCap), paused: b.paused === true }, gate.member.email);
    return Response.json({ ok: true, settings: await marketingSettings(biz) });
  });
}
