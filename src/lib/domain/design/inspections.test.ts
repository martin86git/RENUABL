import { describe, expect, it } from "vitest";
import {
  certificateProblem,
  cleanOutcome,
  inspectionLive,
  inspectionWords,
  looksLike,
  nominateRefusal,
  nominatedEmail,
  outcomeEmail,
} from "./inspections";

describe("nominating an inspector", () => {
  it("is for a job the installer accepted, a connected inspector, one at a time", () => {
    const ok = { accepted: true, connected: true, kind: "inspector", live: false };
    expect(nominateRefusal(ok)).toBeNull();
    expect(nominateRefusal({ ...ok, accepted: false })).toMatch(/Accept the job first/);
    expect(nominateRefusal({ ...ok, connected: false })).toMatch(/connected with/);
    expect(nominateRefusal({ ...ok, kind: "installer" })).toMatch(/electrical inspector/);
    expect(nominateRefusal({ ...ok, live: true })).toMatch(/already nominated/);
  });

  it("stays open until declined or taken back", () => {
    for (const s of ["nominated", "booked", "passed", "defects"] as const) expect(inspectionLive(s)).toBe(true);
    expect(inspectionLive("declined")).toBe(false);
    expect(inspectionLive("withdrawn")).toBe(false);
  });
});

describe("the inspector's record", () => {
  it("needs a day to book, and the defects in words", () => {
    expect(cleanOutcome({ state: "booked", on: "2026-11-20", notes: "" })).toEqual({
      ok: true,
      state: "booked",
      on: "2026-11-20",
      notes: "",
    });
    expect(cleanOutcome({ state: "booked", on: "" }).ok).toBe(false);
    expect(cleanOutcome({ state: "defects", notes: "  " }).ok).toBe(false);
    expect(cleanOutcome({ state: "defects", notes: "Isolator label missing" })).toMatchObject({ ok: true, state: "defects" });
    expect(cleanOutcome({ state: "passed" })).toMatchObject({ ok: true, state: "passed", on: null });
    expect(cleanOutcome({ state: "nominated" }).ok).toBe(false);
  });

  it("takes a certificate as a PDF or photo, by its own bytes, under 4 MB", () => {
    expect(certificateProblem({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(certificateProblem({ type: "image/svg+xml", size: 1000 })).toMatch(/PDF or a photo/);
    expect(certificateProblem({ type: "application/pdf", size: 5 * 1024 * 1024 })).toMatch(/over 4 MB/);
    expect(looksLike("application/pdf", new TextEncoder().encode("%PDF-1.7 rest"))).toBe(true);
    expect(looksLike("application/pdf", new TextEncoder().encode("<html>"))).toBe(false);
    expect(looksLike("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff]))).toBe(true);
  });

  it("says where it stands", () => {
    expect(inspectionWords({ inspector: "Gamma", state: "nominated", on: null })).toBe("Gamma nominated, waiting to book");
    expect(inspectionWords({ inspector: "Gamma", state: "booked", on: "2026-11-20" })).toMatch(/^Booked with Gamma for Fri/);
    expect(inspectionWords({ inspector: "Gamma", state: "passed", on: null })).toBe("Passed: Gamma");
  });
});

describe("the emails", () => {
  it("name who and where, never the customer", () => {
    const n = nominatedEmail({ installer: "Beta <Installs>", suburb: "Clayton", day: "2026-11-20", link: "https://x.example" });
    expect(n.subject).toBe("Beta <Installs> nominated you to inspect a job in Clayton");
    expect(n.html).toContain("Beta &lt;Installs&gt;");
    const o = outcomeEmail({ inspector: "Gamma", outcome: "defects", suburb: "Clayton", on: null, link: "https://x.example" });
    expect(o.subject).toBe("Inspection in Clayton: Defects found");
    expect(o.text).toContain("found defects to put right");
  });
});
