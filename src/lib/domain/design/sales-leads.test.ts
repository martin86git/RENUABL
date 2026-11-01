import { describe, expect, it } from "vitest";
import { cleanEnquiry, enquiryEmail, interestEmail } from "./sales-leads";

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
