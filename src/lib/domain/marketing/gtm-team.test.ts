import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, cleanContent, contentProblem, renderEdm } from "./edm";
import { claimsToCheck } from "./edm-sol";
import { GTM_CAMPAIGNS, GTM_PICTURES, GTM_TEAM, GTM_TEAM_NAME, pictureKeyOf, pictureKeys, withPictures } from "./gtm-drafts";

const ids = Object.fromEntries(Object.keys(GTM_PICTURES).map((k, i) => [k, `mimg_${String(i).padStart(24, "0")}`]));
const sender = { name: "RENUABL", abn: null, email: "hello@renuabl.example", phone: null, address: null };
const links = {
  click: (i: number) => `https://site.test/c?l=${i}`,
  pixel: null,
  unsubscribe: "https://site.test/u",
  image: (id: string) => `https://site.test/i/${id}`,
};

describe("Meet your AI sales team", () => {
  it("is added with the other campaigns, whole and valid once its pictures are in", () => {
    expect(GTM_CAMPAIGNS.map((c) => c.name)).toContain(GTM_TEAM_NAME);
    const c = withPictures(GTM_TEAM, ids);
    expect(contentProblem(c)).toBeNull();
    expect(cleanContent(c)).toEqual(c);
  });

  it("is told in frames: the cover, 01, 02, 03 and the close, each full width with a button under it", () => {
    const keys = GTM_TEAM.blocks.map(pictureKeyOf).filter(Boolean);
    expect(keys).toEqual(["tcover", "tone", "ttwo", "tthree", "tclose", "footv", "footer"]);
    GTM_TEAM.blocks.forEach((b, i) => {
      const key = pictureKeyOf(b);
      if (!key || key.startsWith("foot")) return;
      expect(b.width).toBe("full");
      const next = GTM_TEAM.blocks.slice(i + 1).find((x) => x.kind === "button" || x.kind === "image");
      expect(next?.kind).toBe("button");
    });
    // Words that say it all for an inbox that holds pictures back, under the cover.
    expect(GTM_TEAM.blocks[1].kind).toBe("text");
  });

  it("sits on the frames' own ground with white buttons and light words", () => {
    expect(GTM_TEAM.style).toEqual({ background: "#1d1f25", text: "#f5f5f7" });
    for (const b of GTM_TEAM.blocks.filter((x) => x.kind === "button")) expect(b.colour).toBe("#ffffff");
    const html = renderEdm(withPictures(GTM_TEAM, ids), DEFAULT_BRAND, sender, { firstName: "Sam", company: null }, links).html;
    expect(html).toContain("background:#1d1f25");
  });

  it("reads in every picture it uses, each a file in marketing/launch", () => {
    for (const k of pictureKeys(GTM_TEAM)) expect(existsSync(join(process.cwd(), "marketing", "launch", GTM_PICTURES[k].file))).toBe(true);
  });

  it("makes no claim that needs proof and never says a roof designs itself", () => {
    const words = [GTM_TEAM.subject, GTM_TEAM.preview, ...GTM_TEAM.blocks.map((b) => b.text)].join(" ");
    expect(claimsToCheck(words)).toEqual([]);
    expect(words).not.toMatch(/designs itself|by itself|on its own|automatically/i);
  });
});
