import { describe, expect, it } from "vitest";
import {
  GROUP_EMAIL_MAX,
  cleanGroupEmail,
  fillFirstName,
  groupEmail,
  groupRecipients,
  isCustomer,
  isUnsubToken,
  jobHas,
  matchesHas,
  stepFilter,
  together,
} from "./customers";

describe("customers and contacts", () => {
  it("counts someone as a customer once a job is installed", () => {
    expect(isCustomer(["lead", "installed"])).toBe(true);
    expect(isCustomer(["grid"])).toBe(true);
    expect(isCustomer(["won", "proposal"])).toBe(false);
  });

  it("reads what a job put in from its details, kW and title", () => {
    expect(jobHas({ kw: 6.6, title: "Solar", details: {} })).toEqual({ solar: true, battery: false, ev: false });
    expect(jobHas({ kw: null, title: "Battery", details: {} })).toEqual({ solar: false, battery: true, ev: false });
    expect(jobHas({ kw: 6.6, title: "Solar", details: { battery: "Sigenergy 8 kWh", evCharger: "None" } })).toEqual({
      solar: true,
      battery: true,
      ev: false,
    });
    expect(jobHas({ kw: null, title: "Upgrade", details: { systemType: "Solar + Battery", evCharger: "Zappi" } })).toEqual({
      solar: true,
      battery: true,
      ev: true,
    });
    expect(
      together([
        { solar: true, battery: false, ev: false },
        { solar: false, battery: true, ev: false },
      ]),
    ).toEqual({
      solar: true,
      battery: true,
      ev: false,
    });
  });

  it("filters by what they have, stepping any, has, hasn't", () => {
    let f = stepFilter({}, "solar");
    f = stepFilter(stepFilter(f, "battery"), "battery");
    expect(f).toEqual({ solar: true, battery: false });
    expect(matchesHas({ solar: true, battery: false, ev: true }, f)).toBe(true);
    expect(matchesHas({ solar: true, battery: true, ev: false }, f)).toBe(false);
    expect(stepFilter({ solar: false }, "solar")).toEqual({});
  });
});

describe("the group email", () => {
  it("goes to those with an address who haven't unsubscribed, up to the limit", () => {
    const people = [
      { id: "a", email: "a@x.example", unsubscribed: false },
      { id: "b", email: "", unsubscribed: false },
      { id: "c", email: "c@x.example", unsubscribed: true },
    ];
    const r = groupRecipients(people);
    expect(r.to.map((p) => p.id)).toEqual(["a"]);
    expect([r.noEmail, r.unsubscribed, r.over]).toEqual([1, 1, 0]);
    const many = Array.from({ length: GROUP_EMAIL_MAX + 3 }, (_, i) => ({ id: `${i}`, email: `${i}@x.example`, unsubscribed: false }));
    expect(groupRecipients(many).over).toBe(3);
  });

  it("checks what was typed", () => {
    expect(cleanGroupEmail({ subject: "", body: "Hi", ids: ["cus_abcdef12"] })).toEqual({ ok: false, message: "Give it a subject." });
    expect(cleanGroupEmail({ subject: "News", body: "Hi", ids: ["bad"] })).toEqual({
      ok: false,
      message: "Nobody is chosen to send it to.",
    });
    expect(cleanGroupEmail({ subject: " News ", body: "Hi {firstName}", ids: ["cus_abcdef12", "cus_abcdef12"] })).toEqual({
      ok: true,
      subject: "News",
      body: "Hi {firstName}",
      ids: ["cus_abcdef12"],
    });
  });

  it("greets each by name and carries their own way to stop", () => {
    expect(fillFirstName("Hi {firstName},", "")).toBe("Hi there,");
    const e = groupEmail({
      business: "Sunny Co",
      subject: "A tip for {firstName}",
      body: "Hi {firstName}, <clean> your panels.",
      firstName: "Casey",
      unsubscribe: "https://x.example/u/abc",
    });
    expect(e.subject).toBe("A tip for Casey");
    expect(e.text).toContain("Hi Casey, <clean> your panels.");
    expect(e.text).toContain("To stop these emails: https://x.example/u/abc");
    expect(e.html).toContain("&lt;clean&gt;");
    expect(e.html).toContain('href="https://x.example/u/abc"');
    expect(isUnsubToken("a".repeat(40))).toBe(true);
    expect(isUnsubToken("a".repeat(39))).toBe(false);
  });
});
