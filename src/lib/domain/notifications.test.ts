import { describe, expect, it } from "vitest";
import { buildIcs, callEvent, googleCalendarUrl, installEvent } from "./calendar";
import { callBookedEmail, orderConfirmationEmail, type OrderEmail } from "./emails";

describe("calendar", () => {
  it("blocks out the install day from 7am Melbourne time (daylight saving in October)", () => {
    const e = installEvent({ reference: "RN-1234", date: "2026-10-23", installer: "Primero Electric & Solar" });
    expect(e.start).toBe("2026-10-22T20:00:00.000Z");
    expect(e.end).toBe("2026-10-23T04:00:00.000Z");
    expect(e.description).toContain("between 7am and 9am");
  });

  it("makes the confirmation call 15 minutes long", () => {
    const e = callEvent({ reference: "RN-1234", date: "2026-10-13", time: "10:30" });
    expect(e.start).toBe("2026-10-12T23:30:00.000Z");
    expect(new Date(e.end).getTime() - new Date(e.start).getTime()).toBe(15 * 60_000);
  });

  it("builds a valid, escaped .ics with folded lines", () => {
    const e = installEvent({ reference: "RN-1234", date: "2026-10-23", address: "2 Hanwell Court, Glen Waverley VIC 3150" });
    const ics = buildIcs([e], new Date("2026-09-27T00:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261022T200000Z");
    expect(ics).toContain("DTSTAMP:20260927T000000Z");
    expect(ics).toContain("LOCATION:2 Hanwell Court\\, Glen Waverley VIC 3150");
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });

  it("links to Google Calendar with the same times", () => {
    const url = new URL(googleCalendarUrl(callEvent({ reference: "RN-1", date: "2026-10-13", time: "10:30" })));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("dates")).toBe("20261012T233000Z/20261012T234500Z");
  });
});

describe("emails", () => {
  const order: OrderEmail = {
    reference: "RN-1234",
    firstName: "Sam <b>",
    installDate: "Friday 23 October 2026",
    arrival: "7am–9am",
    system: "Recommended: 6.7 kW solar + 16 kWh battery",
    lines: [
      { label: "Solar system", amount: 8000 },
      { label: "Battery", amount: 12000 },
    ],
    gross: 20000,
    rebates: [{ label: "Federal solar rebate (STCs)", amount: 1500 }],
    total: 18500,
    loan: 1400,
    outOfPocket: 17100,
    deposit: 499,
  };

  it("breaks the order down and says when we'll be in touch", () => {
    const mail = orderConfirmationEmail(order);
    expect(mail.subject).toContain("RN-1234");
    expect(mail.text).toContain("Price before rebates: $20,000");
    expect(mail.text).toContain("Federal solar rebate (STCs): -$1,500");
    expect(mail.text).toContain("Your upfront cost: $17,100");
    expect(mail.text).toContain("Due today: $0");
    expect(mail.text).toContain("book your 15-minute system confirmation call");
    expect(mail.text).not.toContain("undefined");
  });

  it("names the call time once it's booked, and escapes HTML", () => {
    const mail = orderConfirmationEmail({ ...order, call: "Tuesday 13 October at 10:30am" });
    expect(mail.text).toContain("We'll call you on Tuesday 13 October at 10:30am");
    expect(mail.html).toContain("Sam &lt;b&gt;");
    expect(mail.html).not.toContain("Sam <b>");
  });

  it("confirms a booked call", () => {
    const mail = callBookedEmail({ reference: "RN-1234", firstName: "Sam", call: "Tuesday 13 October at 10:30am" });
    expect(mail.subject).toContain("Tuesday 13 October");
    expect(mail.text).toContain("RN-1234");
  });
});
