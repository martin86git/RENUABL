import { cleanBrand, senderProblem } from "@/lib/domain/marketing/edm";
import { cleanDailyCap } from "@/lib/domain/marketing/sequences";
import { siteUrl } from "@/lib/domain/sms";
import { answer } from "@/lib/server/design-context";
import { emailProvider } from "@/lib/server/email";
import { isRenuablBusiness, senderFor } from "@/lib/server/marketing-access";
import { marketingSettings, saveMarketingSettings } from "@/lib/server/marketing-campaigns-repo";
import { marketingMember, readJson, refuse } from "@/lib/server/marketing-guard";

/**
 * GET: the business's sender name, reply-to, colour and footer, daily cap and pause, who its emails are from (its brand
 * kit), and what's set up for sending (yes/no only). PUT (members who may change settings): saves them.
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
    const gate = await marketingMember("prices");
    if ("refuse" in gate) return gate.refuse;
    const b = await readJson(request);
    if (!b) return refuse("Bad request", 400);
    const biz = gate.member.businessId;
    await saveMarketingSettings(
      biz,
      { brand: cleanBrand(b.brand), dailyCap: cleanDailyCap(b.dailyCap), paused: b.paused === true },
      gate.member.email,
    );
    return Response.json({ ok: true, settings: await marketingSettings(biz) });
  });
}
