import { describe, expect, it } from "vitest";
import {
  cleanTicket,
  cleanTicketWords,
  staffOrder,
  staffTicketNote,
  stateAfter,
  supportReplyEmail,
  ticketOrder,
  ticketRef,
  SUPPORT_LIMITS,
} from "./support";

describe("a support ticket as sent", () => {
  it("needs a title and what happened", () => {
    expect(cleanTicket({ subject: " ", text: "x" })).toMatchObject({ ok: false });
    expect(cleanTicket({ subject: "Proposal won't publish", text: "" })).toMatchObject({ ok: false });
    expect(cleanTicket(null)).toMatchObject({ ok: false });
  });

  it("keeps the title to one line, an unknown area as something else, and urgent only when ticked", () => {
    const t = cleanTicket({ subject: "Can't\npublish  it", area: "Nonsense", text: "It says\n\n\n\nno.", urgent: "yes" });
    expect(t).toEqual({ ok: true, subject: "Can't publish it", area: "Something else", urgent: false, text: "It says\n\nno." });
    expect(cleanTicket({ subject: "a", area: "Billing", text: "b", urgent: true })).toMatchObject({ area: "Billing", urgent: true });
  });

  it("cuts long words to the limit", () => {
    expect(cleanTicketWords("x".repeat(SUPPORT_LIMITS.text + 50))).toHaveLength(SUPPORT_LIMITS.text);
  });
});

describe("a ticket's reference", () => {
  it("is RS- and six characters that can't be misread", () => {
    const ref = ticketRef(new Uint8Array([0, 1, 2, 250, 251, 252, 9]));
    expect(ref).toMatch(/^RS-[2-9A-HJKMNP-Z]{6}$/);
  });
});

describe("where a ticket stands", () => {
  it("goes to RENUABL when the business writes and to the business when RENUABL does", () => {
    expect(stateAfter("business")).toBe("open");
    expect(stateAfter("renuabl")).toBe("waiting");
  });

  it("shows a business the ones RENUABL has answered first", () => {
    const tickets = [
      { id: "a", state: "open" as const, updatedAt: "2026-11-26T03:00:00Z", unread: false },
      { id: "b", state: "waiting" as const, updatedAt: "2026-11-25T03:00:00Z", unread: true },
      { id: "c", state: "resolved" as const, updatedAt: "2026-11-26T05:00:00Z", unread: false },
    ];
    expect(ticketOrder(tickets, "open").map((t) => t.id)).toEqual(["b", "a"]);
    expect(ticketOrder(tickets, "resolved").map((t) => t.id)).toEqual(["c"]);
    expect(ticketOrder(tickets, "all")).toHaveLength(3);
  });

  it("shows staff what needs a reply first: urgent, then the longest waiting", () => {
    const tickets = [
      { id: "new", state: "open" as const, urgent: false, updatedAt: "2026-11-26T03:00:00Z" },
      { id: "old", state: "open" as const, urgent: false, updatedAt: "2026-11-24T03:00:00Z" },
      { id: "urgent", state: "open" as const, urgent: true, updatedAt: "2026-11-26T04:00:00Z" },
      { id: "done", state: "resolved" as const, urgent: true, updatedAt: "2026-11-26T06:00:00Z" },
      { id: "theirs", state: "waiting" as const, urgent: false, updatedAt: "2026-11-26T05:00:00Z" },
    ];
    expect(staffOrder(tickets).map((t) => t.id)).toEqual(["urgent", "old", "new", "theirs", "done"]);
  });
});

describe("the emails", () => {
  it("tells staff who raised it, what about, and where to answer", () => {
    const note = staffTicketNote({
      ref: "RS-ABC234",
      subject: "Proposal won't publish",
      area: "Proposals",
      urgent: true,
      business: "Sunrise Solar",
      kind: "Solar retailer",
      by: "sam@sunrise.example",
      text: "It says a line has no cost.",
      reply: false,
      site: "https://www.renuabl.com.au",
    });
    expect(note.subject).toBe("URGENT · Support RS-ABC234: Proposal won't publish");
    expect(note.text).toContain("sam@sunrise.example at Sunrise Solar (Solar retailer) raised a support ticket.");
    expect(note.text).toContain("https://www.renuabl.com.au/admin#support");
  });

  it("answers the business as RENUABL support, naming nobody", () => {
    const mail = supportReplyEmail({
      ref: "RS-ABC234",
      subject: "Proposal won't publish",
      text: "Open the quote and add a cost to the inverter line.",
      resolved: false,
      link: "https://www.renuabl.com.au/design/support?ticket=st_1",
    });
    expect(mail.subject).toBe("RENUABL support RS-ABC234: Proposal won't publish");
    expect(mail.text).toContain("Open the quote");
    expect(mail.text).toContain("/design/support?ticket=st_1");
    expect(mail.text).not.toMatch(/@/);
  });
});
