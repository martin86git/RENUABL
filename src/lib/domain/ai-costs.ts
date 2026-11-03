/**
 * What a call to Claude costs RENUABL, from its usage, so each Sol answer's real cost is kept beside the credits it
 * took (Martin, 3 Nov 2026: make sure Sol makes a profit). Pure, tested (`ai-costs.test.ts`).
 *
 * List prices in US dollars a million tokens, as published by Anthropic (read Oct 2026; VERIFY against the pricing page
 * when they change). Cache writes are charged at 1.25 times input (the five-minute cache), cache reads at the model's
 * own rate, and each web search at $10 a thousand. A model not listed is costed as Opus, so a cost is never
 * understated.
 */

interface Rate {
  input: number;
  output: number;
  cacheRead: number;
}

export const MODEL_RATES: Record<string, Rate> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
const UNKNOWN = MODEL_RATES["claude-opus-5"];
/** US dollars for each web search. */
export const WEB_SEARCH_USD = 0.01;

/** Usage as the API reports it, added up over every call an answer made. */
export interface AiUsage {
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  searches: number;
}

export const noUsage = (model: string): AiUsage => ({ model, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 });

/** The API's usage block, read loosely (fields can be missing or null). */
export function usageOf(model: string, raw: unknown): AiUsage {
  const u = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
  const server = (u.server_tool_use ?? {}) as Record<string, unknown>;
  return {
    model,
    input: n(u.input_tokens),
    output: n(u.output_tokens),
    cacheRead: n(u.cache_read_input_tokens),
    cacheWrite: n(u.cache_creation_input_tokens),
    searches: n(server.web_search_requests),
  };
}

/** Two calls' usage together; the model named is the later one's (an answer handed up ends on the deeper model). */
export function addUsage(a: AiUsage, b: AiUsage): AiUsage {
  return {
    model: b.model,
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    searches: a.searches + b.searches,
  };
}

/** US dollars, unrounded. Each call's own model should be costed on its own when they differ (`costOfCalls`). */
export function costUsd(u: AiUsage): number {
  const r = MODEL_RATES[u.model] ?? UNKNOWN;
  return (
    (u.input * r.input + u.output * r.output + u.cacheRead * r.cacheRead + u.cacheWrite * r.input * 1.25) / 1e6 +
    u.searches * WEB_SEARCH_USD
  );
}

/** Every call costed at its own model's rates. */
export const costOfCalls = (calls: readonly AiUsage[]): number => calls.reduce((sum, c) => sum + costUsd(c), 0);

/** Millionths of a US dollar, the whole number kept in the database. */
export const toMicros = (usd: number) => Math.max(0, Math.round(usd * 1e6));
