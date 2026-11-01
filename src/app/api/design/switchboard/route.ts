import { SWITCHBOARD_PROMPT, SWITCHBOARD_SCHEMA, cleanSwitchboardRead } from "@/lib/domain/design/switchboard";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { readWithClaude } from "@/lib/server/claude-reader";
import { answer, requireMember } from "@/lib/server/design-context";
import { allow } from "@/lib/server/rate-limit";

export const maxDuration = 60;

const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const fail = (message: string, status: number) => Response.json({ ok: false, message }, { status });

/**
 * POST a photo of the switchboard (multipart "photo") → what Sol reads on it (2 Nov 2026, Martin): phases, spare
 * spaces, safety switches, old fuses. The designer turns it into suggestions for the lines decided on each job
 * (`switchboardAdvice`). The photo isn't kept.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const who = await requireMember("design");
    if ("refuse" in who) return who.refuse;
    let file: FormDataEntryValue | null;
    try {
      file = (await request.formData()).get("photo");
    } catch {
      return fail("Send a photo of the switchboard.", 400);
    }
    if (!(file instanceof File) || file.size === 0) return fail("Send a photo of the switchboard.", 400);
    if (!(TYPES as readonly string[]).includes(file.type)) return fail("A JPG, PNG or WebP photo, please.", 415);
    if (file.size > 4 * 1024 * 1024) return fail("That photo is too large.", 413);
    if (!allow(request, "design-switchboard", 60)) return fail("A lot of photos read in the last hour. Try again shortly.", 429);
    const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
    if (!apiKey) return fail("Photos can't be read here: Claude isn't set up.", 503);
    try {
      const data = Buffer.from(await file.arrayBuffer()).toString("base64");
      const raw = await readWithClaude<Record<string, unknown>>(
        [{ type: "image", source: { type: "base64", media_type: file.type as (typeof TYPES)[number], data } }],
        SWITCHBOARD_SCHEMA,
        SWITCHBOARD_PROMPT,
        apiKey,
      );
      const read = cleanSwitchboardRead(raw);
      if (!read.isSwitchboard) return fail("That doesn't look like a switchboard. Try a straight-on photo with the cover open.", 422);
      return Response.json({ ok: true, read });
    } catch (e) {
      console.error("switchboard read failed", redactSecrets(e instanceof Error ? e.message : String(e)));
      return fail("The photo couldn't be read just now. Try again.", 502);
    }
  });
}
