import { describe, expect, it } from "vitest";
import { COACH_WINDOW, NO_SIZES, cleanCoachSizes, coachLayout, dragCoach } from "./coach-window";

const wide = { width: 1600, height: 1000 };

describe("the phone assistant's window, sized", () => {
  it("starts tall with the chat roomy and the panels slim, closed panels taking nothing", () => {
    const l = coachLayout(NO_SIZES, ["deals"], wide);
    expect(l).toEqual({ chat: 460, deals: 340, settings: 0, height: 860 });
    expect(l.deals).toBeLessThan(l.chat);
    expect(coachLayout(NO_SIZES, [], wide)).toMatchObject({ deals: 0, settings: 0 });
  });

  it("opens both panels side by side, deals then settings", () => {
    const l = coachLayout(NO_SIZES, ["settings", "deals"], wide);
    expect(l.deals).toBe(340);
    expect(l.settings).toBe(340);
  });

  it("stays inside a small screen, the furthest panel giving way first", () => {
    const view = { width: 1100, height: 700 };
    const l = coachLayout({ ...NO_SIZES, chat: 500 }, ["deals", "settings"], view);
    expect(l.chat + l.deals + l.settings).toBeLessThanOrEqual(1100 - COACH_WINDOW.gutterX);
    expect(l.chat).toBe(500);
    expect(l.settings).toBe(COACH_WINDOW.pane.min);
    expect(l.deals).toBe(308);
    expect(l.height).toBe(700 - COACH_WINDOW.gutterY);
  });

  it("reads back only sensible sizes", () => {
    expect(cleanCoachSizes({ deals: 5, chat: "400", height: 99999, settings: 400.4 })).toEqual({
      deals: COACH_WINDOW.pane.min,
      settings: 400,
      chat: null,
      height: COACH_WINDOW.height.max,
    });
    expect(cleanCoachSizes(null)).toEqual(NO_SIZES);
  });
});

describe("dragging", () => {
  const both = ["deals", "settings"] as const;
  const from = coachLayout(NO_SIZES, both, wide);

  it("moves room between the chat and the first panel at its divider, the window keeping its width", () => {
    const s = dragCoach(NO_SIZES, both, from, "deals", 60, 0);
    expect(s.chat).toBe(520);
    expect(s.deals).toBe(280);
    expect((s.chat ?? 0) + (s.deals ?? 0)).toBe(from.chat + from.deals);
  });

  it("moves room between the two panels at the second divider", () => {
    const s = dragCoach(NO_SIZES, both, from, "settings", -40, 0);
    expect(s.deals).toBe(300);
    expect(s.settings).toBe(380);
  });

  it("never squeezes a panel under its least", () => {
    const s = dragCoach(NO_SIZES, both, from, "deals", 5000, 0);
    expect(s.deals).toBe(COACH_WINDOW.pane.min);
  });

  it("widens the chat from the window's left edge", () => {
    expect(dragCoach(NO_SIZES, both, from, "left", -120, 0).chat).toBe(580);
  });

  it("makes it taller from the top edge", () => {
    expect(dragCoach(NO_SIZES, both, from, "top", 0, -100).height).toBe(960);
    expect(dragCoach(NO_SIZES, both, from, "top", 0, 5000).height).toBe(COACH_WINDOW.height.min);
  });
});
