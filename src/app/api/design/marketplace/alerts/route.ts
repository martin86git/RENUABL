import { cleanAlert } from "@/lib/domain/design/market-alerts";
import { marketClosed, marketplaceOpen } from "@/lib/domain/design/marketplace-launch";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { loadAlert, saveAlert } from "@/lib/server/design-market-watch-repo";

/** GET → { alert }: this person's job alerts. */
export async function GET() {
  if (!marketplaceOpen()) return marketClosed();
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    return Response.json({ ok: true, alert: await loadAlert(who.member) });
  });
}

/** PUT { alert }: sets this person's job alerts (their own, for their own email). */
export async function PUT(request: Request) {
  if (!marketplaceOpen()) return marketClosed();
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 1_000);
    if ("refuse" in read) return read.refuse;
    return Response.json({ ok: true, alert: await saveAlert(who.member, cleanAlert(read.body.alert)) });
  });
}
