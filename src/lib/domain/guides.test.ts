import { describe, expect, it } from "vitest";
import { GUIDES, GUIDES_TAGLINE, LEARN_POPUP, guideBySlug, guideText, shouldShowLearnPopup } from "./guides";

describe("Revo's guides", () => {
  it("have unique, URL-safe slugs and short meta descriptions", () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const g of GUIDES) {
      expect(g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(g.summary.length).toBeLessThanOrEqual(200);
      expect(guideBySlug(g.slug)).toBe(g);
    }
  });

  it("never overclaim, call Revo an AI or show customers the word installer", () => {
    for (const text of [...GUIDES.map(guideText), GUIDES_TAGLINE]) {
      expect(text).not.toMatch(/\b(exact|exactly|precise|precisely|guaranteed?)\b/i);
      expect(text).not.toMatch(/\bAI\b|artificial intelligence/i);
      expect(text).not.toMatch(/\binstallers?\b/i);
      expect(text).not.toMatch(/\b(first|number one|#1|best|leading)\b/i);
    }
  });

  it("link only to official https sources", () => {
    for (const g of GUIDES)
      for (const b of g.body) if (b.type === "link") expect(b.href).toMatch(/^https:\/\/(www\.)?(solar\.vic\.gov\.au|cer\.gov\.au)\//);
  });
});

describe("Learn with Revo pop-up", () => {
  const day = 86_400_000;
  it("shows to new visitors and stays away for a week once closed", () => {
    expect(shouldShowLearnPopup(null, 1000)).toBe(true);
    expect(shouldShowLearnPopup(0, LEARN_POPUP.quietDays * day - 1)).toBe(false);
    expect(shouldShowLearnPopup(0, LEARN_POPUP.quietDays * day)).toBe(true);
    expect(shouldShowLearnPopup(Number.NaN, 0)).toBe(true);
  });

  it("features guides that exist", () => {
    for (const slug of LEARN_POPUP.featured) expect(guideBySlug(slug)).toBeDefined();
  });
});
