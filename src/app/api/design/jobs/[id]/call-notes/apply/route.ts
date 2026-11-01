import { cleanJobInput } from "@/lib/domain/design/crm";
import { typedFields } from "@/lib/domain/design/deal-sections";
import { MAX_REMIND_DAYS, callReminder, cleanCallDetails, cleanEdit, remindAt } from "@/lib/domain/design/prepared";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { loadPrefs } from "@/lib/server/design-after-sale-repo";
import { addActivity, jobById, updateJob } from "@/lib/server/design-crm-repo";
import { addRecap } from "@/lib/server/design-prepared";
import { loadBrand } from "@/lib/server/design-proposal-repo";
import { newSolId, withSol } from "@/lib/server/design-sol-repo";

const fail = (message: string, status: number) => Response.json({ ok: false, message }, { status });

/**
 * POST { text, details?, remindDays?, nextStep?, recap? }: a call's write-up applied in one press (1 Nov 2026,
 * Martin: Sol takes the admin after a call). The notes go on the deal as a call; the system fields the member ticked
 * fill in the deal's details (`cleanCallDetails`: only the call's own fields); a reminder to follow up is set in the
 * member's own conversation with Sol; and the recap email Sol drafted waits in Ready for you, to be checked and sent.
 * Nothing is sent to the customer here.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/call-notes/apply">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const found = await jobById(who.member.businessId, id, viewerOf(who.member));
    if (!found) return fail("There's no such deal.", 404);
    const read = await readBody(request, 40_000);
    if ("refuse" in read) return read.refuse;
    const text = typeof read.body.text === "string" ? read.body.text.trim().slice(0, 4_000) : "";
    if (!text) return fail("The notes are empty: write something before adding them.", 422);

    const businessId = who.member.businessId;
    const done: string[] = [];
    const note = await addActivity(businessId, found.customer.id, { kind: "call", text, jobId: id }, who.member.email);
    if (typeof note === "string") return fail("The notes couldn't be added to this deal.", 404);
    done.push("Notes added as a call");

    const details = cleanCallDetails(read.body.details);
    const keys = Object.keys(details);
    if (keys.length) {
      const fields = typedFields((await loadPrefs(businessId)).dealFields);
      const job = await updateJob(
        businessId,
        id,
        (current) => cleanJobInput({ details: { ...current.details, ...details } }, current, fields),
        who.member.email,
      );
      if (job && !("refused" in job)) done.push(`${keys.length} ${keys.length === 1 ? "field" : "fields"} filled in`);
    }

    const days = typeof read.body.remindDays === "number" ? Math.round(read.body.remindDays) : 0;
    if (days > 0 && days <= MAX_REMIND_DAYS) {
      const nextStep = typeof read.body.nextStep === "string" ? read.body.nextStep.trim().slice(0, 200) : "";
      const at = new Date().toISOString();
      await withSol(businessId, who.member.email, (row) => ({
        ...row,
        reminders: [
          ...row.reminders,
          { id: newSolId(), what: callReminder(found.customer.name, nextStep), createdAt: at, dueAt: remindAt(days) },
        ],
      }));
      done.push(days === 1 ? "Reminder set for tomorrow" : `Reminder set in ${days} working days`);
    }

    const recap = cleanEdit(read.body.recap);
    if (recap) {
      const brand = await loadBrand(businessId, who.member.businessName);
      await addRecap(businessId, {
        jobId: id,
        customerId: found.customer.id,
        customer: found.customer.name,
        title: found.job.title,
        to: found.customer.email ?? "",
        business: brand.name || who.member.businessName,
        ...recap,
      });
      done.push("Recap email waiting in Ready for you");
    }
    return Response.json({ ok: true, done });
  });
}
