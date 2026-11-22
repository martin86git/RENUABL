import { can } from "@/lib/domain/design/account";
import {
  ADD_ON_MONTHLY_CENTS,
  ADD_ON_WORDS,
  ADD_REFUSAL_WORDS,
  addOnAction,
  addOnRequestNote,
  addRefusal,
  cleanAddOnKey,
  hasNotice,
} from "@/lib/domain/design/add-ons";
import { cleanKind } from "@/lib/domain/design/business-kind";
import { buyNumber, numberBuyingOn, numberOf } from "@/lib/server/business-numbers";
import {
  addOnsOf,
  addToSubscription,
  giveNotice,
  removeFromSubscription,
  requestAddOn,
  standingOf,
  withdrawNotice,
} from "@/lib/server/design-addons";
import { subscriptionOf } from "@/lib/server/design-billing-repo";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { tellStaff } from "@/lib/server/design-staff-note";
import { allow } from "@/lib/server/rate-limit";
import { stripeClient } from "@/lib/server/stripe";
import { voiceStandingFor } from "@/lib/server/voice-calls";
import { cleanCap } from "@/lib/domain/design/voice-usage";
import { capOf, setCap, usageOf } from "@/lib/server/design-voice-usage";

const PRIVATE = { "cache-control": "private, no-store" };

/**
 * GET → the business's add-ons (domain/design/add-ons.ts): each with where it stands and its price ("Price on request"
 * while unpriced), the business's own number, whether calls are on (and why not), whether a number can be bought from
 * the app, and whether this member may add one (the owner). Any member may read it: it decides what each feature shows.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { businessId, role, permissions } = who.member;
    const [addOns, number, voice, plan, usage, cap] = await Promise.all([
      addOnsOf(businessId),
      numberOf(businessId).catch(() => null),
      voiceStandingFor(businessId).catch(() => "not-set-up" as const),
      subscriptionOf(businessId).catch(() => null),
      usageOf(businessId).catch(() => ({ minutes: 0, texts: 0 })),
      capOf(businessId).catch(() => null),
    ]);
    return Response.json(
      {
        ok: true,
        addOns,
        number: number ? { e164: number.e164, renuabl: number.renuabl } : null,
        voice,
        canBuyNumber: numberBuyingOn(),
        // The plan's next bill day, so an offer can say when an add-on is first billed.
        nextBill: plan && plan.interval !== "year" && !["canceled", "incomplete_expired"].includes(plan.status) ? plan.periodEnd : null,
        mayAdd: can(role, "members", permissions) && cleanKind(who.member.businessKind) === "retailer",
        // This month's minutes and texts, and the spending cap in cents (voice-usage.ts).
        usage,
        capCents: cap,
      },
      { headers: PRIVATE },
    );
  });
}

const NUMBER_WORDS = {
  off: "Your number is being set up by RENUABL. We've been told, and will email you as soon as it's ready.",
  already: "Your business already has its number.",
  "none-available": "No Australian number is free to buy right now. Try again shortly.",
  failed: "The number couldn't be set up just now. Nothing was charged for it. Try again shortly.",
} as const;

/**
 * The business's own number, bought there and then where buying is on; where it isn't, RENUABL's staff are told so they
 * set one up by hand. Run when Get my business number is pressed, and by itself as soon as Calls & Texts goes on a plan
 * (21 Nov 2026, Martin: adding the add-on "doesnt present me with the opportunity to purchase a number").
 */
async function getNumber(businessId: string, email: string, businessName: string) {
  const bought = await buyNumber(businessId, email, businessName).catch(() => ({ result: "failed" as const }));
  if (bought.result === "off")
    await tellStaff({
      subject: `Phone number wanted: ${businessName}`,
      text: `${businessName} (${email}) has Calls & Texts on its plan and needs its business number, but buying numbers from the app is off (PHONE_NUMBERS_ENABLED). Set one up in /admin → Add-ons, then tell them.`,
    }).catch(() => false);
  return bought;
}

/**
 * POST { do: "add", key } → a priced add-on put on the plan's Stripe subscription now, an unpriced one asked for (kept,
 * RENUABL's staff told); { do: "remove", key } → cancelled: Calls & Texts with 30 days' notice (on and billed until then,
 * then off the plan and the number released by the daily cron), anything else at once; { do: "keep", key } → a cancel
 * withdrawn while its notice runs; { do: "number" } →
 * the business's own phone number bought (voice add-on on, buying switched on). The owner only.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    if (!allow(request, "design-addons", 20))
      return Response.json({ ok: false, message: "Too many tries. Wait a little." }, { status: 429 });
    const { businessId, email, businessName } = who.member;
    const retailer = cleanKind(who.member.businessKind) === "retailer";

    // The spending cap on minutes and texts beyond the free allowance, in whole dollars.
    if (read.body.do === "cap") {
      const cents = cleanCap(read.body.dollars);
      if (cents === null) return Response.json({ ok: false, message: "Type a cap in whole dollars, up to $5,000." }, { status: 422 });
      await setCap(businessId, cents);
      return Response.json({ ok: true, capCents: cents });
    }

    if (read.body.do === "number") {
      if ((await standingOf(businessId, "voice")) !== "on")
        return Response.json({ ok: false, message: "Add voice agents to your plan first." }, { status: 409 });
      const bought = await getNumber(businessId, email, businessName);
      if (bought.result === "bought") return Response.json({ ok: true, number: bought.e164 });
      // Asked for by hand is not a failure: the business is told where it stands.
      if (bought.result === "off") return Response.json({ ok: true, numberPending: true, message: NUMBER_WORDS.off });
      return Response.json({ ok: false, message: NUMBER_WORDS[bought.result] }, { status: bought.result === "already" ? 409 : 503 });
    }

    const key = cleanAddOnKey(read.body.key);
    if (!key) return Response.json({ ok: false, message: "Pick an add-on." }, { status: 422 });

    if (read.body.do === "remove") {
      const standing = await standingOf(businessId, key);
      if (standing === "ending") return Response.json({ ok: true, already: true });
      if (standing !== "on" && standing !== "requested")
        return Response.json({ ok: false, message: "It isn't on your plan." }, { status: 409 });
      // Calls & Texts carries 30 days' notice: it stays on, and billed, until then (add-ons.ts CANCEL_NOTICE_DAYS).
      if (standing === "on" && hasNotice(key)) {
        const endsAt = await giveNotice(businessId, key, email);
        return Response.json({ ok: true, endsAt });
      }
      await removeFromSubscription(stripeClient(), businessId, key);
      return Response.json({ ok: true });
    }

    // Changed their mind while the notice runs.
    if (read.body.do === "keep") {
      if ((await standingOf(businessId, key)) !== "ending")
        return Response.json({ ok: false, message: "It isn't cancelled." }, { status: 409 });
      await withdrawNotice(businessId, key);
      return Response.json({ ok: true });
    }

    if (read.body.do !== "add") return Response.json({ ok: false, message: "Unknown request." }, { status: 400 });
    const cents = ADD_ON_MONTHLY_CENTS[key];
    const plan = await subscriptionOf(businessId);
    const live = plan && !["canceled", "incomplete_expired"].includes(plan.status);
    const refusal = addRefusal({
      owner: true,
      retailer,
      plan: !live ? "none" : plan.interval === "year" ? "yearly" : "monthly",
      cents,
    });
    if (refusal) return Response.json({ ok: false, message: ADD_REFUSAL_WORDS[refusal] }, { status: 409 });
    const action = addOnAction(await standingOf(businessId, key), cents);
    if (action === "none") return Response.json({ ok: true, already: true });

    if (action === "request") {
      const asked = await requestAddOn(businessId, key, email);
      if (asked)
        await tellStaff({
          subject: `Add-on asked for: ${ADD_ON_WORDS[key].name} · ${businessName}`,
          text: addOnRequestNote({ key, business: businessName, by: email }),
        }).catch(() => false);
      return Response.json({ ok: true, requested: true });
    }

    const stripe = stripeClient();
    if (!stripe || !plan?.stripeSubscription)
      return Response.json({ ok: false, message: "Payments aren't set up just now. Try again shortly." }, { status: 503 });
    const added = await addToSubscription(stripe, { businessId, key, subscriptionId: plan.stripeSubscription, by: email });
    if (added === "ended") return Response.json({ ok: false, message: ADD_REFUSAL_WORDS["no-plan"] }, { status: 409 });
    if (added === "unpriced") return Response.json({ ok: false, message: "It has no price yet." }, { status: 409 });
    // Calls & Texts is no use without the number, so it is asked for at once.
    if (key === "voice") {
      const bought = await getNumber(businessId, email, businessName);
      if (bought.result === "bought") return Response.json({ ok: true, number: bought.e164 });
      if (bought.result !== "already") return Response.json({ ok: true, numberPending: true, message: NUMBER_WORDS[bought.result] });
    }
    return Response.json({ ok: true });
  });
}
