import { describe, expect, it } from "vitest";
import { chatMessageEmail, chatReplyEmail } from "../emails";
import { cleanBrandKit, defaultBrand } from "./brand";
import {
  LINE_MISSING,
  MAX_LINE,
  POLL_SECONDS,
  businessReplied,
  cleanLine,
  customerWrote,
  firstNameOf,
  publicMessages,
  replyOutcome,
  teamName,
  unanswered,
  type ChatLine,
} from "./chat";
import { ACTIVITY_KINDS } from "./crm";

const LINES: ChatLine[] = [
  { id: "msg_1", from: "customer", text: "Can it go on the garage?", at: "2026-10-12T01:00:00.000Z", by: null, read: true },
  {
    id: "msg_2",
    from: "business",
    text: "It can. We'll redraw it.",
    at: "2026-10-12T02:00:00.000Z",
    by: "sam@example-solar.test",
    read: true,
  },
  { id: "msg_3", from: "customer", text: "Thanks", at: "2026-10-12T03:00:00.000Z", by: null, read: false },
];

describe("a message as typed", () => {
  it("is kept with its line breaks, tidied and cut to a length", () => {
    expect(cleanLine({ text: "  Hello\r\n\r\n\r\n\r\nthere\u0007  " })).toEqual({ ok: true, value: { text: "Hello\n\nthere" } });
    const long = cleanLine({ text: "x".repeat(5000) });
    expect(long.ok && long.value.text.length).toBe(MAX_LINE);
  });
  it("needs something written", () => {
    for (const text of ["", "   ", "\n\n", undefined, 5, null]) expect(cleanLine({ text })).toEqual({ ok: false, message: LINE_MISSING });
    expect(cleanLine(null)).toEqual({ ok: false, message: LINE_MISSING });
  });
  it("takes the words and nothing else: who it is from can't be sent", () => {
    const cleaned = cleanLine({
      text: "Hi",
      from: "business",
      by: "owner@example-solar.test",
      read: true,
      at: "2020-01-01",
      jobId: "job_other",
    });
    expect(cleaned).toEqual({ ok: true, value: { text: "Hi" } });
  });
});

describe("what the customer is sent of a conversation", () => {
  it("is each line's side, words and time, and nothing else", () => {
    const sent = publicMessages(LINES);
    expect(sent).toEqual([
      { id: "msg_1", from: "customer", text: "Can it go on the garage?", at: "2026-10-12T01:00:00.000Z" },
      { id: "msg_2", from: "business", text: "It can. We'll redraw it.", at: "2026-10-12T02:00:00.000Z" },
      { id: "msg_3", from: "customer", text: "Thanks", at: "2026-10-12T03:00:00.000Z" },
    ]);
    // Never who at the business wrote a line, or what has been read: not as a field, and not as a value anywhere.
    const text = JSON.stringify(sent);
    expect(text).not.toContain("sam@example-solar.test");
    for (const key of ["by", "read", "email", "cost", "margin"]) expect(text).not.toContain(`"${key}"`);
    for (const line of sent) expect(Object.keys(line).sort()).toEqual(["at", "from", "id", "text"]);
  });
  it("names the business's side as its team, never a person, and the customer by their first name", () => {
    expect(teamName("Example Solar")).toBe("Example Solar team");
    expect(teamName("  ")).toBe("The team");
    expect(firstNameOf({ firstName: "Alex", name: "Alex Example" })).toBe("Alex");
    expect(firstNameOf({ name: "Jordan Placeholder" })).toBe("Jordan");
    expect(firstNameOf({ name: "" })).toBe("You");
  });
});

describe("where a conversation stands", () => {
  it("counts the customer's latest lines that have had no answer", () => {
    expect(unanswered(LINES)).toBe(1);
    expect(unanswered(LINES.slice(0, 2))).toBe(0);
    expect(unanswered([LINES[0], LINES[2]])).toBe(2);
    expect(unanswered([])).toBe(0);
  });
  it("tells a member plainly whether the customer was emailed", () => {
    expect(replyOutcome("emailed")).toBe("Sent, and emailed to the customer.");
    expect(replyOutcome("no-address")).toMatch(/^Sent\. Not emailed: there is no email address on file/);
    expect(replyOutcome("not-set-up")).toMatch(/^Sent\. Not emailed: email isn't set up/);
    expect(replyOutcome("switched-off")).toMatch(/^Sent\. Not emailed: emailing replies is switched off/);
    expect(replyOutcome("failed")).toMatch(/^Sent\. The email to the customer couldn't be sent/);
    // Every one says the message itself was sent.
    for (const outcome of ["emailed", "no-address", "not-set-up", "switched-off", "failed"] as const)
      expect(replyOutcome(outcome)).toMatch(/^Sent/);
  });
  it("goes on the customer's record as a message, cut to a length", () => {
    expect(ACTIVITY_KINDS).toContain("message");
    expect(customerWrote("Can it go on the garage?")).toBe("Message from the customer: Can it go on the garage?");
    expect(businessReplied("x".repeat(900)).length).toBeLessThan(330);
  });
  it("asks the server for new lines every 20 seconds", () => {
    expect(POLL_SECONDS).toBe(20);
  });
});

describe("emails about a conversation", () => {
  it("are switched on until a business says otherwise, by a plain yes or no", () => {
    const start = defaultBrand("Example Solar");
    expect(start.emailReplies).toBe(true);
    const off = cleanBrandKit({ emailReplies: false }, start);
    expect(off.ok && off.value.emailReplies).toBe(false);
    const junk = cleanBrandKit({ emailReplies: "no" }, start);
    expect(junk.ok && junk.value.emailReplies).toBe(true);
  });
  it("tell the customer who it is from, carry the message, and ask them to answer on their proposal", () => {
    const email = chatReplyEmail({
      business: "Example Solar",
      customer: "Alex",
      text: "It can. We'll redraw it.",
      link: "https://www.renuabl.com.au/p/abc#chat",
    });
    expect(email.subject).toBe("A message from Example Solar about your proposal");
    expect(email.text).toContain("It can. We'll redraw it.");
    expect(email.text).toContain("https://www.renuabl.com.au/p/abc#chat");
    expect(email.text).toMatch(/open your proposal and write back there/);
    expect(email.text).toMatch(/A reply to this email isn't read/);
    expect(email.text).not.toMatch(/just reply/i);
    // It says plainly that RENUABL sent it for the business.
    expect(email.text).toMatch(/Sent for Example Solar by RENUABL/);
  });
  it("never let what was typed become markup", () => {
    const email = chatReplyEmail({
      business: "<b>Example</b> Solar",
      customer: "<i>Alex</i>",
      text: '<script>alert(1)</script><a href="https://evil.example">click</a>',
      link: "https://www.renuabl.com.au/p/abc#chat",
    });
    expect(email.html).not.toMatch(/<script|<a href="https:\/\/evil|<b>|<i>/);
    const notice = chatMessageEmail({
      business: "Example Solar",
      customer: "<img src=x onerror=alert(1)>",
      title: "Solar",
      text: "<script>alert(1)</script>",
      link: "https://www.renuabl.com.au/design/deals/job_1?tab=chat",
    });
    expect(notice.html).not.toMatch(/<script|<img/);
  });
  it("tell the business who wrote and what, with the way to the deal, and that a reply by email doesn't reach them", () => {
    const notice = chatMessageEmail({
      business: "Example Solar",
      customer: "Alex Example",
      title: "Solar",
      text: "Can it go on the garage?",
      link: "https://www.renuabl.com.au/design/deals/job_1?tab=chat",
    });
    expect(notice.subject).toBe("New message from Alex Example");
    expect(notice.text).toContain("Can it go on the garage?");
    expect(notice.text).toContain("https://www.renuabl.com.au/design/deals/job_1?tab=chat");
    expect(notice.text).toMatch(/Replying to this email doesn't reach them/);
    expect(notice.text).toMatch(/wasn't sent to the customer/);
  });
});
