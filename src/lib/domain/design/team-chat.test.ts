import { describe, expect, it } from "vitest";
import {
  SOL_BY,
  asksSol,
  cleanDealIds,
  cleanDeals,
  cleanFiles,
  cleanReactions,
  cleanRoom,
  dmRoom,
  dmWith,
  initialsOf,
  mayUseRoom,
  nameOf,
  roomLabel,
  tags,
  teamFileName,
  teamFilesProblem,
  teamTagEmail,
  toggledReaction,
  typingDeal,
  typingTag,
  unreadByRoom,
} from "./team-chat";

const sam = "sam.lee@sunny.example";
const ash = "ash@sunny.example";
const team = [sam, ash];

describe("the team chat's rooms", () => {
  it("opens the same direct conversation from either side, only to its two people", () => {
    const room = dmRoom(ash, "Sam.Lee@sunny.example");
    expect(room).toBe(dmRoom(sam, ash));
    expect(dmWith(room, sam)).toBe(ash);
    expect(dmWith(room, "kim@sunny.example")).toBeNull();
    expect(dmWith("deals", sam)).toBeNull();
  });

  it("lets a member use any channel and a direct conversation with someone in their business", () => {
    expect(mayUseRoom("deals", sam, team)).toBe(true);
    expect(mayUseRoom(dmRoom(sam, ash), sam, team)).toBe(true);
    expect(mayUseRoom(dmRoom(sam, "out@other.example"), sam, team)).toBe(false);
    expect(mayUseRoom(dmRoom(sam, sam), sam, team)).toBe(false);
  });

  it("reads a room from the browser, and names it", () => {
    expect(cleanRoom(" Deals ")).toBe("deals");
    expect(cleanRoom("dm:a@x.example,b@x.example")).toBe("dm:a@x.example,b@x.example");
    expect(cleanRoom("general")).toBeNull();
    expect(roomLabel("service", sam)).toBe("Service");
    expect(roomLabel(dmRoom(sam, ash), ash)).toBe("Sam Lee");
    expect(nameOf(SOL_BY)).toBe("Sol");
    expect(initialsOf(sam)).toBe("SL");
  });
});

describe("what a line carries", () => {
  it("keeps only reactions from the offered emojis, and toggles a member's own", () => {
    expect(cleanReactions({ "👍": [sam, sam.toUpperCase()], "🍕": [ash] })).toEqual({ "👍": [sam] });
    const on = toggledReaction({}, ash, "🎉");
    expect(on).toEqual({ "🎉": [ash] });
    expect(toggledReaction(on, ash, "🎉")).toEqual({});
    expect(() => toggledReaction({}, ash, "🍕")).toThrow();
  });

  it("keeps files and deal cards that are well formed", () => {
    expect(
      cleanFiles([
        { id: "tf_0123456789abcdef", name: "roof.png", type: "image/png", size: 10 },
        { id: "x", name: "a", type: "image/png" },
      ]),
    ).toHaveLength(1);
    expect(
      cleanDeals([
        { id: "job_1", name: "Casey · Solar", address: "", stage: "Won" },
        { id: "job_1", name: "again" },
      ]),
    ).toHaveLength(1);
    expect(cleanDealIds(["job_1", "job_1", "bad id!", "job_2", "job_3", "job_4"])).toEqual(["job_1", "job_2", "job_3"]);
  });

  it("checks files before they go", () => {
    expect(teamFilesProblem([{ size: 10, type: "image/png" }])).toBeNull();
    expect(teamFilesProblem([{ size: 10, type: "application/x-msdownload" }])).toContain("Send pictures");
    expect(teamFilesProblem([{ size: 5 * 1024 * 1024, type: "application/pdf" }])).toContain("4 MB");
    expect(teamFileName("C:\\fakepath\\bill.pdf", "application/pdf")).toBe("bill.pdf");
    expect(teamFileName("", "image/png")).toBe("file.png");
  });
});

describe("tags and unread", () => {
  it("finds what is being typed after # and @", () => {
    expect(typingDeal("see #cas", 8)).toEqual({ start: 4, query: "cas" });
    expect(typingTag("thanks @sa", 10)).toEqual({ start: 7, query: "sa" });
    expect(typingTag("email@sa", 8)).toBeNull();
  });

  it("asks Sol only in a channel, and knows who is tagged", () => {
    expect(asksSol("deals", "@Sol what's at proposal?")).toBe(true);
    expect(asksSol(dmRoom(sam, ash), "@sol hi")).toBe(false);
    expect(asksSol("deals", "solar is great")).toBe(false);
    expect(tags("@sam.lee can you call?", sam)).toBe(true);
    expect(tags("@sam can you call?", sam)).toBe(false);
  });

  it("counts others' lines since a room was last open, the last day's when never opened", () => {
    const now = new Date("2026-11-01T12:00:00Z");
    const lines = [
      { room: "deals", by: ash, at: "2026-11-01T11:00:00Z" },
      { room: "deals", by: sam, at: "2026-11-01T11:30:00Z" },
      { room: "service", by: ash, at: "2026-10-30T11:00:00Z" },
      { room: "service", by: ash, at: "2026-11-01T11:00:00Z" },
    ];
    expect(unreadByRoom(lines, { deals: "2026-11-01T10:00:00Z" }, sam, now)).toEqual({ deals: 1, service: 1 });
    expect(unreadByRoom(lines, { deals: "2026-11-01T11:10:00Z" }, sam, now)).toEqual({ service: 1 });
  });

  it("writes the tag email without the writer's full address", () => {
    const e = teamTagEmail({ by: sam, channel: "Deals", text: "@ash call <Casey>", link: "https://x.example/design?team=deals" });
    expect(e.subject).toBe("Sam Lee tagged you in Deals");
    expect(e.html).toContain("&lt;Casey&gt;");
    expect(e.text).not.toContain(sam);
  });
});
