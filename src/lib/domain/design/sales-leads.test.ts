import { describe, expect, it } from "vitest";
import { cleanDemoRequest, cleanEnquiry, demoRequestEmail, demoRequestNote, enquiryEmail, interestEmail } from "./sales-leads";

describe("an Enterprise enquiry from the sign-up page", () => {
  const good = { name: " Sam  Lee ", business: "Bright Sparks Solar", email: "SAM@example.com", mobile: "0400 000 000", users: "15" };

  it("is cleaned before it is kept", () => {
    expect(cleanEnquiry(good)).toEqual({
      name: "Sam Lee",
      business: "Bright Sparks Solar",
      email: "sam@example.com",
      mobile: "0400 000 000",
      users: 15,
      note: null,
    });
  });

  it("says what is missing", () => {
    expect(cleanEnquiry({ ...good, name: "" })).toBe("Tell us your name.");
    expect(cleanEnquiry({ ...good, email: "not an email" })).toBe("Enter a valid email address.");
    expect(cleanEnquiry({ ...good, users: "many" })).toBe("How many people would use it?");
  });

  it("tells staff who to call", () => {
    const enquiry = cleanEnquiry(good);
    if (typeof enquiry === "string") throw new Error(enquiry);
    expect(enquiryEmail(enquiry).subject).toBe("Enterprise enquiry: Bright Sparks Solar, 15 users");
    expect(enquiryEmail(enquiry).text).toContain("sam@example.com");
    expect(interestEmail("a@b.com").text).toContain("a@b.com");
  });
});

describe("a demo request from the business page", () => {
  const good = { name: " Sam  Lee ", business: "Bright Sparks Solar", email: "SAM@example.com" };

  it("takes a name, business and email, the rest optional", () => {
    expect(cleanDemoRequest(good)).toEqual({
      name: "Sam Lee",
      business: "Bright Sparks Solar",
      email: "sam@example.com",
      mobile: null,
      note: null,
      time: null,
      from: null,
    });
    expect(cleanDemoRequest({ ...good, mobile: "0400 000 000", note: "Mornings suit" })).toMatchObject({
      mobile: "0400 000 000",
      note: "Mornings suit",
    });
  });

  it("says what's missing", () => {
    expect(cleanDemoRequest({ ...good, name: "" })).toBe("Tell us your name.");
    expect(cleanDemoRequest({ ...good, business: " " })).toBe("Tell us your business's name.");
    expect(cleanDemoRequest({ ...good, email: "not an email" })).toBe("Enter a valid email address.");
  });

  it("tells staff who asked and how to reach them", () => {
    const d = cleanDemoRequest({ ...good, mobile: "0400 000 000" });
    if (typeof d === "string") throw new Error(d);
    const e = demoRequestEmail(d);
    expect(e.subject).toBe("Book a demo: Bright Sparks Solar");
    expect(e.text).toContain("sam@example.com");
    expect(e.text).toContain("0400 000 000");
    expect(e.text).toContain("Would suit: not said");
  });

  it("keeps when would suit and where they came from, on the lead and in the email", () => {
    const d = cleanDemoRequest({
      ...good,
      time: " Tuesday  after 2 ",
      note: "The designer",
      utm_source: "Rexel",
      utm_campaign: "wholesaler-launch",
    });
    if (typeof d === "string") throw new Error(d);
    expect(d.time).toBe("Tuesday after 2");
    expect(d.from).toBe("rexel · wholesaler-launch");
    expect(demoRequestNote(d)).toBe("Would suit: Tuesday after 2\nThe designer\nCame from: rexel · wholesaler-launch");
    expect(demoRequestEmail(d).text).toContain("Came from: rexel · wholesaler-launch");
    const plain = cleanDemoRequest(good);
    if (typeof plain === "string") throw new Error(plain);
    expect(demoRequestNote(plain)).toBeNull();
  });
});
