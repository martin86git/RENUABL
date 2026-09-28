import { describe, expect, it } from "vitest";
import { layoutReadyEmail } from "./emails";
import { SMS_MAX, layoutReadySms } from "./sms";

describe("sending the customer their panel layout", () => {
  const link = "https://renuabl.com.au/my/layout?record=abc123abc123abc123";

  it("emails a short note with a button to the layout", () => {
    const e = layoutReadyEmail({ customer: "Sarah Chen", panels: 18, partner: "Primero Electric & Solar", link });
    expect(e.subject).toBe("Your panel layout is ready");
    expect(e.text).toContain("Hi Sarah");
    expect(e.text).toContain("18 panels");
    expect(e.html).toContain(link);
    expect(e.html).toContain("Primero Electric &amp; Solar");
  });

  it("texts one line with the link, first name only", () => {
    const s = layoutReadySms({ customer: "Sarah Chen", link });
    expect(s).toBe(`RENUABL: Hi Sarah, your panel layout is ready. See where your panels will go: ${link}`);
    expect(s.length).toBeLessThanOrEqual(SMS_MAX);
  });
});
