/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): the feed as
 * the industry's network (feed-social.ts). That a like, comment and vote tell the writer (adding up while unread), that
 * other commenters hear of a reply, that a business's page shows its posts and asks it to connect though not listed,
 * that follows are a member's own, and that Sol's weekly poll and its results are posted once a week.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { solPollFor, weekOf } from "@/lib/domain/design/feed-social";

const url = process.env.TEST_DATABASE_URL;
const EMAILS = ["owner@alpha-social.test", "owner@beta-social.test", "owner@gamma-social.test"];

describe.skipIf(!url)("the feed as a network (database)", () => {
  let db: typeof import("./db");
  let posts: typeof import("./design-feed-posts-repo");
  let social: typeof import("./design-feed-social-repo");
  let members: import("./design-repo").Member[];
  let postId: string;
  const reader = (i: number) => posts.readerOf(members[i], false);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    posts = await import("./design-feed-posts-repo");
    social = await import("./design-feed-social-repo");
    await db.query(`delete from businesses where created_by = any($1::text[])`, [EMAILS]);
    await db.query(`delete from design_feed_posts where member_email = 'sol@renuabl'`);
    members = [];
    for (const [i, email] of EMAILS.entries())
      members.push(await repo.createBusiness(email, ["Alpha Solar", "Beta Installs", "Gamma Solar"][i], BUSINESS_TERMS_VERSION));
    postId = await posts.createPost(members[0], "Which inverter is quietest?", null, null, ["Sungrow", "Fronius"], { kind: "question" });
  });

  afterAll(async () => {
    await db?.query(`delete from businesses where created_by = any($1::text[])`, [EMAILS]);
    await db?.query(`delete from design_feed_posts where member_email = 'sol@renuabl'`);
  });

  it("tells the writer of likes, comments and votes, adding up while unread", async () => {
    await posts.setLike(postId, reader(1), true, "Beta Installs");
    await posts.setLike(postId, reader(2), true, "Gamma Solar");
    await posts.votePoll(postId, reader(1), 0, "Beta Installs");
    await posts.addComment(postId, members[1], reader(1), "Fronius for us");
    const notes = await social.feedNotes(EMAILS[0]);
    const like = notes.find((n) => n.kind === "like")!;
    expect(like.count).toBe(2);
    expect(like.by).toBe("Gamma Solar");
    expect(notes.some((n) => n.kind === "vote")).toBe(true);
    expect(notes.some((n) => n.kind === "comment")).toBe(true);
    expect(await social.unreadFeedNotes(EMAILS[0])).toBe(3);
    // Nobody is told of their own doing.
    await posts.setLike(postId, reader(0), true, "Alpha Solar");
    expect(await social.unreadFeedNotes(EMAILS[0])).toBe(3);
  });

  it("tells earlier commenters of a reply", async () => {
    await posts.addComment(postId, members[2], reader(2), "Sungrow here");
    expect((await social.feedNotes(EMAILS[1])).some((n) => n.kind === "reply")).toBe(true);
  });

  it("lets only the asker mark a question answered", async () => {
    expect(await posts.markAnswered(postId, reader(1), true)).toBe(false);
    expect(await posts.markAnswered(postId, reader(0), true)).toBe(true);
    const p = (await posts.listPosts(reader(1))).find((x) => x.id === postId)!;
    expect(p.answered).toBe(true);
    expect(p.postKind).toBe("question");
  });

  it("opens a business's page by its key, and it can be asked to connect from there", async () => {
    const p = (await posts.listPosts(reader(1))).find((x) => x.id === postId)!;
    expect(p.businessKey).toMatch(/^[a-f0-9]{24}$/);
    const page = await social.feedBusiness(reader(1), p.businessKey!);
    expect(page?.name).toBe("Alpha Solar");
    expect(page?.listed).toBe(false);
    expect(page?.suburb).toBe("");
    expect(page?.posts.some((x) => x.id === postId)).toBe(true);
    const { askToConnect } = await import("./design-connections-repo");
    expect((await askToConnect(members[1], p.businessKey!)).ok).toBe(false);
    expect((await askToConnect(members[1], p.businessKey!, { fromFeed: true })).ok).toBe(true);
    expect((await social.feedBusiness(reader(1), p.businessKey!))?.standing).toBe("requested");
  });

  it("keeps each member's follows their own", async () => {
    const key = (await posts.listPosts(reader(1))).find((x) => x.id === postId)!.businessKey!;
    expect(await social.setFollow(members[1], { kind: "business", key }, true)).toBeNull();
    expect(await social.setFollow(members[1], { kind: "word", word: "Tesla" }, true)).toBeNull();
    expect(await social.setFollow(members[1], { kind: "mute", topic: "business" }, true)).toBeNull();
    expect(await social.setFollow(members[0], { kind: "business", key }, true)).toBe("That's your own business.");
    const f = await social.followsOf(EMAILS[1]);
    expect(f.businesses).toEqual([{ key, name: "Alpha Solar" }]);
    expect(f.words).toEqual(["tesla"]);
    expect(f.muted).toEqual(["business"]);
    expect((await social.followsOf(EMAILS[2])).words).toEqual([]);
  });

  it("posts Sol's poll once a week, and its results only when enough voted", async () => {
    const monday = new Date("2026-11-16T21:00:00Z");
    expect(await social.postSolPoll(monday)).toBe(true);
    expect(await social.postSolPoll(monday)).toBe(false);
    const poll = (await posts.listPosts(reader(0))).find((x) => x.postKind === "sol-poll")!;
    expect(poll.sol).toBe(true);
    expect(poll.text).toBe(solPollFor(weekOf(monday)).question);
    expect(poll.businessKey).toBeNull();
    const next = new Date("2026-11-23T21:00:00Z");
    expect(await social.postSolResults(next)).toBe(false);
    for (const i of [0, 1, 2])
      await db.query(`insert into design_feed_votes (post_id, business_id, member_email, choice) values ($1,$2,$3,0)`, [
        poll.id,
        members[i].businessId,
        `v${i}@social.test`,
      ]);
    for (const i of [3, 4])
      await db.query(`insert into design_feed_votes (post_id, business_id, member_email, choice) values ($1,$2,$3,1)`, [
        poll.id,
        members[0].businessId,
        `v${i}@social.test`,
      ]);
    expect(await social.postSolResults(next)).toBe(true);
    expect(await social.postSolResults(next)).toBe(false);
    const results = (await posts.listPosts(reader(0))).find((x) => x.postKind === "sol-results")!;
    expect(results.results?.total).toBe(5);
    expect(results.text).toContain("60%");
  });
});
