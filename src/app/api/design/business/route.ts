import {
  BUSINESS_NAME_MISSING,
  BUSINESS_TERMS_MISSING,
  BUSINESS_TERMS_VERSION,
  cleanBusinessName,
  readTermsTick,
} from "@/lib/domain/design/account";
import { cleanKind } from "@/lib/domain/design/business-kind";
import { answer, designAccess, readBody, requireMember } from "@/lib/server/design-context";
import { acceptTerms, createBusiness, renameBusiness } from "@/lib/server/design-repo";

/**
 * POST { name?, kind?, terms: true }: the step between signing in and using an
 * account. Someone new names their business and accepts the terms, and
 * becomes its owner; someone the owner added only accepts the terms. The tick
 * is required either way, and its version is recorded with the server's time.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const access = await designAccess();
    if (access.state === "signed-out") return Response.json({ ok: false, message: "Sign in first." }, { status: 401 });
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    if (!readTermsTick(read.body.terms)) return Response.json({ ok: false, message: BUSINESS_TERMS_MISSING }, { status: 422 });
    if (access.state === "no-business") {
      const name = cleanBusinessName(read.body.name);
      if (!name) return Response.json({ ok: false, message: BUSINESS_NAME_MISSING }, { status: 422 });
      await createBusiness(access.email, name, BUSINESS_TERMS_VERSION, cleanKind(read.body.kind));
    } else if (access.state === "needs-terms") {
      await acceptTerms(access.member.businessId, access.email, BUSINESS_TERMS_VERSION);
    }
    return Response.json({ ok: true });
  });
}

/** PUT { name }: the owner renames the business. */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("members");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const name = cleanBusinessName(read.body.name);
    if (!name) return Response.json({ ok: false, message: BUSINESS_NAME_MISSING }, { status: 422 });
    await renameBusiness(who.member.businessId, name);
    return Response.json({ ok: true, name });
  });
}
