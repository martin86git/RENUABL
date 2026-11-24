import { normaliseEmail } from "@/lib/domain/accounts";
import { MAX_MEMBERS, MAX_OWNER_ONLY, cleanOwnerOnlyName, cleanPermissions, cleanRole } from "@/lib/domain/design/account";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import {
  addMember,
  addOwnerOnly,
  inviteOwnerOnly,
  listMembers,
  listOwnerOnly,
  removeMember,
  removeOwnerOnly,
  setPermissions,
  setRole,
} from "@/lib/server/design-repo";
import { syncSeats } from "@/lib/server/design-seats";
import { allow } from "@/lib/server/rate-limit";

/** The business's people and those kept to own deals without an invite, as every answer here gives them. */
async function team(businessId: string) {
  const [members, ownerOnly] = await Promise.all([listMembers(businessId), listOwnerOnly(businessId)]);
  return Response.json({ ok: true, members, ownerOnly });
}

/** GET: the people in the signed-in member's business, and those who own deals without being invited. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return team(who.member.businessId);
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
    const businessId = who.member.businessId;
    // { email, name, ownerOnly: true }: someone kept only to own deals, not invited (24 Nov 2026, Martin). No user, no sign-in.
    if (read.body.ownerOnly === true) {
      const name = cleanOwnerOnlyName(read.body.name);
      if (!name) return Response.json({ ok: false, message: "Enter their name." }, { status: 422 });
      const kept = await addOwnerOnly(businessId, email, name, who.member.email);
      if (kept === "member") return Response.json({ ok: false, message: "They're already in your business." }, { status: 422 });
      if (kept === "full")
        return Response.json({ ok: false, message: `You can keep up to ${MAX_OWNER_ONLY} people who aren't invited.` }, { status: 422 });
      return team(businessId);
    }
    // { email, invite: true }: someone kept to own deals is invited now; they keep their deals.
    if (read.body.invite === true) {
      const invited = await inviteOwnerOnly(businessId, email, who.member.email);
      if (invited === "missing") return Response.json({ ok: false, message: "They aren't on your list." }, { status: 404 });
      if (invited === "full")
        return Response.json({ ok: false, message: `A business can have up to ${MAX_MEMBERS} people for now.` }, { status: 422 });
      if (invited === "taken")
        return Response.json({ ok: false, message: "That email can't be added. It may already be in a business." }, { status: 422 });
      await syncSeats(businessId);
      return team(businessId);
    }
    const result = await addMember(who.member.businessId, email, who.member.email);
    if (result === "full")
      return Response.json({ ok: false, message: `A business can have up to ${MAX_MEMBERS} people for now.` }, { status: 422 });
    if (result === "taken")
      return Response.json({ ok: false, message: "That email can't be added. It may already be in a business." }, { status: 422 });
    // A new person is a new paid user: the plan follows the team.
    await syncSeats(who.member.businessId);
    return team(who.member.businessId);
  });
}

/**
 * PUT { email, permissions: { costs, prices, publish, allDeals } } or { email, role: "member" | "designer" }: the owner sets
 * what a member may do, or their role. Enforced on every
 * request by `requireMember`, so it takes effect with their next one. The owner's own can't be changed.
 */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const email = normaliseEmail(read.body.email);
    const role = "role" in read.body ? cleanRole(read.body.role) : undefined;
    if (role === null) return Response.json({ ok: false, message: "That isn't a role." }, { status: 422 });
    const done =
      email &&
      (role
        ? await setRole(who.member.businessId, email, role)
        : await setPermissions(who.member.businessId, email, cleanPermissions(read.body.permissions)));
    if (!done) return Response.json({ ok: false, message: "That person isn't in your business." }, { status: 404 });
    return team(who.member.businessId);
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
    // { email, ownerOnly: true }: taken off the list of people who own deals; their deals are left with no owner.
    if (read.body.ownerOnly === true) {
      if (!email || !(await removeOwnerOnly(who.member.businessId, email))) return Response.json({ ok: false }, { status: 404 });
      return team(who.member.businessId);
    }
    if (!email || !(await removeMember(who.member.businessId, email))) return Response.json({ ok: false }, { status: 404 });
    await syncSeats(who.member.businessId);
    return team(who.member.businessId);
  });
}
