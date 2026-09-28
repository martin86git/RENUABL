/**
 * Server only. Reads a document or photos with Claude and returns JSON that
 * matches a schema (structured output), with server-side fallbacks if the
 * model declines. Used for bills and inverter labels. When Claude is
 * overloaded or erroring, the SDK retries, then a second model is tried.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaJSONSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/beta/json-schema";

const DEFAULT_MODEL = "claude-opus-5";
const DEFAULT_FALLBACK_MODEL = "claude-sonnet-5";

export class ClaudeReadError extends Error {}

type Schema = Parameters<typeof betaJSONSchemaOutputFormat>[0];

/** Overloaded (529), unavailable, rate limited or a server error: worth another model. */
export function isBusyError(e: unknown): boolean {
  return e instanceof Anthropic.APIError && typeof e.status === "number" && (e.status === 429 || e.status >= 500);
}

export async function readWithClaude<T>(
  files: Anthropic.Beta.BetaContentBlockParam[],
  schema: Schema,
  prompt: string,
  apiKey: string,
): Promise<T> {
  // One SDK retry per model (with backoff), and a timeout that keeps both models inside the 60 s route limit.
  const client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 });
  const primary = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const fallback = process.env.ANTHROPIC_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;
  const request = (model: string) => ({
    model,
    max_tokens: 4096,
    output_config: { format: betaJSONSchemaOutputFormat(schema) },
    messages: [{ role: "user" as const, content: [...files, { type: "text" as const, text: prompt }] }],
  });

  const ask = async (model: string) => {
    try {
      // If the model declines, the API retries on Anthropic's recommended fallback model.
      return await client.beta.messages.parse({ ...request(model), betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    } catch (e) {
      // Accounts or models without server-side fallbacks: ask again without them.
      if (!(e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message))) throw e;
      return await client.beta.messages.parse(request(model));
    }
  };

  let response;
  try {
    try {
      response = await ask(primary);
    } catch (e) {
      // Still overloaded after the SDK's retry: try the second model once.
      if (!isBusyError(e) || fallback === primary) throw e;
      response = await ask(fallback);
    }
  } catch (e) {
    if (e instanceof Anthropic.APIError) throw new ClaudeReadError(`Claude API ${e.status}: ${e.message}`);
    // parse() throws when the reply isn't schema JSON (e.g. a refusal or a cut-off reply).
    throw new ClaudeReadError(`Unreadable reply: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (response.stop_reason === "refusal") throw new ClaudeReadError("Claude declined to read the file");
  if (response.stop_reason === "max_tokens") throw new ClaudeReadError("Reading was cut off");
  if (!response.parsed_output) throw new ClaudeReadError("Claude returned no figures");
  return response.parsed_output as T;
}
