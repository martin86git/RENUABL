import { describe, expect, it } from "vitest";
import { TEAM_LIST, TEAM_WINDOW, readWindowSize, teamListWidth, teamWindowSize } from "./team-window";

const screen = { width: 1600, height: 1000 };

describe("team chat's window", () => {
  it("opens at its usual size, and keeps a size inside its limits and the screen", () => {
    expect(teamWindowSize(null, screen)).toEqual({ width: TEAM_WINDOW.width, height: TEAM_WINDOW.height });
    expect(teamWindowSize({ width: 100, height: 100 }, screen)).toEqual({ width: TEAM_WINDOW.minWidth, height: TEAM_WINDOW.minHeight });
    expect(teamWindowSize({ width: 5000, height: 5000 }, screen)).toEqual({ width: 1600 - TEAM_WINDOW.sideRoom, height: 920 });
  });
  it("never goes under its least size on a small screen", () => {
    expect(teamWindowSize({ width: 900, height: 900 }, { width: 400, height: 300 })).toEqual({
      width: TEAM_WINDOW.minWidth,
      height: TEAM_WINDOW.minHeight,
    });
  });
  it("reads a kept size back, and nothing else", () => {
    expect(readWindowSize('{"width":900,"height":700}')).toEqual({ width: 900, height: 700 });
    expect(readWindowSize("nonsense")).toBeNull();
    expect(readWindowSize('{"width":"9"}')).toBeNull();
    expect(readWindowSize(null)).toBeNull();
  });
});

describe("team chat's list of conversations", () => {
  it("is dragged wider or narrower within its limits", () => {
    expect(teamListWidth(Number.NaN, 800)).toBe(TEAM_LIST.width);
    expect(teamListWidth(100, 800)).toBe(TEAM_LIST.min);
    expect(teamListWidth(300, 800)).toBe(300);
    expect(teamListWidth(900, 1400)).toBe(TEAM_LIST.max);
  });
  it("always leaves the conversation its room", () => {
    expect(teamListWidth(400, 600)).toBe(600 - TEAM_LIST.roomForChat);
  });
});
