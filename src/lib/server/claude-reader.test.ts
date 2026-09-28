import { afterEach, describe, expect, it, vi } from "vitest";
import { ClaudeReadError, readWithClaude } from "./claude-reader";

afterEach(() => vi.unstubAllGlobals());

const schema = { type: "object", properties: { kwh: { type: "number" } }, required: ["kwh"], additionalProperties: false } as const;

const ok = () =>
  Response.json({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content: [{ type: "text", text: '{"kwh":12}' }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  });

const overloaded = () =>
  Response.json(
    { type: "error", error: { type: "overloaded_error", message: "Overloaded" } },
    { status: 529, headers: { "retry-after-ms": "1" } },
  );

function stub(replies: (() => Response)[]) {
  const models: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      models.push(JSON.parse(init!.body as string).model);
      return (replies.shift() ?? ok)();
    }),
  );
  return models;
}

describe("readWithClaude", () => {
  it("retries, then reads with the second model when Claude is overloaded", async () => {
    const models = stub([overloaded, overloaded, ok]);
    await expect(readWithClaude([], schema, "Read it", "sk-ant-test")).resolves.toEqual({ kwh: 12 });
    expect(models).toEqual(["claude-opus-5", "claude-opus-5", "claude-sonnet-5"]);
  });

  it("recovers on the SDK's retry without switching model", async () => {
    const models = stub([overloaded, ok]);
    await expect(readWithClaude([], schema, "Read it", "sk-ant-test")).resolves.toEqual({ kwh: 12 });
    expect(models).toEqual(["claude-opus-5", "claude-opus-5"]);
  });

  it("gives up with a readable error when both models are overloaded", async () => {
    stub([overloaded, overloaded, overloaded, overloaded]);
    await expect(readWithClaude([], schema, "Read it", "sk-ant-test")).rejects.toThrow(ClaudeReadError);
  });

  it("doesn't switch model for a bad request", async () => {
    const models = stub([
      () => Response.json({ type: "error", error: { type: "invalid_request_error", message: "Bad image" } }, { status: 400 }),
    ]);
    await expect(readWithClaude([], schema, "Read it", "sk-ant-test")).rejects.toThrow(/400/);
    expect(models).toEqual(["claude-opus-5"]);
  });
});
