import { describe, expect, it } from "vitest";
import {
  CHAT_KEPT,
  keptTurns,
  withPin,
  cleanSolInput,
  cleanTurns,
  dealMention,
  dealsAtStage,
  dueFor,
  dueNow,
  dueWords,
  findDeals,
  fromLocal,
  solSystem,
  stageNamed,
  typingDeal,
  unreadOf,
  upcoming,
  whenChoices,
  withPref,
  withReminder,
  withoutPref,
  type SolJob,
  type SolReminder,
} from "./sol";

// Monday 2 November 2026, 10:00 am in Melbourne (daylight time, UTC+11).
const morning = new Date("2026-11-01T23:00:00Z");
// The same day at 6:00 pm.
const evening = new Date("2026-11-02T07:00:00Z");

const job = (id: string, extra: Partial<SolJob> = {}): SolJob => ({
  id,
  customerId: `c-${id}`,
  customerName: "Casey Nguyen",
  title: "Solar",
  address: "1 Sample Street, Glen Waverley VIC 3150",
  lat: null,
  lng: null,
  stage: "proposal",
  projectId: null,
  value: 12345,
  installDate: null,
  kw: 6.6,
  wonAt: null,
  installedAt: null,
  details: {},
  owner: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  ...extra,
});

describe("Sol's conversation", () => {
  it("keeps only well-formed turns, the latest ones", () => {
    const t = cleanTurns([
      { role: "you", text: "Hi", at: "2026-11-01T00:00:00Z" },
      {
        role: "sol",
        text: "Hello",
        at: "2026-11-01T00:00:01Z",
        drafts: [{ jobId: "j1", subject: "Hi", body: "B" }, { subject: "no deal" }],
      },
      { role: "bot", text: "x", at: "2026-11-01T00:00:00Z" },
      { role: "you", text: "No time" },
    ]);
    expect(t.map((x) => x.role)).toEqual(["you", "sol"]);
    expect(t[1].drafts).toEqual([{ jobId: "j1", customer: "", to: "", subject: "Hi", body: "B" }]);
    const many = Array.from({ length: CHAT_KEPT + 5 }, (_, i) => ({ role: "you", text: `${i}`, at: "2026-11-01T00:00:00Z" }));
    expect(cleanTurns(many)).toHaveLength(CHAT_KEPT);
  });

  it("counts Sol's lines after the conversation was last seen", () => {
    const t = cleanTurns([
      { role: "sol", text: "a", at: "2026-11-01T00:00:00Z" },
      { role: "you", text: "b", at: "2026-11-01T00:01:00Z" },
      { role: "sol", text: "c", at: "2026-11-01T00:02:00Z" },
    ]);
    expect(unreadOf(t, "2026-11-01T00:01:00Z")).toBe(1);
    expect(unreadOf(t, null)).toBe(2);
  });

  it("takes words and up to three files of the kinds he reads", () => {
    expect(cleanSolInput({ text: "  " })).toBeNull();
    const got = cleanSolInput({
      text: "Read this bill",
      files: [
        { name: "bill.pdf", type: "application/pdf", data: "QUJD" },
        { name: "x.exe", type: "application/x-msdownload", data: "QUJD" },
        { name: "bad.png", type: "image/png", data: "not base64!" },
      ],
    });
    expect(got?.files.map((f) => f.name)).toEqual(["bill.pdf"]);
    expect(cleanSolInput({ files: [{ name: "big.pdf", type: "application/pdf", data: "A".repeat(5_000_000) }] })).toBeNull();
  });

  it("finds a deal being typed after #, and writes the one picked", () => {
    expect(typingDeal("Look at #cas", 12)).toEqual({ start: 8, query: "cas" });
    expect(typingDeal("no hash here", 12)).toBeNull();
    expect(dealMention("Casey Nguyen · Solar", "j1")).toBe("#Casey Nguyen · Solar (deal j1) ");
  });
});

describe("Sol's preferences", () => {
  it("adds one once and takes it off by id", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    const one = withPref([], "Sign off as Sam", "p1", now);
    expect(withPref(one, "sign off as sam", "p2", now)).toHaveLength(1);
    expect(withoutPref(one, "p1")).toEqual([]);
    expect(() => withPref([], "  ", "p3", now)).toThrow();
  });
});

describe("Sol's reminders, in Melbourne's time", () => {
  it("offers 1 hour, 4 hours, end of day and tomorrow", () => {
    expect(whenChoices(morning)).toEqual(["1h", "4h", "eod", "tomorrow"]);
    expect(dueFor("1h", morning)?.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(dueFor("eod", morning)?.toISOString()).toBe("2026-11-02T06:00:00.000Z");
    expect(dueFor("tomorrow", morning)?.toISOString()).toBe("2026-11-02T22:00:00.000Z");
  });

  it("drops end of day once 5 pm has passed", () => {
    expect(whenChoices(evening)).toEqual(["1h", "4h", "tomorrow"]);
  });

  it("reads a time Sol writes and says times back plainly", () => {
    expect(fromLocal("2026-11-03 14:00")?.toISOString()).toBe("2026-11-03T03:00:00.000Z");
    expect(fromLocal("Thursday at 2")).toBeNull();
    expect(fromLocal("2026-11-03 25:00")).toBeNull();
    expect(dueWords("2026-11-02T03:15:00.000Z", morning)).toBe("today at 2:15 pm");
    expect(dueWords("2026-11-02T22:00:00.000Z", morning)).toBe("tomorrow at 9 am");
  });

  it("lists those to come soonest first, and is due once", () => {
    const r = (id: string, extra: Partial<SolReminder> = {}): SolReminder => ({
      id,
      what: id,
      createdAt: "2026-11-01T00:00:00Z",
      ...extra,
    });
    const all = [
      r("later", { dueAt: "2026-11-03T00:00:00Z" }),
      r("waiting"),
      r("due", { dueAt: "2026-11-01T22:00:00Z" }),
      r("said", { dueAt: "2026-11-01T22:00:00Z", firedAt: "2026-11-01T22:05:00Z" }),
    ];
    expect(upcoming(all).map((x) => x.id)).toEqual(["due", "later", "waiting"]);
    expect(dueNow(all, morning).map((x) => x.id)).toEqual(["due"]);
    expect(() =>
      withReminder(
        Array.from({ length: 60 }, (_, i) => r(`r${i}`)),
        r("one more"),
      ),
    ).toThrow();
  });
});

describe("Sol's tools", () => {
  const jobs = [job("j1"), job("j2", { customerName: "Robin Lee", stage: "lead", updatedAt: "2026-10-30T00:00:00Z" })];

  it("finds deals by name, id or phone", () => {
    expect(findDeals(jobs, "robin").map((j) => j.id)).toEqual(["j2"]);
    expect(findDeals(jobs, "j1").map((j) => j.id)).toEqual(["j1"]);
    expect(findDeals(jobs, "0423 111", (c) => (c === "c-j1" ? "0423111222" : "")).map((j) => j.id)).toEqual(["j1"]);
  });

  it("reads a stage by any part of its name, and lists the deals there", () => {
    expect(stageNamed("Proposal")).toBe("proposal");
    expect(stageNamed("nonsense")).toBeNull();
    const text = dealsAtStage(jobs, "proposal sent", "2026-11-02");
    expect(text).toContain("1 at Proposal sent");
    expect(text).toContain("unchanged 13 days");
    expect(dealsAtStage(jobs, "", "2026-11-02")).toContain("Lead: 1");
    expect(dealsAtStage(jobs, "nope", "2026-11-02")).toContain("There's no stage");
  });

  it("tells Sol who he's talking with and hides costs from those who can't see them", () => {
    const base = { business: "Sunny Co", member: "sam@sunny.example", facts: "Today is 2026-11-02.", prefs: [], now: morning };
    expect(solSystem({ ...base, costs: false })).toContain("can't see costs");
    expect(solSystem({ ...base, costs: true })).toContain("price_lookup gives supplier costs");
    expect(solSystem({ ...base, costs: true })).toContain("Jobs: Jobs, Proposals sent");
  });
});

describe("pinned messages", () => {
  it("pins and unpins a message by when it was said and by whom, and keeps pinned ones past the trim", () => {
    const turns = Array.from({ length: CHAT_KEPT + 3 }, (_, i) => ({
      role: (i % 2 ? "sol" : "you") as "you" | "sol",
      text: `${i}`,
      at: `2026-11-01T00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z`,
    }));
    const pinned = withPin(turns, turns[0].at, "you", true);
    expect(pinned[0].pinned).toBe(true);
    expect(withPin(turns, turns[0].at, "sol", true)[0].pinned).toBeUndefined();
    const kept = keptTurns(pinned);
    expect(kept).toHaveLength(CHAT_KEPT + 1);
    expect(kept[0].text).toBe("0");
    expect(withPin(pinned, turns[0].at, "you", false)[0]).not.toHaveProperty("pinned");
    expect(cleanTurns(pinned)[0]).toMatchObject({ text: "0", pinned: true });
  });
});
