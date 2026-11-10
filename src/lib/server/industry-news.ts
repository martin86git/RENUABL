/**
 * Server only. Industry news (domain/design/industry-news.ts): each morning Sol searches the web for the Australian
 * solar, battery and EV charger news and writes the stories up; they are kept once for the whole platform in
 * `industry_news` (public news, no business's data) and every business reads the same feed. A reading runs from the
 * morning cron (/api/cron/news) and, when one is due, after a member opens the News tab. One reading at a time, claimed
 * under a lock. RENUABL pays for it: no Sol credit; its cost is kept on `industry_news_runs`.
 */
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { sniffImage } from "@/lib/domain/design/brand";
import { safeFetch } from "./safe-fetch";
import { addUsage, costUsd, noUsage, toMicros, usageOf } from "@/lib/domain/ai-costs";
import {
  NEWS_DAYS,
  NEWS_SHOWN,
  NEWS_STANDINGS,
  NEWS_TOPICS,
  PAGE_READ_BYTES,
  PICTURE_BYTES,
  pageImageUrl,
  type NewsStanding,
  cleanNewsItems,
  newsDue,
  newsPrompt,
  readNewsJson,
  type NewsItem,
  type NewsTopic,
} from "@/lib/domain/design/industry-news";
import { BLOCKED_SITES, SEARCH_FROM, hostOf, urlKey } from "@/lib/domain/design/sol-knowledge";
import { todayInMarket } from "@/lib/domain/market";
import { newId, query, transaction } from "./db";

const MODEL = () => process.env.NEWS_MODEL?.trim() || "claude-sonnet-5-5";

const TOOLS: Anthropic.ToolUnion[] = [
  // 10 Nov 2026, Martin: more stories, products every day: a few more searches than the first ten.
  { type: "web_search_20260209", name: "web_search", max_uses: 14, blocked_domains: [...BLOCKED_SITES], user_location: SEARCH_FROM },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5, blocked_domains: [...BLOCKED_SITES], max_content_tokens: 12_000 },
];

const moment = (column: string) => `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

interface Row {
  id: string;
  topic: string;
  headline: string;
  summary: string;
  meaning: string;
  url: string;
  site: string;
  publishedOn: string | null;
  brands: unknown;
  standing: string | null;
  standingNote: string;
  hasImage: boolean;
  foundAt: string;
}

const itemOf = (r: Row): NewsItem => ({
  id: r.id,
  topic: (NEWS_TOPICS.includes(r.topic as NewsTopic) ? r.topic : "technology") as NewsTopic,
  headline: r.headline,
  summary: r.summary,
  meaning: r.meaning,
  url: r.url,
  site: r.site,
  publishedOn: r.publishedOn,
  brands: Array.isArray(r.brands) ? r.brands.filter((b): b is string => typeof b === "string") : [],
  standing: NEWS_STANDINGS.includes(r.standing as NewsStanding) ? (r.standing as NewsStanding) : null,
  standingNote: r.standingNote ?? "",
  hasImage: Boolean(r.hasImage),
  foundAt: r.foundAt,
});

export interface NewsFeed {
  items: NewsItem[];
  /** When the last good reading finished. */
  readAt: string | null;
  /** A reading is under way now. */
  reading: boolean;
  /** Claude is set up, so Sol can read the news. */
  configured: boolean;
  /** The last reading failed (it is tried again after `NEWS_RETRY_HOURS`); why stays in the server's log. */
  missed: boolean;
}

const configured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

interface RunRow {
  startedAt: string;
  finishedAt: string | null;
  ok: boolean | null;
}

const lastRun = (q: typeof query = query) =>
  q<RunRow>(
    `select ${moment("started_at")} as "startedAt", ${moment("finished_at")} as "finishedAt", ok
       from industry_news_runs order by started_at desc limit 1`,
  ).then((r) => r[0] ?? null);

/** The feed, newest first, with how the reading stands. */
export async function newsFeed(): Promise<NewsFeed> {
  const [rows, last, good] = await Promise.all([
    query<Row>(
      `select id, topic, headline, summary, meaning, url, site, to_char(published_on, 'YYYY-MM-DD') as "publishedOn", brands,
              standing, standing_note as "standingNote", image is not null as "hasImage",
              ${moment("found_at")} as "foundAt"
         from industry_news
        where coalesce(published_on, found_at::date) > now() - make_interval(days => $1)
        order by coalesce(published_on, found_at::date) desc, found_at desc limit $2`,
      [NEWS_DAYS * 2, NEWS_SHOWN],
    ),
    lastRun(),
    query<{ at: string }>(`select ${moment("finished_at")} as at from industry_news_runs where ok order by started_at desc limit 1`),
  ]);
  return {
    items: rows.map(itemOf),
    readAt: good[0]?.at ?? null,
    reading: Boolean(last && last.ok === null && !newsDue(last, new Date())),
    configured: configured(),
    missed: last?.ok === false,
  };
}

/** Whether a reading is due now (so the tab can start one after answering). */
export async function newsReadingDue(): Promise<boolean> {
  return configured() && newsDue(await lastRun(), new Date());
}

/** Claims the next reading under a lock: its id, or null when one isn't due (or another has it). */
async function claimRun(force: boolean): Promise<string | null> {
  return transaction(async (q) => {
    await q(`select pg_advisory_xact_lock(hashtext('industry_news'))`);
    const last = await lastRun(q as typeof query);
    if (!force && !newsDue(last, new Date())) return null;
    if (last && last.ok === null && !newsDue(last, new Date())) return null;
    const id = newId("news", 8);
    await q(`insert into industry_news_runs (id) values ($1)`, [id]);
    return id;
  });
}

/** How many stories' pictures are looked for at once, and at most in one go. */
const PICTURES_AT_ONCE = 4;
const PICTURES_A_GO = 24;

/**
 * A story's picture: its page's own preview picture (`pageImageUrl`), fetched with every address checked
 * (`safeFetch`), taken only when its own first bytes say JPEG, PNG or WebP (never SVG), then drawn again small as a
 * JPEG so nothing but the picture is kept. Null when there is none to be had.
 */
async function pictureFor(pageUrl: string): Promise<Buffer | null> {
  const page = await safeFetch(pageUrl, PAGE_READ_BYTES, "page");
  if (!page) return null;
  const imageUrl = pageImageUrl(page.bytes.toString("utf8"), pageUrl);
  if (!imageUrl) return null;
  const pic = await safeFetch(imageUrl, PICTURE_BYTES, "picture");
  if (!pic || !sniffImage(pic.bytes)) return null;
  try {
    return await sharp(pic.bytes, { limitInputPixels: 40_000_000, animated: false })
      .rotate()
      .resize({ width: 720, height: 405, fit: "cover", position: "attention", withoutEnlargement: false })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

/** Whether some recent story hasn't had its picture looked for yet. */
export async function picturesDue(): Promise<boolean> {
  const rows = await query(`select 1 from industry_news where not image_tried and found_at > now() - make_interval(days => $1) limit 1`, [
    NEWS_DAYS * 2,
  ]);
  return rows.length > 0;
}

const filling = globalThis as unknown as { __newsPictures?: Promise<number> };

/**
 * Looks once for the picture of every recent story not yet looked at (after each reading; new stories first). One look
 * at a time on a server: a second call while one runs waits for that one.
 */
export function fillPictures(): Promise<number> {
  filling.__newsPictures ??= lookForPictures().finally(() => {
    filling.__newsPictures = undefined;
  });
  return filling.__newsPictures;
}

async function lookForPictures(): Promise<number> {
  const todo = await query<{ id: string; url: string }>(
    `select id, url from industry_news where not image_tried and found_at > now() - make_interval(days => $1)
      order by found_at desc limit $2`,
    [NEWS_DAYS * 2, PICTURES_A_GO],
  );
  let got = 0;
  for (let i = 0; i < todo.length; i += PICTURES_AT_ONCE) {
    await Promise.all(
      todo.slice(i, i + PICTURES_AT_ONCE).map(async (s) => {
        const pic = await pictureFor(s.url).catch(() => null);
        if (pic) got++;
        await query(`update industry_news set image = $2, image_type = $3, image_tried = true where id = $1`, [
          s.id,
          pic,
          pic ? "image/jpeg" : null,
        ]);
      }),
    );
  }
  return got;
}

/** A story's kept picture, or null. */
export async function newsPicture(id: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const rows = await query<{ image: Buffer | null; type: string | null }>(
    `select image, image_type as type from industry_news where id = $1`,
    [id],
  );
  const r = rows[0];
  return r?.image && r.type ? { bytes: r.image, contentType: r.type } : null;
}

/** Every page a search result or a fetched page carried, with its title, however the web tools nest them. */
function pagesIn(blocks: readonly unknown[]): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.url === "string") out.push(o.url);
      for (const [k, x] of Object.entries(o)) if (k !== "url" && typeof x === "object") walk(x);
    }
  };
  for (const b of blocks) if (b && typeof b === "object" && /tool_result$/.test(String((b as { type?: unknown }).type))) walk(b);
  return out;
}

/**
 * A morning's reading: Sol searches, writes the stories up, and the ones that pass `cleanNewsItems` are kept. Answers
 * how many were kept, or null when no reading was due or Claude isn't set up. `force` reads even when not due (cron).
 */
export async function readTheNews(force = false): Promise<number | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  const runId = await claimRun(force);
  if (!runId) return null;
  let usage = noUsage(MODEL());
  try {
    const today = todayInMarket();
    const known = await query<{ urlKey: string; headline: string }>(
      `select url_key as "urlKey", headline from industry_news where found_at > now() - make_interval(days => $1) order by found_at desc`,
      [NEWS_DAYS * 2],
    );
    const client = new Anthropic({ apiKey, timeout: 240_000, maxRetries: 1 });
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: newsPrompt(
          today,
          known.slice(0, 40).map((k) => k.headline),
        ),
      },
    ];
    const seen: string[] = [];
    let text = "";
    // The web tools run on Anthropic's side; a long search may pause and is carried on (a few times at most).
    for (let turn = 0; turn < 5; turn++) {
      const m = await client.messages.create({ model: MODEL(), max_tokens: 12_000, tools: TOOLS, messages });
      usage = addUsage(usage, usageOf(m.model, m.usage));
      seen.push(...pagesIn(m.content));
      text = m.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
      if (m.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: m.content });
    }
    const raw = readNewsJson(text);
    // What Sol sent and what was left out, with each page he linked that his search never showed (no story or URL text
    // beyond the address is logged).
    if (Array.isArray(raw)) {
      const seenKeys = new Set(seen.map(urlKey));
      const unseen = raw
        .map((r) => (r && typeof r === "object" ? String((r as { url?: unknown }).url ?? "") : ""))
        .filter((u) => u && !seenKeys.has(urlKey(u)));
      console.info("industry news: Sol sent", raw.length, "stories; pages not in his search:", unseen);
    } else console.info("industry news: no list of stories in Sol's answer");
    const stories = cleanNewsItems(
      raw,
      seen,
      known.map((k) => k.urlKey),
      today,
    );
    let kept = 0;
    for (const s of stories) {
      const rows = await query(
        `insert into industry_news (id, url_key, url, site, topic, headline, summary, meaning, brands, published_on, standing, standing_note)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
         on conflict (url_key) do nothing returning id`,
        [
          newId("story", 8),
          urlKey(s.url),
          s.url,
          hostOf(s.url),
          s.topic,
          s.headline,
          s.summary,
          s.meaning,
          JSON.stringify(s.brands),
          s.publishedOn,
          s.standing,
          s.standingNote,
        ],
      );
      kept += rows.length;
    }
    await query(`update industry_news_runs set finished_at = now(), ok = true, found = $2, cost_micros = $3 where id = $1`, [
      runId,
      kept,
      toMicros(costUsd(usage)),
    ]);
    await fillPictures().catch((e) => console.error("news pictures", e instanceof Error ? e.message : e));
    return kept;
  } catch (e) {
    const why = e instanceof Error ? e.message.slice(0, 300) : "failed";
    console.error("industry news not read", why);
    await query(`update industry_news_runs set finished_at = now(), ok = false, error = $2, cost_micros = $3 where id = $1`, [
      runId,
      why,
      toMicros(costUsd(usage)),
    ]).catch(() => undefined);
    return 0;
  }
}
