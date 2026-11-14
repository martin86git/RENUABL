import { describe, expect, it } from "vitest";
import { COACH_WINDOW, NO_SIZES, cleanCoachSizes, coachLayout, dragCoach } from "./coach-window";

const wide = { width: 1600, height: 1000 };

describe("the phone assistant's window, sized", () => {
  it("starts with the deals wider than the chat", () => {
    const l = coachLayout(NO_SIZES, "deals", wide);
    expect(l).toEqual({ pane: 544, chat: 416, height: 640 });
    expect(coachLayout(NO_SIZES, null, wide).pane).toBe(0);
  });

  it("stays inside a small screen, the pane giving way first", () => {
    const l = coachLayout({ ...NO_SIZES, deals: 900, chat: 600 }, "deals", { width: 1100, height: 700 });
    expect(l.pane + l.chat).toBeLessThanOrEqual(1100 - COACH_WINDOW.gutterX);
    expect(l.chat).toBe(600);
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
  const from = coachLayout(NO_SIZES, "deals", wide);

  it("moves room between the pane and the chat at the divider, the window keeping its width", () => {
    const s = dragCoach(NO_SIZES, "deals", from, "divider", 60, 0);
    expect(s.deals).toBe(604);
    expect(s.chat).toBe(356);
    expect((s.deals ?? 0) + (s.chat ?? 0)).toBe(from.pane + from.chat);
  });

  it("never squeezes the chat under its least", () => {
    const s = dragCoach(NO_SIZES, "deals", from, "divider", 5000, 0);
    expect(s.chat).toBe(COACH_WINDOW.chat.min);
    expect(s.deals).toBe(from.pane + from.chat - COACH_WINDOW.chat.min);
  });

  it("widens the pane from the window's left edge, and the chat when no pane is open", () => {
    expect(dragCoach(NO_SIZES, "deals", from, "left", -120, 0).deals).toBe(664);
    expect(dragCoach(NO_SIZES, null, coachLayout(NO_SIZES, null, wide), "left", -50, 0).chat).toBe(466);
  });

  it("makes it taller from the top edge", () => {
    expect(dragCoach(NO_SIZES, "deals", from, "top", 0, -100).height).toBe(740);
    expect(dragCoach(NO_SIZES, "deals", from, "top", 0, 5000).height).toBe(COACH_WINDOW.height.min);
  });
});
