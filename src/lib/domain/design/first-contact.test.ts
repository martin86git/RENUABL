import { describe, expect, it } from "vitest";
import { cleanHomeAnswer, helloFacts, helloPath, helloSystem, homeRecordLine, isHelloToken, type HelloView } from "./first-contact";
import { HANDOVER } from "./sol-customer";

const view = (over: Partial<HelloView> = {}): HelloView => ({
  business: { name: "Sunrise Solar", phone: "03 9000 0000", email: "hello@example.com" },
  customer: { firstName: "Jo", address: "1 Sample Street, Rowville VIC 3178" },
  interest: "Solar and battery",
  system: { kw: 6.6, panels: 14, batteryKwh: 13.5 },
  drawing: null,
  hasRoof: true,
  home: null,
  ...over,
});

describe("a lead's page", () => {
  it("has one private link a deal", () => {
    const token = "a".repeat(48);
    expect(isHelloToken(token)).toBe(true);
    expect(isHelloToken("A".repeat(48))).toBe(false);
    expect(isHelloToken("a".repeat(47))).toBe(false);
    expect(helloPath(token)).toBe(`/hello/${token}`);
  });

  it("takes only a yes or a no for the home", () => {
    expect(cleanHomeAnswer("yes")).toBe("yes");
    expect(cleanHomeAnswer("no")).toBe("no");
    expect(cleanHomeAnswer("maybe")).toBeNull();
    expect(cleanHomeAnswer(undefined)).toBeNull();
  });

  it("writes the answer on the deal, flagging a wrong home", () => {
    expect(homeRecordLine("yes", "Jo")).toMatch(/confirmed/);
    expect(homeRecordLine("no", "Jo")).toMatch(/Check the address/);
  });
});

describe("what Sol is told on a lead's page", () => {
  it("gives the design in sizes and says there is no price yet", () => {
    const facts = helloFacts(view());
    expect(facts).toContain("6.6 kW");
    expect(facts).toContain("13.5 kWh");
    expect(facts).toMatch(/no price/i);
    expect(facts).not.toMatch(/\$\d/);
  });

  it("says when no design is drawn and when the home was said not to be theirs", () => {
    const facts = helloFacts(view({ system: null, home: "no" }));
    expect(facts).toMatch(/No design/);
    expect(facts).toMatch(/ISN'T theirs/);
  });

  it("never lets him give a price, and hands bookings to the team", () => {
    const system = helloSystem(view());
    expect(system).toMatch(/Never give a price/);
    expect(system).toContain(HANDOVER);
    expect(system).toMatch(/ONE easy next step/);
    expect(system).toMatch(/You are an AI/);
  });
});
