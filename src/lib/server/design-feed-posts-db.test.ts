/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (skipped otherwise; `npm run test:db` sets it): posts in
 * the industry feed. That every business sees a post, by first name and business, never an email; that only its writer,
 * their owner or staff remove it; that a business can't report its own post and reports once; and that reports from
 * `REPORT_HIDE` businesses hide it from everyone but its writer and staff, until staff keep it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUSINESS_TERMS_VERSION } from "@/lib/domain/design/account";
import { REPORT_HIDE } from "@/lib/domain/design/feed-posts";

const url = process.env.TEST_DATABASE_URL;
const EMAILS = ["owner@alpha-feed.test", "owner@beta-feed.test", "owner@gamma-feed.test", "owner@delta-feed.test"];

describe.skipIf(!url)("posts in the industry feed (database)", () => {
  let db: typeof import("./db");
  let posts: typeof import("./design-feed-posts-repo");
  let members: import("./design-repo").Member[];
  let postId: string;
  const reader = (i: number, staff = false) => posts.readerOf(members[i], staff);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("./db");
    await db.resetDbForTests();
    const repo = await import("./design-repo");
    posts = await import("./design-feed-posts-repo");
    await db.query(`delete from businesses where created_by = any($1::text[])`, [EMAILS]);
    members = [];
    for (const [i, email] of EMAILS.entries())
      members.push(
        await repo.createBusiness(email, ["Alpha Solar", "Beta Installs", "Gamma Solar", "Delta Electrical"][i], BUSINESS_TERMS_VERSION),
      );
    postId = await posts.createPost(members[0], "Anyone tried the new firmware?", null, null);
  });

  afterAll(async () => {
    await db?.query(`delete from businesses where created_by = any($1::text[])`, [EMAILS]);
  });

  it("is seen by every business, by business name, never an email", async () => {
    const seen = await posts.listPosts(reader(1));
    const p = seen.find((x) => x.id === postId)!;
    expect(p.author).toBe("Alpha Solar");
    expect(JSON.stringify(p)).not.toMatch(/alpha-feed\.test/);
    expect(p.mine).toBe(false);
    expect((await posts.listPosts(reader(0))).find((x) => x.id === postId)!.mine).toBe(true);
  });

  it("is removed only by its writer, its owner or staff", async () => {
    expect(await posts.removePost(postId, reader(1))).toBe(false);
  });

  it("takes likes and comments from any business", async () => {
    expect(await posts.setLike(postId, reader(1), true)).toBe(true);
    expect(await posts.addComment(postId, members[2], reader(2), "Yes, fine here")).toBe(true);
    const p = (await posts.listPosts(reader(1))).find((x) => x.id === postId)!;
    expect(p.likes).toBe(1);
    expect(p.liked).toBe(true);
    expect(p.comments).toBe(1);
  });

  it("can't be reported by its own business, and once by each other", async () => {
    expect(await posts.reportPost(postId, reader(0), "")).toBeNull();
    expect((await posts.reportPost(postId, reader(1), "spam"))?.first).toBe(true);
    expect((await posts.reportPost(postId, reader(1), "again"))?.hidden).toBe(false);
  });

  it(`is hidden at ${REPORT_HIDE} businesses' reports, but not from its writer or staff`, async () => {
    await posts.reportPost(postId, reader(2), "");
    const third = await posts.reportPost(postId, reader(3), "");
    expect(third?.hidden).toBe(true);
    expect((await posts.listPosts(reader(1))).some((x) => x.id === postId)).toBe(false);
    expect((await posts.listPosts(reader(0))).find((x) => x.id === postId)?.hidden).toBe(true);
    expect((await posts.listPosts(reader(1, true), true)).find((x) => x.id === postId)?.reports).toBe(3);
  });

  it("shows again once staff keep it, and goes when staff remove it", async () => {
    await posts.keepPost(postId);
    expect((await posts.listPosts(reader(1))).some((x) => x.id === postId)).toBe(true);
    expect(await posts.removePost(postId, reader(1, true))).toBe(true);
    expect((await posts.listPosts(reader(0))).some((x) => x.id === postId)).toBe(false);
  });

  it("takes one vote a member in a poll, shown once voted", async () => {
    const id = await posts.createPost(members[0], "Which battery are you installing most?", null, null, ["Sigenergy", "Tesla"]);
    let p = (await posts.listPosts(reader(1))).find((x) => x.id === id)!;
    expect(p.poll?.choices).toEqual(["Sigenergy", "Tesla"]);
    expect(p.poll?.votes).toBeNull();
    expect(await posts.votePoll(id, reader(1), 1)).toBe(true);
    expect(await posts.votePoll(id, reader(1), 0)).toBe(true);
    expect(await posts.votePoll(id, reader(2), 0)).toBe(true);
    expect(await posts.votePoll(id, reader(2), 5)).toBe(false);
    p = (await posts.listPosts(reader(1))).find((x) => x.id === id)!;
    expect(p.poll?.votes).toEqual([2, 0]);
    expect(p.poll?.mine).toBe(0);
    expect((await posts.listPosts(reader(3))).find((x) => x.id === id)!.poll?.votes).toBeNull();
    expect((await posts.listPosts(reader(0))).find((x) => x.id === id)!.poll?.total).toBe(2);
  });

  it("takes likes and comments on Sol's stories", async () => {
    const talk = await import("./design-story-talk-repo");
    const storyId = "story_00000000000000aa";
    await db.query(`delete from industry_news where id = $1`, [storyId]);
    await db.query(`insert into industry_news (id, url_key, url, site, topic, headline, summary) values ($1, $2, $3, $4, $5, $6, $7)`, [
      storyId,
      "news.example.com/talk-test",
      "https://news.example.com/talk-test",
      "news.example.com",
      "ev",
      "A test story",
      "Words.",
    ]);
    expect(await talk.setStoryLike(storyId, reader(1), true)).toBe(true);
    expect(await talk.addStoryComment(storyId, members[2], reader(2), "Interesting")).toBe(true);
    const seen = (await talk.storyTalk([storyId], reader(1))).get(storyId)!;
    expect(seen).toEqual({ likes: 1, liked: true, comments: 1 });
    const [c] = (await talk.listStoryComments(storyId, reader(1)))!;
    expect(c.author).toBe("Gamma Solar");
    expect(c.mine).toBe(false);
    expect(await talk.removeStoryComment(storyId, c.id, reader(1))).toBe(false);
    expect(await talk.removeStoryComment(storyId, c.id, reader(2))).toBe(true);
    expect(await talk.setStoryLike("story_00000000000000ff", reader(1), true)).toBe(false);
    await db.query(`delete from industry_news where id = $1`, [storyId]);
  });
});
