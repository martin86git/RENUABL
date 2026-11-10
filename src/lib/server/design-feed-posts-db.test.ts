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
});
