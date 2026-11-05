import { describe, expect, it } from "vitest";
import { TEAM_LEVELS, WELCOME_TOUR, levelPermissions, welcomeLines, welcomeSteps } from "./welcome";

describe("welcome", () => {
  it("asks only the owner to add people", () => {
    expect(welcomeSteps(true)).toEqual(["connect", "team", "tour"]);
    expect(welcomeSteps(false)).toEqual(["connect", "tour"]);
  });

  it("gives an admin everything and a user their own deals without costs or settings", () => {
    expect(levelPermissions("admin")).toEqual({ costs: true, prices: true, publish: true, allDeals: true });
    expect(levelPermissions("user")).toEqual({ costs: false, prices: false, publish: true, allDeals: false });
    // prices needs costs (account.ts): no level may have one without the other.
    for (const l of TEAM_LEVELS) expect(!l.permissions.prices || l.permissions.costs).toBe(true);
  });

  it("greets by the name given, and says nothing unprovable", () => {
    const lines = welcomeLines("Jo", "Example Solar");
    expect(lines.hello).toMatch(/^Hi Jo, welcome to RENUABL\./);
    expect(lines.hello).toContain("Example Solar's assistant");
    expect(welcomeLines(null, "").hello).toMatch(/^Hi, welcome/);
    for (const text of Object.values(lines)) expect(text).not.toMatch(/\b(best|guarantee|exact|AI)\b/i);
  });

  it("tours the places Martin named", () => {
    const what = WELCOME_TOUR.map((s) => s.what);
    for (const w of ["Today", "The designer", "Sol", "RENUABL Marketplace"]) expect(what).toContain(w);
  });
});
