import {
  SITE_LOGOS,
  SITE_LOGO_KEYS,
  cleanBrand,
  cleanLogos,
  senderProblem,
  withLogo,
  withLogoSize,
  withoutLogo,
} from "@/lib/domain/marketing/edm";
import { safeImage } from "@/lib/server/design-images";
import { cleanDailyCap } from "@/lib/domain/marketing/sequences";
import { siteUrl } from "@/lib/domain/sms";
import { answer } from "@/lib/server/design-context";
import { emailProvider } from "@/lib/server/email";
import { isRenuablBusiness, senderFor } from "@/lib/server/marketing-access";
import { marketingSettings, ownsImage, saveImage, saveMarketingSettings } from "@/lib/server/marketing-campaigns-repo";
import { marketingMember, readJson, refuse } from "@/lib/server/marketing-guard";

/**
 * GET: the business's sender name, reply-to, colour and footer, daily cap and pause, who its emails are from (its brand
 * kit), and what's set up for sending (yes/no only). PUT (members who may change settings): saves them. PUT `{logoLarge}`, `{forgetLogo}` or `{siteLogos: true}` (members who may publish) change the kept logos:
 * the one in use drawn larger, one forgotten, RENUABL's own added for its own business. PUT `{logoId}`
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
    const logoOnly = ("logoId" in b || "logoLarge" in b || "forgetLogo" in b || "siteLogos" in b) && !("brand" in b);
    const gate = await marketingMember(logoOnly ? "publish" : "prices");
    if ("refuse" in gate) return gate.refuse;
    const biz = gate.member.businessId;
    if (logoOnly) {
      const now = await marketingSettings(biz);
      let brand = now.brand;
      if ("siteLogos" in b) {
        // RENUABL's own logos, read from the site's own files (fixed paths), for its own business only.
        if (!(await isRenuablBusiness(biz))) return refuse("Those logos are RENUABL's own.", 403);
        for (const key of SITE_LOGO_KEYS) {
          if (brand.logos.some((l) => l.site === key)) continue;
          const file = await fetch(new URL(SITE_LOGOS[key].path, request.url)).catch(() => null);
          if (!file?.ok) return refuse("That logo couldn't be read. Try again.", 502);
          const img = await safeImage(new Uint8Array(await file.arrayBuffer()), "logo");
          if ("problem" in img) return refuse(img.problem);
          const id = await saveImage(biz, img, gate.member.email);
          // Added to the kept logos; the one in use stays as it was unless there is none.
          const inUse = brand.logoId;
          brand = withLogo(brand, id, { large: SITE_LOGOS[key].large, site: key });
          if (inUse) brand = { ...brand, logoId: inUse };
        }
      } else if ("forgetLogo" in b) {
        const id = cleanBrand({ logoId: b.forgetLogo }).logoId;
        if (id) brand = withoutLogo(brand, id);
      } else if ("logoLarge" in b) {
        brand = withLogoSize(brand, b.logoLarge === true);
      } else {
        const id = cleanBrand({ logoId: b.logoId }).logoId;
        if (b.logoId !== null && (!id || !(await ownsImage(biz, id)))) return refuse("That picture isn't one of yours.", 400);
        brand = id ? withLogo(brand, id) : { ...brand, logoId: null };
      }
      await saveMarketingSettings(biz, { ...now, brand }, gate.member.email);
      return Response.json({ ok: true, settings: await marketingSettings(biz) });
    }
    const brand = cleanBrand(b.brand);
    if (brand.logoId && !(await ownsImage(biz, brand.logoId))) brand.logoId = null;
    // The kept logos are changed only through the logo's own controls: a save of the settings keeps them as they are.
    brand.logos = cleanLogos((await marketingSettings(biz)).brand.logos, brand.logoId);
    await saveMarketingSettings(biz, { brand, dailyCap: cleanDailyCap(b.dailyCap), paused: b.paused === true }, gate.member.email);
    return Response.json({ ok: true, settings: await marketingSettings(biz) });
  });
}
