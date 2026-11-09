import { DESIGN_COMMAND_PROMPT, DESIGN_COMMAND_SCHEMA, commandFrom } from "@/lib/domain/design/design-commands";
import { looksLikeQuestion } from "@/lib/domain/design/find";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { readWithClaude } from "@/lib/server/claude-reader";
import { modelFor } from "@/lib/server/sol-credits";
import { answer, readBody, requireMember } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

/**
 * POST { text, design } → { command }: Sol reads a request made in the roof designer (one the designer couldn't read
 * at once, `parseCommand`) against the design as it stands, described in words by the designer, and answers with one
 * change or an answer (`commandFrom`). Nothing is saved or sent here: the designer makes the change, and it is undone
 * like any other.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    const read = await readBody(request, 40_000);
    if ("refuse" in read) return read.refuse;
    const text = typeof read.body.text === "string" ? read.body.text.trim().slice(0, 600) : "";
    const design = typeof read.body.design === "string" ? read.body.design.slice(0, 20_000) : "";
    if (!text) return Response.json({ ok: false, message: "Say what to change." }, { status: 400 });
    if (!allow(request, "design-command", 200))
      return Response.json({ ok: false, message: "Sol has had a lot of requests in the last hour. Try again shortly." }, { status: 429 });
    const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
    if (!apiKey)
      return Response.json(
        { ok: false, message: "Sol isn't set up here (no Claude key). Try “fit 8 kW” or “string it”." },
        { status: 503 },
      );
    try {
      const reading = await readWithClaude<Record<string, unknown>>(
        [{ type: "text", text: `THE DESIGN\n${design}\n\nTHE REQUEST\n${text}` }],
        DESIGN_COMMAND_SCHEMA,
        DESIGN_COMMAND_PROMPT,
        apiKey,
        // A change to the design: the quick model. A question about it ("how could I bring the payback down?") wants
        // judgement over the figures, so the deep one, which answers it the same way each time (9 Nov 2026, Martin:
        // the quick model's answers to such questions wandered). The command bar takes no credit either way.
        { model: modelFor(looksLikeQuestion(text) ? "deep" : "quick") },
      );
      return Response.json({ ok: true, command: commandFrom(reading) });
    } catch (e) {
      console.error("designer command failed", redactSecrets(e instanceof Error ? e.message : String(e)));
      return Response.json({ ok: false, message: "Sol couldn't read that just now. Try again, or say it another way." }, { status: 502 });
    }
  });
}
