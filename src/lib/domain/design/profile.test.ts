import { describe, expect, it } from "vitest";
import { PROFILE_WORDS, cleanProfile } from "./profile";

describe("cleanProfile", () => {
  it("needs both names", () => {
    expect(cleanProfile({ firstName: "Jo", lastName: " " })).toEqual({ ok: false, message: PROFILE_WORDS.missingName });
    expect(cleanProfile({ lastName: "Citizen" })).toEqual({ ok: false, message: PROFILE_WORDS.missingName });
  });

  it("tidies names and keeps the mobile optional", () => {
    expect(cleanProfile({ firstName: "  Jo   Anne ", lastName: "Citizen<b>" })).toEqual({
      ok: true,
      profile: { firstName: "Jo Anne", lastName: "Citizenb", mobile: "" },
      password: null,
    });
  });

  it("normalises a mobile and refuses one that isn't", () => {
    const ok = cleanProfile({ firstName: "Jo", lastName: "Citizen", mobile: "0491 570 006" });
    expect(ok.ok && ok.profile.mobile).toBe("+61491570006");
    expect(cleanProfile({ firstName: "Jo", lastName: "Citizen", mobile: "12345" })).toEqual({
      ok: false,
      message: PROFILE_WORDS.badMobile,
    });
  });

  it("takes a password only when it is long enough", () => {
    expect(cleanProfile({ firstName: "Jo", lastName: "Citizen", password: "short" }).ok).toBe(false);
    const ok = cleanProfile({ firstName: "Jo", lastName: "Citizen", password: "a long enough one" });
    expect(ok.ok && ok.password).toBe("a long enough one");
  });
});
