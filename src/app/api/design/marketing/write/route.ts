import { SOL_OUT_SHORT } from "@/lib/domain/design/sol-credits";
import { EDM_LIMITS } from "@/lib/domain/marketing/edm";
import { EDM_SOL_LIMITS, cleanEdmSol, edmSolPrompt, edmSolSchema, edmSolTier, isEdmSolPart } from "@/lib/domain/marketing/edm-sol";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";
import { readWithClaude } from "@/lib/server/claude-reader";
import { answer } from "@/lib/server/design-context";
import { senderFor } from "@/lib/server/marketing-access";
import { marketingMember, readJson, refuse } from "@/lib/server/marketing-guard";
import { allow } from "@/lib/server/rate-limit";
import { withSolCredit } from "@/lib/server/sol-credits";

export const maxDuration = 60;

/**
 * POST {part, brief, draft} (members who may publish, where Marketing is on): Sol writes a marketing email's subject,
 * preview line, heading or words, or all four from a brief (domain/marketing/edm-sol.ts). Quick for a line, deep for the
 * words; Sol credits as any answer (use "marketing"). Nothing is kept or sent: the answer goes into the editor.
 */
export async function POST(request: Request) {
  return answer(async () => {
    const gate = await marketingMember("publish");
    if ("refuse" in gate) return gate.refuse;
    const { member } = gate;
    if (!allow(request, "marketing-sol", 120)) return refuse("Too many in the last hour. Try again shortly.", 429);
    const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
    if (!apiKey) return refuse("Sol isn't set up here.", 503);
    const b = await readJson(request);
    if (!b || !isEdmSolPart(b.part)) return refuse("Bad request.", 400);
    const part = b.part;
    const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max).trim() : "");
    const brief = text(b.brief, EDM_SOL_LIMITS.brief);
    const d = (b.draft && typeof b.draft === "object" ? b.draft : {}) as Record<string, unknown>;
    const draft = {
      subject: text(d.subject, EDM_LIMITS.subject),
      preview: text(d.preview, EDM_LIMITS.preview),
      heading: text(d.heading, EDM_LIMITS.heading),
      text: text(d.text, EDM_LIMITS.text),
    };
    if (part === "all" && !brief) return refuse("Tell Sol what the email is about.");
    if (!brief && !Object.values(draft).some((v) => v && v !== "Hi {firstName},"))
      return refuse("Write a line about what the email is for, or some of the email first.");
    const business = (await senderFor(member.businessId)).name || member.businessName;
    const prompt = edmSolPrompt(part, { business, brief, draft });
    const tier = edmSolTier(part);
    const out = await withSolCredit(
      member.businessId,
      "marketing",
      member.email,
      (ai) => readWithClaude<unknown>([], edmSolSchema(part), prompt, apiKey, ai),
      tier,
      part === "all" ? "marketing email written" : `marketing ${part} written`,
    ).catch((e) => {
      console.error("marketing sol failed", redactSecrets(e instanceof Error ? e.message : String(e)));
      return null;
    });
    if (out === "out") return refuse(SOL_OUT_SHORT, 402);
    const clean = cleanEdmSol(part, out);
    if (!clean) return refuse("Sol couldn't write that just now. Try again in a moment.", 502);
    return Response.json({ ok: true, ...clean });
  });
}
