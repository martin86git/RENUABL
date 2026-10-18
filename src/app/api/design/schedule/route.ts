import { answer, requireMember } from "@/lib/server/design-context";
import { bookedJobs } from "@/lib/server/design-after-sale-repo";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD: the business's installations booked in those days, with whether each is ready. */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!DATE.test(from) || !DATE.test(to) || from > to)
      return Response.json({ ok: false, message: "Choose the days to show." }, { status: 422 });
    return Response.json({ ok: true, jobs: await bookedJobs(who.member.businessId, from, to) });
  });
}
