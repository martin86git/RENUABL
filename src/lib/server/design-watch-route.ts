/**
 * Server only. The one way to watch or stop watching something on the Marketplace, shared by its two addresses
 * (/api/design/marketplace/watch for job listings, /api/design/trade/watch for equipment), so each sits under the
 * area a kind of business is let into. Watching commits nothing, so anyone who may design may do it.
 */
import type { WatchKind } from "@/lib/domain/design/market-alerts";
import { marketClosed, marketplaceOpen } from "@/lib/domain/design/marketplace-launch";
import { answer, readBody, requireMember } from "./design-context";
import { setWatch } from "./design-market-watch-repo";
import { allow } from "./rate-limit";

export function watchRoute(kind: WatchKind) {
  return async function POST(request: Request) {
    if (!marketplaceOpen()) return marketClosed();
    return answer(async () => {
      const who = await requireMember("design");
      if ("refuse" in who) return who.refuse;
      if (!allow(request, "market-watch", 240))
        return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
      const read = await readBody(request, 1_000);
      if ("refuse" in read) return read.refuse;
      const id = typeof read.body.id === "string" ? read.body.id.slice(0, 80) : "";
      const on = read.body.on === true;
      if (!id) return Response.json({ ok: false, message: "That couldn't be read." }, { status: 400 });
      if (!(await setWatch(who.member, kind, id, on)))
        return Response.json({ ok: false, message: "That can't be watched: it's yours, or it isn't for sale any more." }, { status: 409 });
      return Response.json({ ok: true, watched: on });
    });
  };
}
