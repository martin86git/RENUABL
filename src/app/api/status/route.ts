import { connection } from "next/server";
import { siteUrl } from "@/lib/domain/sms";
import { stripeKeyMode } from "@/lib/domain/status";
import { stripeClient } from "@/lib/server/stripe";
import { dbConfigured } from "@/lib/server/db";
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
      email: set(process.env.RESEND_API_KEY) && set(process.env.EMAIL_FROM),
      // Which half is missing when email is false.
      emailSetup: { resendKey: set(process.env.RESEND_API_KEY), emailFrom: set(process.env.EMAIL_FROM) },
      storage: storageConfigured(),
      database: dbConfigured(),
      staff: set(process.env.ADMIN_EMAILS),
      siteUrl: Boolean(siteUrl()),
      google: set(process.env.GOOGLE_MAPS_API_KEY),
      claude: set(process.env.ANTHROPIC_API_KEY),
      sms: smsConfigured(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
