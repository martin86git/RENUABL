import { cleanCallerName } from "@/lib/domain/design/caller";
import { callerOf, setCallerName } from "@/lib/server/design-caller-repo";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { query } from "@/lib/server/db";
import { loadBrand } from "@/lib/server/design-proposal-repo";
import { voiceOnFor } from "@/lib/server/voice-calls";

/** GET: the business's phone assistant (its name, whether it has a picture), the name it speaks for, and whether its calls are on. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const id = who.member.businessId;
    const biz = await query<{ name: string }>(`select name from businesses where id = $1`, [id]);
    const [caller, callsOn, brand] = await Promise.all([
      callerOf(id),
      voiceOnFor(id).catch(() => false),
      loadBrand(id, biz[0]?.name ?? ""),
    ]);
    return Response.json({ ok: true, caller, callsOn, business: brand.name || biz[0]?.name || "" });
  });
}

/** PUT { name }: the name it gives on calls, for a member who may change settings. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    const name = cleanCallerName(read.body.name);
    if (!name.ok) return Response.json({ ok: false, message: name.message }, { status: 422 });
    return Response.json({ ok: true, caller: await setCallerName(who.member.businessId, name.value, who.member.email) });
  });
}
