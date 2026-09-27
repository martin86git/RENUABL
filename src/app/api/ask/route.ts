import { askSystemPrompt, cleanAskInput, type AskContext, type AskSnapshot } from "@/lib/domain/ask-knowledge";
import { AskError, answerWithClaude } from "@/lib/server/ask-claude";
import { parseApiKey, redactSecrets } from "@/lib/server/bill-reader";

const CONTEXTS: AskContext[] = ["home", "profile", "recommendation", "extras", "installer", "schedule", "checkout", "my"];

/**
 * POST { question, context, snapshot, history } → { answer }. Without a Claude
 * key (or if Claude fails) it returns 503/502 and the page falls back to its
 * reviewed canned answers.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const input = cleanAskInput(body);
  if (!input) return Response.json({ ok: false }, { status: 400 });
  const context = CONTEXTS.includes(body.context as AskContext) ? (body.context as AskContext) : "home";
  const snapshot = snapshotFrom(body.snapshot);

  const apiKey = parseApiKey(process.env.ANTHROPIC_API_KEY);
  if (!apiKey) return Response.json({ ok: false, fallback: true }, { status: 503 });
  try {
    const answer = await answerWithClaude({ system: askSystemPrompt(context, snapshot), ...input }, apiKey);
    return Response.json({ ok: true, answer });
  } catch (e) {
    console.error("ask failed", redactSecrets(e instanceof AskError ? e.message : String(e)));
    return Response.json({ ok: false, fallback: true }, { status: 502 });
  }
}

/** Only known fields, as short strings, numbers or booleans. */
function snapshotFrom(raw: unknown): AskSnapshot {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string).slice(0, 160) : undefined);
  const num = (k: string) => (typeof r[k] === "number" && Number.isFinite(r[k]) ? (r[k] as number) : undefined);
  const bool = (k: string) => (typeof r[k] === "boolean" ? (r[k] as boolean) : undefined);
  return {
    suburb: str("suburb"),
    state: str("state"),
    dailyUsageKwh: num("dailyUsageKwh"),
    hasSolar: bool("hasSolar"),
    roof: str("roof"),
    storeys: str("storeys"),
    phase: str("phase"),
    wantsBattery: bool("wantsBattery"),
    option: str("option"),
    system: str("system"),
    priceAfterRebates: num("priceAfterRebates"),
    rebates: Array.isArray(r.rebates)
      ? r.rebates
          .filter((x): x is string => typeof x === "string")
          .slice(0, 6)
          .map((x) => x.slice(0, 120))
      : undefined,
    installDate: str("installDate"),
    installer: str("installer"),
    reserved: bool("reserved"),
  };
}
