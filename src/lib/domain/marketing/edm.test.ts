import { describe, expect, it } from "vitest";
import {
  cleanBlocks,
  cleanBrand,
  cleanLink,
  contentProblem,
  edmLinks,
  merge,
  moveBlock,
  newBlock,
  renderEdm,
  footerLines,
  senderProblem,
  type EdmContent,
  type EdmSender,
} from "./edm";
import { MARKETING_PAGE_ID, withMarketing } from "./access";
import { SECTIONS } from "../design/sections";
import {
  afterWorkingDays,
  cleanSendAt,
  cleanSequence,
  inSendingHours,
  nextSendingTime,
  reportOf,
  roomThisRun,
  sequenceProblem,
  stepAction,
  stopReason,
} from "./sequences";

const rand = () => 0.5;
const links = {
  click: (i: number) => `https://site.test/api/m/c/tok?l=${i}`,
  pixel: "https://site.test/api/m/o/tok",
  unsubscribe: "https://site.test/m/u/abc",
  image: (id: string) => `https://site.test/api/m/i/${id}`,
};

describe("blocks", () => {
  it("cleans links and refuses unsafe ones", () => {
    expect(cleanLink("renuabl.com.au/business")).toBe("https://renuabl.com.au/business");
    expect(cleanLink("javascript:alert(1)")).toBeNull();
    expect(cleanLink("http://x.com")).toBeNull();
    expect(cleanLink("mailto:hello@renuabl.com.au")).toBe("mailto:hello@renuabl.com.au");
  });

  it("drops unknown kinds and keeps urls only where they belong", () => {
    const b = cleanBlocks([
      { id: "aaaaaa", kind: "heading", text: "Hi", url: "https://x.com" },
      { kind: "script", text: "<b>" },
      { id: "bbbbbb", kind: "button", text: "Go", url: "https://renuabl.com.au" },
    ]);
    expect(b.map((x) => x.kind)).toEqual(["heading", "button"]);
    expect(b[0].url).toBeNull();
    expect(b[1].url).toBe("https://renuabl.com.au/");
  });

  it("moves blocks and stops at the ends", () => {
    const b = [newBlock("heading", rand), { ...newBlock("text", rand), id: "other1234" }];
    expect(moveBlock(b, b[1].id, -1)[0].id).toBe("other1234");
    expect(moveBlock(b, b[0].id, -1)).toBe(b);
  });

  it("says what's missing before sending", () => {
    expect(contentProblem({ subject: "", preview: "", blocks: [] })).toMatch(/subject/);
    expect(contentProblem({ subject: "Hi", preview: "", blocks: [{ ...newBlock("button", rand), url: null }] })).toMatch(/heading/);
    expect(
      contentProblem({ subject: "Hi", preview: "", blocks: [newBlock("heading", rand), { ...newBlock("button", rand), url: null }] }),
    ).toMatch(/button/);
  });
});

const sender: EdmSender = { name: "Sunrise Solar", abn: "12345678901", email: "hi@sunrise.example", phone: null, address: "1 Sample St" };

describe("the business as sender", () => {
  it("needs a name and a way to reach it", () => {
    expect(senderProblem(sender)).toBeNull();
    expect(senderProblem({ ...sender, email: null })).toMatch(/email or phone/);
    expect(senderProblem({ ...sender, name: " " })).toMatch(/name/);
  });

  it("puts the business, its contact and the reason in the footer; an address set in Marketing wins", () => {
    expect(footerLines(cleanBrand({ reason: "Because." }), sender)).toEqual([
      "Sunrise Solar (ABN 12 345 678 901)",
      "1 Sample St",
      "Contact us: hi@sunrise.example",
      "Because.",
    ]);
    expect(footerLines(cleanBrand({ address: "PO Box 1" }), sender)[1]).toBe("PO Box 1");
  });
});

describe("Marketing in the menu", () => {
  const has = (s: ReturnType<typeof withMarketing>) => s.some((x) => x.pages.some((p) => p.id === MARKETING_PAGE_ID));
  it("shows only where it is switched on", () => {
    expect(has(withMarketing(SECTIONS, true))).toBe(true);
    expect(has(withMarketing(SECTIONS, false))).toBe(false);
  });
});

describe("renderEdm", () => {
  const content: EdmContent = {
    subject: "For {company}",
    preview: "A quick look",
    blocks: [
      { ...newBlock("heading", rand), text: "Hello {firstName}" },
      { ...newBlock("button", rand), id: "btn000", text: "Go", url: "https://renuabl.com.au/business" },
    ],
  };

  it("fills merge fields, escapes them, tracks clicks by index and always carries the footer", () => {
    const r = renderEdm(content, cleanBrand({}), sender, { firstName: "<Sam>", company: null }, links);
    expect(r.subject).toBe("For your business");
    expect(r.html).toContain("Hello &lt;Sam&gt;");
    expect(r.html).not.toContain("<Sam>");
    expect(r.html).toContain("https://site.test/api/m/c/tok?l=0");
    expect(r.html).toContain("https://site.test/m/u/abc");
    expect(r.html).toContain("Sunrise Solar (ABN 12 345 678 901)");
    expect(r.html).toContain("https://site.test/api/m/o/tok");
    expect(r.text).toContain("Unsubscribe: https://site.test/m/u/abc");
    expect(edmLinks(content.blocks)).toEqual(["https://renuabl.com.au/business"]);
  });

  it("reads a missing name kindly", () => {
    expect(merge("Hi {firstName}", { firstName: null, company: null })).toBe("Hi there");
  });
});

describe("sending hours", () => {
  it("only weekdays, 9 to 5 Melbourne", () => {
    expect(inSendingHours(new Date("2026-11-16T00:00:00Z"))).toBe(true); // Mon 11am AEDT
    expect(inSendingHours(new Date("2026-11-15T00:00:00Z"))).toBe(false); // Sunday
    expect(inSendingHours(new Date("2026-11-16T08:00:00Z"))).toBe(false); // Mon 7pm
  });

  it("finds the next window and counts working days", () => {
    expect(nextSendingTime(new Date("2026-11-15T00:00:00Z")).toISOString()).toBe("2026-11-15T22:00:00.000Z"); // Mon 9am
    expect(afterWorkingDays(2, new Date("2026-11-20T00:00:00Z")).toISOString()).toBe("2026-11-23T22:00:00.000Z"); // Fri + 2 = Tue 9am Melbourne
  });

  it("keeps within the batch and the day's cap", () => {
    expect(roomThisRun(0, 300)).toBe(100);
    expect(roomThisRun(280, 300)).toBe(20);
    expect(roomThisRun(400, 300)).toBe(0);
  });
});

describe("campaigns", () => {
  const now = new Date("2026-11-16T00:00:00Z");
  it("sends now or within 90 days", () => {
    expect(cleanSendAt(null, now)).toEqual({ at: now });
    expect(cleanSendAt("2025-01-01", now)).toHaveProperty("problem");
    expect(cleanSendAt("2027-06-01", now)).toHaveProperty("problem");
  });

  it("works out rates of those sent", () => {
    const r = reportOf({ queued: 0, sent: 200, failed: 0, skipped: 3, opened: 50, clicked: 10, unsubscribed: 1, bounced: 2 });
    expect(r.openRate).toBe(0.25);
    expect(reportOf({ queued: 5, sent: 0, failed: 0, skipped: 0, opened: 0, clicked: 0, unsubscribed: 0, bounced: 0 }).openRate).toBeNull();
  });
});

describe("sequences", () => {
  const email = { subject: "Hi", preview: "", blocks: [newBlock("heading", rand)] };
  it("needs a name, a trigger and a ready email", () => {
    expect(sequenceProblem(cleanSequence({ name: "Welcome" }))).toMatch(/starts/);
    const ok = cleanSequence({
      name: "Welcome",
      trigger: { kind: "list", listId: "ml_abc123" },
      steps: [
        { kind: "email", content: email },
        { kind: "wait", days: 999 },
      ],
    });
    expect(sequenceProblem(ok)).toBeNull();
    expect(ok.steps[1]).toMatchObject({ kind: "wait", days: 60 });
    expect(ok.stops.signedUp).toBe(true);
  });

  it("stops for the right reason, signing up first", () => {
    const facts = { signedUp: true, unsubscribed: true, bounced: false, mayEmail: true, clickedInSequence: false };
    expect(stopReason(facts, { signedUp: true, clicked: false })).toBe("signed-up");
    expect(stopReason({ ...facts, signedUp: false, unsubscribed: false, clickedInSequence: true }, { signedUp: true, clicked: true })).toBe(
      "clicked",
    );
    expect(stopReason({ ...facts, signedUp: false, unsubscribed: false }, { signedUp: true, clicked: false })).toBeNull();
  });

  it("walks the steps", () => {
    const steps = cleanSequence({
      steps: [
        { kind: "email", content: email },
        { kind: "wait", days: 2 },
      ],
    }).steps;
    const now = new Date("2026-11-16T00:00:00Z");
    expect(stepAction(steps, 0, now).kind).toBe("email");
    expect(stepAction(steps, 1, now)).toMatchObject({ kind: "wait" });
    expect(stepAction(steps, 2, now).kind).toBe("finish");
  });
});
