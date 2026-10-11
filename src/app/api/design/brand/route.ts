import { cleanBrandKit } from "@/lib/domain/design/brand";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { listImages, loadBrand, saveBrand } from "@/lib/server/design-proposal-repo";

/** GET: the business's branding for its proposals (what it starts with until it saves its own) and its pictures. */
export async function GET() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { businessId, businessName } = who.member;
    const [brand, images] = await Promise.all([loadBrand(businessId, businessName), listImages(businessId)]);
    return Response.json({ ok: true, brand, images });
  });
}

/**
 * PUT any of the brand kit's fields: what isn't sent stays. Checked first:
 * colours are six hex digits and nothing else, a web address is http or
 * https, an ABN passes its checksum.
 */
export async function PUT(request: Request) {
  return answer(async () => {
    const who = await requireMember("prices");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 100_000);
    if ("refuse" in read) return read.refuse;
    const { businessId, businessName, email } = who.member;
    const next = cleanBrandKit(read.body, await loadBrand(businessId, businessName));
    if (!next.ok) return Response.json({ ok: false, message: next.message }, { status: 422 });
    await saveBrand(businessId, next.value, email);
    return Response.json({ ok: true, brand: next.value });
  });
}
