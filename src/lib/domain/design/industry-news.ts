/**
 * Industry news (10 Nov 2026, Martin, on learning SolarEdge had withdrawn from Australia: "a news feed that keeps us up
 * to date with changes such as these, any stories relating to solar, changes to rebates, new products emerging, any new
 * capabilities"). Once a day Sol searches the web for the Australian solar, battery and EV charging news and writes each
 * story up in his own words: a headline, two or three sentences, and one line on what it means for a solar retailer or
 * installer, linked to the page it came from. The same news for every business, gathered once for the platform at
 * RENUABL's cost (no Sol credit). Shown as the News tab on Today.
 *
 * The rules that keep it honest live here: only pages his search really showed are kept (`cleanNewsItems`, by
 * `urlKey`), never a made-up link; never a page from social media or question sites; nothing older than `NEWS_DAYS`;
 * no story twice. Pure, tested.
 */
import { BLOCKED_SITES, hostOf, urlKey } from "./sol-knowledge";

export const NEWS_TOPICS = ["companies", "rebates", "rules", "networks", "products", "technology"] as const;
export type NewsTopic = (typeof NEWS_TOPICS)[number];

export const NEWS_TOPIC_LABELS: Record<NewsTopic, string> = {
  companies: "Companies",
  rebates: "Rebates",
  rules: "Rules and standards",
  networks: "Networks and the grid",
  products: "New products",
  technology: "Technology",
};

export interface NewsItem {
  id: string;
  topic: NewsTopic;
  /** Sol's own headline, never the page's copied. */
  headline: string;
  /** Two or three sentences in his words. */
  summary: string;
  /** One line on what it means for a solar retailer or installer. */
  meaning: string;
  url: string;
  site: string;
  /** The day the story was published, when the page says so. */
  publishedOn: string | null;
  /** Makers or businesses named in it ("SolarEdge"), as written. */
  brands: string[];
  /** How sure it is (`NEWS_STANDINGS`); null on stories kept before 10 Nov 2026. */
  standing: NewsStanding | null;
  /** Sol's one line on why ("Announced on the CER's own site.", "A press report; the government hasn't confirmed it."). */
  standingNote: string;
  /** When Sol found it (ISO instant). */
  foundAt: string;
  /** A picture is kept for it (the page's own preview picture, redrawn by us), served at `/api/design/news/<id>/image`. */
  hasImage?: boolean;
  /** For the business reading it: its products that name the story's makers (added by the route, never stored). */
  mine?: OnYourLists | null;
}

/**
 * How sure a story is (10 Nov 2026, Martin: say whether a claim is verified or speculative). **Confirmed**: said by the
 * body responsible (the government or regulator, the network, the company itself about itself). **Reported**: credible
 * news, not yet confirmed by that body. **Unconfirmed**: speculation, leaks, proposals, "reportedly", options being
 * considered.
 */
export const NEWS_STANDINGS = ["confirmed", "reported", "unconfirmed"] as const;
export type NewsStanding = (typeof NEWS_STANDINGS)[number];
export const NEWS_STANDING_LABELS: Record<NewsStanding, string> = {
  confirmed: "Confirmed",
  reported: "Reported",
  unconfirmed: "Unconfirmed",
};

/** Topics whose facts belong to a government body, regulator or network: confirmed only from one of their own pages. */
export const OFFICIAL_TOPICS: readonly NewsTopic[] = ["rebates", "rules", "networks"];

/**
 * Official sites beyond every .gov.au address: the market operator, standards and accreditation bodies, and every
 * Australian electricity network (10 Nov 2026: Endeavour Energy's own page read "Not found on an official page").
 */
export const OFFICIAL_SITES: readonly string[] = [
  "aemo.com.au",
  "standards.org.au",
  "solaraccreditation.com.au",
  // Victoria
  "ausnetservices.com.au",
  "citipower.com.au",
  "powercor.com.au",
  "jemena.com.au",
  "unitedenergy.com.au",
  // New South Wales and the ACT
  "ausgrid.com.au",
  "endeavourenergy.com.au",
  "essentialenergy.com.au",
  "evoenergy.com.au",
  // Queensland
  "energex.com.au",
  "ergon.com.au",
  // South Australia, Tasmania, Western Australia, the Northern Territory
  "sapowernetworks.com.au",
  "tasnetworks.com.au",
  "westernpower.com.au",
  "horizonpower.com.au",
  "powerwater.com.au",
];

/** Comparison and lead sites: never the source of a rebate, rules or network story. */
export const NOT_FOR_OFFICIAL_TOPICS: readonly string[] = [
  "finder.com.au",
  "canstar.com.au",
  "canstarblue.com.au",
  "solarquotes.com.au",
  "comparethemarket.com.au",
  "savings.com.au",
];

const onSite = (url: string, sites: readonly string[]) => {
  const host = hostOf(url).toLowerCase();
  return sites.some((s) => host === s || host.endsWith(`.${s}`));
};

/** Whether a page's address is an official source (`.gov.au`, or one of `OFFICIAL_SITES`). */
export function isOfficialSite(url: string): boolean {
  const host = hostOf(url).toLowerCase();
  return host.endsWith(".gov.au") || OFFICIAL_SITES.some((s) => host === s || host.endsWith(`.${s}`));
}

/** What the note says when a rebate, rules or network story was only found away from an official page. */
export const NOT_OFFICIAL_NOTE = "Not found on an official page yet: check with the government body or network before relying on it.";

/**
 * Sol's standing for a story, checked: unknown words read as unconfirmed, and a rebate, rules or network story he calls
 * confirmed from a page that isn't official is only reported, with `NOT_OFFICIAL_NOTE`.
 */
export function cleanStanding(
  topic: NewsTopic,
  url: string,
  standing: unknown,
  note: unknown,
): { standing: NewsStanding; standingNote: string } {
  const said = NEWS_STANDINGS.includes(standing as NewsStanding) ? (standing as NewsStanding) : "unconfirmed";
  const words = wholeSentences(note, LIMITS.note);
  if (said === "confirmed" && OFFICIAL_TOPICS.includes(topic) && !isOfficialSite(url))
    return { standing: "reported", standingNote: NOT_OFFICIAL_NOTE };
  return { standing: said, standingNote: words };
}

/** What Sol is asked to return for each story, before it is checked. */
export type NewsDraft = Omit<NewsItem, "id" | "site" | "foundAt" | "hasImage" | "mine">;

/** The most of a story's page read to find its picture, and the largest picture fetched. */
export const PAGE_READ_BYTES = 600_000;
export const PICTURE_BYTES = 5_000_000;

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2] ?? null;

/**
 * The preview picture a page names for itself (`og:image`, then `og:image:secure_url`, then `twitter:image`), as an
 * https address resolved against the page; null when it names none or only a non-https one. Pure: the server fetches
 * it with every address checked.
 */
export function pageImageUrl(html: string, pageUrl: string): string | null {
  const metas = html.slice(0, PAGE_READ_BYTES).match(/<meta\b[^>]*>/gi) ?? [];
  const wanted = ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"];
  const found = new Map<string, string>();
  for (const m of metas) {
    const key = (attr(m, "property") ?? attr(m, "name") ?? "").toLowerCase();
    const content = attr(m, "content");
    if (content && wanted.includes(key) && !found.has(key)) found.set(key, content.replace(/&amp;/g, "&").trim());
  }
  for (const key of wanted) {
    const raw = found.get(key);
    if (!raw) continue;
    try {
      const u = new URL(raw, pageUrl);
      if (u.protocol === "https:") return u.toString();
    } catch {
      /* try the next */
    }
  }
  return null;
}

/** Stories older than this aren't kept. */
export const NEWS_DAYS = 14;
/** The feed shows this many, newest first. */
export const NEWS_SHOWN = 60;
/** Most stories kept from one day's reading, and how many Sol is asked to find (10 Nov 2026, Martin: more stories). */
export const MAX_PER_RUN = 15;
export const AIM_STORIES = 10;
/** A day's reading is due again after this many hours (the cron runs each morning; a read of the tab catches up). */
export const NEWS_REFRESH_HOURS = 20;
/** How long to wait before trying again after a reading failed. */
export const NEWS_RETRY_HOURS = 1;

const LIMITS = { headline: 120, summary: 480, meaning: 220, note: 200, brand: 40, brands: 6 } as const;

const DAY_MS = 86_400_000;
const dayNum = (d: string) => Date.parse(`${d}T12:00:00Z`);

const oneLine = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Words too long for their place end at their last whole sentence, never mid-sentence (else at a word, with "…"). */
export function wholeSentences(v: unknown, max: number): string {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (end > max / 3) return cut.slice(0, end + 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}

/** A publication day as YYYY-MM-DD, or null when missing, unreadable or after today. */
export function cleanDay(v: unknown, today: string): string | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m || Number.isNaN(dayNum(m[1]))) return null;
  return dayNum(m[1]) > dayNum(today) ? null : m[1];
}

const blocked = (host: string) => BLOCKED_SITES.some((s) => host === s || host.endsWith(`.${s}`));

/**
 * Sol's stories checked: a known topic, a headline, a summary and an https page he really saw in his search (`seen`, so
 * nothing made up is linked); none from a blocked site, none older than `NEWS_DAYS`, none already kept (`known`, page
 * keys), each page once, at most `MAX_PER_RUN`.
 */
export function cleanNewsItems(raw: unknown, seen: readonly string[], known: readonly string[], today: string): NewsDraft[] {
  if (!Array.isArray(raw)) return [];
  const seenKeys = new Map(seen.map((u) => [urlKey(u), u]));
  const taken = new Set(known);
  const out: NewsDraft[] = [];
  for (const r of raw) {
    if (out.length >= MAX_PER_RUN) break;
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const url = seenKeys.get(urlKey(typeof o.url === "string" ? o.url.trim() : ""));
    if (!url || !/^https:\/\//i.test(url)) continue;
    const key = urlKey(url);
    if (taken.has(key) || blocked(hostOf(url))) continue;
    const topic = NEWS_TOPICS.includes(o.topic as NewsTopic) ? (o.topic as NewsTopic) : null;
    if (topic && OFFICIAL_TOPICS.includes(topic) && onSite(url, NOT_FOR_OFFICIAL_TOPICS)) continue;
    const headline = oneLine(o.headline, LIMITS.headline);
    const summary = wholeSentences(o.summary, LIMITS.summary);
    if (!topic || headline.length < 8 || summary.length < 20) continue;
    const publishedOn = cleanDay(o.publishedOn, today);
    if (publishedOn && dayNum(today) - dayNum(publishedOn) > NEWS_DAYS * DAY_MS) continue;
    const brands = Array.isArray(o.brands)
      ? [...new Set(o.brands.map((b) => oneLine(b, LIMITS.brand)).filter(Boolean))].slice(0, LIMITS.brands)
      : [];
    taken.add(key);
    out.push({
      topic,
      headline,
      summary,
      meaning: wholeSentences(o.meaning, LIMITS.meaning),
      url,
      publishedOn,
      brands,
      ...cleanStanding(topic, url, o.standing, o.standingNote),
    });
  }
  return out;
}

/** The JSON list at the end of Sol's answer (in a ```json fence, or the last [...] in it), or null. */
export function readNewsJson(text: string): unknown {
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].pop()?.[1];
  const candidates = [fenced, text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      const v = JSON.parse(c.trim());
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object" && Array.isArray((v as { stories?: unknown }).stories)) return (v as { stories: unknown[] }).stories;
    } catch {
      /* try the next */
    }
  }
  return null;
}

/** What Sol is asked each morning. `recent` are headlines already in the feed, so he looks for what's new. */
export function newsPrompt(today: string, recent: readonly string[]): string {
  const already = recent.length
    ? `\nAlready in the feed (don't send these stories again):\n${recent.map((h) => `- ${h}`).join("\n")}\n`
    : "";
  return `Today is ${today} in Melbourne. You are Sol, the assistant inside RENUABL, software for Australian solar retailers and installers.

Search the web for the news from the last 7 days that an Australian solar, battery and EV charger business should know. Look for:
- companies: makers, wholesalers, retailers or installers entering or leaving Australia, closing, going into administration, merging, recalls, warranty support changing
- rebates: the federal STCs and battery incentive, Solar Victoria and other state rebates and loans, changes to amounts, rules or dates
- rules: standards (AS/NZS 4777, 5139, 3000), the CEC and Solar Accreditation Australia, Energy Safe Victoria, the CER's approved products, consumer rules
- networks: export limits, flexible exports, emergency backstop, tariffs, AEMO and the distributors (AusNet, CitiPower, Powercor, Jemena, United Energy and others)
- products: new panels, inverters, batteries and EV chargers launched or approved for Australia
- technology: new capabilities (virtual power plants, vehicle-to-grid, monitoring, software) that change what a solar business can sell or do

Victoria first, then the rest of Australia; world news only when it changes things here. Prefer official bodies and the companies' own announcements, then reputable news and trade press. Search several times with different words.

Sources:
- For rebates, rules and standards, and networks, link the official page: the government body or regulator (cer.gov.au, dcceew.gov.au, energy.gov.au, solar.vic.gov.au, esc.vic.gov.au, energysafe.vic.gov.au, aer.gov.au and other .gov.au sites), AEMO, Standards Australia, Solar Accreditation Australia, or the network itself. When you find such a change in the news, search for the official page that states it and link that instead.
- Never use comparison or lead sites (Finder, Canstar, SolarQuotes and the like), or a retailer's or installer's own sales or pricing page, as the source for a rebate, rule or network change.
- If you can't find or open the official page, don't drop the story: link a reputable news outlet (ABC, AFR, RenewEconomy, pv magazine and the like) and mark it "reported".
- Report the news; don't spend your searches on one story. Cover the week's main stories first, then look for official pages for the rebate and rule ones.

Aim for ${AIM_STORIES} stories or more, across the topics, not all rebates. Always search for products: new panels, inverters, batteries and EV chargers launched in Australia or added to the Clean Energy Council's approved lists, and makers' announcements (makers' own news pages, pv magazine Australia and the trade press). Include at least two product stories when there are any that week.
${already}
Rules:
- Every story must come from a page your search showed or you read. Copy its address exactly. Never make up or guess a link.
- Say how sure each story is: "confirmed" when the body responsible says it on its own page (the government or regulator about its rebate or rule, the network about its network, a company about itself), "reported" when credible news says it but that body hasn't confirmed it, "unconfirmed" for anything speculative: leaks, proposals, options being considered, "reportedly", "could" or "may". Then one short sentence of commentary saying why, naming who says it (for example: "Stated on the Clean Energy Regulator's own page." or "From a newspaper report; the government hasn't announced it.").
- Write the headline and summary in your own words. Never copy a sentence from the page.
- Only facts the page states. No figure, date or name it doesn't give. If something is uncertain or reported but not confirmed, say so.
- "meaning" is one plain sentence on what it means for a solar retailer or installer (for example: customers with this product may ask about warranty support). Practical, never financial or legal advice.
- Up to ${MAX_PER_RUN} stories, the most important first. Fewer is fine: no filler, nothing older than ${NEWS_DAYS} days.

End your reply with the stories as JSON in a \`\`\`json fence: a list of objects with
"topic" (one of ${NEWS_TOPICS.map((t) => `"${t}"`).join(", ")}), "headline" (under 15 words), "summary" (2 or 3 sentences), "meaning" (1 sentence), "url", "publishedOn" (YYYY-MM-DD if the page says, else null), "brands" (makers or businesses named, as written), "standing" ("confirmed", "reported" or "unconfirmed"), "standingNote" (1 short sentence).`;
}

/** Whether a fresh reading is due: never read, the last good one over `NEWS_REFRESH_HOURS` ago, a failed one over `NEWS_RETRY_HOURS`. */
export function newsDue(last: { startedAt: string; ok: boolean | null } | null, now: Date): boolean {
  if (!last) return true;
  const hours = (now.getTime() - Date.parse(last.startedAt)) / 3_600_000;
  if (last.ok === false) return hours >= NEWS_RETRY_HOURS;
  // A reading still going (ok null) for over 15 minutes has died.
  if (last.ok === null) return hours >= 0.25;
  return hours >= NEWS_REFRESH_HOURS;
}

/** Stories of one topic, or all; newest first by publication day, else when found. */
export function newsShown(items: readonly NewsItem[], topic: NewsTopic | "all"): NewsItem[] {
  const when = (n: NewsItem) => (n.publishedOn ? dayNum(n.publishedOn) : Date.parse(n.foundAt));
  return items.filter((n) => topic === "all" || n.topic === topic).sort((a, b) => when(b) - when(a));
}

/** "Today", "Yesterday", "This week", "Earlier": the heading a story sits under. */
export function newsDayGroup(n: Pick<NewsItem, "publishedOn" | "foundAt">, today: string): string {
  const day = n.publishedOn ?? n.foundAt.slice(0, 10);
  const days = Math.round((dayNum(today) - dayNum(day)) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return "Earlier";
}

/** Words too general to stand for a maker on their own ("Solar Victoria" is fine; "Solar" alone is not). */
const NOT_A_MAKER = new Set([
  "solar",
  "energy",
  "power",
  "battery",
  "batteries",
  "inverter",
  "inverters",
  "panel",
  "panels",
  "australia",
  "australian",
  "group",
  "the",
  "home",
  "systems",
  "technology",
  "electric",
  "electrical",
]);

const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Whether a product's name (or code) names this maker, as whole words: the maker's words in a row ("Solar Edge",
 * "SolarEdge"), or the maker run together matching words run together ("SolarEdge" in "Solar Edge SE5000H"). A one-word
 * maker that is a general word, or under three letters, never matches.
 */
export function namesMaker(product: string, maker: string): boolean {
  const m = tokens(maker);
  if (!m.length) return false;
  if (m.length === 1 && (m[0].length < 3 || NOT_A_MAKER.has(m[0]))) return false;
  const p = tokens(product);
  const joined = m.join("");
  for (let i = 0; i < p.length; i++) {
    if (m.every((w, k) => p[i + k] === w)) return true;
    let run = "";
    for (let j = i; j < p.length && run.length < joined.length; j++) {
      run += p[j];
      if (run === joined) return true;
    }
  }
  return false;
}

/** What a story's makers mean for one business: how many of its products name them, and up to three of their names. */
export interface OnYourLists {
  makers: string[];
  count: number;
  examples: string[];
}

/** The business's products (`sku` and `name`, each once by code) that name one of the story's makers, or null for none. */
export function onYourLists(brands: readonly string[], products: readonly { sku: string; name: string }[]): OnYourLists | null {
  const makers = new Set<string>();
  const hit = new Map<string, string>();
  for (const p of products) {
    for (const b of brands) {
      if (namesMaker(`${p.name} ${p.sku}`, b)) {
        makers.add(b);
        if (!hit.has(p.sku)) hit.set(p.sku, p.name || p.sku);
      }
    }
  }
  if (!hit.size) return null;
  return { makers: [...makers], count: hit.size, examples: [...hit.values()].slice(0, 3) };
}

/** "3 SolarEdge products on your price lists". */
export const onYourListsWords = (m: OnYourLists) =>
  `${m.count} ${m.makers.join(" and ")} product${m.count === 1 ? "" : "s"} on your price lists`;
