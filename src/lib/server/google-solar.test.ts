import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { roofLookup } from "./google-solar";

const insights = {
  imageryQuality: "BASE",
  solarPotential: { maxArrayAreaMeters2: 60, roofSegmentStats: [{ azimuthDegrees: 0, pitchDegrees: 20, stats: { areaMeters2: 60 } }] },
};

function stub(replies: (() => Response)[]) {
  const qualities: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      qualities.push(new URL(String(url)).searchParams.get("requiredQuality") ?? "");
      return replies.shift()!();
    }),
  );
  return qualities;
}

// A different home each test, so the in-memory cache doesn't answer.
let lng = 144.9;
beforeEach(() => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  lng += 0.01;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("roofLookup", () => {
  it("falls back to base-quality imagery when medium has none", async () => {
    const qualities = stub([() => new Response("{}", { status: 404 }), () => Response.json(insights)]);
    const r = await roofLookup(-37.8, lng);
    expect(qualities).toEqual(["MEDIUM", "BASE"]);
    expect(r.data?.insights.usableAreaM2).toBe(60);
  });

  it("says when Google has no roof for the home", async () => {
    stub([() => new Response("{}", { status: 404 }), () => new Response("{}", { status: 404 })]);
    expect((await roofLookup(-37.8, lng)).reason).toBe("no-coverage");
  });

  it("reports Google refusing, without echoing the key", async () => {
    // Google's real errors carry long "details"; the message must survive them.
    const details = Array.from({ length: 10 }, (_, i) => ({
      reason: `DETAIL_${i}`,
      metadata: { consumer: "projects/123", service: "solar" },
    }));
    stub([
      () => Response.json({ error: { message: "Solar API has not been used in project 123 (key=test-key)", details } }, { status: 403 }),
    ]);
    const r = await roofLookup(-37.8, lng);
    expect(r.reason).toMatch(/^google-403: Solar API has not been used/);
    expect(r.reason).not.toContain("test-key");
  });

  it("needs a key", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    expect((await roofLookup(-37.8, lng)).reason).toBe("no-key");
  });
});
