/**
 * Sol the oracle (1 Nov 2026, Martin: "Sol's mission is to be the absolute guru and oracle when it comes to solar,
 * batteries and EVs"). What a solar business asks him (networks, approvals, rebates, technical, products, wholesalers),
 * where the answers are, how he finds them on the web, and the memory he keeps of what he found: a business-wide set of
 * answers, each with the pages it came from, so the next question is answered at once and the team can check it.
 *
 * Every answer from the web or from memory carries its sources, shown under it as a small sources icon. An answer is
 * saved only with a page Sol actually read in that answer (`cleanKnowledgeInput` checks), so nothing in memory is
 * unsourced, and nothing from the business's own records (customers, deals, costs) ever goes into it. Pure: no I/O.
 */

/** A page an answer came from: read on the web in this answer, or kept in memory from an earlier one. */
export interface SolSource {
  url: string;
  title: string;
  from: "web" | "memory";
  /** For a memory source, when the answer was saved. */
  at?: string;
}

/** The line he ends an answer's sources with (`takeSourcesList`). */
export const SOURCES_MARK = "Sources:";

export const KNOWLEDGE_TOPICS = ["network", "approvals", "rebates", "technical", "product", "wholesaler", "standards", "other"] as const;
export type KnowledgeTopic = (typeof KNOWLEDGE_TOPICS)[number];
export const TOPIC_LABELS: Record<KnowledgeTopic, string> = {
  network: "Networks",
  approvals: "Approvals",
  rebates: "Rebates",
  technical: "Technical",
  product: "Products",
  wholesaler: "Wholesalers",
  standards: "Standards",
  other: "Other",
};

/** After this many days a saved answer is said to be worth checking again: rebates and rules change faster than physics. */
export const STALE_DAYS: Record<KnowledgeTopic, number> = {
  rebates: 45,
  approvals: 90,
  network: 120,
  standards: 365,
  wholesaler: 365,
  product: 365,
  technical: 730,
  other: 180,
};

/** One answer Sol keeps for the whole business. */
export interface KnowledgeEntry {
  id: string;
  topic: KnowledgeTopic;
  /** The question it answers, in a line. */
  question: string;
  answer: string;
  sources: SolSource[];
  savedBy: string;
  savedAt: string;
  /** How many times it has been recalled, and when last. */
  uses: number;
  usedAt: string | null;
}

/** The most answers a business keeps; the least used, oldest go first beyond it. */
export const MAX_KNOWLEDGE = 2_000;
/** How many searches and page reads one answer may make. */
export const SOL_WEB_SEARCHES = 5;
export const SOL_WEB_FETCHES = 4;
/** The most of one page or PDF he reads, in tokens. */
export const SOL_PAGE_TOKENS = 30_000;

/**
 * Sites his search never uses: social media and question sites, where an answer is someone's opinion. Forums such as
 * Whirlpool stay open: installers talk shop there, so he may read them, but only as experience, never as a rule.
 */
export const BLOCKED_SITES: readonly string[] = [
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "pinterest.com",
  "quora.com",
  "reddit.com",
  "linkedin.com",
];

/** Where he searches from: Melbourne, so local results come first (networks, wholesalers, rebates). */
export const SEARCH_FROM = {
  type: "approximate",
  city: "Melbourne",
  region: "Victoria",
  country: "AU",
  timezone: "Australia/Melbourne",
} as const;

/**
 * What a solar business asks, by area, with where the answer lives. Used in his instructions and as the examples the
 * chat offers when it is empty.
 */
export const QUESTION_AREAS: readonly { topic: KnowledgeTopic; examples: string[]; where: string }[] = [
  {
    topic: "network",
    examples: [
      "Which network is Glen Waverley on, and what's the export limit there?",
      "How do I apply for pre-approval with AusNet Services?",
      "Can I do flexible exports on a three-phase home with Powercor?",
    ],
    where:
      "the distributors' own sites (AusNet Services, CitiPower, Powercor, Jemena, United Energy), their connection guides and portals, and AEMO for the wider rules",
  },
  {
    topic: "approvals",
    examples: [
      "What do I lodge after an install, and by when: CES, EWR, STC paperwork?",
      "How long is Solar Victoria approval taking right now?",
      "What's needed to become a Solar Victoria authorised retailer?",
    ],
    where: "Energy Safe Victoria, Solar Victoria, the Clean Energy Regulator, Solar Accreditation Australia and the network's own guides",
  },
  {
    topic: "rebates",
    examples: [
      "What's the battery rebate worth on a 13.5 kWh battery this year?",
      "Who qualifies for the Solar Victoria solar rebate and the interest-free loan?",
      "How many STCs does a 6.6 kW system get in Melbourne in 2027?",
    ],
    where:
      "solar.vic.gov.au, cer.gov.au, energy.gov.au and the federal Cheaper Home Batteries pages; never a retailer's blog for the figure",
  },
  {
    topic: "technical",
    examples: [
      "How far does a battery need to be from a window under AS/NZS 5139?",
      "How do I work out the string length for 440 W panels on a Sungrow SH10RS?",
      "What causes an isolation fault on a string inverter, and how do I find it?",
    ],
    where:
      "the standards (the business's own licensed copies), Energy Safe Victoria, the Clean Energy Council's guides, and the makers' installation manuals",
  },
  {
    topic: "product",
    examples: [
      "Does the Sigenergy SigenStor work on a single-phase home with backup?",
      "What's the warranty on a Jinko Tiger Neo panel, and what voids it?",
      "Which EV chargers can follow solar surplus with a Fronius inverter?",
    ],
    where: "the maker's own Australian datasheets, manuals and warranty documents, and the CEC approved products lists",
  },
  {
    topic: "wholesaler",
    examples: [
      "What's the address and phone number for Rexel in Dandenong?",
      "Which wholesalers near Clayton stock Sigenergy?",
      "What are AWM's opening hours and how do I open a trade account?",
    ],
    where: "the wholesaler's own website and its branch pages; give the address, phone, email and hours exactly as that page shows them",
  },
];

/** A handful of examples for the empty chat, one from each area, the same for everyone. */
export const STARTER_QUESTIONS: readonly string[] = QUESTION_AREAS.map((a) => a.examples[0]);

/** Sol's instructions for answering as the industry's oracle, with the web and his memory. */
export const SOL_ORACLE = `You are the team's solar, battery and EV oracle: the one they ask instead of searching themselves. Answer what a Victorian solar business asks every day, in these areas, looking in the places named:
${QUESTION_AREAS.map((a) => `- ${a.topic}: such as "${a.examples[0]}" Look in ${a.where}.`).join("\n")}

Your memory first: for any question about networks, approvals, rebates, products, wholesalers or technical rules, call recall_knowledge before searching. When it holds an answer that isn't marked to check again, answer from it and say it came from what you've found before. When it is marked to check again, or doesn't settle it, search.

The web: use web_search, and web_fetch to read the page or PDF it found. Prefer, in order: the official body or network, the maker's own Australian documents, the wholesaler's own pages, the Clean Energy Council; a forum post is someone's experience, so say so if you use one, and never take a rule or a figure from it. Give the figure, date, address, phone or email exactly as the page shows it, and when the page is dated, the date. Never fill a gap with a figure you didn't find: say what you couldn't find and where to look. Rebate amounts, approval times and network rules change: say when a page looks old.

Saving what you found: after answering a question that others in the business are likely to ask again, from pages you read in this answer (a network's export rules, a rebate's current amount, a wholesaler's branch details, a product's limits), keep it with save_knowledge: the question in a line, the answer as you'd give it again, the topic, and the pages it came from. Never save anything about the business's own customers, deals, prices or costs, and never save a guess. Say in a few words that you've kept it.

Sources: when an answer drew on the web or your memory, end it with a last line "${SOURCES_MARK}" followed by the addresses of the pages you relied on, one per line, nothing else after them. They are taken off your words and shown under your answer as a sources icon, so don't otherwise write addresses out in the answer.`;

/** Words that carry no meaning for matching a question to a saved answer. */
const STOP = new Set(
  "the a an and or of to in on for with is are was be it its this that what which who how when where does do can i we our my your there their at by from as about any have has much many".split(
    " ",
  ),
);

/** The words a question is matched on: lower case, plurals folded, the empty ones dropped. */
export function keyWords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9.\s-]/g, " ")
        .split(/\s+/)
        .map((w) => w.replace(/^[.-]+|[.-]+$/g, ""))
        .map((w) =>
          w.length > 4 && w.endsWith("ies")
            ? `${w.slice(0, -3)}y`
            : w.length > 4 && w.endsWith("s") && !w.endsWith("ss")
              ? w.slice(0, -1)
              : w,
        )
        .filter((w) => w.length >= 2 && !STOP.has(w)),
    ),
  ];
}

const DAY_MS = 86_400_000;
const ageDays = (at: string, now: Date) => Math.max(0, Math.floor((now.getTime() - Date.parse(at)) / DAY_MS));

/** Whether a saved answer is old enough, for its topic, to check again before relying on it. */
export const isStale = (e: Pick<KnowledgeEntry, "topic" | "savedAt">, now: Date) => ageDays(e.savedAt, now) > STALE_DAYS[e.topic];

/**
 * The saved answers that match a question, best first: by how many of its words the saved question and answer share
 * (the saved question counts double), at least two shared words (or one, for a one-word question).
 */
export function recallKnowledge(entries: readonly KnowledgeEntry[], query: string, max = 3): KnowledgeEntry[] {
  const want = keyWords(query);
  if (!want.length) return [];
  const need = want.length === 1 ? 1 : 2;
  return entries
    .map((e) => {
      const q = new Set(keyWords(e.question));
      const a = new Set(keyWords(`${e.answer} ${TOPIC_LABELS[e.topic]}`));
      const shared = want.filter((w) => q.has(w) || a.has(w)).length;
      const score = want.reduce((n, w) => n + (q.has(w) ? 2 : a.has(w) ? 1 : 0), 0);
      return { e, shared, score };
    })
    .filter((x) => x.shared >= need)
    .sort((x, y) => y.score - x.score || y.e.savedAt.localeCompare(x.e.savedAt))
    .slice(0, max)
    .map((x) => x.e);
}

/** What recall_knowledge tells him: each answer with its age, whether to check it again, and its pages. */
export function recallLines(found: readonly KnowledgeEntry[], now: Date): string {
  if (!found.length) return "Nothing in memory answers that. Search the web.";
  return found
    .map((e) => {
      const age = ageDays(e.savedAt, now);
      const when = age === 0 ? "today" : age === 1 ? "yesterday" : `${age} days ago`;
      return [
        `[${e.id}] ${TOPIC_LABELS[e.topic]} · saved ${when}${isStale(e, now) ? " · OLD: check it's still current before relying on it" : ""}`,
        `Q: ${e.question}`,
        `A: ${e.answer}`,
        `Sources: ${e.sources.map((s) => s.url).join(", ")}`,
      ].join("\n");
    })
    .join("\n\n");
}

/** Pages as kept: https only, each once, a tidy title, at most `max`. */
export function cleanSources(raw: unknown, max = 8): SolSource[] {
  const seen = new Set<string>();
  const out: SolSource[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (!/^https:\/\/[^\s]+$/i.test(url) || url.length > 600 || seen.has(urlKey(url))) continue;
    seen.add(urlKey(url));
    const title = typeof o.title === "string" ? o.title.replace(/\s+/g, " ").trim().slice(0, 140) : "";
    out.push({
      url,
      title: title || hostOf(url),
      from: o.from === "memory" ? "memory" : "web",
      ...(typeof o.at === "string" && !Number.isNaN(Date.parse(o.at)) ? { at: o.at } : {}),
    });
    if (out.length >= max) break;
  }
  return out;
}

/** "sungrowpower.com" from a page's address, for the sources list. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 60);
  }
}

/**
 * His list of sources taken off the end of an answer (`SOURCES_MARK` and the addresses after it): the words without
 * it, and the addresses. A search tool that filters its results in code leaves no citations, so this list is how an
 * answer says which pages it relied on; `answerSources` then keeps only pages he really saw.
 */
export function takeSourcesList(text: string): { text: string; urls: string[] } {
  const at = text.lastIndexOf(SOURCES_MARK);
  if (at < 0) return { text, urls: [] };
  const urls = [...text.slice(at).matchAll(/https:\/\/[^\s<>()"']+/gi)].map((m) => m[0].replace(/[.,;:)\]]+$/, ""));
  return urls.length ? { text: text.slice(0, at).trimEnd(), urls } : { text, urls: [] };
}

/** A page's address for comparing: no "www.", no trailing slash, no #part, lower-case host. */
export function urlKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "").toLowerCase()}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * The pages an answer relied on: those he listed that he really saw in it (searched, read or cited), with their
 * titles; an address he listed but never saw is dropped, so nothing made up reaches the sources.
 */
export function reliedOn(
  listed: readonly string[],
  seen: readonly { url: string; title?: string | null }[],
): { url: string; title?: string | null }[] {
  const byKey = new Map(seen.map((p) => [urlKey(p.url), p]));
  return listed.map((u) => byKey.get(urlKey(u))).filter((p): p is { url: string; title?: string | null } => Boolean(p));
}

/** The saved answers he drew on: those whose pages he listed, or all he recalled when he listed none. */
export function memoryUsed(listed: readonly string[], recalled: readonly KnowledgeEntry[]): KnowledgeEntry[] {
  if (!listed.length) return [...recalled];
  const keys = new Set(listed.map(urlKey));
  return recalled.filter((e) => e.sources.some((s) => keys.has(urlKey(s.url))));
}

/** The pages under an answer: those read on the web, then those from memory, each once. */
export function answerSources(web: readonly { url: string; title?: string | null }[], memory: readonly KnowledgeEntry[]): SolSource[] {
  return cleanSources([
    ...web.map((p) => ({ url: p.url, title: p.title ?? "", from: "web" })),
    ...memory.flatMap((e) => e.sources.map((s) => ({ url: s.url, title: s.title, from: "memory", at: e.savedAt }))),
  ]);
}

export type KnowledgeInput = Pick<KnowledgeEntry, "topic" | "question" | "answer" | "sources">;

/**
 * An answer to keep, as Sol or a member sent it: a topic, the question in a line, the answer, and only pages read in
 * that answer or kept in memory (`known`), so nothing is saved without a page it came from.
 */
export function cleanKnowledgeInput(
  raw: unknown,
  known: ReadonlySet<string>,
): { ok: true; value: KnowledgeInput } | { ok: false; message: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const topic = (KNOWLEDGE_TOPICS as readonly string[]).includes(r.topic as string) ? (r.topic as KnowledgeTopic) : "other";
  const question = typeof r.question === "string" ? r.question.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  const answer = typeof r.answer === "string" ? r.answer.replace(/\r/g, "").trim().slice(0, 3_000) : "";
  if (question.length < 5 || answer.length < 5) return { ok: false, message: "Give the question and the answer to keep." };
  const urls = (Array.isArray(r.sources) ? r.sources : []).map((s) => (typeof s === "string" ? { url: s } : s));
  const sources = cleanSources(urls).filter((s) => known.has(s.url));
  if (!sources.length)
    return { ok: false, message: "Only an answer from pages read in this answer can be kept: give their addresses as sources." };
  return { ok: true, value: { topic, question, answer, sources: sources.map((s) => ({ ...s, from: "web" as const })) } };
}

/** The area a question most likely belongs to, by its words, for an answer a member keeps by hand. */
export function guessTopic(text: string): KnowledgeTopic {
  const t = text.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  if (has("rebate", "stc", "incentive", "loan", "cheaper home batter")) return "rebates";
  if (has("export", "pre-approval", "preapproval", "ausnet", "citipower", "powercor", "jemena", "united energy", "distributor", "nmi"))
    return "network";
  if (has("ces", "ewr", "solar victoria", "accreditation", "lodge", "approval")) return "approvals";
  if (has("wholesaler", "rexel", "awm", "branch", "opening hours", "trade account", "address", "phone")) return "wholesaler";
  if (has("as/nzs", "as 3000", "5139", "4777", "3008", "standard")) return "standards";
  if (has("warranty", "datasheet", "model", "compatible", "supports")) return "product";
  if (has("string", "voltage", "mppt", "fault", "earth", "isolation", "clearance", "cable")) return "technical";
  return "other";
}

/** Memory within its limit: the newest kept, then the most used. */
export function trimKnowledge<T extends Pick<KnowledgeEntry, "uses" | "savedAt">>(entries: readonly T[], max = MAX_KNOWLEDGE): T[] {
  return [...entries].sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.uses - a.uses).slice(0, max);
}
