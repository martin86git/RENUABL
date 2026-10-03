import { describe, expect, it } from "vitest";
import { buildCallAvailability, isBookableCallSlot } from "./booking";
import { consultEvent } from "./calendar";
import { consultBookedEmail, finishLaterEmail, newLeadEmail } from "./emails";

describe("15-minute call for prospects", () => {
  it("only accepts a day and time the page offered", () => {
    const today = "2026-10-05"; // a Monday
    const first = buildCallAvailability(today, null)[0];
    expect(isBookableCallSlot(today, first.date, first.times[0])).toBe(true);
    expect(isBookableCallSlot(today, today, "10:00")).toBe(false); // not today
    expect(isBookableCallSlot(today, "2026-10-11", "10:00")).toBe(false); // a Sunday
    expect(isBookableCallSlot(today, first.date, "21:00")).toBe(false);
  });

  it("offers Saturdays, never Sundays or Victorian public holidays", () => {
    // Melbourne Cup Day, Tuesday 3 November 2026.
    const days = buildCallAvailability("2026-10-29", null).map((d) => d.date);
    expect(days).not.toContain("2026-11-03");
    expect(days).not.toContain("2026-11-01"); // Sunday
    expect(days).toContain("2026-10-31"); // Saturday
    expect(days).toContain("2026-11-02");
    // Christmas to New Year.
    const summer = buildCallAvailability("2026-12-23", null).map((d) => d.date);
    for (const holiday of ["2026-12-25", "2026-12-28", "2027-01-01"]) expect(summer).not.toContain(holiday);
  });

  it("the finish-later email offers the call as well as the plan", () => {
    const mail = finishLaterEmail({ link: "https://www.renuabl.com.au/", callLink: "https://www.renuabl.com.au/book-a-call" });
    expect(mail.html).toContain("Book a 15-minute call");
    expect(mail.html).toContain("https://www.renuabl.com.au/book-a-call");
    expect(mail.text).toContain("Book a 15-minute call: https://www.renuabl.com.au/book-a-call");
    expect(mail.html).toContain("Continue my plan");
  });

  it("confirms the call to the customer and tells staff", () => {
    const mail = consultBookedEmail({
      firstName: "Sam",
      call: "Tuesday 6 October at 10am (Melbourne time)",
      link: "https://www.renuabl.com.au/",
    });
    expect(mail.subject).toBe("Your RENUABL call: Tuesday 6 October at 10am (Melbourne time)");
    expect(mail.text).toContain("no obligation");
    const staff = newLeadEmail({
      kind: "call",
      name: "Sam Lee",
      email: "sam@example.com",
      mobile: "+61412345678",
      details: { Call: "Tuesday" },
    });
    expect(staff.subject).toBe("Call booked: Sam Lee");
    expect(staff.text).toContain("Mobile: +61412345678");
    const event = consultEvent({ id: "x", date: "2026-10-06", time: "10:00" });
    expect(new Date(event.end).getTime() - new Date(event.start).getTime()).toBe(15 * 60_000);
  });
});
