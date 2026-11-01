import { cleanStandardInput, STANDARDS_LIMITS } from "@/lib/domain/design/standards";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { StandardRefusal, listStandards, startStandard } from "@/lib/server/design-standards-repo";
import { allow } from "@/lib/server/rate-limit";

/** GET → { copies }: the business's own licensed copies of the standards. Every member may open them. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, copies: await listStandards(who.member.businessId) });
  });
}

/**
 * POST { code, title, edition, fileName, size, licence }: starts a copy, answering with its id and how to send it
 * (`parts` of up to `partBytes` each, PUT to /api/design/standards/<id>?part=n, then POST { do: "finish" }).
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-standards", 30))
      return Response.json({ ok: false, message: "That's a lot of uploads this hour: try again shortly." }, { status: 429 });
    const read = await readBody(request, 4_000);
    if ("refuse" in read) return read.refuse;
    const input = cleanStandardInput(read.body);
    if (!input.ok) return Response.json({ ok: false, message: input.message }, { status: 422 });
    try {
      const id = await startStandard(who.member.businessId, input.value, who.member.email);
      return Response.json({ ok: true, id, parts: input.value.parts, partBytes: STANDARDS_LIMITS.partBytes });
    } catch (e) {
      if (e instanceof StandardRefusal) return Response.json({ ok: false, message: e.message }, { status: 422 });
      throw e;
    }
  });
}
