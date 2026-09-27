/**
 * Server only. Ask RENUABL answers from Claude, grounded in reviewed facts and
 * the customer's own answers (src/lib/domain/ask-knowledge.ts).
 */
import Anthropic from "@anthropic-ai/sdk";

/** A fast model for chat; override with ASK_MODEL. */
const DEFAULT_MODEL = "claude-sonnet-5";

export class AskError extends Error {}

export async function answerWithClaude(
  input: { system: string; question: string; history: { q: string; a: string }[] },
  apiKey: string,
): Promise<string> {
  const client = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 });
  const messages: Anthropic.MessageParam[] = [
    ...input.history.flatMap((t) => [
      { role: "user" as const, content: t.q },
      { role: "assistant" as const, content: t.a },
    ]),
    { role: "user", content: input.question },
  ];
  let response;
  try {
    response = await client.messages.create({
      model: process.env.ASK_MODEL || DEFAULT_MODEL,
      max_tokens: 400,
      system: input.system,
      messages,
    });
  } catch (e) {
    throw new AskError(e instanceof Anthropic.APIError ? `Claude API ${e.status}: ${e.message}` : String(e));
  }
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text || response.stop_reason === "refusal") throw new AskError(`No answer (${response.stop_reason})`);
  return text;
}
