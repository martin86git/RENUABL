import { safeImage } from "@/lib/server/design-images";
import { saveImage } from "@/lib/server/marketing-campaigns-repo";
import { marketingStaff, refuse, unauthorised } from "@/lib/server/marketing-staff";

/** POST (staff) a form with "file": a picture for a marketing email, redrawn (nothing but the picture kept), up to 1600 px. */
export async function POST(request: Request) {
  const staff = await marketingStaff();
  if (!staff) return unauthorised();
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return refuse("Choose a picture.", 400);
  const img = await safeImage(new Uint8Array(await file.arrayBuffer()), "photo");
  if ("problem" in img) return refuse(img.problem);
  return Response.json({ ok: true, id: await saveImage(img, staff.email) });
}
