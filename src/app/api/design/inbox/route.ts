import {
  COMPOSE_LIMITS,
  cleanCompose,
  cleanComposeHelp,
  cleanEmailSummary,
  SUMMARY_INSTRUCTIONS,
  cleanEmailNote,
  composeHelpPrompt,
  isEmailAction,
  isMessageId,
  type ComposedFile,
} from "@/lib/domain/design/inbox";
import { emailFileName, isPicture, picturesHtml } from "@/lib/domain/design/email-compose";
import { formFiles } from "@/lib/server/email-parts";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { readWithClaude } from "@/lib/server/claude-reader";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { addEmailNote, emailFile, inboxFor, openEmail, sharedEmail, sharedWith } from "@/lib/server/design-inbox-repo";
import { MAX_MAILBOXES } from "@/lib/domain/design/inbox";
import {
  GmailOff,
  ReadOnlyMailbox,
  changeEmail,
  changeableAddresses,
  disconnectGmail,
  gmailAddresses,
  gmailConfig,
  sendFromGmail,
  unreadCount,
} from "@/lib/server/gmail";
import { allow } from "@/lib/server/rate-limit";
import { SOL_OUT_SHORT } from "@/lib/domain/design/sol-credits";
import { withSolCredit } from "@/lib/server/sol-credits";
import { inboxTier } from "@/lib/domain/design/sol-routing";

export const maxDuration = 60;

const json = (body: object, status = 200) => Response.json(body, { status });

/**
 * GET: this member's own Gmail inbox, read only (domain/design/inbox.ts).
 * - no query: { connected, address, addresses, emails, shared } across every mailbox the member connected (or
 *   { connected: false, ready } when none is)
 * - ?count=1: { unread } (Gmail's own count)
 * - ?id=<message>[&box=<address>]: the email whole, from that mailbox, with its notes, marked read in Gmail when it
 *   was unread and its mailbox allows it (opening an email reads it, as in Gmail); with &owner=<email>, a copy
 *   shared with this member
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
    const addresses = await gmailAddresses(member);
    const address = addresses[0];
    const box = q.get("box")?.toLowerCase() || undefined;
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
          const got = await emailFile(member, id, Number(file), box);
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
        const email = await openEmail(member, viewerOf(member), id, box);
        if (email.unread && email.canChange && email.box) {
          // Opening it reads it, as in Gmail; the email still opens if Gmail doesn't take the change.
          const marked = await changeEmail(member, email.box, id, "read").then(
            () => true,
            (e) => (console.error("mark read failed", e instanceof Error ? e.message : e), false),
          );
          if (marked) email.unread = false;
        }
        return json({ ok: true, email });
      }
      return json({
        ok: true,
        connected: true,
        address,
        addresses,
        changeable: await changeableAddresses(member),
        more: addresses.length < MAX_MAILBOXES,
        ...(await inboxFor(member, viewerOf(member))),
      });
    } catch (e) {
      if (e instanceof GmailOff)
        return json({ ok: true, connected: false, ready: true, broken: e.message, emails: [], shared: await sharedWith(member) });
      console.error("inbox failed", e instanceof Error ? e.message : e);
      return json({ ok: false, message: "Gmail couldn't be reached just now. Try again in a moment." }, 502);
    }
  });
}

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["short", "asking", "next"],
  properties: { short: { type: "string" }, asking: { type: "string" }, next: { type: "string" } },
} as const;

const COMPOSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body"],
  properties: { subject: { type: "string" }, body: { type: "string" } },
} as const;

type Member = Extract<Awaited<ReturnType<typeof requireMember>>, { member: unknown }>["member"];

/**
 * A new email sent through one of the member's own mailboxes: the words, and any pictures (shown inside it under the
 * words) and files (attached). Never while viewing as someone else; 60 an hour.
 */
async function sendNew(request: Request, member: Member, fields: Record<string, unknown>, files: readonly File[]) {
  if (member.viewedBy) return json({ ok: false, message: "You're viewing as someone else: nothing is sent from their mailbox." }, 403);
  if (!allow(request, "inbox-send", 60)) return json({ ok: false, message: "That's a lot of emails in an hour. Try again shortly." }, 429);
  const clean = cleanCompose(fields, files.length > 0);
  if (!clean.ok) return json({ ok: false, message: clean.message }, 422);
  const box =
    typeof fields.box === "string" && fields.box.includes("@")
      ? fields.box.toLowerCase().slice(0, 254)
      : (await changeableAddresses(member))[0];
  if (!box) return json({ ok: false, message: "Connect your Gmail first." }, 409);
  const parts: ComposedFile[] = [];
  const ids: string[] = [];
  let pictures = 0;
  for (const f of files) {
    const picture = isPicture(f.type);
    if (picture) pictures += 1;
    const contentId = picture ? `picture${pictures}` : undefined;
    if (contentId) ids.push(contentId);
    parts.push({ name: emailFileName(f.name, f.type, pictures), type: f.type, bytes: new Uint8Array(await f.arrayBuffer()), contentId });
  }
  try {
    await sendFromGmail(member, box, clean.mail, parts, picturesHtml(ids));
    return json({ ok: true, from: box });
  } catch (e) {
    if (e instanceof GmailOff || e instanceof ReadOnlyMailbox) return json({ ok: false, message: e.message }, 409);
    console.error("inbox send failed", redactSecrets(e instanceof Error ? e.message : String(e)));
    return json({ ok: false, message: "Gmail didn't take that email just now. It wasn't sent: try again in a moment." }, 502);
  }
}

const SOL_SCHEMA = { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" } } } as const;

/**
 * POST { do: "note", id, owner, text }: a note on an email (only the member whose inbox it is, and anyone tagged, read
 * them; tagging shares that one email). POST { do: "sol", id, owner?, mode: "summary" | "reply" }: Sol sums it up for
 * the team, or drafts a reply to check and send from the deal or Gmail. Nothing is sent and nothing Sol writes is kept.
 * POST { do: "read" | "unread" | "archive", id, box }: changes it in Gmail itself, in one of the member's own mailboxes
 * connected for it (409 with what to do for one connected read only). Never while viewing as someone else.
 * POST { do: "send", box, to, cc, subject, body }: a new email from one of the member's own mailboxes through Gmail,
 * so it comes from their address and is kept in their Sent (8 Nov 2026). Never while viewing as someone else.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { member } = who;
    // A new email comes as a form, with its pictures and files (checked again here: the browser is never trusted).
    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await request.formData().catch(() => null);
      if (!form || form.get("do") !== "send") return json({ ok: false, message: "That couldn't be read." }, 400);
      const got = formFiles(form);
      if ("problem" in got) return json({ ok: false, message: got.problem }, 422);
      const field = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : "");
      return sendNew(
        request,
        member,
        { box: field("box"), to: field("to"), cc: field("cc"), subject: field("subject"), body: field("body"), size: field("size") },
        got.files,
      );
    }
    // A new email's words can run to COMPOSE_LIMITS.body characters; everything else here is short.
    const read = await readBody(request, 90_000);
    if ("refuse" in read) return read.refuse;
    const b = read.body;
    if (b.do === "send") return sendNew(request, member, b, []);
    if (b.do === "compose-sol") {
      if (!allow(request, "inbox-sol", 120)) return json({ ok: false, message: "Too many in the last hour. Try again shortly." }, 429);
      const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
      if (!apiKey) return json({ ok: false, message: "Sol isn't set up here." }, 503);
      const mode = b.mode === "write" ? "write" : "polish";
      const text = (k: string, max: number) => (typeof b[k] === "string" ? (b[k] as string).slice(0, max) : "");
      const instructions = text("instructions", COMPOSE_LIMITS.instructions).trim();
      const body = text("body", COMPOSE_LIMITS.body);
      if (mode === "write" && !instructions) return json({ ok: false, message: "Tell Sol what the email should say." }, 422);
      if (mode === "polish" && !body.trim()) return json({ ok: false, message: "Write something first, then Sol can polish it." }, 422);
      const to = text("to", 1000)
        .split(/[\s,;]+/)
        .filter((a) => a.includes("@"))
        .slice(0, COMPOSE_LIMITS.to);
      const prompt = composeHelpPrompt(mode, {
        business: member.businessName,
        to,
        subject: text("subject", COMPOSE_LIMITS.subject),
        body,
        instructions,
      });
      // Writing an email someone will read is the deeper model's; tidying words is quick (sol-routing.ts).
      const out = await withSolCredit(
        member.businessId,
        "inbox",
        member.email,
        (ai) => readWithClaude<{ subject: string; body: string }>([], COMPOSE_SCHEMA, prompt, apiKey, ai),
        inboxTier(mode === "write"),
        mode === "write" ? "email written" : "email polished",
      ).catch((e) => {
        console.error("compose sol failed", redactSecrets(e instanceof Error ? e.message : String(e)));
        return null;
      });
      if (out === "out") return json({ ok: false, message: SOL_OUT_SHORT }, 402);
      const clean = cleanComposeHelp(out);
      if (!clean) return json({ ok: false, message: "Sol couldn't write that just now. Try again in a moment." }, 502);
      return json({ ok: true, ...clean });
    }
    const id = typeof b.id === "string" && isMessageId(b.id) ? b.id : null;
    const owner = typeof b.owner === "string" && b.owner.includes("@") ? b.owner.toLowerCase().slice(0, 254) : member.email.toLowerCase();
    if (!id) return json({ ok: false, message: "That email couldn't be found." }, 404);
    try {
      if (isEmailAction(b.do)) {
        if (member.viewedBy) return json({ ok: false, message: "You're viewing as someone else: their mailbox isn't changed." }, 403);
        if (!allow(request, "inbox-change", 600)) return json({ ok: false, message: "Try again in a little while." }, 429);
        const box = typeof b.box === "string" ? b.box.toLowerCase().slice(0, 254) : (await gmailAddresses(member))[0];
        if (!box) return json({ ok: false, message: "Connect your Gmail first." }, 409);
        await changeEmail(member, box, id, b.do);
        return json({ ok: true });
      }
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
            : SUMMARY_INSTRUCTIONS,
          "",
          `Subject: ${email.subject}`,
          words,
        ].join("\n");
        // A reply a customer reads is drafted by the deeper model; a summary for the team is quick (sol-routing.ts).
        // A summary comes back in its three parts, so the screen can set out the takeaway and the next step.
        const out = await withSolCredit(
          member.businessId,
          "inbox",
          member.email,
          (ai) => readWithClaude<Record<string, string>>([], reply ? SOL_SCHEMA : SUMMARY_SCHEMA, prompt, apiKey, ai),
          inboxTier(reply),
          reply ? "reply drafted" : "summary",
        );
        if (out === "out") return json({ ok: false, message: SOL_OUT_SHORT }, 402);
        if (reply) return json({ ok: true, text: String(out.text ?? "").slice(0, 4_000) });
        const summary = cleanEmailSummary(out);
        if (!summary) return json({ ok: false, message: "Sol couldn't sum that one up. Try again in a moment." }, 502);
        return json({ ok: true, summary });
      }
      return json({ ok: false, message: "That couldn't be read." }, 400);
    } catch (e) {
      if (e instanceof GmailOff || e instanceof ReadOnlyMailbox) return json({ ok: false, message: e.message }, 409);
      console.error("inbox action failed", redactSecrets(e instanceof Error ? e.message : String(e)));
      return json({ ok: false, message: "That couldn't be done just now. Try again in a moment." }, 502);
    }
  });
}

/** DELETE [?address=<mailbox>]: disconnects that one of this member's mailboxes, or every one (Google is told to forget each token). */
export async function DELETE(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const address = new URL(request.url).searchParams.get("address")?.toLowerCase() || undefined;
    await disconnectGmail(who.member, address);
    return json({ ok: true });
  });
}
