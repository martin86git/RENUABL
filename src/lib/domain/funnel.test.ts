import { describe, expect, it } from "vitest";
import { FUNNEL_EVENTS, funnelEvent } from "./funnel";

describe("funnel step events", () => {
  it("names each flow step, and nothing else", () => {
    expect(funnelEvent("/start/analysing")).toBe("StepAddress");
    expect(funnelEvent("/start/profile")).toBe("StepAboutHome");
    expect(funnelEvent("/start/reserve/")).toBe("StepReserve");
    expect(funnelEvent("/start/confirmed")).toBeNull();
    expect(funnelEvent("/")).toBeNull();
    expect(funnelEvent("/start/system?x=1")).toBeNull();
  });

  it("uses fixed event names Meta accepts (letters only, no details)", () => {
    for (const name of Object.values(FUNNEL_EVENTS)) expect(name).toMatch(/^[A-Za-z]{1,40}$/);
    expect(new Set(Object.values(FUNNEL_EVENTS)).size).toBe(Object.keys(FUNNEL_EVENTS).length);
  });
});
