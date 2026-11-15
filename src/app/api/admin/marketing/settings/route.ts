import { cleanBrand } from "@/lib/domain/marketing/edm";
import { cleanDailyCap } from "@/lib/domain/marketing/sequences";
import { siteUrl } from "@/lib/domain/sms";
import { emailProvider } from "@/lib/server/email";
import { marketingSettings, saveMarketingSettings } from "@/lib/server/marketing-campaigns-repo";
import { marketingStaff, readJson, refuse, unauthorised } from "@/lib/server/marketing-staff";

/** GET (staff): the brand, daily cap, pause, and what's set up for sending (yes/no only). PUT: saves them. */
export async function GET() {
  if (!(await marketingStaff())) return unauthorised();
  return Response.json({
    ok: true,
    settings: await marketingSettings(),
    ready: {
      email: Boolean(emailProvider()),
      siteUrl: Boolean(siteUrl()),
      cron: Boolean(process.env.CRON_SECRET?.trim()),
      bounces: Boolean(process.env.SENDGRID_WEBHOOK_PUBLIC_KEY?.trim() || process.env.RESEND_WEBHOOK_SECRET?.trim()),
    },
  });
}

export async function PUT(request: Request) {
  const staff = await marketingStaff();
  if (!staff) return unauthorised();
  const b = await readJson(request);
  if (!b) return refuse("Bad request", 400);
  await saveMarketingSettings({ brand: cleanBrand(b.brand), dailyCap: cleanDailyCap(b.dailyCap), paused: b.paused === true }, staff.email);
  return Response.json({ ok: true, settings: await marketingSettings() });
}
