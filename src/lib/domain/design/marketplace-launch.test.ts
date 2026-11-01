import { describe, expect, it } from "vitest";
import { LAUNCH, SHOW_COUNT_FROM, cleanRoles, countLine, inviteMail, launchWords, marketplaceOpen, rolesNote } from "./marketplace-launch";
import { MARKETPLACE_PAGES, SECTIONS, pageAt } from "./sections";

describe("the Marketplace's launch switch", () => {
  it("is open only when switched on in so many words", () => {
    expect(marketplaceOpen({ NEXT_PUBLIC_MARKETPLACE_OPEN: "true" })).toBe(true);
    expect(marketplaceOpen({ NEXT_PUBLIC_MARKETPLACE_OPEN: " TRUE " })).toBe(true);
    expect(marketplaceOpen({ NEXT_PUBLIC_MARKETPLACE_OPEN: "1" })).toBe(false);
    expect(marketplaceOpen({})).toBe(false);
  });

  it("shows one page in the section until it opens", () => {
    const market = SECTIONS.find((s) => s.id === "marketplace")!;
    if (marketplaceOpen()) expect(market.pages).toEqual(MARKETPLACE_PAGES);
    else {
      expect(market.pages.map((p) => p.href)).toEqual(["/design/marketplace"]);
      expect(pageAt("/design/marketplace")?.section.id).toBe("marketplace");
    }
  });
});

describe("the waiting list", () => {
  it("keeps known roles in order, and none ticked is all of them", () => {
    expect(cleanRoles(["trade", "post", "nonsense"])).toEqual(["post", "trade"]);
    expect(cleanRoles([])).toEqual(["post", "bid", "trade"]);
    expect(cleanRoles("post")).toEqual(["post", "bid", "trade"]);
    expect(rolesNote(["bid"])).toBe("Win installation work");
  });

  it("says how many are on it only once the number says something", () => {
    expect(countLine(SHOW_COUNT_FROM - 1)).toBeNull();
    expect(countLine(1250)).toBe("1,250 solar businesses are on the list.");
  });

  it("invites from the business's own mail app, with the link and nothing else", () => {
    const mail = inviteMail("https://www.renuabl.com.au/", "Sunrise Solar");
    expect(mail.startsWith("mailto:?subject=")).toBe(true);
    const body = decodeURIComponent(mail.split("&body=")[1]);
    expect(body).toContain("https://www.renuabl.com.au/design");
    expect(body).toContain("Sunrise Solar");
  });
});

describe("the launch page's words", () => {
  const words = launchWords().join("\n");
  it("claims nothing it can't prove and promises no fees or payments through RENUABL", () => {
    expect(words).not.toMatch(/\bfirst\b(?! day)|\b(best|leading|largest|biggest|#1|number one|guarantee|AI)\b/i);
    expect(words).not.toMatch(/\bfree\b|\bfee\b|\bcommission\b/i);
    expect(words).not.toMatch(/installer'?s? of choice/i);
    expect(LAUNCH.tradeSub).toMatch(/takes no part in the payment/);
  });

  it("is clear that the address and the customer stay private until a bid is chosen", () => {
    expect(LAUNCH.hidden.join(" ")).toMatch(/street address, until a bid is chosen/);
    expect(LAUNCH.hidden.join(" ")).toMatch(/customer's name, phone or email/);
    expect(LAUNCH.shown.join(" ")).toMatch(/blurred/);
  });
});
