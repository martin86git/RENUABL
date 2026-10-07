import { connection } from "next/server";
import { googleAdsConfig } from "@/lib/domain/google-ads";
import { metaPixelId } from "@/lib/domain/meta-pixel";
import { siteUrl, staffMobiles } from "@/lib/domain/sms";
import { stripeKeyMode } from "@/lib/domain/status";
import { stripeClient } from "@/lib/server/stripe";
import { dbConfigured } from "@/lib/server/db";
import { emailProvider } from "@/lib/server/email";
import { smsConfigured } from "@/lib/server/sms";
import { storageConfigured } from "@/lib/server/storage";

const set = (v: string | undefined) => Boolean(v?.trim());

/**
 * GET: which services this deployment is connected to, and whether Stripe
 * accepts its key. Only yes/no answers: never a key, an account id or an error body.
 */
export async function GET() {
  await connection();
  const mode = stripeKeyMode(process.env.STRIPE_SECRET_KEY);
  const gads = googleAdsConfig(process.env);
  let stripeWorks: boolean | null = null;
  const stripe = mode === "test" || mode === "live" ? stripeClient() : null;
  if (stripe) {
    try {
      await stripe.balance.retrieve();
      stripeWorks = true;
    } catch {
      stripeWorks = false;
    }
  }
  return Response.json(
    {
      stripe: { key: mode, accepted: stripeWorks, webhookSecret: set(process.env.STRIPE_WEBHOOK_SECRET) },
      hubspot: set(process.env.HUBSPOT_PRIVATE_APP_TOKEN),
      email: emailProvider() !== null,
      // Which service sends, and which part is missing when email is false.
      emailSetup: {
        provider: emailProvider(),
        sendgridKey: set(process.env.SENDGRID_API_KEY),
        resendKey: set(process.env.RESEND_API_KEY),
        emailFrom: set(process.env.EMAIL_FROM),
      },
      storage: storageConfigured(),
      database: dbConfigured(),
      staff: set(process.env.ADMIN_EMAILS),
      siteUrl: Boolean(siteUrl()),
      google: set(process.env.GOOGLE_MAPS_API_KEY),
      claude: set(process.env.ANTHROPIC_API_KEY),
      sms: smsConfigured(),
      // Staff mobiles texted about new leads to call now.
      leadTexts: staffMobiles(process.env.LEAD_ALERT_MOBILES || process.env.ALERT_MOBILES).length > 0,
      // Browser tags (public IDs): which are set, so missing ones are easy to spot.
      metaPixel: Boolean(metaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID)),
      googleAds: {
        tag: Boolean(gads.id),
        reservation: Boolean(gads.labels.reservation),
        call: Boolean(gads.labels.call),
        followUp: Boolean(gads.labels["follow-up"]),
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
