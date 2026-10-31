import { describe, expect, it } from "vitest";
import { cleanDiagram, cleanDiagrams, cleanSvg, DIAGRAMS_PER_TURN, diagramSrc } from "./sol-diagrams";

const ok = `<svg viewBox="0 0 400 200"><rect x="10" y="10" width="80" height="120" fill="#e6b84a" stroke="#262624"/><text x="50" y="150" text-anchor="middle" font-size="14">Battery</text></svg>`;

describe("Sol's diagrams", () => {
  it("keeps a plain drawing, with its namespace", () => {
    const svg = cleanSvg(ok)!;
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" font-family="Inter,')).toBe(true);
    expect(svg).toContain('<rect x="10" y="10" width="80" height="120" fill="#e6b84a" stroke="#262624"/>');
    expect(svg).toContain(">Battery</text>");
  });

  it("takes out anything that could run or reach outside the drawing", () => {
    const svg = cleanSvg(
      `<svg viewBox="0 0 10 10" onload="alert(1)" width="900"><script>alert(2)</script><style>*{}</style>` +
        `<rect onclick="x()" style="fill:red" fill="url(https://evil.example/x)" stroke="url(#g)" width="5" height="5"/>` +
        `<a href="javascript:alert(3)"><text x="1" y="9">Link</text></a><image href="https://evil.example/p.png"/>` +
        `<foreignObject><div>hi</div></foreignObject><path d="M0 0L5 5" fill="javascript:x"/></svg>`,
    )!;
    expect(svg).not.toMatch(/onload|onclick|script|style|alert|evil|href|image|foreignObject|javascript|width="900"/i);
    expect(svg).toContain('stroke="url(#g)"');
    expect(svg).toContain(">Link</text>");
  });

  it("escapes text and closes what was left open", () => {
    const svg = cleanSvg(`<svg viewBox="0 0 10 10"><g><text>600 < 900 & up</text>`)!;
    expect(svg.replace(/ font-family="[^"]*"/, "")).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g><text>600 &lt; 900 &amp; up</text></g></svg>',
    );
  });

  it("refuses a drawing with no svg root or no viewBox", () => {
    expect(cleanSvg("<rect width='1'/>")).toBeNull();
    expect(cleanSvg("<svg width='10'><rect/></svg>")).toBeNull();
    expect(cleanSvg(42)).toBeNull();
  });

  it("keeps a title and caption, and no more than a turn's worth", () => {
    expect(cleanDiagram({ title: "", svg: ok })).toBeNull();
    expect(cleanDiagram({ title: "Clearance", svg: ok, caption: "Illustration only." })?.caption).toBe("Illustration only.");
    expect(cleanDiagrams(Array.from({ length: 9 }, () => ({ title: "A", svg: ok })))).toHaveLength(DIAGRAMS_PER_TURN);
  });

  it("is shown as a picture's address", () => {
    expect(diagramSrc("<svg/>")).toBe("data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E");
  });
});
