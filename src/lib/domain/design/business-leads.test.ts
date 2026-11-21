import { describe, expect, it } from "vitest";
import { cleanStaffNote, cleanStage, isPipelineKind, leadBoard, openLeads, stageOf, type BusinessLead } from "./business-leads";

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
