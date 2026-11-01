import { describe, expect, it } from "vitest";
import {
  JOB_FILES_MAX,
  cleanInstallers,
  cleanNoteText,
  drawingSvg,
  installerBy,
  isJobFileId,
  isJobToken,
  jobCardEmail,
  jobDrawing,
  jobFilesProblem,
  stringLetter,
  stringsInWords,
} from "./job-card";
import type { RoofDesign } from "./roof-design";

const panel = (id: string, x: number) => ({ id, x, y: 0, angle: 0 });

const design = {
  lat: -37.88,
  lng: 145.16,
  faces: [],
  loose: [panel("a", -2), panel("b", 0), panel("c", 2)],
  strings: [{ id: "s1", panels: ["l:a", "l:b"], mppt: 1 }],
  inverters: [{ sku: "INV", name: "Inverter", kw: 5, x: 4, y: 3 }],
  switchboard: { x: -4, y: 3 },
} as unknown as RoofDesign;

describe("installers on file", () => {
  it("keeps those with a name and an email, giving new ones an id", () => {
    let n = 0;
    const id = () => `ins_${String(++n).padStart(8, "0")}`;
    const got = cleanInstallers(
      [
        { name: " Sam  Sparks ", email: "SAM@x.example", phone: "0400 000 000" },
        { id: "ins_aaaaaaaa", name: "Kim", email: "kim@x.example" },
        { name: "No email" },
        { id: "ins_aaaaaaaa", name: "Same id", email: "dup@x.example" },
      ],
      id,
    );
    expect(got).toEqual([
      { id: "ins_00000001", name: "Sam Sparks", email: "sam@x.example", phone: "0400 000 000" },
      { id: "ins_aaaaaaaa", name: "Kim", email: "kim@x.example", phone: "" },
      { id: "ins_00000002", name: "Same id", email: "dup@x.example", phone: "" },
    ]);
    // Without a way to make ids, one without an id isn't kept.
    expect(cleanInstallers([{ name: "New", email: "new@x.example" }])).toEqual([]);
  });
});

describe("the job card's thread", () => {
  it("takes notes and photos within bounds, and names an installer's note", () => {
    expect(cleanNoteText("  Roof is tin \n\n\n\nnot tile ")).toBe("Roof is tin \n\nnot tile");
    expect(jobFilesProblem([{ name: "a.jpg", type: "image/jpeg", size: 1000 }])).toBeNull();
    expect(jobFilesProblem([{ name: "a.exe", type: "application/x-msdownload", size: 10 }])).toMatch(/isn't a photo/);
    expect(jobFilesProblem([{ name: "big.jpg", type: "image/jpeg", size: 5 * 1024 * 1024 }])).toMatch(/over 4 MB/);
    expect(jobFilesProblem(Array.from({ length: JOB_FILES_MAX + 1 }, () => ({ name: "a.jpg", type: "image/jpeg", size: 1 })))).toMatch(
      /at a time/,
    );
    expect(installerBy("Sparks Electrical", "Jo")).toBe("Jo (Sparks Electrical)");
    expect(installerBy("Sparks Electrical", "")).toBe("Sparks Electrical");
    expect(isJobToken("a".repeat(48))).toBe(true);
    expect(isJobToken("a".repeat(47))).toBe(false);
    expect(isJobFileId("jf_" + "0".repeat(24))).toBe(true);
  });
});

describe("the drawings", () => {
  it("draws the layout with the marks, and the strings lettered in their colours", () => {
    const layout = jobDrawing(design, "layout")!;
    expect(layout.marks.match(/<polygon/g)).toHaveLength(3);
    expect(layout.marks).toContain(">INV<");
    expect(layout.marks).toContain(">MSB<");
    const strings = jobDrawing(design, "strings")!;
    expect(strings.marks).toContain("#86efac");
    expect(strings.marks).toContain(">A<");
    expect(strings.marks).toContain("<polyline");
    expect(stringLetter(0)).toBe("A");
    expect(stringLetter(27)).toBe("S28");
    expect(stringsInWords(design)).toEqual(["A: 2 panels on input 2"]);
    expect(jobDrawing({ ...design, loose: [] } as RoofDesign, "layout")).toBeNull();
    const svg = drawingSvg(layout, null);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toContain("<image");
  });
});

describe("the email to the installer", () => {
  it("carries the day, the customer's name and phone, the link, and never their email", () => {
    const e = jobCardEmail({
      business: "Sunny Co",
      installer: "Sam",
      date: "2026-11-12",
      address: "1 Sample Street, Glen Waverley VIC 3150",
      customer: { name: "Casey <Test>", phone: "0400 000 000" },
      details: [{ label: "Panels", value: "16" }],
      strings: ["A: 8 panels on input 1"],
      link: "https://x.example/job/abc",
      drawings: 2,
    });
    expect(e.subject).toBe("Job card: 1 Sample Street · Thursday 12 November · Sunny Co");
    expect(e.text).toContain("Customer: Casey <Test> · 0400 000 000");
    expect(e.text).toContain("https://x.example/job/abc");
    expect(e.html).toContain("Casey &lt;Test&gt;");
    expect(e.text).not.toContain("@");
  });
});
