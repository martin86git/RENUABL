import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/domain/accounts";
import { STAFF_RETURN_COOKIE, sampleByEmail, sampleOf } from "@/lib/domain/design/staff-view";
import { SESSION_COOKIE_OPTIONS, endSession, openSession, sessionEmail } from "@/lib/server/accounts";
import { answer, readBody } from "@/lib/server/design-context";
import { readySamples, staffBehind } from "@/lib/server/design-staff-view";

// Hidden from everyone but RENUABL's staff: anyone else is answered as if there were nothing here.
const nothing = () => new Response(null, { status: 404 });

/** GET → { viewing }: the sample business being looked through, if any (staff only). */
export async function GET() {
  return answer(async () => {
    if (!(await staffBehind())) return nothing();
    const jar = await cookies();
    const sample = jar.get(STAFF_RETURN_COOKIE) ? sampleByEmail(await sessionEmail(jar.get(SESSION_COOKIE)?.value)) : null;
    return Response.json({ ok: true, viewing: sample?.kind ?? null });
  });
}

/**
 * POST { kind }: signs this staff member into the sample business of that kind ("retailer", "installer",
 * "inspector"), keeping their own session aside; { kind: "own" } goes back to it. The samples are made on first use.
 */
export async function POST(request: Request) {
  return answer(async () => {
    if (!(await staffBehind())) return nothing();
    const read = await readBody(request, 500);
    if ("refuse" in read) return read.refuse;
    const jar = await cookies();
    const current = jar.get(SESSION_COOKIE)?.value;
    const kept = jar.get(STAFF_RETURN_COOKIE)?.value;
    if (read.body.kind === "own") {
      if (!kept) return Response.json({ ok: true });
      // The sample's session ends; the staff member's own is put back.
      if (current && current !== kept) await endSession(current);
      jar.set(SESSION_COOKIE, kept, SESSION_COOKIE_OPTIONS);
      jar.delete(STAFF_RETURN_COOKIE);
      return Response.json({ ok: true });
    }
    const sample = sampleOf(read.body.kind);
    if (!sample) return Response.json({ ok: false, message: "Choose a retailer, an installer or an inspector." }, { status: 422 });
    await readySamples();
    const session = await openSession(sample.email, "business");
    if (kept) {
      // Already looking through a sample: that one's session ends, the staff member's own stays aside.
      if (current && current !== kept) await endSession(current);
    } else if (current) jar.set(STAFF_RETURN_COOKIE, current, SESSION_COOKIE_OPTIONS);
    jar.set(SESSION_COOKIE, session, SESSION_COOKIE_OPTIONS);
    return Response.json({ ok: true, viewing: sample.kind });
  });
}
