import { describe, expect, it } from "vitest";
import { readFollowUpContact } from "./contact";

describe("readFollowUpContact", () => {
  it("takes an email, a mobile, or both", () => {
    expect(readFollowUpContact({ email: " Sam@Example.com " })).toEqual({ email: "sam@example.com", mobile: null });
    expect(readFollowUpContact({ mobile: "0412 345 678" })).toEqual({ email: null, mobile: "+61412345678" });
    expect(readFollowUpContact({ email: "sam@example.com", mobile: "+61 412 345 678" })).toEqual({
      email: "sam@example.com",
      mobile: "+61412345678",
    });
  });

  it("needs at least one, and each one given must be valid", () => {
    expect(readFollowUpContact({})).toHaveProperty("error");
    expect(readFollowUpContact({ email: "  ", mobile: "" })).toHaveProperty("error");
    expect(readFollowUpContact({ email: "nope" })).toEqual({ error: "Enter a valid email address." });
    expect(readFollowUpContact({ email: "sam@example.com", mobile: "123" })).toHaveProperty("error");
  });
});
