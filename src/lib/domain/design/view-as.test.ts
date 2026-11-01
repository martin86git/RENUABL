import { describe, expect, it } from "vitest";
import { VIEW_AS_PATH, mayViewAs, passesWhileViewing } from "./view-as";

describe("view as", () => {
  it("lets through only reading, and going back, while viewing", () => {
    expect(passesWhileViewing("GET", "/api/design/jobs")).toBe(true);
    expect(passesWhileViewing("post", "/api/design/jobs")).toBe(false);
    expect(passesWhileViewing("PUT", "/api/design/members")).toBe(false);
    expect(passesWhileViewing("DELETE", VIEW_AS_PATH)).toBe(true);
    expect(passesWhileViewing("POST", VIEW_AS_PATH)).toBe(false);
  });
  it("is only for the owner, and only someone else in their own business", () => {
    const owner = { role: "owner", email: "o@x.example", businessId: "b1" };
    expect(mayViewAs(owner, { email: "sam@x.example", businessId: "b1" })).toBe(true);
    expect(mayViewAs(owner, { email: "kim@y.example", businessId: "b2" })).toBe(false);
    expect(mayViewAs(owner, { email: "o@x.example", businessId: "b1" })).toBe(false);
    expect(mayViewAs({ ...owner, role: "member" }, { email: "sam@x.example", businessId: "b1" })).toBe(false);
    expect(mayViewAs(owner, null)).toBe(false);
  });
});
