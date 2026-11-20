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

  it("shows the deal feed and the pipeline (20 Nov 2026, Martin: the tour skipped them)", () => {
    const what = WELCOME_TOUR.map((s) => s.what);
    for (const w of ["Needs you", "Each card", "Your deals", "Sales"]) expect(what).toContain(w);
    // The feed's places are lit on the Feed, Sol's box on Chat.
    for (const s of WELCOME_TOUR.filter((s) => s.at.includes("feed-") || s.at.includes("Deals"))) expect(s.go).toBe("feed");
    expect(WELCOME_TOUR.find((s) => s.what === "Ask Sol")?.go).toBe("chat");
    expect(WELCOME_TOUR.find((s) => s.what === "Sales")?.now).toMatch(/pipeline/);
    // Nothing about the layers button that left the menu.
    for (const s of WELCOME_TOUR) expect(s.now).not.toMatch(/layers/i);
  });
});
