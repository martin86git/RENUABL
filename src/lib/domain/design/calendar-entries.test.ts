import { describe, expect, it } from "vitest";
import { MAX_ENTRY_DAYS, cleanEntryInput, entriesOn, entryLabel, tentativeInWeek } from "./calendar-entries";

describe("entries put on the install calendar by hand", () => {
  it("takes a kind, real days in order and tidy words", () => {
    const got = cleanEntryInput({ kind: "off", from: "2026-11-12", who: "  Sam   Smith ", note: " Dentist " });
    expect(got).toEqual({
      ok: true,
      entry: { kind: "off", from: "2026-11-12", to: "2026-11-12", title: "", note: "Dentist", who: "Sam Smith", jobId: null },
    });
  });

  it("refuses what isn't an entry", () => {
    expect(cleanEntryInput({ kind: "party", from: "2026-11-12" }).ok).toBe(false);
    expect(cleanEntryInput({ kind: "off", from: "2026-02-30" }).ok).toBe(false);
    expect(cleanEntryInput({ kind: "off", from: "2026-11-12", to: "2026-11-11" }).ok).toBe(false);
    expect(cleanEntryInput({ kind: "off", from: "2026-11-01", to: "2026-12-15" })).toEqual({
      ok: false,
      message: `An entry can run for ${MAX_ENTRY_DAYS} days at most.`,
    });
    expect(cleanEntryInput({ kind: "note", from: "2026-11-12", title: "  " }).ok).toBe(false);
  });

  it("keeps a deal only on a tentative install", () => {
    const tentative = cleanEntryInput({ kind: "tentative", from: "2026-11-12", jobId: "job_abc" });
    const off = cleanEntryInput({ kind: "off", from: "2026-11-12", jobId: "job_abc" });
    expect(tentative.ok && tentative.entry.jobId).toBe("job_abc");
    expect(off.ok && off.entry.jobId).toBeNull();
    const bad = cleanEntryInput({ kind: "tentative", from: "2026-11-12", jobId: "x'; drop" });
    expect(bad.ok && bad.entry.jobId).toBeNull();
  });

  it("finds the entries on a day, a span included", () => {
    const entries = [
      { id: "a", from: "2026-11-10", to: "2026-11-14" },
      { id: "b", from: "2026-11-12", to: "2026-11-12" },
    ] as const;
    expect(entriesOn(entries, "2026-11-12").map((e) => e.id)).toEqual(["a", "b"]);
    expect(entriesOn(entries, "2026-11-15")).toEqual([]);
  });

  it("names an entry by its words, its customer, or its kind", () => {
    expect(entryLabel({ kind: "tentative", title: "", who: "", customer: "Ava Reid" })).toBe("Ava Reid");
    expect(entryLabel({ kind: "off", title: "", who: "Sam", customer: null })).toBe("Sam off");
    expect(entryLabel({ kind: "off", title: "", who: "", customer: null })).toBe("Day off");
    expect(entryLabel({ kind: "note", title: "Crane booked", who: "", customer: null })).toBe("Crane booked");
  });

  it("counts the tentative installs touching a week", () => {
    const entries = [
      { kind: "tentative", from: "2026-11-09", to: "2026-11-09" },
      { kind: "tentative", from: "2026-11-15", to: "2026-11-17" },
      { kind: "off", from: "2026-11-10", to: "2026-11-10" },
      { kind: "tentative", from: "2026-11-16", to: "2026-11-16" },
    ] as const;
    expect(tentativeInWeek(entries, "2026-11-09")).toBe(2);
  });
});
