/** Posts in the industry feed (domain/design/feed-posts.ts), as the screens reach them. */
import type { FeedComment, FeedPost } from "@/lib/domain/design/feed-posts";
import type { FeedBusiness, FeedNote, Follows, PostKind } from "@/lib/domain/design/feed-social";
import { prepareBillFile } from "./consumer";
import { ask } from "./crm";

export const loadPosts = (reported = false) =>
  ask<{ posts: FeedPost[]; staff: boolean }>(`/api/design/posts${reported ? "?reported=1" : ""}`);

/** Posts words, a link and a photo (shrunk in the browser first so it travels quickly). */
export async function sendPost(input: {
  text: string;
  link: string;
  photo: File | null;
  poll?: string[] | null;
  /** A question to the industry, or a win shared from an installed job (17 Nov 2026). */
  kind?: PostKind;
  job?: string | null;
}) {
  const form = new FormData();
  form.set("text", input.text);
  if (input.kind) form.set("kind", input.kind);
  if (input.job) form.set("job", input.job);
  form.set("link", input.link);
  if (input.poll) form.set("poll", JSON.stringify(input.poll));
  if (input.photo) form.set("photo", await prepareBillFile(input.photo, 2_000_000));
  return ask<{ id: string }>("/api/design/posts", { method: "POST", body: form });
}

const act = (id: string, body: Record<string, unknown>) =>
  ask<{ hidden?: boolean }>(`/api/design/posts/${encodeURIComponent(id)}`, { method: "POST", body });

export const likePost = (id: string, like: boolean) => act(id, { do: like ? "like" : "unlike" });
export const commentOn = (id: string, text: string) => act(id, { do: "comment", text });
export const votePoll = (id: string, choice: number) => act(id, { do: "vote", choice });
export const removeComment = (id: string, comment: string) => act(id, { do: "uncomment", comment });
export const reportPost = (id: string, reason: string) => act(id, { do: "report", reason });
export const removePost = (id: string) => act(id, { do: "remove" });
export const markAnswered = (id: string, answered: boolean) => act(id, { do: answered ? "answered" : "unanswered" });
export const keepPost = (id: string) => act(id, { do: "keep" });
export const loadComments = (id: string) => ask<{ comments: FeedComment[] }>(`/api/design/posts/${encodeURIComponent(id)}`);

export const postPictureUrl = (id: string, which: "photo" | "link") => `/api/design/posts/${encodeURIComponent(id)}/picture?which=${which}`;

/** Likes and comments on one of Sol's stories. */
const actStory = (id: string, body: Record<string, unknown>) =>
  ask<object>(`/api/design/news/${encodeURIComponent(id)}`, { method: "POST", body });
export const likeStory = (id: string, like: boolean) => actStory(id, { do: like ? "like" : "unlike" });
export const commentOnStory = (id: string, text: string) => actStory(id, { do: "comment", text });
export const removeStoryComment = (id: string, comment: string) => actStory(id, { do: "uncomment", comment });
export const loadStoryComments = (id: string) => ask<{ comments: FeedComment[] }>(`/api/design/news/${encodeURIComponent(id)}`);

/** A business's page in the feed, by its directory key. */
export const loadFeedBusiness = (key: string) => ask<{ business: FeedBusiness }>(`/api/design/posts/by/${encodeURIComponent(key)}`);
/** Asks a business to connect, from its page in the feed. */
export const connectFromFeed = (key: string) =>
  ask<object>("/api/design/connections", { method: "POST", body: { do: "ask", key, fromFeed: true } });

/** The member's feed notifications. */
export const loadFeedNotes = () => ask<{ notes: FeedNote[]; unread: number }>("/api/design/posts/notes");
export const readFeedNotes = (which: { ids?: string[]; all?: boolean }) =>
  ask<object>("/api/design/posts/notes", { method: "PUT", body: which });

/** What the member follows and mutes. */
export const loadFollows = () => ask<{ follows: Follows }>("/api/design/posts/follows");
export const setFollow = (body: Record<string, unknown>) =>
  ask<{ follows: Follows }>("/api/design/posts/follows", { method: "POST", body });

/** Installed jobs the business may share as a win. */
export const loadWinnable = () => ask<{ jobs: { jobId: string; label: string }[] }>("/api/design/posts/wins");
