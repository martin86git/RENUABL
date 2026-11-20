/**
 * Server only. Codes for the plan (domain/design/plan-codes.ts) as Stripe promotion codes: RENUABL's staff make them on
 * /admin (a coupon of 100% off for some months or for good, and its code), a new business types one at sign-up, and
 * Stripe's checkout takes it off the bills. Stripe is the only record of them: nothing is kept here.
 */
import type Stripe from "stripe";
import { codeWords, lengthWords, type CodeCoupon, type CodeLength } from "@/lib/domain/design/plan-codes";

/** What a code found in Stripe gives. */
export interface FoundCode {
  /** Stripe's id for the promotion code, for checkout. */
  id: string;
  code: string;
  coupon: CodeCoupon;
  words: string;
}

const couponOf = (c: Stripe.Coupon): CodeCoupon => ({
  percentOff: c.percent_off ?? null,
  duration: c.duration === "forever" ? "forever" : c.duration === "repeating" ? "repeating" : "once",
  months: c.duration_in_months ?? null,
});

/** A live code by what was typed: active, its coupon still valid and a share off (never an amount, which is off a whole bill). */
export async function findPlanCode(stripe: Stripe, code: string): Promise<FoundCode | null> {
  const list = await stripe.promotionCodes.list({ code, active: true, limit: 1, expand: ["data.promotion.coupon"] });
  const promo = list.data[0];
  const coupon = promo?.promotion?.coupon;
  if (!promo || !coupon || typeof coupon === "string" || !coupon.valid || !coupon.percent_off) return null;
  if (promo.max_redemptions !== null && promo.times_redeemed >= promo.max_redemptions) return null;
  if (promo.expires_at && promo.expires_at * 1000 < Date.now()) return null;
  const facts = couponOf(coupon);
  return { id: promo.id, code: promo.code, coupon: facts, words: codeWords(facts) };
}

/** A code staff make: its own coupon of 100% off for the length chosen. */
export async function makePlanCode(stripe: Stripe, o: { code: string; length: CodeLength; uses: number | null; by: string }) {
  const coupon = await stripe.coupons.create({
    percent_off: 100,
    ...(o.length === "forever"
      ? { duration: "forever" as const }
      : o.length.months === 1
        ? { duration: "once" as const }
        : { duration: "repeating" as const, duration_in_months: o.length.months }),
    name: lengthWords(o.length),
    metadata: { kind: "renuabl-plan-code", by: o.by },
  });
  return stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: o.code,
    ...(o.uses ? { max_redemptions: o.uses } : {}),
    metadata: { kind: "renuabl-plan-code", by: o.by },
  });
}

export interface PlanCodeLine {
  id: string;
  code: string;
  words: string;
  used: number;
  uses: number | null;
  by: string | null;
}

/** The live codes staff made, newest first. */
export async function listPlanCodes(stripe: Stripe): Promise<PlanCodeLine[]> {
  const list = await stripe.promotionCodes.list({ active: true, limit: 100, expand: ["data.promotion.coupon"] });
  return list.data
    .filter((p) => p.metadata?.kind === "renuabl-plan-code")
    .map((p) => {
      const c = p.promotion?.coupon;
      return {
        id: p.id,
        code: p.code,
        words: c && typeof c !== "string" ? codeWords(couponOf(c)) : "",
        used: p.times_redeemed,
        uses: p.max_redemptions,
        by: p.metadata?.by ?? null,
      };
    });
}

/** A code stopped: no one new can use it; plans that already have it keep it. */
export async function stopPlanCode(stripe: Stripe, id: string): Promise<void> {
  await stripe.promotionCodes.update(id, { active: false });
}
