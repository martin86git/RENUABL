import { documentFile, validKey } from "@/lib/server/handover-store";
import { storageConfigured } from "@/lib/server/storage";

/** GET a job document's page or file (found through the record). */
export async function GET(_: Request, ctx: RouteContext<"/api/jobs/[key]/documents/[id]">) {
  const { key, id } = await ctx.params;
  if (!validKey(key) || !/^dc_[a-z0-9]{4,20}$/.test(id) || !storageConfigured()) return new Response(null, { status: 404 });
  const file = await documentFile(key, id);
  if (!file) return new Response(null, { status: 404 });
  return new Response(file.stream, {
    headers: { "content-type": file.contentType, "cache-control": "private, max-age=3600", "x-robots-tag": "noindex" },
  });
}
