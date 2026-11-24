import { describe, expect, it } from "vitest";
import { cleanDemoRequest, cleanEnquiry, demoRequestEmail, enquiryEmail, interestEmail } from "./sales-leads";

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
    expect(e.subject).toBe("Demo request: Bright Sparks Solar");
    expect(e.text).toContain("sam@example.com");
    expect(e.text).toContain("0400 000 000");
  });
});
