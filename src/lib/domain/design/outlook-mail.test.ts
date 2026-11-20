import { describe, expect, it } from "vitest";
import { isMessageId, parseFrom, partsOf, headerOf } from "./inbox";
import {
  asMailShape,
  cleanMailProvider,
  headerAddress,
  isInlinePicture,
  outlookChange,
  outlookMailGranted,
  outlookWebLink,
  providerOfId,
} from "./outlook-mail";

const OUTLOOK_ID = "AAMkAGI2TG93AAA-_abcDEF0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH=";

describe("an Outlook email in the inbox's own shape", () => {
  const message = {
    id: OUTLOOK_ID,
    conversationId: "conv-1",
    subject: "Quote for\r\nsolar",
    from: { emailAddress: { name: "Jo Example", address: "jo@example.com" } },
    toRecipients: [{ emailAddress: { name: "sales@sunrise.example", address: "sales@sunrise.example" } }],
    receivedDateTime: "2026-11-20T01:02:03Z",
    isRead: false,
    bodyPreview: "Hi, could you\r\nquote me",
    body: { contentType: "html", content: '<p>Hi <img src="cid:pic1"></p>' },
  };

  it("carries who, what, when and unread as a Gmail message does", () => {
    const m = asMailShape(message);
    expect(m.id).toBe(OUTLOOK_ID);
    expect(m.labelIds).toEqual(["UNREAD"]);
    expect(new Date(Number(m.internalDate)).toISOString()).toBe("2026-11-20T01:02:03.000Z");
    expect(headerOf(m.payload, "Subject")).toBe("Quote for solar");
    expect(parseFrom(headerOf(m.payload, "From"))).toEqual({ name: "Jo Example", email: "jo@example.com" });
    expect(headerOf(m.payload, "To")).toBe("sales@sunrise.example");
    expect(m.snippet).toBe("Hi, could you quote me");
    expect(asMailShape({ ...message, isRead: true }).labelIds).toEqual([]);
  });

  it("gives its words, its files and its own pictures to the inbox's reader", () => {
    const m = asMailShape(message, [
      { "@odata.type": "#microsoft.graph.fileAttachment", id: "a1", name: "bill.pdf", contentType: "application/pdf", size: 1200 },
      {
        "@odata.type": "#microsoft.graph.fileAttachment",
        id: "a2",
        name: "logo.png",
        contentType: "image/png",
        size: 4,
        isInline: true,
        contentId: "pic1",
        contentBytes: Buffer.from("abcd").toString("base64"),
      },
      { "@odata.type": "#microsoft.graph.fileAttachment", id: "a3", name: "sig.png", contentType: "image/png", size: 9, isInline: true },
      { "@odata.type": "#microsoft.graph.itemAttachment", id: "a4", name: "Another email" },
    ]);
    const parts = partsOf(m.payload);
    expect(Buffer.from(parts.html ?? "", "base64url").toString("utf8")).toContain("cid:pic1");
    expect(parts.text).toBeNull();
    expect(parts.files).toEqual([{ n: 0, name: "bill.pdf", type: "application/pdf", size: 1200, attachmentId: "a1" }]);
    expect(parts.inline).toHaveLength(1);
    expect(parts.inline[0].cid).toBe("pic1");
    expect(Buffer.from(parts.inline[0].data ?? "", "base64url").toString("utf8")).toBe("abcd");
  });

  it("reads a plain-text email as text", () => {
    const parts = partsOf(asMailShape({ ...message, body: { contentType: "text", content: "Hello" } }).payload);
    expect(Buffer.from(parts.text ?? "", "base64url").toString("utf8")).toBe("Hello");
    expect(parts.html).toBeNull();
  });
});

describe("Outlook's ids, permissions and changes", () => {
  it("tells an Outlook id from a Gmail one, and both pass as an email's id", () => {
    expect(providerOfId("18c2f0a9b3d4e5f6")).toBe("google");
    expect(providerOfId(OUTLOOK_ID)).toBe("outlook");
    expect(isMessageId(OUTLOOK_ID)).toBe(true);
    expect(isMessageId("18c2f0a9b3d4e5f6")).toBe(true);
    expect(isMessageId("../etc/passwd")).toBe(false);
    expect(isMessageId("a/b?c=1")).toBe(false);
  });

  it("needs both reading and sending granted", () => {
    expect(outlookMailGranted("openid email Mail.ReadWrite Mail.Send")).toBe(true);
    expect(outlookMailGranted("https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send")).toBe(true);
    expect(outlookMailGranted("Mail.ReadWrite")).toBe(false);
    expect(outlookMailGranted("Mail.Read Mail.Send")).toBe(false);
    expect(outlookMailGranted(undefined)).toBe(false);
  });

  it("marks read and unread by a field and archives by moving, never deleting", () => {
    expect(outlookChange("read")).toEqual({ method: "PATCH", body: { isRead: true } });
    expect(outlookChange("unread")).toEqual({ method: "PATCH", body: { isRead: false } });
    expect(outlookChange("archive")).toEqual({ method: "POST", move: "archive" });
  });

  it("keeps a name off a header line and reads any other provider as Gmail", () => {
    expect(headerAddress({ emailAddress: { name: 'Jo "The" <Boss>\r\nBcc: x@y.z', address: "jo@example.com" } })).toBe(
      '"Jo The Boss Bcc: x@y.z" <jo@example.com>',
    );
    expect(cleanMailProvider("outlook")).toBe("outlook");
    expect(cleanMailProvider("yahoo")).toBe("google");
    expect(isInlinePicture({ isInline: true, contentType: "image/png", size: 10 })).toBe(true);
    expect(isInlinePicture({ isInline: true, contentType: "image/png", size: 9_000_000 })).toBe(false);
    expect(outlookWebLink(OUTLOOK_ID)).toContain(encodeURIComponent(OUTLOOK_ID));
  });
});
