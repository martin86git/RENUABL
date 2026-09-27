import { photoFile, validKey } from "@/lib/server/handover-store";
import { storageConfigured } from "@/lib/server/storage";

/** GET a handover photo (found through the record, so only the record's own photos can be read). */
export async function GET(_: Request, ctx: RouteContext<"/api/jobs/[key]/photos/[id]">) {
  const { key, id } = await ctx.params;
  if (!validKey(key) || !/^ph_[a-z0-9]{4,20}$/.test(id) || !storageConfigured()) return new Response(null, { status: 404 });
  const file = await photoFile(key, id);
  if (!file) return new Response(null, { status: 404 });
  return new Response(file.stream, {
    headers: { "content-type": file.contentType, "cache-control": "private, max-age=3600", "x-robots-tag": "noindex" },
  });
}
