/**
 * Server only. Reads a document or photos with Claude and returns JSON that
 * matches a schema (structured output), with server-side fallbacks if the
 * model declines. Used for bills and inverter labels.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaJSONSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/beta/json-schema";

const DEFAULT_MODEL = "claude-opus-5";

export class ClaudeReadError extends Error {}

type Schema = Parameters<typeof betaJSONSchemaOutputFormat>[0];

export async function readWithClaude<T>(
  files: Anthropic.Beta.BetaContentBlockParam[],
  schema: Schema,
  prompt: string,
  apiKey: string,
): Promise<T> {
  const client = new Anthropic({ apiKey, timeout: 45_000, maxRetries: 0 });
  const request = {
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    max_tokens: 4096,
    output_config: { format: betaJSONSchemaOutputFormat(schema) },
    messages: [{ role: "user" as const, content: [...files, { type: "text" as const, text: prompt }] }],
  };

  let response;
  try {
    try {
      // If the model declines, the API retries on Anthropic's recommended fallback model.
      response = await client.beta.messages.parse({ ...request, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    } catch (e) {
      // Accounts or models without server-side fallbacks: ask again without them.
      if (!(e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message))) throw e;
      response = await client.beta.messages.parse(request);
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
