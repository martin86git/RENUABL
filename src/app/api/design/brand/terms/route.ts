import { TERMS_LIMITS, TERMS_TOO_BIG, TERMS_WRONG, isPdf, termsFileName, withOwnTerms } from "@/lib/domain/design/brand";
import { answer, requireMember } from "@/lib/server/design-context";
import { termsResponse } from "@/lib/server/design-images";
import { addTermsFile, loadBrand, saveBrand, termsFile } from "@/lib/server/design-proposal-repo";
import { allow } from "@/lib/server/rate-limit";

/** GET: the business's own terms and conditions as they stand, for its own people to check. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const brand = await loadBrand(who.member.businessId, who.member.businessName);
    const file = brand.ownTerms ? await termsFile(who.member.businessId, brand.ownTerms.id) : null;
    return file && brand.ownTerms ? termsResponse(file, brand.ownTerms.name) : new Response(null, { status: 404 });
  });
}

/**
 * POST (a form with `file`): the business's own terms and conditions, as a
 * PDF. Checked by its own bytes (a whole PDF, never what the browser says it
 * is), kept in place of any before, and chosen as the terms its proposals
 * now carry. Proposals already sent keep the terms they were sent with.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    if (!allow(request, "design-brand-terms", 20))
      return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
    // Refused by its stated size before any of it is read.
    if (Number(request.headers.get("content-length") ?? 0) > TERMS_LIMITS.uploadBytes + 100_000)
      return Response.json({ ok: false, message: TERMS_TOO_BIG }, { status: 413 });
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ ok: false, message: TERMS_WRONG }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ ok: false, message: TERMS_WRONG }, { status: 400 });
    if (file.size > TERMS_LIMITS.uploadBytes) return Response.json({ ok: false, message: TERMS_TOO_BIG }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isPdf(bytes)) return Response.json({ ok: false, message: TERMS_WRONG }, { status: 422 });
    const { businessId, businessName, email } = who.member;
    const kept = await addTermsFile(businessId, Buffer.from(bytes), termsFileName(file.name), email);
    const brand = withOwnTerms(await loadBrand(businessId, businessName), kept);
    await saveBrand(businessId, brand, email);
    return Response.json({ ok: true, brand });
  });
}

/** DELETE: takes the business's own terms out. Proposals go back to our standard terms if they were using them. */
export async function DELETE() {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const { businessId, businessName, email } = who.member;
    const brand = withOwnTerms(await loadBrand(businessId, businessName), null);
    await saveBrand(businessId, brand, email);
    return Response.json({ ok: true, brand });
  });
}
