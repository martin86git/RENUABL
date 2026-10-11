import { normaliseEmail } from "@/lib/domain/accounts";
import { MAX_MEMBERS, cleanPermissions } from "@/lib/domain/design/account";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { addMember, listMembers, removeMember, setPermissions } from "@/lib/server/design-repo";
import { allow } from "@/lib/server/rate-limit";

/** GET: the people in the signed-in member's business. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, members: await listMembers(who.member.businessId) });
  });
}

/**
 * POST { email }: the owner adds someone. No email is sent: the person signs
 * in at /design/sign-in with that address and lands in the business. An
 * address already in a business (this one or any other) can't be added, and
 * the answer doesn't say which.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-members", 30))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const email = normaliseEmail(read.body.email);
    if (!email) return Response.json({ ok: false, message: "Enter a valid email address." }, { status: 422 });
    const result = await addMember(who.member.businessId, email, who.member.email);
    if (result === "full")
      return Response.json({ ok: false, message: `A business can have up to ${MAX_MEMBERS} people for now.` }, { status: 422 });
    if (result === "taken")
      return Response.json({ ok: false, message: "That email can't be added. It may already be in a business." }, { status: 422 });
    return Response.json({ ok: true, members: await listMembers(who.member.businessId) });
  });
}

/**
 * PUT { email, permissions: { costs, prices, publish } }: the owner sets what a member may do. Enforced on every
 * request by `requireMember`, so it takes effect with their next one. The owner's own can't be changed.
 */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const email = normaliseEmail(read.body.email);
    if (!email || !(await setPermissions(who.member.businessId, email, cleanPermissions(read.body.permissions))))
      return Response.json({ ok: false, message: "That person isn't in your business." }, { status: 404 });
    return Response.json({ ok: true, members: await listMembers(who.member.businessId) });
  });
}

/** DELETE { email }: the owner takes someone out. Their access ends with their next request. The owner stays. */
export async function DELETE(request: Request) {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const email = normaliseEmail(read.body.email);
    if (!email || !(await removeMember(who.member.businessId, email))) return Response.json({ ok: false }, { status: 404 });
    return Response.json({ ok: true, members: await listMembers(who.member.businessId) });
  });
}
