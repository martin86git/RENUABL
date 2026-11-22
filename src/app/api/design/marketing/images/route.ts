import { answer } from "@/lib/server/design-context";
import { marketingImage } from "@/lib/server/design-images";
import { saveImage } from "@/lib/server/marketing-campaigns-repo";
import { marketingMember, refuse } from "@/lib/server/marketing-guard";

/** POST a form with "file" (members who may publish): a picture for a marketing email, redrawn (nothing but the picture kept), up to 1600 px; an animated GIF stays animated. */
export async function POST(request: Request) {
  return answer(async () => {
    const gate = await marketingMember("publish");
    if ("refuse" in gate) return gate.refuse;
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || !file.size) return refuse("Choose a picture.", 400);
    const img = await marketingImage(new Uint8Array(await file.arrayBuffer()));
    if ("problem" in img) return refuse(img.problem);
    return Response.json({ ok: true, id: await saveImage(gate.member.businessId, img, gate.member.email) });
  });
}
