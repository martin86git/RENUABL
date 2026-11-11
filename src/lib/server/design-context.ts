/**
 * Server only. Who a roof designer request is acting for. This is the one
 * place a business's id comes from: the signed-in person's email is looked up
 * among the members on every request, so someone taken out of a business
 * loses access at once, and nothing a browser sends can name another business.
 * It is also the one place a member's role is checked (`can`).
 */
import { BUSINESS_TERMS_VERSION, can, refusal, seesAllDeals, type DealViewer, type MemberAction } from "@/lib/domain/design/account";
import { cookies, headers } from "next/headers";
import { VIEW_AS_COOKIE, mayViewAs } from "@/lib/domain/design/view-as";
import { KIND_REFUSAL, PATH_HEADER, apiAllowed, cleanKind } from "@/lib/domain/design/business-kind";
import {
  DEMO_DETAILS,
  DEMO_DETAILS_HEADER,
  DEMO_REFUSAL,
  METHOD_HEADER,
  demoNeedsDetails,
  demoRefuses,
  isDemoEmail,
} from "@/lib/domain/design/demo";
import { currentSession } from "./accounts";
import { dbConfigured } from "./db";
import { memberByEmail, type Member } from "./design-repo";

export type DesignAccess =
  | { state: "signed-out" }
  /** Signed in, but not in a business yet: they name one and accept the terms to start. */
  | { state: "no-business"; email: string }
  /** Added to a business by its owner (or the terms have changed): they accept the terms to carry on. */
  | { state: "needs-terms"; email: string; member: Member }
  | { state: "ready"; email: string; member: Member };

export async function designAccess(): Promise<DesignAccess> {
  if (!dbConfigured()) return { state: "signed-out" };
  const session = await currentSession();
  if (session?.role !== "business") return { state: "signed-out" };
  const member = await memberByEmail(session.email);
  if (!member) return { state: "no-business", email: session.email };
  if (member.termsVersion !== BUSINESS_TERMS_VERSION) return { state: "needs-terms", email: session.email, member };
  // The owner viewing as another member of their business (read only: the proxy refuses changes while it is set).
  const viewing = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (viewing && member.role === "owner") {
    const other = await memberByEmail(viewing);
    if (other && mayViewAs(member, other) && other.termsVersion === BUSINESS_TERMS_VERSION)
      return { state: "ready", email: other.email, member: { ...other, viewedBy: member.email } };
  }
  return { state: "ready", email: session.email, member };
}

const refused = (status: number, message: string) => Response.json({ ok: false, message }, { status });

/**
 * The member a request is from, allowed to do this. Otherwise the answer to
 * send back: 401 when nobody is signed in to a business, 403 when their role
 * or the permissions the owner has given them don't allow it.
 */
export async function requireMember(action: MemberAction): Promise<{ member: Member } | { refuse: Response }> {
  const access = await designAccess();
  if (access.state !== "ready") return { refuse: refused(401, "Sign in to your business to do this.") };
  if (!can(access.member.role, action, access.member.permissions)) return { refuse: refused(403, refusal(action)) };
  // An installer's or inspector's login holds only part of the product: the proxy tells us the address asked for.
  const sent = await headers();
  const path = sent.get(PATH_HEADER);
  if (path && !apiAllowed(cleanKind(access.member.businessKind), path)) return { refuse: refused(403, KIND_REFUSAL) };
  // A demo account never reaches a real person, another business or money (demo.ts).
  if (isDemoEmail(access.member.email)) {
    const method = sent.get(METHOD_HEADER);
    if (demoRefuses(method, path)) return { refuse: refused(403, DEMO_REFUSAL) };
    // And asks who is trying it before the parts that cost money to run: the product opens the box on this header.
    if (!access.member.firstName && demoNeedsDetails(method, path))
      return {
        refuse: Response.json({ ok: false, message: DEMO_DETAILS.needed }, { status: 403, headers: { [DEMO_DETAILS_HEADER]: "details" } }),
      };
  }
  return { member: access.member };
}

/** Runs a route's work; a failure (the database is away) becomes a plain 503 and a line in the log, never a stack trace. */
export async function answer(work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (e) {
    console.error("roof designer request failed", e instanceof Error ? e.message : e);
    return refused(503, "We couldn't reach your account just now. Try again in a moment.");
  }
}

/** A request's JSON body, refused past a size (the answer says so) or when it isn't JSON. */
export async function readBody(request: Request, maxBytes: number): Promise<{ body: Record<string, unknown> } | { refuse: Response }> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { refuse: refused(400, "That couldn't be read.") };
  }
  if (text.length > maxBytes) return { refuse: refused(413, "That is too large to save.") };
  try {
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    return { body: body as Record<string, unknown> };
  } catch {
    return { refuse: refused(400, "That couldn't be read.") };
  }
}

/** Whose deals a member sees (`seesDeal`): everyone's, or their own, no one's and those they are mentioned on. */
export function viewerOf(member: Member): DealViewer {
  return { email: member.email.toLowerCase(), all: seesAllDeals(member.role, member.permissions) };
}
