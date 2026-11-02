import { certificateProblem, cleanOutcome, looksLike, outcomeEmail } from "@/lib/domain/design/inspections";
import { siteUrl } from "@/lib/domain/sms";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { declineInspection, inspectionCard, recordOutcome } from "@/lib/server/design-inspections-repo";
import { emailProvider, sendEmail } from "@/lib/server/email";
import { allow } from "@/lib/server/rate-limit";

const closed = () => Response.json({ ok: false, message: "This inspection isn't open to you any more." }, { status: 404 });

/** GET → { card, inspection }: the job read only (never the customer's email) for the inspector it was nominated to. */
export async function GET(_request: Request, ctx: RouteContext<"/api/design/inspections/[id]">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const got = await inspectionCard(who.member.businessId, id.slice(0, 60));
    return got ? Response.json({ ok: true, ...got }) : closed();
  });
}

/**
 * POST a form (state, on, notes, certificate) to record where the inspection stands; or JSON { do: "decline" }. The
 * installer and whoever sent the job are emailed the outcome when email is set up.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/inspections/[id]">) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "inspection", 60)) return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const { id: raw } = await ctx.params;
    const id = raw.slice(0, 60);
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const read = await readBody(request, 500);
      if ("refuse" in read) return read.refuse;
      if (read.body.do !== "decline") return Response.json({ ok: false, message: "That couldn't be read." }, { status: 400 });
      return (await declineInspection(who.member, id))
        ? Response.json({ ok: true })
        : Response.json({ ok: false, message: "Only a nomination not yet booked can be declined." }, { status: 409 });
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ ok: false, message: "That couldn't be read." }, { status: 400 });
    }
    const outcome = cleanOutcome({ state: form.get("state"), on: form.get("on"), notes: form.get("notes") });
    if (!outcome.ok) return Response.json(outcome, { status: 422 });
    const file = form.get("certificate");
    let certificate: { name: string; type: string; bytes: Buffer } | null = null;
    if (file && typeof file === "object" && "arrayBuffer" in file && file.size > 0) {
      const problem = certificateProblem({ type: file.type, size: file.size });
      if (problem) return Response.json({ ok: false, message: problem }, { status: 422 });
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!looksLike(file.type.toLowerCase(), bytes))
        return Response.json({ ok: false, message: "That file isn't the PDF or photo it says it is." }, { status: 422 });
      const name = (file.name || "certificate").replace(/[^\w. -]/g, "").slice(0, 80) || "certificate";
      certificate = { name, type: file.type.toLowerCase(), bytes };
    }
    const done = await recordOutcome(who.member, id, outcome, certificate);
    if (!done.ok) return Response.json({ ok: false, message: done.message }, { status: done.status });
    const site = siteUrl();
    if (site && emailProvider())
      for (const to of done.tell)
        await sendEmail({
          to,
          ...outcomeEmail({
            inspector: who.member.businessName,
            outcome: outcome.state,
            suburb: done.suburb,
            on: outcome.on,
            link: `${site}/design`,
          }),
        }).catch((e) => console.error("inspection email failed", e instanceof Error ? e.message : e));
    const got = await inspectionCard(who.member.businessId, id);
    return got ? Response.json({ ok: true, ...got }) : closed();
  });
}
