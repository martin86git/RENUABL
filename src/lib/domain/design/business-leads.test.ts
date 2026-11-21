import { describe, expect, it } from "vitest";
import {
  cleanDemoLink,
  cleanDemoTime,
  cleanStaffNote,
  cleanStage,
  demoWhen,
  isPipelineKind,
  leadBoard,
  leadReminderEmail,
  openLeads,
  remindersDue,
  stageOf,
  type BusinessLead,
} from "./business-leads";

const lead = (id: string, stage: BusinessLead["stage"], at: string, stageAt: string | null = null): BusinessLead => ({
  id,
  kind: "demo-request",
  email: `${id}@example.com`,
  name: null,
  business: null,
  mobile: null,
  users: null,
  note: null,
  stage,
  staffNote: null,
  at,
  stageAt,
  movedBy: null,
  demo: null,
});

describe("RENUABL Business's own pipeline", () => {
  it("takes only its own stages, and reads a missing one as New", () => {
    expect(cleanStage("booked")).toBe("booked");
    expect(cleanStage("proposal")).toBeNull();
    expect(cleanStage(3)).toBeNull();
    expect(stageOf(null)).toBe("new");
    expect(stageOf("nonsense")).toBe("new");
  });

  it("keeps demo requests, Enterprise enquiries and demo sign-ups, not the marketplace list", () => {
    expect(isPipelineKind("demo-request")).toBe(true);
    expect(isPipelineKind("enterprise")).toBe(true);
    expect(isPipelineKind("demo")).toBe(true);
    expect(isPipelineKind("marketplace")).toBe(false);
  });

  it("puts every lead in its stage, the latest moved first", () => {
    const board = leadBoard([
      lead("a", "new", "2026-11-20T01:00:00Z"),
      lead("b", "new", "2026-11-21T01:00:00Z"),
      lead("c", "booked", "2026-11-19T01:00:00Z", "2026-11-21T02:00:00Z"),
      lead("d", "won", "2026-11-01T01:00:00Z"),
    ]);
    expect(board.map((s) => s.stage)).toEqual(["new", "booked", "demoed", "signed-up", "won", "lost"]);
    expect(board[0].leads.map((l) => l.id)).toEqual(["b", "a"]);
    expect(board[1].leads.map((l) => l.id)).toEqual(["c"]);
    expect(openLeads([lead("a", "new", "x"), lead("d", "won", "x"), lead("e", "lost", "x")])).toBe(1);
  });

  it("keeps a note's lines and nothing that isn't text", () => {
    expect(cleanStaffNote("  Called Sam\u0007 \n\n\n\nBooked Tue  ")).toBe("Called Sam  \n\nBooked Tue");
    expect(cleanStaffNote(5)).toBeNull();
    expect(cleanStaffNote("x".repeat(2000))).toHaveLength(1000);
  });
});

describe("a booked demo and its reminders", () => {
  const now = new Date("2026-11-21T00:00:00Z"); // 11am Saturday in Melbourne
  const demo = (at: string, over: Partial<import("./business-leads").BookedDemo> = {}) => ({
    at,
    link: null,
    remindLead: true,
    by: "staff@renuabl.example",
    staffReminded: false,
    leadReminded: false,
    ...over,
  });

  it("takes a day and time on Melbourne's clock, still to come and not too far off", () => {
    expect(cleanDemoTime("2026-11-25", "10:00", now)).toEqual({ at: "2026-11-24T23:00:00.000Z" });
    expect(cleanDemoTime("2026-11-20", "10:00", now)).toEqual({ problem: "That time has passed." });
    expect(cleanDemoTime("2026-02-30", "10:00", now)).toEqual({ problem: "That isn't a real day and time." });
    expect(cleanDemoTime("2027-06-01", "10:00", now)).toHaveProperty("problem");
    expect(cleanDemoTime("", "10:00", now)).toHaveProperty("problem");
  });

  it("keeps only an https link", () => {
    expect(cleanDemoLink("https://meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
    expect(cleanDemoLink("http://meet.google.com/abc")).toBeNull();
    expect(cleanDemoLink("javascript:alert(1)")).toBeNull();
    expect(cleanDemoLink("")).toBeNull();
  });

  it("reminds the lead the day before and staff an hour before, once each, never late", () => {
    const at = "2026-11-22T00:00:00.000Z"; // 11am tomorrow
    expect(remindersDue("booked", demo(at), new Date("2026-11-20T23:00:00Z"))).toEqual({ staff: false, lead: false });
    expect(remindersDue("booked", demo(at), new Date("2026-11-21T00:10:00Z"))).toEqual({ staff: false, lead: true });
    expect(remindersDue("booked", demo(at, { leadReminded: true }), new Date("2026-11-21T23:10:00Z"))).toEqual({
      staff: true,
      lead: false,
    });
    expect(remindersDue("booked", demo(at, { staffReminded: true, leadReminded: true }), new Date("2026-11-21T23:30:00Z"))).toEqual({
      staff: false,
      lead: false,
    });
    // Passed, or moved on, or no tick for the lead: nothing.
    expect(remindersDue("booked", demo(at), new Date("2026-11-22T00:05:00Z"))).toEqual({ staff: false, lead: false });
    expect(remindersDue("demoed", demo(at), new Date("2026-11-21T23:10:00Z"))).toEqual({ staff: false, lead: false });
    expect(remindersDue("booked", demo(at, { remindLead: false }), new Date("2026-11-21T00:10:00Z")).lead).toBe(false);
  });

  it("says when in the lead's words, with the link and nothing else from staff", () => {
    const mail = leadReminderEmail({ name: "Sam Lee" }, demo("2026-11-22T00:00:00.000Z", { link: "https://meet.google.com/x" }), now);
    expect(mail.subject).toBe("Your RENUABL demo is tomorrow at 11:00 am");
    expect(mail.text).toContain("Hi Sam,");
    expect(mail.text).toContain("Join here: https://meet.google.com/x");
    expect(demoWhen("2026-11-21T03:00:00.000Z", now)).toBe("today at 2:00 pm");
    expect(demoWhen("2026-11-25T03:00:00.000Z", now)).toBe("Wednesday 25 November at 2:00 pm");
  });

  it("puts the soonest booked demo first", () => {
    const board = leadBoard([
      { ...lead("late", "booked", "2026-11-20T01:00:00Z"), demo: demo("2026-11-28T00:00:00.000Z") },
      { ...lead("soon", "booked", "2026-11-19T01:00:00Z"), demo: demo("2026-11-23T00:00:00.000Z") },
      lead("none", "booked", "2026-11-21T01:00:00Z"),
    ]);
    expect(board[1].leads.map((l) => l.id)).toEqual(["soon", "late", "none"]);
  });
});
