import { cleanEmailNote, isMessageId } from "@/lib/domain/design/inbox";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { readWithClaude } from "@/lib/server/claude-reader";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { addEmailNote, emailFile, inboxFor, openEmail, sharedEmail, sharedWith } from "@/lib/server/design-inbox-repo";
import { GmailOff, disconnectGmail, gmailAddress, gmailConfig, unreadCount } from "@/lib/server/gmail";
import { allow } from "@/lib/server/rate-limit";
import { SOL_OUT_SHORT } from "@/lib/domain/design/sol-credits";
import { withSolCredit } from "@/lib/server/sol-credits";
import { inboxTier } from "@/lib/domain/design/sol-routing";

export const maxDuration = 60;

const json = (body: object, status = 200) => Response.json(body, { status });

/**
 * GET: this member's own Gmail inbox, read only (domain/design/inbox.ts).
 * - no query: { connected, address, emails, shared } (or { connected: false, ready } when Gmail isn't connected)
 * - ?count=1: { unread } (Gmail's own count)
 * - ?id=<message>: the email whole, with its notes; with &owner=<email>, a copy shared with this member
 * - ?id=<message>&file=<n>: one of its files, from the member's own mailbox only
 * Never while the owner is viewing as someone else: that person's mailbox isn't read.
 */
export async function GET(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { member } = who;
    const q = new URL(request.url).searchParams;
    const id = q.get("id");
    const owner = q.get("owner");
    if (id && owner) {
      if (!isMessageId(id)) return json({ ok: false, message: "That email couldn't be found." }, 404);
      const shared = await sharedEmail(member, owner, id);
      return shared ? json({ ok: true, email: shared }) : json({ ok: false, message: "That email isn't shared with you." }, 404);
    }
    if (member.viewedBy) return json({ ok: true, connected: false, viewing: true, emails: [], shared: [] });
    const address = await gmailAddress(member);
    if (!address) {
      if (q.get("count") === "1") return json({ ok: true, unread: 0 });
      // Emails others shared with this member show whether or not their own Gmail is connected.
      return json({
        ok: true,
        connected: false,
        ready: Boolean(gmailConfig(new URL(request.url).origin)),
        emails: [],
        shared: await sharedWith(member),
      });
    }
    try {
      if (q.get("count") === "1") return json({ ok: true, unread: await unreadCount(member) });
      if (id) {
        if (!isMessageId(id)) return json({ ok: false, message: "That email couldn't be found." }, 404);
        const file = q.get("file");
        if (file !== null) {
          const got = await emailFile(member, id, Number(file));
          if (!got) return new Response("Not found", { status: 404 });
          return new Response(new Uint8Array(got.bytes), {
            headers: {
              "content-type": got.type,
              "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(got.name)}`,
              "cache-control": "private, no-store",
              "x-content-type-options": "nosniff",
              "content-security-policy": "sandbox; default-src 'none'",
            },
          });
        }
        return json({ ok: true, email: await openEmail(member, viewerOf(member), id) });
      }
      return json({ ok: true, connected: true, address, ...(await inboxFor(member, viewerOf(member))) });
    } catch (e) {
      if (e instanceof GmailOff)
        return json({ ok: true, connected: false, ready: true, broken: e.message, emails: [], shared: await sharedWith(member) });
      console.error("inbox failed", e instanceof Error ? e.message : e);
      return json({ ok: false, message: "Gmail couldn't be reached just now. Try again in a moment." }, 502);
    }
  });
}

const SOL_SCHEMA = { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" } } } as const;

/**
 * POST { do: "note", id, owner, text }: a note on an email (only the member whose inbox it is, and anyone tagged, read
 * them; tagging shares that one email). POST { do: "sol", id, owner?, mode: "summary" | "reply" }: Sol sums it up for
 * the team, or drafts a reply to check and send from the deal or Gmail. Nothing is sent and nothing Sol writes is kept.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { member } = who;
    const read = await readBody(request, 6_000);
    if ("refuse" in read) return read.refuse;
    const b = read.body;
    const id = typeof b.id === "string" && isMessageId(b.id) ? b.id : null;
    const owner = typeof b.owner === "string" && b.owner.includes("@") ? b.owner.toLowerCase().slice(0, 254) : member.email.toLowerCase();
    if (!id) return json({ ok: false, message: "That email couldn't be found." }, 404);
    try {
      if (b.do === "note") {
        if (!allow(request, "inbox-note", 240)) return json({ ok: false, message: "Try again in a little while." }, 429);
        const text = cleanEmailNote(b.text);
        if (!text) return json({ ok: false, message: "Write a note first." }, 422);
        const done = await addEmailNote(member, owner, id, text);
        if (!done) return json({ ok: false, message: "That email isn't shared with you." }, 404);
        const email =
          owner === member.email.toLowerCase() ? await openEmail(member, viewerOf(member), id) : await sharedEmail(member, owner, id);
        return json({ ok: true, told: done.told, email });
      }
      if (b.do === "sol") {
        if (!allow(request, "inbox-sol", 120)) return json({ ok: false, message: "Too many in the last hour. Try again shortly." }, 429);
        const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
        if (!apiKey) return json({ ok: false, message: "Sol isn't set up here." }, 503);
        const email =
          owner === member.email.toLowerCase() ? await openEmail(member, viewerOf(member), id) : await sharedEmail(member, owner, id);
        if (!email) return json({ ok: false, message: "That email isn't shared with you." }, 404);
        const words = (email.text ?? email.html?.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ") ?? "")
          .replace(/\s+/g, " ")
          .slice(0, 12_000);
        const reply = b.mode === "reply";
        const prompt = [
          `You are Sol, the assistant at ${member.businessName}, a solar business in Australia. An email came in from ${email.from.name} <${email.from.email}>${email.deal ? `, a customer (${email.deal.customer})` : ""}.`,
          reply
            ? "Draft a short, friendly reply in Australian English from the business, signed off with no name. Answer what they asked only from what the email says; never invent a figure, price, date, product or promise; where something needs checking, say it will be confirmed."
            : "Sum it up for the team, never for the customer, as three short parts: 'In short:', 'They're asking:', 'Next step:'. Plain words, no more than five lines.",
          "",
          `Subject: ${email.subject}`,
          words,
        ].join("\n");
        // A reply a customer reads is drafted by the deeper model; a summary for the team is quick (sol-routing.ts).
        const out = await withSolCredit(
          member.businessId,
          "inbox",
          member.email,
          (ai) => readWithClaude<{ text: string }>([], SOL_SCHEMA, prompt, apiKey, ai),
          inboxTier(reply),
          reply ? "reply drafted" : "summary",
        );
        if (out === "out") return json({ ok: false, message: SOL_OUT_SHORT }, 402);
        return json({ ok: true, text: String(out.text ?? "").slice(0, 4_000) });
      }
      return json({ ok: false, message: "That couldn't be read." }, 400);
    } catch (e) {
      if (e instanceof GmailOff) return json({ ok: false, message: e.message }, 409);
      console.error("inbox action failed", redactSecrets(e instanceof Error ? e.message : String(e)));
      return json({ ok: false, message: "That couldn't be done just now. Try again in a moment." }, 502);
    }
  });
}

/** DELETE: disconnects this member's Gmail (Google is told to forget the token). */
export async function DELETE() {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    await disconnectGmail(who.member);
    return json({ ok: true });
  });
}
