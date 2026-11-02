import { describe, expect, it } from "vitest";
import {
  EMAIL_FILES_BYTES,
  EMAIL_SYMBOLS,
  atCaret,
  attachedLine,
  emailFileName,
  emailFilesProblem,
  isPicture,
  listEnter,
  messageBlocks,
  messageHtml,
  pictureBudget,
  picturesHtml,
  withList,
} from "./email-compose";

const pdf = (size = 1000, name = "a.pdf") => ({ size, type: "application/pdf", name });

describe("email files", () => {
  it("takes up to six files of the allowed kinds, 4 MB together", () => {
    expect(emailFilesProblem([pdf(), { size: 10, type: "image/png" }])).toBeNull();
    expect(emailFilesProblem(Array.from({ length: 7 }, () => pdf()))).toMatch(/Up to 6/);
    expect(emailFilesProblem([{ size: 10, type: "application/zip", name: "x.zip" }])).toMatch(/x\.zip can't be sent/);
    expect(emailFilesProblem([pdf(0)])).toMatch(/empty/);
    expect(emailFilesProblem([pdf(EMAIL_FILES_BYTES), pdf(1)])).toMatch(/over the 4 MB/);
  });

  it("knows a picture", () => {
    expect(isPicture("image/jpeg")).toBe(true);
    expect(isPicture("application/pdf")).toBe(false);
  });

  it("shares what is left of the budget between the pictures", () => {
    expect(pictureBudget(0, 2)).toBeLessThan(EMAIL_FILES_BYTES / 2);
    expect(pictureBudget(0, 2)).toBeGreaterThan(EMAIL_FILES_BYTES / 2 - 2048);
    expect(pictureBudget(EMAIL_FILES_BYTES, 3)).toBe(150 * 1024);
  });

  it("names files safely, with the right extension", () => {
    expect(emailFileName("C:\\Users\\me\\<quote>.pdf", "application/pdf")).toBe("quote.pdf");
    expect(emailFileName("image.png", "image/png", 2)).toBe("picture-2.png");
    expect(emailFileName("", "image/jpeg", 1)).toBe("picture-1.jpg");
    expect(emailFileName("roof.png", "image/jpeg")).toBe("roof.jpg");
    expect(emailFileName("roof.jpeg", "image/jpeg")).toBe("roof.jpeg");
    expect(emailFileName("bill", "application/pdf")).toBe("bill.pdf");
    expect(emailFileName("a?b*c.pdf", "application/pdf")).toBe("abc.pdf");
    expect(emailFileName(`${"x".repeat(150)}.pdf`, "application/pdf").length).toBeLessThanOrEqual(100);
  });
});

describe("the email's words", () => {
  it("reads bullets, numbers and paragraphs", () => {
    expect(messageBlocks("Hi Jo,\n\n• one\n- two\n* three\n\n1. first\n2) second\n\nThanks")).toEqual([
      { kind: "p", lines: ["Hi Jo,"] },
      { kind: "ul", items: ["one", "two", "three"] },
      { kind: "ol", start: 1, items: ["first", "second"] },
      { kind: "p", lines: ["Thanks"] },
    ]);
  });

  it("starts a new list after a blank line or a paragraph", () => {
    expect(messageBlocks("• a\n\n• b").filter((b) => b.kind === "ul")).toHaveLength(2);
    expect(messageBlocks("• a\ntext\n• b").map((b) => b.kind)).toEqual(["ul", "p", "ul"]);
  });

  it("keeps a signature dash and a number that isn't a list", () => {
    expect(messageBlocks("--\nJo\n2026 was good").map((b) => b.kind)).toEqual(["p"]);
  });

  it("builds real lists, escaped, styled inline", () => {
    const html = messageHtml("Hi <b>\n\n• a & b\n\n3. three\n4. four");
    expect(html).toContain("<p>Hi &lt;b&gt;</p>");
    expect(html).toContain('<ul style="');
    expect(html).toContain('<li style="margin:0 0 4px">a &amp; b</li>');
    expect(html).toContain('<ol start="3"');
    expect(html).not.toContain("<b>");
  });

  it("puts pictures in by their inline ids", () => {
    expect(picturesHtml(["picture1", "picture2"])).toMatch(/src="cid:picture1".*\n.*src="cid:picture2"/);
  });

  it("says what is attached in the plain text", () => {
    expect(attachedLine(0, 0)).toBe("");
    expect(attachedLine(1, 0)).toBe("(A picture is attached.)");
    expect(attachedLine(1, 1)).toBe("(A picture and a file are attached.)");
    expect(attachedLine(2, 3)).toBe("(2 pictures and 3 files are attached.)");
  });
});

describe("editing the words", () => {
  it("turns the lines touched into a list, and back", () => {
    const text = "Intro\napples\npears\nEnd";
    const on = withList(text, 7, 15, "bullets");
    expect(on.text).toBe("Intro\n• apples\n• pears\nEnd");
    const off = withList(on.text, on.start, on.end, "bullets");
    expect(off.text).toBe(text);
  });

  it("switches one kind of list for the other", () => {
    expect(withList("• a\n• b", 0, 7, "numbers").text).toBe("1. a\n2. b");
    expect(withList("1. a\n2. b", 0, 9, "bullets").text).toBe("• a\n• b");
  });

  it("starts a list on an empty line with the caret after the marker", () => {
    expect(withList("Hi\n", 3, 3, "numbers")).toEqual({ text: "Hi\n1. ", start: 6, end: 6 });
  });

  it("leaves a blank line in the middle blank", () => {
    expect(withList("a\n\nb", 0, 4, "numbers").text).toBe("1. a\n\n2. b");
  });

  it("carries the list on at Enter, and ends it on an empty item", () => {
    expect(listEnter("• apples", 8)).toEqual({ text: "• apples\n• ", caret: 11 });
    expect(listEnter("1. first", 8)).toEqual({ text: "1. first\n2. ", caret: 12 });
    expect(listEnter("1) first", 8)?.text).toBe("1) first\n2) ");
    expect(listEnter("• apples\n• ", 11)).toEqual({ text: "• apples\n", caret: 9 });
    expect(listEnter("plain", 5)).toBeNull();
  });

  it("puts a symbol in at the caret, over a selection", () => {
    expect(atCaret("ab", 1, 1, "✓")).toEqual({ text: "a✓b", caret: 2 });
    expect(atCaret("abc", 1, 2, "°")).toEqual({ text: "a°c", caret: 2 });
    expect(EMAIL_SYMBOLS).toHaveLength(32);
  });
});

describe("the emails that carry it", () => {
  it("sends a deal's email with real lists, pictures under the words and the plain text as typed", async () => {
    const { dealEmail, emailRecord } = await import("./deal-email");
    const e = dealEmail({
      business: "Sunrise",
      subject: "Hi",
      body: "Hi Jo\n\n• one\n• two",
      pictures: picturesHtml(["picture1"]),
      attached: attachedLine(1, 1),
    });
    expect(e.html).toMatch(/<ul[^>]*><li[^>]*>one<\/li><li[^>]*>two<\/li><\/ul>/);
    expect(e.html.indexOf("cid:picture1")).toBeGreaterThan(e.html.indexOf("</ul>"));
    expect(e.text).toContain("• one\n• two\n\n(A picture and a file are attached.)");
    expect(emailRecord("a@b.example", "Hi", "words", ["roof.jpg"])).toBe(
      "Email to a@b.example: Hi\nAttached (kept in the deal's Attachments): roof.jpg\n\nwords",
    );
  });

  it("keeps a chat reply's lines and lists in the customer's email, still without links", async () => {
    const { chatReplyEmail } = await import("../emails");
    const e = chatReplyEmail({
      business: "Sunrise",
      customer: "Jo",
      text: "What's next:\n1. Site visit\n2. Sign at https://evil.example",
      link: "https://www.renuabl.com.au/p/x#chat",
      pictures: picturesHtml(["picture1"]),
      attached: attachedLine(1, 0),
    });
    expect(e.html).toMatch(/<ol[^>]*><li[^>]*>Site visit<\/li><li[^>]*>Sign at<\/li><\/ol>/);
    expect(e.html).not.toContain("evil");
    expect(e.html).toContain('src="cid:picture1"');
    expect(e.text).toContain("1. Site visit\n2. Sign at\n\n(A picture is attached.)");
  });

  it("says why files can't go with a reply that won't be emailed", async () => {
    const { filesNeedEmail } = await import("./chat");
    expect(filesNeedEmail("no-address")).toMatch(/no email address.*Take them off/);
  });
});
