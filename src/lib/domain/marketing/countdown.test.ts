import { describe, expect, it } from "vitest";
import { cleanEndsAt, countdownFrames, countdownSvg, ended, endsAtMs, endsWords, timeLeft } from "./countdown";
import { DEFAULT_BRAND, cleanBlock, contentProblem, newBlock, renderEdm, type EdmContent } from "./edm";

const sender = { name: "Sunrise Solar", abn: null, email: "hi@sunrise.example", phone: null, address: null };
const links = {
  click: (i: number) => `https://site.test/api/m/c/tok?l=${i}`,
  pixel: null,
  unsubscribe: "https://site.test/m/u/abc",
  image: (id: string) => `https://site.test/api/m/i/${id}`,
};
const email = (endsAt: string | null): EdmContent => ({
  subject: "s",
  preview: "",
  blocks: [
    { ...newBlock("heading"), text: "Sale" },
    { ...newBlock("countdown"), text: "Hi {firstName}, it ends in", endsAt },
  ],
});

describe("countdown times", () => {
  it("keeps only a real wall-clock time", () => {
    expect(cleanEndsAt("2026-11-30T17:00")).toBe("2026-11-30T17:00");
    expect(cleanEndsAt(" 2026-11-30T17:00 ")).toBe("2026-11-30T17:00");
    expect(cleanEndsAt("2026-02-30T17:00")).toBeNull();
    expect(cleanEndsAt("2026-11-30T24:00")).toBeNull();
    expect(cleanEndsAt("2026-11-30")).toBeNull();
    expect(cleanEndsAt(42)).toBeNull();
  });

  it("reads the end in Melbourne time, daylight saving counted", () => {
    expect(new Date(endsAtMs("2026-11-30T17:00")).toISOString()).toBe("2026-11-30T06:00:00.000Z");
    expect(new Date(endsAtMs("2026-06-30T17:00")).toISOString()).toBe("2026-06-30T07:00:00.000Z");
    expect(endsWords("2026-11-30T17:00")).toBe("Ends Monday 30 November at 5:00 pm (Melbourne time)");
  });

  it("counts down to zero and stops there", () => {
    const end = Date.UTC(2026, 10, 30, 6);
    const now = end - (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;
    expect(timeLeft(end, now)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
    expect(ended(timeLeft(end, end + 5000))).toBe(true);
    const frames = countdownFrames(end, end - 3000, 5);
    expect(frames.map((f) => f.seconds)).toEqual([3, 2, 1, 0, 0]);
    expect(timeLeft(end, end - 2000 * 86400_000).days).toBe(999);
  });

  it("draws the tiles in the colour, grey once ended, and no text", () => {
    const svg = countdownSvg({ days: 1, hours: 2, minutes: 3, seconds: 4 }, "ff5a1f");
    expect(svg).toContain('fill="#ff5a1f"');
    expect(svg).not.toContain("<text");
    expect(countdownSvg({ days: 0, hours: 0, minutes: 0, seconds: 0 }, "ff5a1f")).toContain("#a1a1aa");
  });
});

describe("countdown blocks", () => {
  it("starts centred with a line and no end", () => {
    const b = newBlock("countdown");
    expect(b).toMatchObject({ align: "center", text: "Offer ends in", endsAt: null });
  });

  it("cleans the end and the line", () => {
    const b = cleanBlock({ kind: "countdown", text: "x".repeat(200), endsAt: "nonsense", url: "https://a.test" })!;
    expect(b.endsAt).toBeNull();
    expect(b.url).toBeNull();
    expect(b.text.length).toBeLessThanOrEqual(80);
  });

  it("won't send without an end", () => {
    expect(contentProblem(email(null))).toMatch(/countdown has no end/);
    expect(contentProblem(email("2026-11-30T17:00"))).toBeNull();
  });

  it("sends the timer picture with the end in words beside it", () => {
    const r = renderEdm(
      email("2026-11-30T17:00"),
      DEFAULT_BRAND,
      sender,
      { firstName: "Sam", company: null },
      {
        ...links,
        countdown: (end, colour) => `https://site.test/api/m/t/${end}.gif?c=${colour}`,
      },
    );
    const end = Math.round(Date.UTC(2026, 10, 30, 6) / 1000);
    expect(r.html).toContain(`https://site.test/api/m/t/${end}.gif?c=ff5a1f`);
    expect(r.html).toContain('alt="Ends Monday 30 November at 5:00 pm (Melbourne time)"');
    expect(r.html).toContain(">Minutes<");
    expect(r.html).toContain("Hi Sam, it ends in");
    expect(r.text).toContain("Hi Sam, it ends in\nEnds Monday 30 November at 5:00 pm (Melbourne time)");
  });

  it("says the end in words alone where no timer can be drawn", () => {
    const r = renderEdm(email("2026-11-30T17:00"), DEFAULT_BRAND, sender, { firstName: "Sam", company: null }, links);
    expect(r.html).not.toContain("/api/m/t/");
    expect(r.html).toContain("Ends Monday 30 November at 5:00 pm");
  });
});
