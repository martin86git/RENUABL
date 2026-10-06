/**
 * Text messages to partners and customers: short, plain, with one link.
 * Links are built on the server from the site's own address, never from the
 * request. No prices or personal details beyond a first name and suburb.
 */
import { normaliseMobile } from "./contact";
import { plainText } from "./emails";

/** One SMS segment is 160 characters; keep messages to two at most. */
export const SMS_MAX = 306;

const firstName = (name: string) => plainText(name, 40).split(" ")[0] ?? "";
const clip = (s: string) => (s.length > SMS_MAX ? `${s.slice(0, SMS_MAX - 1)}…` : s);

export function newOfferSms(o: { suburb: string; system: string; hours: number; link: string }) {
  return clip(
    `RENUABL: new job offer in ${plainText(o.suburb, 40)} (${plainText(o.system, 60)}). Accept within ${o.hours} hours: ${o.link}`,
  );
}

export function customerMessageSms(o: { customer: string; reference: string; link: string }) {
  return clip(`RENUABL: ${firstName(o.customer)} sent a message about ${plainText(o.reference, 20)}. Reply: ${o.link}`);
}

export function variationSentSms(o: { customer: string; link: string }) {
  return clip(
    `RENUABL: Hi ${firstName(o.customer)}, your installation partner found extra work your home needs. Take a look and approve or decline: ${o.link}`,
  );
}

export function variationDecidedSms(o: { reference: string; approved: boolean; link: string }) {
  return clip(
    `RENUABL: the customer ${o.approved ? "approved" : "declined"} the variation on ${plainText(o.reference, 20)}. ${o.approved ? "Go ahead with the work." : "Don't do the extra work."} ${o.link}`,
  );
}

export function layoutReadySms(o: { customer: string; link: string }) {
  return clip(`RENUABL: Hi ${firstName(o.customer)}, your panel layout is ready. See where your panels will go: ${o.link}`);
}

export function complianceReminderSms(o: { label: string; days: number; link: string }) {
  const when = o.days <= 0 ? "expires today" : o.days === 1 ? "expires tomorrow" : `expires in ${o.days} days`;
  return clip(`RENUABL: your ${o.label.toLowerCase()} ${when}. Upload the new one so job offers keep coming: ${o.link}`);
}

/**
 * To someone who left their mobile at the start of their plan: straight away, so
 * they know it's real and who's calling. One link (book a time), "Reply STOP".
 */
export function startedPlanSms(o: { link: string }) {
  return clip(
    `RENUABL: thanks for starting your solar and battery plan. Someone from our team will call you soon to help. Prefer a set time? Book a 15-minute call: ${o.link} Reply STOP to opt out.`,
  );
}

/** To staff (LEAD_ALERT_MOBILES): a new lead to contact now (their mobile, else email). Suburb only, plus how they came in. */
export function newLeadStaffSms(o: { contact: string; suburb?: string; entry?: string }) {
  const where = o.suburb ? ` in ${plainText(o.suburb, 40)}` : "";
  const via = o.entry ? ` (${plainText(o.entry, 40)})` : "";
  return clip(
    `RENUABL lead${where}${via}: ${o.contact.replace(/[^\w.+@-]/g, "").slice(0, 80)} just started a plan. Get in touch now while it's fresh.`,
  );
}

/** Staff mobiles for lead texts: LEAD_ALERT_MOBILES, comma-separated Australian mobiles (none by default). */
export function staffMobiles(raw: string | undefined): string[] {
  const list = (raw ?? "").split(",").map((s) => normaliseMobile(s.trim()));
  return [...new Set(list.filter((m): m is string => Boolean(m)))];
}

/** The site's own address for links: SITE_URL, else Vercel's production domain. */
export function siteUrl(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.SITE_URL?.trim() || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL.trim()}` : "");
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.hostname === "localhost" ? u.origin : null;
  } catch {
    return null;
  }
}
