import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanContent, contentProblem } from "./edm";
import { claimsToCheck } from "./edm-sol";
import { pictureKeyOf, withPictures } from "./gtm-drafts";
import { GTM_ERA, GTM_ERA_ADMIN, GTM_ERA_ASKS, GTM_ERA_LINES, GTM_ERA_MAX_WORDS, GTM_ERA_NEEDS, GTM_ERA_PICTURES } from "./gtm-era-draft";

const ids = Object.fromEntries(Object.keys(GTM_ERA_NEEDS).map((k, i) => [k, `mimg_${String(i).padStart(24, "0")}`]));
const words = GTM_ERA.blocks.filter((b) => b.kind === "text" || b.kind === "heading").map((b) => b.text);

describe("email one, A new era", () => {
  it("is a whole, valid email once its pictures are in", () => {
    const c = withPictures(GTM_ERA, ids);
    expect(contentProblem(c)).toBeNull();
    expect(cleanContent(c)).toEqual(c);
    for (const b of c.blocks) if (b.kind === "image") expect(b.imageId).toBeTruthy();
  });

  it("opens on its heading and the sunrise, shows its three pictures in order and ends on the two bands", () => {
    expect(GTM_ERA.blocks[0].kind).toBe("heading");
    expect(GTM_ERA.blocks.map(pictureKeyOf).filter(Boolean)).toEqual(["eradawn", "eraoracle", "eraadmin", "footv", "footer"]);
    expect(pictureKeyOf(GTM_ERA.blocks[1])).toBe("eradawn");
  });

  it("has every picture's file where the route reads it, none too heavy for an email", () => {
    for (const p of Object.values(GTM_ERA_NEEDS)) {
      const file = join(process.cwd(), "marketing", "launch", p.file);
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeLessThan(750_000);
    }
  });

  it("is a glance, not a read", () => {
    expect(words.join(" ").split(/\s+/).length).toBeLessThanOrEqual(GTM_ERA_MAX_WORDS);
  });

  it("says in the pictures what the email's alt text says, in step with the picture tool", () => {
    const art = readFileSync(join(process.cwd(), "tools/marketing/launch-art.mjs"), "utf8");
    for (const line of Object.values(GTM_ERA_LINES).flat()) expect(art).toContain(line);
    for (const [q, a] of GTM_ERA_ASKS) {
      expect(art).toContain(q);
      expect(art).toContain(a.toUpperCase());
    }
    for (const [job, now] of GTM_ERA_ADMIN) {
      expect(art).toContain(job.toUpperCase());
      expect(art).toContain(now);
      expect(GTM_ERA_PICTURES.eraadmin.alt).toContain(job);
    }
  });

  it("makes no claim that needs proof, uses only our fields and links only to renuabl.com.au", () => {
    const t = [GTM_ERA.subject, GTM_ERA.preview, ...GTM_ERA.blocks.map((b) => b.text)].join(" ");
    expect(claimsToCheck(t)).toEqual([]);
    expect(t.match(/\{[A-Za-z]+\}/g)?.every((f) => f === "{firstName}" || f === "{company}") ?? true).toBe(true);
    expect(t).not.toMatch(/save \d|%|was \$|discount|\boff\b|guarantee|\bfirst (ai|truly)|\bbest\b|leading|world/i);
    for (const b of GTM_ERA.blocks) if (b.url) expect(b.url).toMatch(/^https:\/\/www\.renuabl\.com\.au(\/|$)/);
  });
});
