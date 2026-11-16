import { dbConfigured } from "@/lib/server/db";
import { cleanPart } from "@/lib/domain/design/industry-news";
import { readTheNews } from "@/lib/server/industry-news";

export const maxDuration = 300;

/**
 * Vercel cron (vercel.json): Sol reads the morning's industry news for every business (domain/design/industry-news.ts),
 * before the working day starts in Melbourne; `?part=wider` is the second reading, beyond solar, half an hour later. Vercel sends CRON_SECRET as a bearer token; without it set, the route
 * does nothing.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  if (!dbConfigured()) return Response.json({ ok: false, notConfigured: true });
  const part = cleanPart(new URL(request.url).searchParams.get("part"));
  const kept = await readTheNews(true, part);
  return Response.json({ ok: true, part, kept });
}
