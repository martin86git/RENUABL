import {
  CALL_NOTES_SCHEMA,
  MIN_WORDS,
  callNotesPrompt,
  callNotesText,
  cleanCallNotes,
  cleanHeard,
  transcriptOf,
  wordsIn,
} from "@/lib/domain/design/call-notes";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { readWithClaude } from "@/lib/server/claude-reader";
import { answer, readBody, requireMember, viewerOf } from "@/lib/server/design-context";
import { jobById } from "@/lib/server/design-crm-repo";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

/**
 * POST { lines } → { notes, text }: the call note-taker (domain/design/call-notes.ts). What the microphone heard of the
 * member's side of a call on this deal, and the notes they added, distilled by Claude into what the follow-up email
 * and the design need. Nothing heard is kept: the write-up comes back to be checked, and goes on the deal only when
 * the member adds it as a note.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/design/jobs/[id]/call-notes">) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const { id } = await ctx.params;
    const found = await jobById(who.member.businessId, id, viewerOf(who.member));
    if (!found) return Response.json({ ok: false, message: "There's no such deal." }, { status: 404 });
    const read = await readBody(request, 400_000);
    if ("refuse" in read) return read.refuse;
    const lines = cleanHeard(read.body.lines);
    if (wordsIn(lines) < MIN_WORDS)
      return Response.json({ ok: false, message: "Not enough was heard to make notes from." }, { status: 422 });
    if (!allow(request, "design-call-notes", 60))
      return Response.json({ ok: false, message: "Too many write-ups in the last hour. Try again shortly." }, { status: 429 });
    const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
    if (!apiKey) return Response.json({ ok: false, message: "Notes can't be written up here: Claude isn't set up." }, { status: 503 });
    try {
      const raw = await readWithClaude<unknown>(
        [],
        CALL_NOTES_SCHEMA,
        callNotesPrompt(who.member.businessName, found.customer.name, transcriptOf(lines)),
        apiKey,
      );
      const notes = cleanCallNotes(raw);
      return Response.json({ ok: true, notes, text: callNotesText(notes) });
    } catch (e) {
      console.error("call notes failed", redactSecrets(e instanceof Error ? e.message : String(e)));
      return Response.json(
        { ok: false, message: "The notes couldn't be written up just now. What was heard is still here: try again." },
        { status: 502 },
      );
    }
  });
}
