import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanContent, contentProblem } from "./edm";
import { claimsToCheck } from "./edm-sol";
import { PANEL_FIRST, pictureKeyOf, withPictures } from "./gtm-drafts";
import { GTM_SOL, GTM_SOL_LINE, GTM_SOL_NEEDS } from "./gtm-sol-draft";

const ids = Object.fromEntries(Object.keys(GTM_SOL_NEEDS).map((k, i) => [k, `mimg_${String(i).padStart(24, "0")}`]));

describe("the Meet Sol draft", () => {
  it("is a whole, valid email once its pictures are in", () => {
    const c = withPictures(GTM_SOL, ids);
    expect(contentProblem(c)).toBeNull();
    expect(cleanContent(c)).toEqual(c);
    for (const b of c.blocks) if (b.kind === "image") expect(b.imageId).toBeTruthy();
  });

  it("opens on the bar, then its hook and picture on the warm panel, and ends on the two bands", () => {
    expect(GTM_SOL.blocks[0].kind).toBe("bar");
    expect(GTM_SOL.blocks[1].kind).toBe("heading");
    expect(GTM_SOL.blocks[1].fill).toBe(PANEL_FIRST);
    expect(pictureKeyOf(GTM_SOL.blocks[2])).toBe("paperwork");
    expect(pictureKeyOf(GTM_SOL.blocks.at(-2)!)).toBe("footv");
    expect(pictureKeyOf(GTM_SOL.blocks.at(-1)!)).toBe("footer");
  });

  it("has every picture it needs in marketing/launch, where the route reads them", () => {
    for (const p of Object.values(GTM_SOL_NEEDS)) expect(existsSync(join(process.cwd(), "marketing", "launch", p.file))).toBe(true);
  });

  it("says the line its picture carries, in step with the picture tool", () => {
    const art = readFileSync(join(process.cwd(), "tools/marketing/launch-art.mjs"), "utf8");
    const [first, second] = GTM_SOL_LINE.split(". ");
    expect(art).toContain(`${first}.`);
    expect(art).toContain(second);
    expect(GTM_SOL.blocks.find((b) => b.kind === "text")!.text).toContain(GTM_SOL_LINE);
  });

  it("makes no claim that needs proof, uses only our fields and links only to renuabl.com.au", () => {
    const t = [GTM_SOL.subject, GTM_SOL.preview, ...GTM_SOL.blocks.map((b) => b.text)].join(" ");
    expect(claimsToCheck(t)).toEqual([]);
    expect(t.match(/\{[A-Za-z]+\}/g)?.every((f) => f === "{firstName}" || f === "{company}") ?? true).toBe(true);
    expect(t).not.toMatch(/save \d|%|was \$|discount|\boff\b|guarantee/i);
    for (const b of GTM_SOL.blocks) if (b.url) expect(b.url).toMatch(/^https:\/\/www\.renuabl\.com\.au(\/|$)/);
  });
});
