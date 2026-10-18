import { cleanInvoiceFigures } from "@/lib/domain/design/installer-invoices";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { addInvoice, invoicesView, workOutAgain } from "@/lib/server/design-after-sale-repo";

const validJob = (id: unknown): id is string => typeof id === "string" && /^job_[a-f0-9]{8,64}$/.test(id);

/** GET: Installer Invoices: every signed job's installation allowance against what was billed, and the invoices waiting for a job. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("costs");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, ...(await invoicesView(who.member.businessId)) });
  });
}

/**
 * POST { jobId | null, figures, fileName }: keeps an installer's invoice as
 * checked by the business (the figures only; no file is kept).
 * POST { jobId, again: true }: works the job's allowance out again from the
 * version the customer signed.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("costs");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 30_000);
    if ("refuse" in read) return read.refuse;
    const b = read.body;
    if (b.again === true) {
      if (!validJob(b.jobId)) return Response.json({ ok: false, message: "There's no such job." }, { status: 404 });
      const cost = await workOutAgain(who.member.businessId, b.jobId);
      return cost
        ? Response.json({ ok: true, cost })
        : Response.json({ ok: false, message: "That job has no signed proposal." }, { status: 409 });
    }
    const figures = cleanInvoiceFigures(b.figures);
    if (!figures)
      return Response.json({ ok: false, message: "Add the invoice's total (ex GST, or with its GST) to keep it." }, { status: 422 });
    const jobId = b.jobId === null || b.jobId === undefined ? null : validJob(b.jobId) ? b.jobId : undefined;
    if (jobId === undefined) return Response.json({ ok: false, message: "There's no such job." }, { status: 404 });
    const fileName = typeof b.fileName === "string" ? b.fileName.slice(0, 120) : "";
    const saved = await addInvoice(who.member.businessId, jobId, { ...figures, fileName }, who.member.email);
    if (saved === "missing") return Response.json({ ok: false, message: "There's no such job." }, { status: 404 });
    return Response.json({ ok: true, invoice: saved });
  });
}
