/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): RENUABL
 * support tickets (design-support.ts). A business raises one, staff answer, the business sees it as unread until
 * opened, a reply puts it back with RENUABL, and one business never sees or touches another's.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";

const url = process.env.TEST_DATABASE_URL;
const A = "owner@alpha-support.test";
const B = "owner@beta-support.test";

describe.skipIf(!url)("RENUABL support tickets (database)", () => {
  let db: typeof import("./db");
  let support: typeof import("./design-support");
  let a: string;
  let b: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    support = await import("./design-support");
    await db.query(`delete from businesses where created_by = any($1)`, [[A, B]]);
    a = (await repo.createBusiness(A, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(B, "Beta Solar", BUSINESS_TERMS_VERSION)).businessId;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where created_by = any($1)`, [[A, B]]);
  });

  it("goes from the business to RENUABL and back, and stays the business's own", async () => {
    const made = await support.raiseTicket(a, A, { subject: "Won't publish", area: "Proposals", urgent: true, text: "It says no." });
    if (made === "full") throw new Error("full");
    expect(made.ref).toMatch(/^RS-/);
    expect(await support.listTickets(b)).toEqual([]);
    expect(await support.unreadTickets(a)).toBe(0);

    const staff = await support.staffTickets();
    expect(staff.find((t) => t.id === made.id)).toMatchObject({ business: "Alpha Solar", state: "open", urgent: true });

    expect(await support.staffReply(made.id, "staff@renuabl.test", "Add a cost to the inverter.", false)).not.toBeNull();
    expect(await support.unreadTickets(a)).toBe(1);
    const [t] = await support.listTickets(a);
    expect(t).toMatchObject({ state: "waiting", unread: true });
    // The business never sees who at RENUABL wrote.
    expect(t.messages.map((m) => [m.side, m.by])).toEqual([
      ["business", A],
      ["renuabl", ""],
    ]);

    await support.markTicketSeen(a, made.id);
    expect(await support.unreadTickets(a)).toBe(0);

    // Another business can't write on it, resolve it or read it.
    expect(await support.replyToTicket(b, made.id, B, "Hello")).toBe(false);
    expect(await support.setTicketResolved(b, made.id, true)).toBe(false);

    expect(await support.staffSetResolved(made.id, true)).toBe(true);
    expect((await support.listTickets(a))[0].state).toBe("resolved");
    // Writing again opens it.
    expect(await support.replyToTicket(a, made.id, A, "Still not right.")).toBe(true);
    const again = (await support.listTickets(a))[0];
    expect(again.state).toBe("open");
    expect(again.messages).toHaveLength(3);
    expect(await support.staffReply("st_nothere", "staff@renuabl.test", "x", false)).toBeNull();
  });

  it("keeps a message's pictures for its own business and staff only", async () => {
    const pic = { bytes: Buffer.from([1, 2, 3, 4]), contentType: "image/jpeg" };
    const made = await support.raiseTicket(a, A, { subject: "Looks wrong", area: "Design tool", urgent: false, text: "See this." }, [
      pic,
      pic,
    ]);
    if (made === "full") throw new Error("full");
    const ticket = (await support.listTickets(a)).find((t) => t.id === made.id)!;
    expect(ticket.messages[0].pictures).toHaveLength(2);
    const id = ticket.messages[0].pictures[0];
    expect(id).toMatch(/^sp_[0-9a-f]{20}$/);
    const mine = await support.ticketPicture(a, id);
    expect(mine?.contentType).toBe("image/jpeg");
    expect([...mine!.bytes]).toEqual([1, 2, 3, 4]);
    // Another business can't open it; staff can.
    expect(await support.ticketPicture(b, id)).toBeNull();
    expect((await support.staffTicketPicture(id))?.contentType).toBe("image/jpeg");
    // A reply carries its own, and one with none has none.
    expect(await support.replyToTicket(a, made.id, A, "And this.", [pic])).toBe(true);
    const after = (await support.listTickets(a)).find((t) => t.id === made.id)!;
    expect(after.messages.map((m) => m.pictures.length)).toEqual([2, 1]);
    expect((await support.staffTickets()).find((t) => t.id === made.id)!.messages[1].pictures).toHaveLength(1);
  });
});
