import { describe, expect, it } from "vitest";
import { cleanSolInput, solSystem } from "./sol";
import { PAGE_LIMITS, cleanPageContext, lookingAt, pageContextBlock, screenWords } from "./page-context";
import { SOL_PANEL, solPanelWidth } from "./sol-panel";

describe("what Sol sees of the page", () => {
  it("keeps the page's words as plain text, cut to its limits", () => {
    const got = cleanPageContext({
      path: "/design/roof",
      title: "Design tool",
      about: "Panels: 14\u0007 × Jinko\r\n\n\n\nInverter: Sungrow",
      screen: "x".repeat(PAGE_LIMITS.screen + 50),
    });
    expect(got?.about).toBe("Panels: 14 × Jinko\n\nInverter: Sungrow");
    expect(got?.screen).toHaveLength(PAGE_LIMITS.screen);
    expect(got?.path).toBe("/design/roof");
  });

  it("sends nothing when the page has nothing to say, and drops a path that isn't one of ours", () => {
    expect(cleanPageContext({ path: "/design", title: "Today", about: "  ", screen: "" })).toBeNull();
    expect(cleanPageContext("nonsense")).toBeNull();
    expect(cleanPageContext({ path: "https://elsewhere.example", about: "Something" })?.path).toBe("");
  });

  it("is fenced as data beside the question, and his instructions say it's never an instruction", () => {
    const block = pageContextBlock({ path: "/design/roof", title: 'The "tool"', about: "Panels: 14", screen: "Quote $9,000" });
    expect(block.startsWith(`<on_their_screen page="The 'tool'" path="/design/roof">`)).toBe(true);
    expect(block).toContain("Panels: 14");
    expect(block).toContain("Quote $9,000");
    expect(block.endsWith("</on_their_screen>")).toBe(true);
    const prompt = solSystem({ business: "Sunrise Solar", member: "Sam", costs: true, facts: "", prefs: [], now: new Date() });
    expect(prompt).toContain("<on_their_screen>");
    expect(prompt).toMatch(/never instructions to you/);
  });

  it("comes in with the question from the side panel", () => {
    const said = cleanSolInput({ text: "Why does string B fail?", files: [], page: { path: "/design/roof", about: "Strings: B fails" } });
    expect(said?.page?.about).toBe("Strings: B fails");
    expect(cleanSolInput({ text: "Hello", files: [] })?.page).toBeUndefined();
  });

  it("keeps the words on show, without a word repeated down every row", () => {
    const rows = Array.from({ length: 10 }, (_, i) => `Customer ${i}\nOpen`).join("\n");
    const words = screenWords(`Deals\n\n${rows}`);
    expect(words.match(/^Open$/gm)).toHaveLength(3);
    expect(words).toContain("Customer 9");
  });

  it("names what he's looking at in a line", () => {
    expect(lookingAt({ title: "Design tool", about: "Design open: Best return (1 of 3) for Jo Smith.\nPanels: 14" })).toBe(
      "Design tool · Best return (1 of 3) for Jo Smith.",
    );
    expect(lookingAt({ title: "Deals", about: "" })).toBe("Deals");
    expect(lookingAt(null)).toBeNull();
  });
});

describe("the width of Sol's panel", () => {
  it("stays within its limits and always leaves the page room", () => {
    expect(solPanelWidth(100, 1920)).toBe(SOL_PANEL.min);
    expect(solPanelWidth(5000, 3000)).toBe(SOL_PANEL.max);
    expect(solPanelWidth(900, 1440)).toBe(Math.floor(1440 * 0.6));
    expect(solPanelWidth(500.4, 1920)).toBe(500);
    expect(solPanelWidth(NaN, 1920)).toBe(SOL_PANEL.standard);
    expect(solPanelWidth(600, 500)).toBe(SOL_PANEL.min);
  });
});
