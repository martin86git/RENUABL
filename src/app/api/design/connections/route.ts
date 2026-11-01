import { cleanKind } from "@/lib/domain/design/business-kind";
import { KIND_FILTERS, MIN_QUERY, acceptedEmail, cleanListing, requestEmail, type KindFilter } from "@/lib/domain/design/connections";
import { siteUrl } from "@/lib/domain/sms";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import {
  answerConnection,
  askToConnect,
  connectionsOf,
  incomingCount,
  kindOf,
  myListing,
  saveListing,
  searchDirectory,
} from "@/lib/server/design-connections-repo";
import { emailProvider, sendEmail } from "@/lib/server/email";
import { allow } from "@/lib/server/rate-limit";

/**
 * GET → { listing, connections } | ?count=1 → { incoming } | ?q=…&kind=… → { results }: this business's listing in the
 * directory, its connections and requests, or a search of the listed businesses (domain/design/connections.ts).
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const url = new URL(request.url);
    const id = who.member.businessId;
    if (url.searchParams.get("count")) return Response.json({ ok: true, incoming: await incomingCount(id) });
    const q = (url.searchParams.get("q") ?? "").slice(0, 80);
    if (url.searchParams.has("q")) {
      if (q.trim().length < MIN_QUERY) return Response.json({ ok: true, results: [] });
      if (!allow(request, "directory-search", 120))
        return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
      const kind = (KIND_FILTERS as readonly string[]).includes(url.searchParams.get("kind") ?? "")
        ? (url.searchParams.get("kind") as KindFilter)
        : "all";
      return Response.json({ ok: true, results: await searchDirectory(id, q, kind) });
    }
    const [listing, connections] = await Promise.all([myListing(id), connectionsOf(id)]);
    return Response.json({ ok: true, listing, connections, kind: cleanKind(who.member.businessKind) });
  });
}

/**
 * POST { do: "list", listed, suburb, state, abn } | { do: "ask", key } | { do: "accept" | "decline" | "cancel" |
 * "disconnect", id }. Each commits the business, so it needs the publish permission. The other business's owner is
 * emailed from RENUABL when asked, and the asker's when accepted, when email is set up.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("publish");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 2_000);
    if ("refuse" in read) return read.refuse;
    const b = read.body;
    const m = who.member;
    const site = siteUrl();
    const link = site ? `${site}/design/connections` : null;
    const tell = async (to: string | null, mail: { subject: string; text: string; html: string }) => {
      if (!to || !link || !emailProvider()) return;
      await sendEmail({ to, ...mail }).catch((e) => console.error("connection email failed", e instanceof Error ? e.message : e));
    };
    if (b.do === "list") {
      const listing = cleanListing(b);
      if (!listing.ok) return Response.json(listing, { status: 422 });
      await saveListing(m.businessId, listing.listing, m.email);
    } else if (b.do === "ask") {
      if (!allow(request, "connection-ask", 30))
        return Response.json({ ok: false, message: "Try again in a little while." }, { status: 429 });
      const done = await askToConnect(m, typeof b.key === "string" ? b.key.slice(0, 40) : "");
      if (!done.ok) return Response.json({ ok: false, message: done.message }, { status: done.status });
      await tell(done.tell, requestEmail({ from: m.businessName, kind: await kindOf(m.businessId), link: link ?? "" }));
    } else if (b.do === "accept" || b.do === "decline" || b.do === "cancel" || b.do === "disconnect") {
      const done = await answerConnection(m, typeof b.id === "string" ? b.id.slice(0, 60) : "", b.do);
      if (!done.ok) return Response.json({ ok: false, message: done.message }, { status: done.status });
      if (b.do === "accept") await tell(done.tell, acceptedEmail({ by: m.businessName, link: link ?? "" }));
    } else return Response.json({ ok: false, message: "That couldn't be read." }, { status: 400 });
    const [listing, connections] = await Promise.all([myListing(m.businessId), connectionsOf(m.businessId)]);
    return Response.json({ ok: true, listing, connections, kind: cleanKind(m.businessKind) });
  });
}
