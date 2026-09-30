import { normaliseEmail } from "@/lib/domain/accounts";
import { plainText } from "@/lib/domain/emails";
import { HEALTH_ITEMS, cleanAnswers, healthPlan, shareableAnswers, HEALTH_QUESTIONS } from "@/lib/domain/home-health";
import { CONSENT_MISSING, consentRecord, readConsent } from "@/lib/domain/legal";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { dbConfigured } from "@/lib/server/db";
import { saveHealthCheck } from "@/lib/server/home-health-repo";
import { addNote, contactIdByEmail, crmNote } from "@/lib/server/hubspot-crm";
import { jobByReferenceAndEmail } from "@/lib/server/jobs-repo";
import { alertNewLead } from "@/lib/server/lead-alert";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST a Home Health check: { answers, sensitiveConsent, reference?, email?, address?, consent? }.
 * With a reservation (reference + its email) it's saved on the order. Public checks need an
 * email and the Terms/Privacy tick. The plan is worked out here, not taken from the browser, and
 * the allergies answer never goes to HubSpot or staff emails.
 */
export async function POST(request: Request) {
  if (!allow(request, "home-health", 20)) return Response.json({ ok: false, message: "Please try again later." }, { status: 429 });
  if (!dbConfigured()) return Response.json({ ok: false, message: "We couldn't save your plan just now." }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const sensitiveConsent = body.sensitiveConsent === true;
  const answers = cleanAnswers(body.answers, sensitiveConsent);
  const plan = healthPlan(answers);
  const email = normaliseEmail(body.email);
  const reference = typeof body.reference === "string" && /^RN-\d{4,6}$/.test(body.reference) ? body.reference : null;

  let linked: string | null = null;
  if (reference) {
    if (!email || !(await jobByReferenceAndEmail(reference, email))) {
      return Response.json({ ok: false, message: "We couldn't find that reservation." }, { status: 404 });
    }
    linked = reference;
  } else {
    if (!email) return Response.json({ ok: false, message: "Enter a valid email address." }, { status: 422 });
    if (!readConsent(body.consent).accepted) return Response.json({ ok: false, consent: true, message: CONSENT_MISSING }, { status: 422 });
  }
  const address = plainText(body.address, 160) || null;
  const saved = await saveHealthCheck({ reference: linked, email, address, answers, plan, sensitiveConsent });

  const labels = new Map(HEALTH_QUESTIONS.map((q) => [q.id, q]));
  const shareable = shareableAnswers(answers);
  const details: Record<string, string | undefined> = {
    Order: saved.reference ?? "No reservation yet",
    Home: address ?? undefined,
    Recommendations: plan.recommendations.map((r) => HEALTH_ITEMS[r.item]).join(", ") || "None",
    "Free fixes": plan.freeFixes.map((f) => f.title).join(", "),
    "Longer-term": plan.longTerm ? "Staying 10+ years" : undefined,
    Answers: Object.entries(shareable)
      .map(([k, v]) => {
        const q = labels.get(k);
        const pick = (id: string) => q?.options.find((x) => x.id === id)?.label ?? id;
        return `${q?.prompt ?? k} ${Array.isArray(v) ? v.map(pick).join(", ") : pick(v)}`;
      })
      .join(" | "),
    ...(reference
      ? {}
      : {
          Consent: consentRecord({
            kind: "follow-up",
            marketing: readConsent(body.consent).marketing,
            at: new Date(),
            timeZone: LAUNCH_MARKET.timeZone,
          }),
        }),
  };
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  if (token && email) {
    try {
      await addNote(await contactIdByEmail(email, token), crmNote("Home Health check", details), token);
    } catch (e) {
      console.error("home health not saved to HubSpot", e instanceof Error ? e.message : e);
    }
  }
  if (email) await alertNewLead({ kind: "home-health", reference: saved.reference ?? undefined, email, details });
  return Response.json({ ok: true, id: saved.id, plan });
}
