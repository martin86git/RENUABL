/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the team
 * chat. That a channel is the whole business's and a direct conversation only its two members'; that someone from
 * another business can't open, write in or read the files of either; that only a writer changes or deletes their line;
 * that reactions toggle; that unread counts others' lines until the room is seen; and that a deal card is hidden from a
 * member who can't see that deal.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { cleanCustomerInput, cleanJobInput } from "@/lib/domain/design/crm";
import { dmRoom } from "@/lib/domain/design/team-chat";

const url = process.env.TEST_DATABASE_URL;
const OWNER = "owner@alpha-chat.test";
const SAM = "sam@alpha-chat.test";
const OTHER = "owner@beta-chat.test";

describe.skipIf(!url)("the team chat (database)", () => {
  let db: typeof import("./db");
  let team: typeof import("./design-team-repo");
  let a: string;
  let b: string;
  let dealId: string;
  const owner = () => ({ businessId: a, email: OWNER, viewer: { email: OWNER, all: true } });
  const sam = () => ({ businessId: a, email: SAM, viewer: { email: SAM, all: false } });
  const outsider = () => ({ businessId: b, email: OTHER, viewer: { email: OTHER, all: true } });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    const crm = await import("./design-crm-repo");
    team = await import("./design-team-repo");
    await db.query(`delete from businesses where created_by in ($1,$2)`, [OWNER, OTHER]);
    a = (await repo.createBusiness(OWNER, "Alpha Solar", BUSINESS_TERMS_VERSION)).businessId;
    b = (await repo.createBusiness(OTHER, "Beta Electrical", BUSINESS_TERMS_VERSION)).businessId;
    expect(await repo.addMember(a, SAM, OWNER)).toBe("added");
    expect(await repo.setPermissions(a, SAM, { ...ALL_PERMISSIONS, allDeals: false })).toBe(true);
    const customer = cleanCustomerInput({ name: "Casey Owned", address: "1 Sample Street, Exampleton VIC 3000" });
    const job = cleanJobInput({ address: "1 Sample Street, Exampleton VIC 3000" });
    if (!customer.ok || !job.ok) throw new Error("unexpected");
    const made = await crm.createCustomer(a, customer.value, job.value, OWNER);
    if (made === "full" || !made.job) throw new Error("unexpected");
    dealId = made.job.id;
  });
  afterAll(async () => {
    await db.query(`delete from businesses where created_by in ($1,$2)`, [OWNER, OTHER]);
  });

  it("shares a channel with the whole business, a deal card only with those who see the deal", async () => {
    await team.sayInTeam(owner(), "deals", { text: "Who has Casey?", files: [], dealIds: [dealId] });
    const mine = await team.teamRoom(owner(), "deals");
    expect(mine.lines.at(-1)?.deals?.[0]?.id).toBe(dealId);
    const theirs = await team.teamRoom(sam(), "deals");
    expect(theirs.lines.at(-1)?.text).toBe("Who has Casey?");
    expect(theirs.lines.at(-1)?.deals).toBeUndefined();
    expect(await team.teamUnread(sam())).toBe(1);
    await team.markTeamSeen(sam(), "deals");
    expect(await team.teamUnread(sam())).toBe(0);
  });

  it("keeps a direct conversation to its two members, and another business out", async () => {
    const room = dmRoom(OWNER, SAM);
    await team.sayInTeam(sam(), room, { text: "Just us", files: [], dealIds: [] });
    expect((await team.teamRoom(owner(), room)).lines.map((l) => l.text)).toEqual(["Just us"]);
    await expect(team.teamRoom(outsider(), room)).rejects.toThrow();
    await expect(team.sayInTeam(owner(), dmRoom(OWNER, OTHER), { text: "hi", files: [], dealIds: [] })).rejects.toThrow();
    expect((await team.teamRoom(outsider(), "deals")).lines).toEqual([]);
  });

  it("lets only the writer change or delete a line; anyone toggles a reaction", async () => {
    const line = await team.sayInTeam(owner(), "service", { text: "First", files: [], dealIds: [] });
    await expect(team.editTeamLine(sam(), line.id, "Hijacked")).rejects.toThrow();
    await team.editTeamLine(owner(), line.id, "First, changed");
    await team.reactToTeamLine(sam(), line.id, "👍");
    let got = (await team.teamRoom(owner(), "service")).lines.find((l) => l.id === line.id);
    expect(got?.text).toBe("First, changed");
    expect(got?.edited).toBeTruthy();
    expect(got?.reactions).toEqual({ "👍": [SAM] });
    await team.reactToTeamLine(sam(), line.id, "👍");
    got = (await team.teamRoom(owner(), "service")).lines.find((l) => l.id === line.id);
    expect(got?.reactions).toBeUndefined();
    await expect(team.deleteTeamLine(sam(), line.id)).rejects.toThrow();
    await expect(team.reactToTeamLine(outsider(), line.id, "👍")).rejects.toThrow();
    await team.deleteTeamLine(owner(), line.id);
    expect((await team.teamRoom(owner(), "service")).lines.some((l) => l.id === line.id)).toBe(false);
  });

  it("serves a file only to someone who may read its room", async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], "board.png", { type: "image/png" });
    const line = await team.sayInTeam(sam(), dmRoom(OWNER, SAM), { text: "", files: [file], dealIds: [] });
    const id = line.files?.[0]?.id ?? "";
    expect((await team.teamFile(owner(), id))?.name).toBe("board.png");
    expect(await team.teamFile(outsider(), id)).toBeNull();
    await expect(
      team.sayInTeam(owner(), "deals", {
        text: "",
        files: [new File(["x"], "run.exe", { type: "application/x-msdownload" })],
        dealIds: [],
      }),
    ).rejects.toThrow();
  });
});
