import { afterEach, describe, expect, it, vi } from "vitest";
import { describeInverter, isInverterSummary, summariseInverter } from "@/lib/domain/inverter";
import { readInverterWithClaude } from "./inverter-reader";

afterEach(() => vi.unstubAllGlobals());

describe("existing inverter", () => {
  it("keeps what could be read and rejects non-inverters", () => {
    const s = summariseInverter({ isInverter: true, brand: "Fronius", model: "Primo 5.0-1", ratedKw: 5, phase: "single", hybrid: false });
    expect(isInverterSummary(s) && describeInverter(s)).toBe("Fronius Primo 5.0-1 · 5 kW · single phase");
    expect(summariseInverter({ isInverter: false })).toBe("not-an-inverter");
    expect(summariseInverter({ isInverter: true, brand: null, model: null, ratedKw: null })).toBe("unreadable");
    // Watts mistaken for kW are dropped rather than trusted.
    expect((summariseInverter({ isInverter: true, brand: "SMA", ratedKw: 5000 }) as { ratedKw: number | null }).ratedKw).toBeNull();
  });

  it("sends every photo to Claude as an image", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        id: "m",
        type: "message",
        role: "assistant",
        model: "x",
        content: [
          {
            type: "text",
            text: JSON.stringify({ isInverter: true, brand: "SMA", model: "SB5.0", ratedKw: 5, phase: "single", hybrid: false }),
          },
        ],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const reading = await readInverterWithClaude(
      [
        { data: new ArrayBuffer(4), mediaType: "image/jpeg" },
        { data: new ArrayBuffer(4), mediaType: "image/png" },
      ],
      "key",
    );
    expect(reading).toMatchObject({ brand: "SMA", ratedKw: 5 });
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.messages[0].content.filter((c: { type: string }) => c.type === "image")).toHaveLength(2);
  });
});
