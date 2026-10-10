import { JOBS_FULL, cleanJobInput } from "@/lib/domain/design/crm";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { createJob, customerById, listJobs } from "@/lib/server/design-crm-repo";

/** GET: every job the business has, the most recently changed first, each with its customer's name. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, jobs: await listJobs(who.member.businessId) });
  });
}

/**
 * POST { customerId, title, address, lat, lng }: a new job for one of the
 * business's customers. It starts as a lead; a job sent without an address
 * takes the customer's. If the business has already drawn the roof at that
 * place, the job is joined to that design and starts at "designed".
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 20_000);
    if ("refuse" in read) return read.refuse;
    const { customerId, title, address, lat, lng } = read.body;
    const missing = () => Response.json({ ok: false, message: "That customer isn't here." }, { status: 404 });
    const customer =
      typeof customerId === "string" && /^cus_[a-f0-9]{8,64}$/.test(customerId)
        ? await customerById(who.member.businessId, customerId)
        : null;
    if (!customer) return missing();
    const own = typeof address === "string" && address.trim() !== "";
    const input = cleanJobInput(
      own ? { title, address, lat, lng } : { title, address: customer.address, lat: customer.lat, lng: customer.lng },
    );
    if (!input.ok) return Response.json({ ok: false, message: input.message }, { status: 422 });
    const job = await createJob(who.member.businessId, customer.id, input.value, who.member.email);
    if (job === "missing") return missing();
    if (job === "full") return Response.json({ ok: false, message: JOBS_FULL }, { status: 422 });
    return Response.json({ ok: true, job });
  });
}
