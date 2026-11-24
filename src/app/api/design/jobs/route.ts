import { JOBS_FULL, cleanJobInput } from "@/lib/domain/design/crm";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { createJob, customerById, listJobs, setJobOwner } from "@/lib/server/design-crm-repo";
import { mayOwnDeals } from "@/lib/server/design-repo";

/** GET: every job the business has, the most recently changed first, each with its customer's name. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, jobs: await listJobs(who.member.businessId, viewerOf(who.member)) });
  });
}

/**
 * POST { customerId, title, address, lat, lng, owner? }: a new job for one of the
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
    const { customerId, title, address, lat, lng, owner } = read.body;
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
    const job = await createJob(
      who.member.businessId,
      customer.id,
      input.value,
      who.member.email,
      typeof owner === "string" ? owner : null,
    );
    if (job === "missing") return missing();
    if (job === "full") return Response.json({ ok: false, message: JOBS_FULL }, { status: 422 });
    return Response.json({ ok: true, job });
  });
}

/**
 * PUT { ids, owner }: many deals given to one person at once (24 Nov 2026, Martin: historical deals given to their
 * salesperson), a member or someone kept to own deals without an invite, or to no one (null). Only deals this member may
 * see; each change is written on its deal's record. Answers how many changed.
 */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 60_000);
    if ("refuse" in read) return read.refuse;
    const biz = who.member.businessId;
    const owner = typeof read.body.owner === "string" && read.body.owner.trim() ? read.body.owner.trim().toLowerCase() : null;
    if (owner && !(await mayOwnDeals(biz, owner)))
      return Response.json({ ok: false, message: "That person isn't in your business." }, { status: 422 });
    const asked = new Set((Array.isArray(read.body.ids) ? read.body.ids : []).filter((id): id is string => typeof id === "string"));
    if (!asked.size || asked.size > 1_000) return Response.json({ ok: false, message: "Pick up to 1,000 deals." }, { status: 400 });
    const mine = (await listJobs(biz, viewerOf(who.member))).filter((j) => asked.has(j.id) && (j.owner ?? null) !== owner);
    for (const job of mine) await setJobOwner(biz, job.id, owner, who.member.email);
    return Response.json({ ok: true, changed: mine.length });
  });
}
