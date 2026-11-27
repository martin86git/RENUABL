import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, cleanBlock, edmLinks, letterWarnings, newBlock, renderEdm, type EdmContent } from "./edm";

const sender = { name: "Sunrise Solar", abn: null, email: "hi@sunrise.example", phone: null, address: null };
const links = {
  click: (i: number) => `https://site.test/api/m/c/tok?l=${i}`,
  pixel: null,
  unsubscribe: "https://site.test/m/u/abc",
  image: (id: string) => `https://site.test/api/m/i/${id}`,
};
const pic = (n: number) => `mimg_${String(n).padStart(24, "0")}`;

describe("numbered steps blocks", () => {
  it("starts with three empty steps", () => {
    expect(newBlock("steps").steps).toHaveLength(3);
  });

  it("cleans steps: one line titles, https links only, at most five", () => {
    const b = cleanBlock({
      kind: "steps",
      steps: [
        { title: "  Your\nlead ", text: "x".repeat(500), url: "javascript:alert(1)", imageId: pic(1) },
        { title: "Design", url: "mailto:a@b.co" },
        ...Array.from({ length: 8 }, () => ({ title: "More" })),
      ],
    })!;
    expect(b.steps).toHaveLength(5);
    expect(b.steps![0]).toMatchObject({ title: "Your lead", url: null, imageId: pic(1) });
    expect(b.steps![0].text.length).toBeLessThanOrEqual(300);
    expect(b.steps![1].url).toBeNull();
    expect(b.text).toBe("");
  });

  it("sends titled steps numbered in order, each picture beside its words and each link tracked", () => {
    const content: EdmContent = {
      subject: "s",
      preview: "",
      blocks: [
        cleanBlock({
          kind: "steps",
          steps: [
            { title: "Contact your lead", text: "For {firstName}", imageId: pic(1), url: "https://sunrise.example/a", label: "See how" },
            { title: "" },
            { title: "Design it", url: "https://sunrise.example/b" },
          ],
        })!,
      ],
    };
    expect(edmLinks(content.blocks)).toEqual(["https://sunrise.example/a", "https://sunrise.example/b"]);
    const r = renderEdm(content, DEFAULT_BRAND, sender, { firstName: "Sam", company: null }, links);
    expect(r.html).toContain("Contact your lead");
    expect(r.html).toContain("For Sam");
    expect(r.html).toContain(`api/m/i/${pic(1)}`);
    expect(r.html).toContain(">See how</a>");
    expect(r.html).toContain(">Find out more</a>");
    expect(r.html).toMatch(/>1<\/div>[\s\S]*>2<\/div>/);
    expect(r.html).not.toMatch(/>3<\/div>/);
    expect(r.text).toContain("1. Contact your lead");
    expect(r.text).toContain("2. Design it");
    expect(r.text).toContain("See how: https://site.test/api/m/c/tok?l=0");
  });

  it("counts its pictures for a letter", () => {
    const c: EdmContent = {
      subject: "s",
      preview: "",
      blocks: [
        cleanBlock({
          kind: "steps",
          steps: [
            { title: "A", imageId: pic(1) },
            { title: "B", imageId: pic(2) },
          ],
        })!,
      ],
    };
    expect(letterWarnings(c).join(" ")).toContain("2 pictures");
  });
});

describe("the logo on a dark email", () => {
  it("uses the light logo on a dark ground and the usual one on a light ground", () => {
    const s = {
      ...sender,
      logo: "https://www.renuabl.com.au/brand/renuabl-logo-email.png",
      logoOnDark: "https://www.renuabl.com.au/brand/renuabl-logo-email-light.png",
    };
    const blocks = [cleanBlock({ kind: "heading", text: "Hi" })!];
    const dark = renderEdm(
      { subject: "s", preview: "", blocks, style: { background: "#0b0c0e", text: "#f5f5f7" } },
      DEFAULT_BRAND,
      s,
      { firstName: "Sam", company: null },
      links,
    );
    const light = renderEdm({ subject: "s", preview: "", blocks }, DEFAULT_BRAND, s, { firstName: "Sam", company: null }, links);
    expect(dark.html).toContain("renuabl-logo-email-light.png");
    expect(light.html).toContain("renuabl-logo-email.png");
    expect(light.html).not.toContain("renuabl-logo-email-light.png");
  });
});
