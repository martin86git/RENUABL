import { afterEach, describe, expect, it, vi } from "vitest";
import { BillReaderError, readBillWithClaude } from "./bill-reader";

afterEach(() => vi.unstubAllGlobals());

function message(text: string, stop_reason = "end_turn") {
  return Response.json({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5",
    content: [{ type: "text", text }],
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  });
}

function stub(response: () => Response) {
  const fetchMock = vi.fn(async (_url: unknown, _init?: unknown) => response()); // eslint-disable-line @typescript-eslint/no-unused-vars
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sent(fetchMock: ReturnType<typeof stub>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body as string) };
}

describe("readBillWithClaude", () => {
  it("sends a PDF as a document with structured output and fallbacks, and returns the parsed figures", async () => {
    const fetchMock = stub(() => message(JSON.stringify({ isElectricityBill: true, usageKwh: 1200 })));

    const reading = await readBillWithClaude(new TextEncoder().encode("%PDF").buffer as ArrayBuffer, "application/pdf", "key");
    expect(reading).toMatchObject({ isElectricityBill: true, usageKwh: 1200 });

    const { url, headers, body } = sent(fetchMock);
    expect(url).toContain("/v1/messages");
    expect(headers.get("x-api-key")).toBe("key");
    expect(headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(body.model).toBe("claude-opus-5");
    expect(body.fallbacks).toBe("default");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.tool_choice).toBeUndefined();
    expect(body.messages[0].content[0].type).toBe("document");
  });

  it("sends photos as images", async () => {
    const fetchMock = stub(() => message("{}"));
    await readBillWithClaude(new ArrayBuffer(4), "image/jpeg", "key").catch(() => undefined);
    expect(sent(fetchMock).body.messages[0].content[0]).toMatchObject({ type: "image", source: { media_type: "image/jpeg" } });
  });

  it("fails clearly on API errors and refusals", async () => {
    stub(() => Response.json({ type: "error", error: { type: "invalid_request_error", message: "bad" } }, { status: 400 }));
    await expect(readBillWithClaude(new ArrayBuffer(4), "image/png", "key")).rejects.toBeInstanceOf(BillReaderError);
    stub(() => message("", "refusal"));
    await expect(readBillWithClaude(new ArrayBuffer(4), "image/png", "key")).rejects.toBeInstanceOf(BillReaderError);
  });
});
