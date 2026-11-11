import { cookies } from "next/headers";
import { after } from "next/server";
import { SESSION_COOKIE } from "@/lib/domain/accounts";
import { DEMO_DETAILS, DEMO_PAGE, DEMO_PER_HOUR, cleanDemoDetails, demoDetailsNote, isDemoEmail } from "@/lib/domain/design/demo";
import { STAFF_RETURN_COOKIE } from "@/lib/domain/design/staff-view";
import { VIEW_AS_COOKIE } from "@/lib/domain/design/view-as";
import { SESSION_COOKIE_OPTIONS, openSession } from "@/lib/server/accounts";
import { dbConfigured } from "@/lib/server/db";
import { answer, designAccess, readBody } from "@/lib/server/design-context";
import { keepDemoDetails, openDemo } from "@/lib/server/design-demo";
import { tellStaff } from "@/lib/server/design-staff-note";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST: "Try the demo" (domain/design/demo.ts). Makes a demo business of the visitor's own and signs this browser into
 * it: no form, no sign-in. Someone already in a demo is sent back into theirs; someone signed in to a real business
 * keeps their sign-in and is sent to it.
 */
export async function POST(request: Request) {
  return answer(async () => {
    if (!dbConfigured()) return Response.json({ ok: false, message: DEMO_PAGE.failed }, { status: 503 });
    const access = await designAccess();
    if (access.state !== "signed-out") return Response.json({ ok: true, next: "/design" });
    if (!allow(request, "business-demo", DEMO_PER_HOUR)) return Response.json({ ok: false, message: DEMO_PAGE.busy }, { status: 429 });
    const email = await openDemo();
    const jar = await cookies();
    jar.set(SESSION_COOKIE, await openSession(email, "business"), SESSION_COOKIE_OPTIONS);
    // The demo is its own sign-in: nothing of another view carries into it.
    jar.delete(VIEW_AS_COOKIE);
    jar.delete(STAFF_RETURN_COOKIE);
    return Response.json({ ok: true, next: "/design" });
  });
}

/**
 * PUT { name, company, email }: "Put your business on it". Only for the demo account this browser is signed in to: who
 * is trying it is kept as a lead, the demo is named for their company, and staff are told.
 */
export async function PUT(request: Request) {
  return answer(async () => {
    const access = await designAccess();
    if (access.state !== "ready" || !isDemoEmail(access.member.email)) return new Response(null, { status: 404 });
    if (!allow(request, "business-demo-details", 20)) return Response.json({ ok: false, message: DEMO_PAGE.busy }, { status: 429 });
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const cleaned = cleanDemoDetails(read.body);
    if (!cleaned.ok) return Response.json({ ok: false, message: cleaned.message }, { status: 422 });
    await keepDemoDetails(access.member, cleaned.details);
    // Told once: someone changing what they typed isn't news.
    if (!access.member.firstName) after(() => tellStaff(demoDetailsNote(cleaned.details)));
    return Response.json({ ok: true, message: DEMO_DETAILS.title });
  });
}
