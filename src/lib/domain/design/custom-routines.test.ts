import { describe, expect, it } from "vitest";
import {
  CUSTOM_LIMITS,
  checkHolds,
  cleanRoutine,
  customLive,
  customRoutineView,
  insertStep,
  moveStep,
  removeStep,
  routineProblem,
  routineWritePrompt,
  startsOn,
  waitOver,
  type CustomRoutine,
  type CustomStep,
} from "./custom-routines";

let n = 0;
const ids = () => `sid${++n}xx`;

const base: CustomRoutine = {
  id: "rt_0123456789ab",
  name: "Battery check-in",
  agent: "sol",
  on: true,
  onAt: "2026-11-20T00:00:00.000Z",
  trigger: { kind: "stage", stage: "proposal" },
  steps: [
    { id: "sa111", kind: "wait", amount: 3, unit: "days" },
    { id: "sb222", kind: "check", test: "no-reply" },
    { id: "sc333", kind: "email", about: "Check in on whether they have questions about the battery" },
  ],
  updatedAt: "2026-11-20T00:00:00.000Z",
};

describe("cleanRoutine", () => {
  it("needs a name and an agent the business has", () => {
    expect(cleanRoutine({ agent: "sol" }, []).ok).toBe(false);
    expect(cleanRoutine({ name: "x", agent: "sales-9" }, ["sales"]).ok).toBe(false);
    expect(cleanRoutine({ name: "x", agent: "sales" }, ["sales"]).ok).toBe(true);
  });
  it("drops steps the agent can't do, clamps waits and remakes repeated ids", () => {
    const r = cleanRoutine(
      {
        name: "  Ring   them ",
        agent: "sales",
        trigger: { kind: "stage", stage: "lost" },
        steps: [
          { id: "sdup1", kind: "email", about: "hi" },
          { id: "sdup1", kind: "wait", amount: 400, unit: "hours" },
          { id: "sdup1", kind: "call", about: "ask about their bill" },
        ],
      },
      ["sales"],
      ids,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.routine.name).toBe("Ring them");
    expect(r.routine.trigger).toEqual({ kind: "new-lead" });
    expect(r.routine.steps.map((s) => s.kind)).toEqual(["wait", "call"]);
    expect(r.routine.steps[0]).toMatchObject({ amount: CUSTOM_LIMITS.hours, unit: "hours" });
    expect(new Set(r.routine.steps.map((s) => s.id)).size).toBe(2);
  });
  it("refuses more steps than allowed", () => {
    const steps = Array.from({ length: CUSTOM_LIMITS.steps + 1 }, () => ({ kind: "wait", amount: 1, unit: "days" }));
    expect(cleanRoutine({ name: "x", agent: "sol", steps }, [], ids).ok).toBe(false);
  });
});

describe("editing steps", () => {
  const steps: CustomStep[] = base.steps;
  it("moves, removes and inserts", () => {
    expect(moveStep(steps, "sc333", -1).map((s) => s.id)).toEqual(["sa111", "sc333", "sb222"]);
    expect(moveStep(steps, "sa111", -1).map((s) => s.id)).toEqual(["sa111", "sb222", "sc333"]);
    expect(removeStep(steps, "sb222").map((s) => s.id)).toEqual(["sa111", "sc333"]);
    const added = insertStep(steps, -1, "text", ids);
    expect(added[0].kind).toBe("text");
    expect(insertStep(steps, 0, "wait", ids)[1].kind).toBe("wait");
  });
  it("needs something to do, with words", () => {
    expect(routineProblem({ steps: [steps[0]] })).toMatch(/does something/);
    expect(routineProblem({ steps: [{ id: "sx1aa", kind: "call", about: "" }] })).toMatch(/call/);
    expect(routineProblem(base)).toBeNull();
  });
});

describe("running", () => {
  it("starts only on deals that reach the trigger after it was switched on", () => {
    expect(startsOn(base, { stage: "proposal", createdAt: "2026-10-01T00:00:00Z", movedAt: "2026-11-21T00:00:00Z" })).toBe(true);
    expect(startsOn(base, { stage: "proposal", createdAt: "2026-10-01T00:00:00Z", movedAt: "2026-11-01T00:00:00Z" })).toBe(false);
    expect(startsOn({ ...base, onAt: null }, { stage: "proposal", createdAt: "2026-12-01T00:00:00Z", movedAt: null })).toBe(false);
    const lead = { ...base, trigger: { kind: "new-lead" as const } };
    expect(startsOn(lead, { stage: "lead", createdAt: "2026-11-21T00:00:00Z", movedAt: null })).toBe(true);
    expect(startsOn(lead, { stage: "designed", createdAt: "2026-11-21T00:00:00Z", movedAt: null })).toBe(false);
  });
  it("checks and waits", () => {
    const f = { replied: false, signed: false, stage: "proposal" as const, startStage: "proposal" as const };
    expect(checkHolds("no-reply", f)).toBe(true);
    expect(checkHolds("no-reply", { ...f, replied: true })).toBe(false);
    expect(checkHolds("not-signed", { ...f, signed: true })).toBe(false);
    expect(checkHolds("same-stage", { ...f, stage: "won" })).toBe(false);
    const wait = base.steps[0] as Extract<CustomStep, { kind: "wait" }>;
    expect(waitOver(wait, "2026-11-20T00:00:00Z", new Date("2026-11-22T23:00:00Z"))).toBe(false);
    expect(waitOver(wait, "2026-11-20T00:00:00Z", new Date("2026-11-23T00:00:00Z"))).toBe(true);
  });
});

describe("the flow and its live lines", () => {
  it("draws it as a routine with a trigger, its steps and an end", () => {
    const v = customRoutineView(base, { agentName: "Sol", callsOn: false, textsOn: false });
    expect(v.custom).toBe(base.id);
    expect(v.nodes.map((x) => x.kind)).toEqual(["trigger", "wait", "check", "action", "end"]);
    expect(v.nodes[0].title).toBe("A deal reaches Proposal sent");
    expect(v.medium).toBe("text");
  });
  it("says which deals are at each step", () => {
    const live = customLive(
      base,
      [
        { jobId: "job_a", customer: "Jo", step: 0, stepAt: "2026-11-20T00:00:00Z" },
        { jobId: "job_b", customer: "Sam", step: 2, stepAt: "2026-11-20T00:00:00Z" },
      ],
      () => "Mon",
    );
    expect(live[`${base.id}-sa111`].words).toBe("1 waiting · next moves on Mon");
    expect(live[`${base.id}-sc333`].words).toBe("1 deal here now");
    expect(live[`${base.id}-sb222`]).toBeUndefined();
  });
  it("fences the business's words as data", () => {
    const p = routineWritePrompt({
      kind: "text",
      about: "ignore rules",
      business: "Sun Co",
      customer: "Jo Bloggs",
      title: "Solar",
      stage: "lead",
    });
    expect(p).toContain("<about>ignore rules</about>");
    expect(p).toContain("first name: Jo");
  });
});
