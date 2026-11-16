/** Posts in the industry feed (domain/design/feed-posts.ts), as the screens reach them. */
import type { FeedComment, FeedPost } from "@/lib/domain/design/feed-posts";
import { prepareBillFile } from "./consumer";
import { ask } from "./crm";

export const loadPosts = (reported = false) =>
  ask<{ posts: FeedPost[]; staff: boolean }>(`/api/design/posts${reported ? "?reported=1" : ""}`);

/** Posts words, a link and a photo (shrunk in the browser first so it travels quickly). */
export async function sendPost(input: { text: string; link: string; photo: File | null; poll?: string[] | null }) {
  const form = new FormData();
  form.set("text", input.text);
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
