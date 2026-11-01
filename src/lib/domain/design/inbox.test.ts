import { describe, expect, it } from "vitest";
import { dayGroup, filterInbox, isAutomated, isMessageId, mayReadTalk, parseFrom, partsOf, withPictures, type InboxEmail } from "./inbox";

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
