import { after } from "next/server";
import { DEMO_DETAILS, DEMO_PAGE, cleanDemoDetails, demoDetailsNote, isDemoEmail } from "@/lib/domain/design/demo";
import { answer, designAccess, readBody } from "@/lib/server/design-context";
import { keepDemoDetails } from "@/lib/server/design-demo";
import { tellStaff } from "@/lib/server/design-staff-note";
import { allow } from "@/lib/server/rate-limit";

/**
 * POST used to be "Try the demo": it made a demo business of the visitor's own and signed the browser into it. Closed
 * since 27 Nov 2026 (Martin: "i dont want there to be access to the demo platform. you either have to sign up, or book
 * a demo in"): nobody opens a demo account themselves, so it makes nothing and says where to go. RENUABL's staff show
 * the platform from the sample retailer (RENUABL admin's Demo account, staff-view.ts), which doesn't come through here.
 */
export function POST() {
  return Response.json({ ok: false, message: DEMO_PAGE.closed, next: DEMO_PAGE.bookPath }, { status: 410 });
}

/**
 * PUT { name, company, email }: "Put your business on it". Only for the demo account this browser is signed in to (one
 * opened before 27 Nov 2026, until it is cleared): who is trying it is kept as a lead, the demo is named for their
 * company, and staff are told.
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
    const from = await keepDemoDetails(access.member, cleaned.details);
    // Told once: someone changing what they typed isn't news.
    if (!access.member.firstName) after(() => tellStaff(demoDetailsNote(cleaned.details, from)));
    return Response.json({ ok: true, message: DEMO_DETAILS.title });
  });
}
