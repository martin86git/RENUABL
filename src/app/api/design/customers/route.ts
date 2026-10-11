import { CUSTOMERS_FULL, cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { createCustomer, listCustomers } from "@/lib/server/design-crm-repo";

/**
 * GET: the business's customers, whoever something last happened with first,
 * each with how many jobs they have and the one stage to show beside them.
 * The first time a business asks, its five sample customers are added.
 */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, customers: await listCustomers(who.member.businessId) });
  });
}

/**
 * POST { firstName, lastName (or name), phone, email, address, lat, lng,
 * source, notes, deal? }: a new customer, checked first. With an address,
 * their first job is made for it (a lead called "Solar") and answered as
 * `job`; without one, or with `deal: false`, `job` is null.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    const customer = cleanCustomerInput(read.body);
    if (!customer.ok) return Response.json({ ok: false, message: customer.message }, { status: 422 });
    const { address, lat, lng } = customer.value;
    // `deal: false` adds the customer alone: the screen then asks whether to start a deal for them.
    const job = address && read.body.deal !== false ? cleanJobInput({ address, lat, lng }) : null;
    const made = await createCustomer(who.member.businessId, customer.value, job?.ok ? job.value : null, who.member.email);
    if (made === "full") return Response.json({ ok: false, message: CUSTOMERS_FULL }, { status: 422 });
    return Response.json({ ok: true, customer: made.customer, job: made.job });
  });
}
