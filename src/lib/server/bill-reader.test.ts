import { afterEach, describe, expect, it, vi } from "vitest";
import { BillReaderError, readBillWithClaude } from "./bill-reader";

afterEach(() => vi.unstubAllGlobals());

describe("readBillWithClaude", () => {
  it("sends a PDF as a document and returns the forced tool call's figures", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ content: [{ type: "tool_use", name: "record_bill", input: { isElectricityBill: true, usageKwh: 1200 } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const reading = await readBillWithClaude(new TextEncoder().encode("%PDF").buffer as ArrayBuffer, "application/pdf", "key");
    expect(reading).toEqual({ isElectricityBill: true, usageKwh: 1200 });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(init.body as string);
    expect(body.tool_choice).toEqual({ type: "tool", name: "record_bill" });
    expect(body.messages[0].content[0].type).toBe("document");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("key");
  });

  it("sends photos as images", async () => {
    const fetchMock = vi.fn(async () => Response.json({ content: [{ type: "tool_use", name: "record_bill", input: {} }] }));
    vi.stubGlobal("fetch", fetchMock);
    await readBillWithClaude(new ArrayBuffer(4), "image/jpeg", "key");
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.messages[0].content[0]).toMatchObject({ type: "image", source: { media_type: "image/jpeg" } });
  });

  it("fails clearly on API errors or a missing tool call", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("overloaded", { status: 529 })),
    );
    await expect(readBillWithClaude(new ArrayBuffer(4), "image/png", "key")).rejects.toBeInstanceOf(BillReaderError);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ content: [{ type: "text", text: "hi" }] })),
    );
    await expect(readBillWithClaude(new ArrayBuffer(4), "image/png", "key")).rejects.toBeInstanceOf(BillReaderError);
  });
});
