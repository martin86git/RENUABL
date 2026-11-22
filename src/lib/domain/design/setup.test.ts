import { describe, expect, it } from "vitest";
import {
  SETUP_PLACES,
  SETUP_STEPS,
  SETUP_WORDS,
  cleanSkipped,
  setupHello,
  setupOffered,
  setupStepsFor,
  setupView,
  type SetupFacts,
} from "./setup";

const none: SetupFacts = { email: false, calendar: false, pricing: false, leadInbox: false, imported: false, proposal: false, team: false };
const owner = { settings: true, owner: true };

describe("Sol's setup wizard", () => {
  it("has the seven steps Martin listed, in his order", () => {
    expect([...SETUP_STEPS]).toEqual(["email", "calendar", "pricing", "lead-inbox", "import", "proposal", "team"]);
  });

  it("gives each person only the steps that are theirs", () => {
    expect(setupStepsFor(owner)).toHaveLength(7);
    expect(setupStepsFor({ settings: true, owner: false })).not.toContain("team");
    expect(setupStepsFor({ settings: false, owner: false })).toEqual(["email", "calendar"]);
  });

  it("reads a step as done from what is really set up, skipped or not", () => {
    const v = setupView({ ...none, email: true, pricing: true }, ["pricing", "calendar"], owner);
    expect(v.steps.find((s) => s.step === "email")?.state).toBe("done");
    expect(v.steps.find((s) => s.step === "pricing")?.state).toBe("done");
    expect(v.steps.find((s) => s.step === "calendar")?.state).toBe("skipped");
    expect(v.done).toBe(2);
    expect(v.next).toBe("lead-inbox");
  });

  it("comes back to a skipped step once nothing else is left", () => {
    const all = { email: true, calendar: false, pricing: true, leadInbox: true, imported: true, proposal: true, team: true };
    const v = setupView(all, ["calendar"], owner);
    expect(v.next).toBe("calendar");
    expect(v.finished).toBe(false);
    expect(setupOffered(v, false)).toBe(false);
  });

  it("says the lead inbox waits on email", () => {
    expect(setupView(none, [], owner).steps.find((s) => s.step === "lead-inbox")?.waits).toContain("Connect your email first");
    expect(setupView({ ...none, email: true }, [], owner).steps.find((s) => s.step === "lead-inbox")?.waits).toBeUndefined();
  });

  it("offers itself until done, skipped or put away", () => {
    const v = setupView(none, [], owner);
    expect(setupOffered(v, false)).toBe(true);
    expect(setupOffered(v, true)).toBe(false);
    const full = setupView(
      { email: true, calendar: true, pricing: true, leadInbox: true, imported: true, proposal: true, team: true },
      [],
      owner,
    );
    expect(full.finished).toBe(true);
    expect(full.next).toBeNull();
    expect(setupOffered(full, false)).toBe(false);
  });

  it("keeps only real steps as skipped", () => {
    expect(cleanSkipped(["email", "nope", "email", 4])).toEqual(["email"]);
    expect(cleanSkipped("email")).toEqual([]);
  });

  it("has words and a place for every step, and promises nothing", () => {
    for (const s of SETUP_STEPS) {
      expect(SETUP_WORDS[s].sol.length).toBeGreaterThan(20);
      expect(SETUP_PLACES[s].href.startsWith("/design")).toBe(true);
      expect(SETUP_WORDS[s].sol).not.toMatch(/guarantee|best|\$\d/i);
    }
  });

  it("greets by where setup stands", () => {
    expect(setupHello("Sam", setupView(none, [], owner))).toContain("7 things to set up");
    expect(setupHello(null, setupView({ ...none, email: true }, [], owner))).toContain("1 of 7 done");
  });
});
