import { normaliseEmail } from "../accounts";

/**
 * The RENUABL Business demo (11 Nov 2026, Martin: the way in for someone handed the link, such as a wholesaler passing
 * RENUABL to its retailers and installers; blended into signing up without being framed as it).
 *
 * CLOSED TO THE PUBLIC since 27 Nov 2026 (Martin: "i dont want there to be access to the demo platform. you either
 * have to sign up, or book a demo in"): nothing opens a demo account any more; the front page offers Book a demo
 * (sales-leads.ts) and staff show the platform from the sample retailer (staff-view.ts). The rules below still hold for
 * demo accounts opened before, until the daily clean-up clears them.
 *
 * As it was: "Try the demo" on /business opened a demo account in one press: no form. Each visitor got a demo business of
 * their own, a retailer's, filled with the made-up example deals. They look around freely; their name, company and email are
 * asked for ("Put your business on it") the first time they do something that costs RENUABL money and shows the
 * product at its best: design a roof, ask Sol, publish a proposal (`demoNeedsDetails`). The demo is then named for
 * their company, so proposals carry it. A demo never reaches outside itself (`demoRefuses`), and Sol answers from a
 * small allowance. Pure, tested in `demo.test.ts`.
 */

/** Reserved (`.example`): nothing is delivered to it, and example deals may be added (`mayHaveExamples`). */
export const DEMO_DOMAIN = "demo.renuabl.example";

export const isDemoEmail = (email: string | null | undefined): boolean => (email ?? "").trim().toLowerCase().endsWith(`@${DEMO_DOMAIN}`);

/** The owner's email of a new demo business, from a random id made on the server. */
export const demoEmail = (id: string): string => `demo-${id.toLowerCase().replace(/[^a-z0-9]/g, "")}@${DEMO_DOMAIN}`;

/** Sol's answers in a demo: a one-off allowance, always enforced, so a demo can't run up a bill. */
export const DEMO_SOL_CREDITS = 40;

/** New demos one visitor may open in an hour. */
export const DEMO_PER_HOUR = 6;

/** A demo is cleared this many days after it was opened. */
export const DEMO_DAYS = 30;

/** What a demo business is called until its visitor says whose it is. */
export const DEMO_BUSINESS = "Your solar business";

export const DEMO_NAME_MAX = 40;
export const DEMO_COMPANY_MAX = 80;

/** Who is trying the demo, once they have said. */
export interface DemoDetails {
  firstName: string;
  /** The rest of the name they typed, or empty. */
  lastName: string;
  company: string;
  email: string;
}

const clean = (raw: unknown, max: number): string =>
  typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u001f<>]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** What the details box sent, checked: a name, a company and an email that looks like one. */
export function cleanDemoDetails(body: Record<string, unknown>): { ok: true; details: DemoDetails } | { ok: false; message: string } {
  const name = clean(body.name, DEMO_NAME_MAX * 2);
  const company = clean(body.company, DEMO_COMPANY_MAX);
  if (!name) return { ok: false, message: DEMO_DETAILS.missingName };
  if (!company) return { ok: false, message: DEMO_DETAILS.missingCompany };
  const email = normaliseEmail(body.email);
  if (!email || isDemoEmail(email)) return { ok: false, message: DEMO_DETAILS.badEmail };
  const [first, ...rest] = name.split(" ");
  return {
    ok: true,
    details: { firstName: first.slice(0, DEMO_NAME_MAX), lastName: rest.join(" ").slice(0, DEMO_NAME_MAX), company, email },
  };
}

/**
 * Where a demo came from (15 Nov 2026, Martin: a wholesaler's email links to the demo, and the demos it brings should
 * say so): the `utm_source` and `utm_campaign` on the page the button was pressed on, sent with the press. Only plain
 * tags are kept (letters, digits, dot, dash, underscore; lower case; `DEMO_TAG_MAX` long), so nothing typed into a link
 * reaches an email or the database as anything but a tag. No source, no record.
 */
export interface DemoSource {
  source: string;
  /** The campaign, or empty. */
  campaign: string;
}

export const DEMO_TAG_MAX = 40;

const tag = (raw: unknown): string =>
  typeof raw === "string"
    ? raw
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9._-]/g, "")
        .slice(0, DEMO_TAG_MAX)
    : "";

export function cleanDemoSource(body: Record<string, unknown> | null | undefined): DemoSource | null {
  const source = tag(body?.utm_source);
  if (!source) return null;
  return { source, campaign: tag(body?.utm_campaign) };
}

/** "rexel · wholesaler-launch", or the source alone. */
export const demoSourceWords = (s: DemoSource): string => (s.campaign ? `${s.source} · ${s.campaign}` : s.source);

/** The note to RENUABL's staff when someone in the demo says who they are, with where the demo came from when known. */
export function demoDetailsNote(d: DemoDetails, from?: DemoSource | null): { subject: string; text: string } {
  const who = [d.firstName, d.lastName].filter(Boolean).join(" ");
  return {
    subject: `RENUABL Business demo: ${who}, ${d.company}${from ? ` (via ${from.source})` : ""}`,
    text: [
      `${who} is trying the RENUABL Business demo.`,
      `Company: ${d.company}`,
      `Email: ${d.email} (as typed, not verified)`,
      ...(from ? [`Came from: ${demoSourceWords(from)}`] : []),
    ].join("\n"),
  };
}

export const DEMO_REFUSAL = "That's switched off in the demo. Everything else is yours to try.";

/**
 * What a demo never does, by the designer API's address: anything that reaches a real person or another business, or
 * touches money. Reading is always allowed.
 */
const BLOCKED: readonly RegExp[] = [
  // Emails, calls and texts to customers, installers and wholesalers.
  /^\/api\/design\/jobs\/[^/]+\/(email|call|text|share|inspection)$/,
  /^\/api\/design\/customers\/group-email$/,
  /^\/api\/design\/orders\/[^/]+\/email$/,
  /^\/api\/design\/sol-agents$/,
  // Asking RENUABL for a phone number for an agent.
  /^\/api\/design\/agents$/,
  // A support ticket to RENUABL's staff (support.ts): a demo has no address to answer.
  /^\/api\/design\/support$/,
  // Add-ons to the plan, and a phone number bought (domain/design/add-ons.ts).
  /^\/api\/design\/addons(\/|$)/,
  /^\/api\/design\/inbox$/,
  // The lead inbox reads a real mailbox (lead-inbox.ts).
  /^\/api\/design\/lead-inbox$/,
  // Reading another company's account (Pylon) with a key.
  /^\/api\/design\/pylon$/,
  // The business's own books in Xero (xero.ts).
  /^\/api\/design\/xero$/,
  /^\/api\/design\/hubspot$/,
  // Marketing email to a business's contacts (domain/marketing).
  /^\/api\/design\/marketing(\/|$)/,
  // Other businesses: the feed every business reads, connections, the Marketplace, jobs passed on.
  /^\/api\/design\/(posts|connections|marketplace|trade|installer-jobs|inspections)(\/|$)/,
  // People and money.
  /^\/api\/design\/(members|billing|connect|subscribe|password|view-as)(\/|$)/,
];

/** PUT on the job card emails it to an installer; adding a note (POST) stays. */
const BLOCKED_PUT: readonly RegExp[] = [/^\/api\/design\/jobs\/[^/]+\/card$/];

const reads = (method: string | null | undefined) => ["GET", "HEAD", "OPTIONS"].includes((method ?? "GET").toUpperCase());
const tidy = (path: string) => path.replace(/\/+$/, "");

export function demoRefuses(method: string | null | undefined, path: string | null | undefined): boolean {
  if (reads(method) || !path) return false;
  const p = tidy(path);
  return BLOCKED.some((r) => r.test(p)) || ((method ?? "").toUpperCase() === "PUT" && BLOCKED_PUT.some((r) => r.test(p)));
}

/** What a demo asks for its visitor's details before doing, whatever the method: a roof's pictures and data cost money to fetch. */
const DETAILS_FIRST_ANY: readonly RegExp[] = [/^\/api\/design\/roof(\/|$)/];

/** And these when something is asked of them (not read): Sol, the designer's helpers, a roof kept, a proposal published. */
const DETAILS_FIRST_WRITE: readonly RegExp[] = [
  /^\/api\/design\/(sol|command|bill|switchboard|live|projects|datasheets|draft)(\/|$)/,
  /^\/api\/design\/invoices\/read$/,
  /^\/api\/design\/jobs\/[^/]+\/(proposal|write|usage|call-notes|chat\/draft|walkthrough)(\/|$)/,
];

/**
 * Whether a demo whose visitor hasn't said who they are must ask first: designing a roof, asking Sol, publishing a
 * proposal, and the other things that call a paid service. Looking around is free.
 */
export function demoNeedsDetails(method: string | null | undefined, path: string | null | undefined): boolean {
  if (!path) return false;
  const p = tidy(path);
  if (DETAILS_FIRST_ANY.some((r) => r.test(p))) return true;
  return !reads(method) && DETAILS_FIRST_WRITE.some((r) => r.test(p));
}

/** The pages that open on something `demoNeedsDetails` gates, so the box is shown as they open: the designer on a roof. */
export function demoPageNeedsDetails(pathname: string, search: string): boolean {
  if (!/^\/design\/roof\/?$/.test(pathname)) return false;
  const q = new URLSearchParams(search);
  return q.has("job") || q.has("at");
}

/** The header the proxy sets with the request's method, for `demoRefuses`. */
export const METHOD_HEADER = "x-renuabl-method";

/** On a refusal that the details box answers: the product opens the box when it sees it. */
export const DEMO_DETAILS_HEADER = "x-renuabl-demo";
export const DEMO_DETAILS_EVENT = "renuabl:demo-details";

/** "Put your business on it": the box that asks who is trying the demo. */
export const DEMO_DETAILS = {
  title: "Put your business on it.",
  intro: "Tell us who you are and the demo becomes yours: your company's name on the proposals, and Sol and the roof designer switched on.",
  name: "Your name",
  company: "Company",
  email: "Work email",
  consent: "We'll use these to get in touch about RENUABL.",
  button: "Carry on",
  saving: "One moment…",
  later: "Not now",
  needed: "Add your details to carry on with the demo.",
  missingName: "Please enter your name.",
  missingCompany: "Please enter your company's name.",
  badEmail: "Please enter a valid email address.",
  failed: "That didn't save. Please try again.",
  /** In the demo's bar, until given. */
  barButton: "Put your business on it",
} as const;

/**
 * The demo's words. Its own page and its Try the demo button are gone (27 Nov 2026, Martin: "you either have to sign up,
 * or book a demo in"): /business/demo sends to `bookPath`, the front page with its Book a demo box open
 * (sales-leads.ts), and what is left here is for demo accounts opened before, until they are cleared.
 */
export const DEMO_PAGE = {
  /** Where every old demo link lands: the front page, its Book a demo box open. */
  bookPath: "/?demo=1",
  closed: "The demo account isn't open any more. Book a demo and someone from RENUABL will show you round.",
  busy: "Please try again shortly.",
  /** The bar over every page of a demo account. */
  bar: "You're in a demo of RENUABL Business. The customers and deals are made up, and nothing is sent to anyone.",
  barLink: "About RENUABL",
} as const;
