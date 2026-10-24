import { describe, expect, it } from "vitest";
import { closedThisMonth, installsToday, newLeadsToday, salesToday } from "./pad";
import type { JobStage } from "./crm";

let n = 0;
const job = (
  stage: JobStage,
  more: Partial<{ value: number; kw: number; wonAt: string; installDate: string; createdAt: string }> = {},
) => ({
  id: `job_${++n}`,
  stage,
  value: more.value ?? null,
  kw: more.kw ?? null,
  wonAt: more.wonAt ?? null,
  installDate: more.installDate ?? null,
  createdAt: more.createdAt ?? "2026-09-01T00:00:00Z",
});

// 25 Oct 2026 in Melbourne (AEDT, UTC+11) runs from 24 Oct 13:00 UTC to 25 Oct 13:00 UTC.
const TODAY = "2026-10-25";

describe("the pad", () => {
  it("counts a lead made this morning in Melbourne as today's, even though it was yesterday in UTC", () => {
    const early = job("lead", { createdAt: "2026-10-24T20:00:00Z" });
    const later = job("designed", { createdAt: "2026-10-25T01:00:00Z" });
    const before = job("lead", { createdAt: "2026-10-24T12:00:00Z" });
    expect(newLeadsToday([early, before, later], TODAY).map((j) => j.id)).toEqual([later.id, early.id]);
  });

  it("lists today's installs, leaving lost deals out", () => {
    const a = job("scheduled", { installDate: TODAY });
    const lost = job("lost", { installDate: TODAY });
    const tomorrow = job("scheduled", { installDate: "2026-10-26" });
    expect(installsToday([a, lost, tomorrow], TODAY)).toEqual([a]);
  });

  it("closes this month's sales newest first, and adds up today and the month with its pace", () => {
    const one = job("won", { value: 10000, kw: 6.6, wonAt: "2026-10-03T01:00:00Z" });
    const two = job("installed", { value: 5000.4, kw: 3.3, wonAt: "2026-10-24T22:00:00Z" });
    const last = job("won", { value: 9000, wonAt: "2026-09-30T01:00:00Z" });
    const lost = job("lost", { value: 9000, wonAt: "2026-10-10T01:00:00Z" });
    expect(closedThisMonth([one, two, last, lost], TODAY)).toEqual([two, one]);
    const s = salesToday([one, two, last, lost], TODAY);
    expect(s.today).toEqual({ deals: 1, value: 5000, kw: 3.3 });
    expect(s.month).toEqual({ deals: 2, value: 15000, kw: 9.9 });
    expect(s).toMatchObject({ day: 25, days: 31, projected: Math.round((15000 / 25) * 31) });
  });
});
