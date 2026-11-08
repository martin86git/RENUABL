import { describe, expect, it } from "vitest";
import {
  GMAIL_READONLY_SCOPE,
  GMAIL_SCOPE,
  afterAction,
  canChangeMail,
  canReadMail,
  cleanCompose,
  cleanComposeHelp,
  cleanEmailSummary,
  SUMMARY_INSTRUCTIONS,
  cleanLinkUrl,
  composeHelpPrompt,
  composeHtml,
  plainBody,
  withLink,
  rawEmail,
  isEmailAction,
  labelChange,
  dayGroup,
  filterInbox,
  isAutomated,
  isMessageId,
  mayReadTalk,
  mergeInboxes,
  parseFrom,
  partsOf,
  withPictures,
  type InboxEmail,
} from "./inbox";

describe("the inbox", () => {
  it("reads who an email is from, and tells a machine's address", () => {
    expect(parseFrom('"Casey Example" <Casey@Example.com>')).toEqual({ name: "Casey Example", email: "casey@example.com" });
    expect(parseFrom("sam@sparks.example")).toEqual({ name: "sam", email: "sam@sparks.example" });
    expect(isAutomated("no-reply@bank.example")).toBe(true);
    expect(isAutomated("notifications@github.example")).toBe(true);
    expect(isAutomated("dmarc-reports@x.example")).toBe(true);
    expect(isAutomated("casey@example.com")).toBe(false);
  });

  it("sets emails out by the market's day", () => {
    const now = new Date("2026-11-04T02:00:00Z"); // Wednesday in Melbourne
    expect(dayGroup("2026-11-04T01:00:00Z", now)).toBe("Today");
    expect(dayGroup("2026-11-03T01:00:00Z", now)).toBe("Yesterday");
    expect(dayGroup("2026-11-02T01:00:00Z", now)).toBe("This week");
    expect(dayGroup("2026-10-20T01:00:00Z", now)).toBe("October 2026");
  });

  it("filters by customers, unread and automated, and searches every word", () => {
    const e = (id: string, more: Partial<InboxEmail>): InboxEmail => ({
      id,
      threadId: id,
      from: { name: "A", email: "a@x.example" },
      subject: "Hello",
      snippet: "",
      at: "2026-11-04T01:00:00Z",
      unread: false,
      automated: false,
      deal: null,
      notes: 0,
      ...more,
    });
    const list = [
      e("1", { deal: { id: "j", customer: "Casey" } }),
      e("2", { unread: true, subject: "Battery quote" }),
      e("3", { automated: true }),
    ];
    expect(filterInbox(list, "customers").map((x) => x.id)).toEqual(["1"]);
    expect(filterInbox(list, "unread").map((x) => x.id)).toEqual(["2"]);
    expect(filterInbox(list, "automated").map((x) => x.id)).toEqual(["3"]);
    expect(filterInbox(list, "all", "battery QUOTE").map((x) => x.id)).toEqual(["2"]);
    expect(filterInbox(list, "all", "casey").map((x) => x.id)).toEqual(["1"]);
  });

  it("walks an email's parts for its words, HTML, files and pictures", () => {
    const p = partsOf({
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/plain", body: { data: "aGk" } },
            { mimeType: "text/html", body: { data: "PGI-aGk8L2I-" } },
          ],
        },
        {
          mimeType: "image/png",
          filename: "logo.png",
          headers: [{ name: "Content-ID", value: "<logo1>" }],
          body: { attachmentId: "A1", size: 10 },
        },
        { mimeType: "application/pdf", filename: "bill.pdf", body: { attachmentId: "A2", size: 2000 } },
      ],
    });
    expect([p.text, p.html]).toEqual(["aGk", "PGI-aGk8L2I-"]);
    expect(p.files).toEqual([{ n: 0, name: "bill.pdf", type: "application/pdf", size: 2000, attachmentId: "A2" }]);
    expect(p.inline).toEqual([{ cid: "logo1", type: "image/png", attachmentId: "A1" }]);
    expect(withPictures('<img src="cid:logo1">', [{ cid: "logo1", dataUrl: "data:image/png;base64,AA" }])).toBe(
      '<base target="_blank"><img src="data:image/png;base64,AA">',
    );
  });

  it("lets only the mailbox's owner and those tagged read the notes", () => {
    const talk = { owner: "me@x.example", shared: ["sam@x.example"] };
    expect([mayReadTalk(talk, "ME@x.example"), mayReadTalk(talk, "sam@x.example"), mayReadTalk(talk, "kim@x.example")]).toEqual([
      true,
      true,
      false,
    ]);
    expect(isMessageId("18c2f0a9b3d4e5f6")).toBe(true);
    expect(isMessageId("../etc")).toBe(false);
  });
});

describe("marking read and archiving", () => {
  it("asks Google for modify, and tells a read-only connection from one that can change mail", () => {
    expect(GMAIL_SCOPE).toBe("https://www.googleapis.com/auth/gmail.modify");
    const old = `openid email ${GMAIL_READONLY_SCOPE}`;
    expect([canReadMail(old), canChangeMail(old)]).toEqual([true, false]);
    expect([canReadMail(`email ${GMAIL_SCOPE}`), canChangeMail(`email ${GMAIL_SCOPE}`)]).toEqual([true, true]);
    expect(canReadMail("openid email")).toBe(false);
  });

  it("changes only Gmail's own labels: read, unread, out of the inbox", () => {
    expect(labelChange("read")).toEqual({ addLabelIds: [], removeLabelIds: ["UNREAD"] });
    expect(labelChange("unread")).toEqual({ addLabelIds: ["UNREAD"], removeLabelIds: [] });
    expect(labelChange("archive")).toEqual({ addLabelIds: [], removeLabelIds: ["INBOX"] });
    expect([isEmailAction("archive"), isEmailAction("delete")]).toEqual([true, false]);
  });

  it("updates the list in place, the same email in another mailbox left alone", () => {
    const list = [
      { id: "1", box: "a", unread: true },
      { id: "1", box: "b", unread: true },
      { id: "2", box: "a", unread: false },
    ];
    expect(afterAction(list, "1", "a", "read").map((e) => e.unread)).toEqual([false, true, false]);
    expect(afterAction(list, "2", "a", "unread")[2].unread).toBe(true);
    expect(afterAction(list, "1", "a", "archive").map((e) => `${e.id}${e.box}`)).toEqual(["1b", "2a"]);
  });
});

describe("writing a new email", () => {
  const read = (raw: Buffer) => raw.toString("utf8");
  /** Every base64 part of the email, decoded, in order. */
  const parts = (raw: Buffer) =>
    read(raw)
      .split(/\r\n\r\n/)
      .slice(1)
      .map((chunk) => chunk.split(/\r\n--/)[0].replace(/\r\n/g, ""))
      .filter((b) => /^[A-Za-z0-9+/=]+$/.test(b) && b.length > 4)
      .map((b) => Buffer.from(b, "base64").toString("utf8"));

  it("checks who it's to, keeps Cc apart and needs something to say", () => {
    expect(
      cleanCompose({ to: "Sam@X.example, sam@x.example; kim@y.example", cc: "kim@y.example lee@z.example", subject: "Hi", body: "" }),
    ).toEqual({
      ok: true,
      mail: { to: ["sam@x.example", "kim@y.example"], cc: ["lee@z.example"], subject: "Hi", body: "", size: "normal" },
    });
    expect(cleanCompose({ to: "", subject: "Hi" })).toMatchObject({ ok: false });
    expect(cleanCompose({ to: "not an address", subject: "Hi" })).toMatchObject({ ok: false });
    expect(cleanCompose({ to: "sam@x.example" })).toMatchObject({ ok: false });
    // A file alone is something to send.
    expect(cleanCompose({ to: "sam@x.example" }, true)).toMatchObject({ ok: true });
    expect(cleanCompose({ to: "sam@x.example", body: "x", size: "huge" })).toMatchObject({ ok: true, mail: { size: "huge" } });
    expect(cleanCompose({ to: "sam@x.example", body: "x", size: "<script>" })).toMatchObject({ ok: true, mail: { size: "normal" } });
  });

  it("never lets a typed subject add a header", () => {
    const c = cleanCompose({ to: "sam@x.example", subject: "Hi\r\nBcc: eve@evil.example", body: "x" });
    expect(c.ok && c.mail.subject).toBe("Hi Bcc: eve@evil.example");
    if (!c.ok) return;
    expect(
      read(rawEmail("me@x.example", c.mail))
        .split("\r\n")
        .filter((l) => /^bcc:/i.test(l)),
    ).toEqual([]);
  });

  it("builds the email Gmail sends: plain text and HTML, any language", () => {
    const c = cleanCompose({ to: "sam@x.example", cc: "kim@y.example", subject: "Café quote", body: "G'day,\nSee you Tuesday ☀" });
    if (!c.ok) throw new Error(c.message);
    const raw = rawEmail("me@x.example", c.mail);
    expect(read(raw)).toContain("From: me@x.example\r\nTo: sam@x.example\r\nCc: kim@y.example\r\n");
    expect(read(raw)).toContain(`Subject: =?UTF-8?B?${Buffer.from("Café quote").toString("base64")}?=`);
    expect(read(raw)).toContain("multipart/alternative");
    const [text, html] = parts(raw);
    expect(text).toBe("G'day,\r\nSee you Tuesday ☀");
    expect(html).toContain("G&#39;day".replace("&#39;", "'"));
    expect(html).toContain("See you Tuesday ☀");
  });

  it("puts pictures inside the email and attaches the other files", () => {
    const c = cleanCompose({ to: "sam@x.example", body: "Here's the roof" });
    if (!c.ok) throw new Error(c.message);
    const raw = read(
      rawEmail(
        "me@x.example",
        c.mail,
        [
          { name: "roof.png", type: "image/png", bytes: new Uint8Array([1, 2, 3]), contentId: "picture1" },
          { name: 'quote "final".pdf', type: "application/pdf", bytes: new Uint8Array([4, 5]) },
        ],
        '<img src="cid:picture1">',
      ),
    );
    expect(raw).toContain("multipart/mixed");
    expect(raw).toContain("multipart/related");
    expect(raw).toContain("Content-ID: <picture1>");
    expect(raw).toContain('Content-Disposition: attachment; filename="quote final.pdf"');
  });

  it("makes links safe and keeps them in both versions", () => {
    expect(cleanLinkUrl("renuabl.com.au")).toBe("https://renuabl.com.au/");
    expect(cleanLinkUrl("sam@x.example")).toBe("mailto:sam@x.example");
    expect(cleanLinkUrl("javascript:alert(1)")).toBeNull();
    expect(cleanLinkUrl("not a link")).toBeNull();
    expect(withLink("See our page", 4, 12, "https://renuabl.com.au/")).toEqual({
      text: "See [our page](https://renuabl.com.au/)",
      caret: 39,
    });
    expect(withLink("Visit ", 6, 6, "https://renuabl.com.au/").text).toBe("Visit [https://renuabl.com.au/](https://renuabl.com.au/)");
    const body = "Read [the guide](https://renuabl.com.au/learn) or [this](javascript:void)";
    expect(plainBody(body)).toBe("Read the guide (https://renuabl.com.au/learn) or this");
    const html = composeHtml(body, "large");
    expect(html).toContain('<a href="https://renuabl.com.au/learn" style="color:#1a56db">the guide</a>');
    expect(html).not.toContain("javascript");
    expect(html).toContain("font-size:16px");
    expect(composeHtml("<b>hi</b>\n• one\n• two", "normal")).toContain("&lt;b&gt;hi&lt;/b&gt;</p>\n<ul");
  });

  it("asks Sol to tidy without adding facts, or to write what was asked", () => {
    const base = { business: "Sunrise Solar", to: ["sam@x.example"], subject: "", body: "hi sam, quote atached", instructions: "" };
    const polish = composeHelpPrompt("polish", base);
    expect(polish).toContain("Tidy up this email");
    expect(polish).toContain("Never add a figure, price");
    expect(polish).toContain("quote atached");
    const write = composeHelpPrompt("write", { ...base, body: "", instructions: "thank them for the call, proposal coming Friday" });
    expect(write).toContain("What they want: thank them for the call");
    expect(cleanComposeHelp({ subject: "Thanks\nfor the call", body: "  Hi Sam  " })).toEqual({
      subject: "Thanks for the call",
      body: "Hi Sam",
    });
    expect(cleanComposeHelp({ subject: "x", body: "" })).toBeNull();
  });
});

describe("Sol's summary of an email", () => {
  it("keeps the three parts apart and reads padding as nothing to do", () => {
    expect(cleanEmailSummary({ short: " Neon's usage\nreport: $6.57 so far. ", asking: "Nothing.", next: "No action needed." })).toEqual({
      short: "Neon's usage report: $6.57 so far.",
      asking: "",
      next: "",
    });
    expect(
      cleanEmailSummary({ short: "Sam wants a battery quote.", asking: "A price for a battery", next: "Reply with the proposal" }),
    ).toEqual({
      short: "Sam wants a battery quote.",
      asking: "A price for a battery",
      next: "Reply with the proposal",
    });
    expect(cleanEmailSummary({ short: "", next: "Call" })).toBeNull();
    expect(SUMMARY_INSTRUCTIONS).toContain("never for the customer");
  });
});

describe("several mailboxes", () => {
  it("merges them newest first and keeps the inbox's size", () => {
    const a = [
      { at: "2026-11-05T01:00:00Z", box: "a" },
      { at: "2026-11-03T01:00:00Z", box: "a" },
    ];
    const b = [{ at: "2026-11-04T01:00:00Z", box: "b" }];
    expect(mergeInboxes([a, b]).map((e) => e.box)).toEqual(["a", "b", "a"]);
    expect(mergeInboxes([a, b], 2)).toHaveLength(2);
  });
});
