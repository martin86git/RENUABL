import { describe, expect, it } from "vitest";
import { asksForMeeting, cleanMeeting, googleEventBody, meetLinkOf, meetingDescription } from "./sol-meeting";

const now = new Date("2026-11-16T00:00:00Z"); // 11 am in Melbourne

describe("Sol books a meeting", () => {
  it("books only when the member's own words ask for one", () => {
    expect(asksForMeeting("@Sol can you schedule a google meets call between me and mike")).toBe(true);
    expect(asksForMeeting("put it in my calendar for Wednesday at 2")).toBe(true);
    expect(asksForMeeting("what did Mike say about the battery?")).toBe(false);
  });

  it("reads the time as Melbourne's and gives it a length", () => {
    const got = cleanMeeting({ title: "Call with Mike", when_local: "2026-11-18 14:00" }, now);
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.start).toBe("2026-11-18T03:00:00.000Z");
    expect(got.value.minutes).toBe(30);
    expect(got.value.end).toBe("2026-11-18T03:30:00.000Z");
    expect(got.value.meet).toBe(true);
  });

  it("asks for a time rather than guessing, and refuses one past", () => {
    expect(cleanMeeting({ title: "Call", when_local: "" }, now).ok).toBe(false);
    expect(cleanMeeting({ title: "Call", when_local: "Wednesday" }, now).ok).toBe(false);
    expect(cleanMeeting({ title: "Call", when_local: "2026-11-15 09:00" }, now).ok).toBe(false);
    expect(cleanMeeting({ title: "", when_local: "2026-11-18 09:00" }, now).ok).toBe(false);
  });

  it("keeps the length within bounds and leaves Meet off when asked", () => {
    const got = cleanMeeting({ title: "Site walk", when_local: "2026-11-18 09:00", minutes: 900, meet: false }, now);
    expect(got.ok && got.value.minutes).toBe(240);
    expect(got.ok && got.value.meet).toBe(false);
  });

  it("invites nobody and asks Google for a Meet link", () => {
    const got = cleanMeeting({ title: "Call", when_local: "2026-11-18 09:00" }, now);
    if (!got.ok) throw new Error("not ok");
    const body = googleEventBody(got.value, "About the deal", "req-1");
    expect(body).not.toHaveProperty("attendees");
    expect(body.conferenceData).toEqual({ createRequest: { requestId: "req-1", conferenceSolutionKey: { type: "hangoutsMeet" } } });
  });

  it("takes only Google Meet's own links", () => {
    expect(meetLinkOf({ hangoutLink: "https://meet.google.com/abc-defg-hij" })).toBe("https://meet.google.com/abc-defg-hij");
    expect(meetLinkOf({ hangoutLink: "https://evil.example/meet" })).toBeNull();
    expect(
      meetLinkOf({ conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/xyz-abcd-efg" }] } }),
    ).toBe("https://meet.google.com/xyz-abcd-efg");
  });

  it("says what it's about and who booked it", () => {
    const d = meetingDescription({
      notes: "Talk through the quote",
      deal: "Mike Larry · Solar and battery",
      dealUrl: "https://x/d/1",
      by: "sam@x.au",
    });
    expect(d).toContain("Mike Larry · Solar and battery");
    expect(d).toContain("Booked by Sol in RENUABL for sam@x.au.");
  });
});
