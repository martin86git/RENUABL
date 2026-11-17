import { describe, expect, it } from "vitest";
import {
  asksForMeeting,
  cleanAgreed,
  cleanMeeting,
  googleEventBody,
  isMeetingId,
  linkRuns,
  localParts,
  meetLinkOf,
  meetingDescription,
  meetingWhen,
  reminderWhat,
  remindChoices,
  remindLabel,
} from "./sol-meeting";

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

describe("the meeting card", () => {
  it("offers only the reminders still to come", () => {
    const start = "2026-11-17T05:00:00.000Z"; // 4 pm in Melbourne
    expect(remindChoices(start, new Date("2026-11-17T03:00:00Z"))).toEqual([60, 30, 10]);
    expect(remindChoices(start, new Date("2026-11-17T04:40:00Z"))).toEqual([10]);
    expect(remindChoices(start, new Date("2026-11-17T05:00:00Z"))).toEqual([]);
  });

  it("reads the time back in Melbourne for the card's boxes", () => {
    expect(localParts("2026-11-17T05:00:00.000Z")).toEqual({ day: "2026-11-17", time: "16:00" });
    expect(meetingWhen("2026-11-17T05:00:00.000Z")).toBe("Tue 17 Nov, 4:00 pm");
  });

  it("keeps what the customer agreed, and its day only when it is a real one", () => {
    expect(cleanAgreed({ agreed_with_customer: "a call on Wednesday 18 Nov", agreed_day: "2026-11-18" })).toEqual({
      agreed: "a call on Wednesday 18 Nov",
      agreedDay: "2026-11-18",
    });
    expect(cleanAgreed({ agreed_day: "2026-11-18" })).toEqual({ agreed: null, agreedDay: null });
    expect(cleanAgreed({ agreed_with_customer: "Wednesday", agreed_day: "Wednesday" }).agreedDay).toBeNull();
  });

  it("puts the link in the reminder Sol says", () => {
    const what = reminderWhat(
      { title: "Call with Mike", start: "2026-11-17T05:00:00.000Z", meetLink: "https://meet.google.com/rsk-tcab-iwk" },
      30,
    );
    expect(what).toBe("Call with Mike in 30 min (Tue 17 Nov, 4:00 pm). Join: https://meet.google.com/rsk-tcab-iwk");
    expect(remindLabel(60)).toBe("1 hour");
  });

  it("makes web addresses pressable, without the full stop after them", () => {
    expect(linkRuns("Meet link: https://meet.google.com/rsk-tcab-iwk.")).toEqual([
      { text: "Meet link: " },
      { text: "https://meet.google.com/rsk-tcab-iwk", href: "https://meet.google.com/rsk-tcab-iwk" },
      { text: "." },
    ]);
    expect(linkRuns("no links here")).toEqual([{ text: "no links here" }]);
    expect(linkRuns("javascript:alert(1) http://x.com")).toEqual([{ text: "javascript:alert(1) http://x.com" }]);
  });

  it("knows its own ids", () => {
    expect(isMeetingId("mt_0123456789abcdef")).toBe(true);
    expect(isMeetingId("mt_../../x")).toBe(false);
  });
});
