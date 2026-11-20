import { describe, expect, it } from "vitest";
import { cleanSeen, todayOpensOn } from "./today-view";
import type { ISODate } from "../types";

const today = "2026-11-20" as ISODate;

describe("which way Today opens", () => {
  it("opens on Chat the first time in a day", () => {
    expect(todayOpensOn(null, today)).toBe("chat");
    expect(todayOpensOn({ day: "2026-11-19" as ISODate, view: "feed" }, today)).toBe("chat");
  });
  it("keeps the view last had the same day", () => {
    expect(todayOpensOn({ day: today, view: "feed" }, today)).toBe("feed");
    expect(todayOpensOn({ day: today, view: "chat" }, today)).toBe("chat");
  });
  it("reads only a day and a view", () => {
    expect(cleanSeen({ day: "2026-11-20", view: "feed" })).toEqual({ day: "2026-11-20", view: "feed" });
    expect(cleanSeen({ day: "20 Nov", view: "feed" })).toBeNull();
    expect(cleanSeen({ day: "2026-11-20", view: "board" })).toBeNull();
    expect(cleanSeen("feed")).toBeNull();
    expect(cleanSeen(null)).toBeNull();
  });
});
