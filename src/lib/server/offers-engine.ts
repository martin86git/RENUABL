/**
 * Server only. Offers each new job to the best partner, re-offers it when an
 * offer is declined or runs out, and tells the partner by email and text.
 * Runs when a job is reserved, whenever the portal or staff pages load, and
 * from a daily cron (/api/cron/offers), so lapsed offers move on promptly.
 */
import { jobOfferEmail } from "@/lib/domain/emails";
import { formatDate } from "@/lib/domain/format";
import { todayInMarket } from "@/lib/domain/market";
import { OFFER_HOURS, offerExpiry, rankPartners } from "@/lib/domain/offers";
import { newOfferSms, siteUrl } from "@/lib/domain/sms";
import { sendEmail } from "./email";
import { createOffer, expireOffers, getJobRow, partnersOffered, setJobStatus, unassignedJobIds } from "./jobs-repo";
import { getPartner, offerablePartners } from "./partners-repo";
import { sendSms } from "./sms";

/** Offers the job to the next partner in line; unassigned (for staff to place) when nobody can take it. */
export async function offerNext(jobId: string, now = new Date()): Promise<string | null> {
  const job = await getJobRow(jobId);
  if (!job || (job.status !== "unassigned" && job.status !== "offered")) return null;
  const ranked = rankPartners(
    { lat: job.address.lat, lng: job.address.lng, state: job.address.state },
    await offerablePartners(),
    await partnersOffered(jobId),
    todayInMarket(now),
  );
  const next = ranked[0]?.partner;
  if (!next) {
    await setJobStatus(jobId, "unassigned");
    return null;
  }
  try {
    await createOffer(jobId, next.id, offerExpiry(now));
  } catch {
    // Another request offered it first (one open offer per job).
    return null;
  }
  await notifyOffer(next.id, job);
  return next.id;
}

async function notifyOffer(partnerId: string, job: NonNullable<Awaited<ReturnType<typeof getJobRow>>>) {
  const partner = await getPartner(partnerId);
  const site = siteUrl();
  if (!partner || !site) return;
  const link = `${site}/installer/jobs/${job.id}`;
  const system = job.packageName;
  const date = job.installDate ? formatDate(job.installDate, { weekday: "short", day: "numeric", month: "short" }) : null;
  try {
    await sendEmail({
      to: partner.email,
      ...jobOfferEmail({ suburb: job.address.suburb, system, installDate: date, link, hours: OFFER_HOURS }),
    });
  } catch (e) {
    console.error("offer email failed", job.reference, e instanceof Error ? e.message : e);
  }
  if (partner.mobile) await sendSms(partner.mobile, newOfferSms({ suburb: job.address.suburb, system, hours: OFFER_HOURS, link }));
}

/** Moves lapsed offers on, and tries again for jobs nobody could take. Safe to run often. */
export async function processOffers(now = new Date()) {
  const expired = await expireOffers();
  const waiting = await unassignedJobIds();
  let offered = 0;
  for (const id of new Set([...expired, ...waiting])) if (await offerNext(id, now)) offered++;
  return { expired: expired.length, offered };
}

/** Lazily, at most once a minute per server, so page loads stay quick. */
let lastRun = 0;
export async function processOffersSoon() {
  if (Date.now() - lastRun < 60_000) return;
  lastRun = Date.now();
  try {
    await processOffers();
  } catch (e) {
    console.error("processing offers failed", e instanceof Error ? e.message : e);
  }
}
