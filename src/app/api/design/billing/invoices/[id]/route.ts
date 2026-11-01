import { EMPTY_BILLING, taxInvoice } from "@/lib/domain/design/billing-invoice";
import { answer, requireMember } from "@/lib/server/design-context";
import { billingDetailsOf, subscriptionOf } from "@/lib/server/design-billing-repo";
import { stripeClient } from "@/lib/server/stripe";
import { invoiceOf } from "@/lib/server/stripe-billing";
import { taxInvoicePdf } from "@/lib/server/tax-invoice-pdf";

/**
 * GET: one of the business's invoices from RENUABL as a tax invoice PDF. The owner only, and only an invoice on the
 * business's own Stripe customer: any other id answers as if it weren't there.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/billing/invoices/[id]">) {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const stripe = stripeClient();
    const plan = await subscriptionOf(who.member.businessId);
    const found = stripe && plan?.stripeCustomer && /^in_[A-Za-z0-9]+$/.test(id) ? await invoiceOf(stripe, plan.stripeCustomer, id) : null;
    if (!found) return Response.json({ ok: false, message: "That invoice isn't here." }, { status: 404 });
    const details = (await billingDetailsOf(who.member.businessId)) ?? { ...EMPTY_BILLING, legalName: who.member.businessName };
    const pdf = await taxInvoicePdf(taxInvoice(found, details));
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="RENUABL tax invoice ${(found.number ?? found.id).replace(/[^A-Za-z0-9-]/g, "")}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  });
}
