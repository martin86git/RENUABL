import { noticeTwiml } from "@/lib/domain/browser-call";
import { browserCallById } from "@/lib/server/browser-calls";
import { query } from "@/lib/server/db";
import { loadBrand } from "@/lib/server/design-proposal-repo";
import { browserCallSettings, fromTwilio } from "@/lib/server/twilio-voice";

/** POST: what the customer hears as they answer a call from the computer: who is calling, and that it may be recorded. */
export async function POST(request: Request) {
  const s = browserCallSettings();
  if (!s) return new Response("Not set up", { status: 404 });
  if (!(await fromTwilio(request, s))) return new Response("Forbidden", { status: 403 });
  const row = await browserCallById(new URL(request.url).searchParams.get("call") ?? "").catch(() => null);
  let business = "";
  if (row) {
    const biz = await query<{ name: string }>(`select name from businesses where id = $1`, [row.business_id]).catch(() => []);
    business = (await loadBrand(row.business_id, biz[0]?.name ?? "").catch(() => null))?.name || biz[0]?.name || "";
  }
  return new Response(noticeTwiml(business), { headers: { "content-type": "text/xml; charset=utf-8" } });
}
