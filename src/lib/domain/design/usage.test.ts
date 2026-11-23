import { describe, expect, it } from "vitest";
import { beyondWords, daysLeft, daysOf, noticeDue, percentUsed, percentWords, periodEnd, stackSol, usageNoticeEmail } from "./usage";

describe("usage meters", () => {
  it("works out the share used", () => {
    expect(percentUsed({ used: 75, included: 150 })).toBe(50);
    expect(percentUsed({ used: 5, included: 0 })).toBe(0);
    expect(percentWords({ used: 3, included: 150 })).toBe("2%");
    expect(percentWords({ used: 1, included: 150 })).toBe("0.6%");
    expect(percentWords({ used: 0, included: 150 })).toBe("0%");
    expect(percentWords({ used: 0, included: 0 })).toBe("–");
  });

  it("sends only the highest step passed, once", () => {
    const m = { key: "sol" as const, used: 76, included: 150 };
    expect(noticeDue(m, [])).toBe(50);
    expect(noticeDue(m, [50])).toBeNull();
    expect(noticeDue({ ...m, used: 135 }, [])).toBe(80);
    expect(noticeDue({ ...m, used: 135 }, [50])).toBe(80);
    expect(noticeDue({ ...m, used: 150 }, [50, 80])).toBe(100);
    expect(noticeDue({ ...m, used: 160 }, [100])).toBeNull();
    expect(noticeDue({ ...m, used: 10 }, [])).toBeNull();
    expect(noticeDue({ ...m, included: 0, used: 10 }, [])).toBeNull();
  });

  it("knows the month's end and days left", () => {
    expect(periodEnd("2026-11")).toEqual({ iso: "2026-11-30", words: "30 November 2026" });
    expect(periodEnd("2028-02").iso).toBe("2028-02-29");
    expect(daysLeft("2026-11-23", "2026-11")).toBe(8);
    expect(daysOf("2026-11")).toHaveLength(30);
  });

  it("says what happens beyond the allowance truthfully", () => {
    expect(beyondWords("sol", { solStops: false, capCents: 0 })).not.toMatch(/stops/);
    expect(beyondWords("sol", { solStops: true, capCents: 0 })).toMatch(/stops answering/);
    expect(beyondWords("minutes", { solStops: false, capCents: 10_000 })).toMatch(/50c a minute.*\$100 a month/);
    expect(beyondWords("texts", { solStops: false, capCents: 0 })).toMatch(/send no texts/);
  });

  it("builds the owner's email from figures, escaped", () => {
    const mail = usageNoticeEmail({
      business: "Sun & <Co>",
      step: 50,
      key: "sol",
      meters: [{ key: "sol", used: 75, included: 150 }],
      month: "2026-11",
      solStops: false,
      capCents: 10_000,
      link: "https://www.renuabl.com.au/design/settings/usage",
    });
    expect(mail.subject).toBe("You've used 50% of this month's Sol credits");
    expect(mail.text).toMatch(/75 of 150 credits/);
    expect(mail.text).toMatch(/30 November 2026/);
    expect(mail.html).toContain("Sun &amp; &lt;Co&gt;");
    expect(mail.html).not.toContain("<Co>");
    expect(mail.html).toContain("View my usage");
    const all = usageNoticeEmail({
      ...{ business: "A", key: "texts", meters: [], month: "2026-11", solStops: false, capCents: 0, link: null },
      step: 100,
    });
    expect(all.subject).toBe("You've used all of this month's free texts");
    expect(all.html).not.toContain("View my usage");
  });

  it("stacks Sol's use by kind and by person, folding the rest", () => {
    const rows = [
      { day: "2026-11-02", use: "chat", by: "jo@x.com", credits: 3 },
      { day: "2026-11-02", use: "inbox", by: "sam@x.com", credits: 1 },
      { day: "2026-11-05", use: "chat", by: null, credits: 2 },
      { day: "2026-12-01", use: "chat", by: null, credits: 9 },
    ];
    const byUse = stackSol(rows, "2026-11", "use");
    expect(byUse.series.map((s) => s.label)).toEqual(["Asked Sol", "Email summary or draft"]);
    expect(byUse.days[1]).toMatchObject({ day: "2026-11-02", total: 4 });
    const byPerson = stackSol(rows, "2026-11", "person");
    expect(byPerson.series.map((s) => s.label)).toEqual(["jo", "Sol by himself", "sam"]);
    const many = Array.from({ length: 10 }, (_, i) => ({ day: "2026-11-01", use: "chat", by: `p${i}@x.com`, credits: 10 - i }));
    const folded = stackSol(many, "2026-11", "person");
    expect(folded.series).toHaveLength(8);
    expect(folded.series[7]).toMatchObject({ label: "Other", total: 3 + 2 + 1 });
  });
});
