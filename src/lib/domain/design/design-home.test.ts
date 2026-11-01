import { describe, expect, it } from "vitest";
import {
  attachRefusal,
  attachable,
  designsDone,
  mondayOf,
  siteState,
  sitesOf,
  toDesign,
  waitedWords,
  type SiteLine,
  type WaitingInput,
} from "./design-home";
import { timelineOf } from "./timeline";

const job = (id: string, createdAt: string, more: Partial<WaitingInput> = {}): WaitingInput => ({
  id,
  customerName: `Customer ${id}`,
  title: "Solar",
  address: "1 Sample Street",
  lat: -37.8,
  lng: 145,
  stage: "lead",
  projectId: null,
  createdAt,
  ...more,
});

describe("the design tool's home", () => {
  const now = new Date("2026-11-04T02:00:00Z"); // Wednesday 4 Nov, 1 pm in Melbourne

  it("lists deals still being sold with no design, the longest waiting first, within the window", () => {
    const jobs = [
      job("a", "2026-11-03T23:00:00Z"),
      job("b", "2026-10-30T00:00:00Z"),
      job("c", "2026-09-01T00:00:00Z"),
      job("d", "2026-11-01T00:00:00Z", { projectId: "prj_1" }),
      job("e", "2026-11-01T00:00:00Z", { stage: "won" }),
      job("f", "2026-11-02T00:00:00Z", { lat: null, lng: null }),
    ];
    const { list, older } = toDesign(jobs, now, 30);
    expect(list.map((j) => j.id)).toEqual(["b", "f", "a"]);
    expect(older).toBe(1);
    expect(list[0]).toMatchObject({ days: 5, late: true, placed: true });
    expect(list[1].placed).toBe(false);
    expect(list[2]).toMatchObject({ days: 0, late: false });
    expect(toDesign(jobs, now, null).list).toHaveLength(4);
    expect(waitedWords(0)).toBe("In today");
    expect(waitedWords(1)).toBe("Waiting 1 day");
  });

  it("counts designs done today and through the working week", () => {
    expect(mondayOf("2026-11-04")).toBe("2026-11-02");
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
    const done = designsDone(
      [
        { jobId: "a", customerName: "Ana", at: "2026-11-04T01:00:00Z" },
        { jobId: "b", customerName: "Ben", at: "2026-11-02T03:00:00Z" },
        { jobId: "c", customerName: "Cy", at: "2026-10-30T03:00:00Z" },
      ],
      now,
    );
    expect(done.today.map((d) => d.jobId)).toEqual(["a"]);
    expect(done.week.map((d) => [d.label, d.count, d.today])).toEqual([
      ["Mon", 1, false],
      ["Tue", 0, false],
      ["Wed", 1, true],
      ["Thu", 0, false],
      ["Fri", 0, false],
    ]);
    expect(done.weekTotal).toBe(2);
  });

  it("lists recent roofs and those not on a deal, and puts a site only on a deal with no design or place", () => {
    const site = (id: string, updatedAt: string, jobId: string | null, published = false): SiteLine => ({
      id,
      address: id,
      lat: 0,
      lng: 0,
      panels: 10,
      kw: 4.75,
      updatedAt,
      jobId,
      customerName: null,
      published,
    });
    const { recent, loose } = sitesOf([site("x", "2026-11-01", null), site("y", "2026-11-03", "job_1", true)]);
    expect(recent.map((s) => s.id)).toEqual(["y", "x"]);
    expect(loose.map((s) => s.id)).toEqual(["x"]);
    expect([siteState(recent[0]), siteState(recent[1]), siteState({ jobId: "j", published: false })]).toEqual([
      "Published",
      "Site only",
      "On a deal",
    ]);
    expect(attachRefusal({ lat: null, lng: null, projectId: null })).toBeNull();
    expect(attachRefusal({ lat: null, lng: null, projectId: "p" })).toMatch(/already has a design/);
    expect(attachRefusal({ lat: 1, lng: 2, projectId: null })).toMatch(/address of its own/);
    expect(
      attachable([
        { stage: "lead", lat: null, lng: null, projectId: null },
        { stage: "won", lat: null, lng: null, projectId: null },
      ]),
    ).toHaveLength(1);
  });
});

describe("the proposal timeline", () => {
  it("puts each publish with its options, then the rest, newest first, without the publish drawn twice", () => {
    const t = timelineOf({
      versions: [
        {
          version: 1,
          publishedAt: "2026-11-01T01:00:00Z",
          by: "sam@x.example",
          options: [{ name: "Solar", system: "6.65 kW", youPay: 7000 }],
        },
        { version: 2, publishedAt: "2026-11-02T01:00:00Z", by: "sam@x.example", options: [] },
      ],
      activity: [
        { kind: "proposal", text: "Proposal sent", by: "sam@x.example", at: "2026-11-01T01:00:01Z" },
        { kind: "proposal", text: "Proposal (version 2) sent", by: "sam@x.example", at: "2026-11-02T01:00:01Z" },
        { kind: "proposal", text: "Opened the proposal", by: "Customer", at: "2026-11-02T05:00:00Z" },
        { kind: "email", text: "Email to ana@x.example: Your proposal\n\nHi Ana", by: "sam@x.example", at: "2026-11-02T02:00:00Z" },
        { kind: "note", text: "Called", by: "sam@x.example", at: "2026-11-02T03:00:00Z" },
      ],
      messages: [{ fromCustomer: true, text: "Can we add a battery?", at: "2026-11-02T06:00:00Z" }],
    });
    expect(t.map((e) => e.kind)).toEqual(["customer", "proposal", "email", "published", "published"]);
    expect(t[3]).toMatchObject({ title: "Version 2 published" });
    expect(t[4].options).toEqual([{ name: "Solar", system: "6.65 kW", youPay: 7000 }]);
    expect(t[2]).toMatchObject({ title: "Email to ana@x.example: Your proposal", detail: "Hi Ana" });
  });
});
