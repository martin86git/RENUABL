/**
 * A proposal: what a business sends its customer once a roof is designed and
 * priced. Pure.
 *
 * **A proposal is published, not live.** Publishing works everything out on
 * the server from what is saved (the job's roof design, the bill, the quote's
 * settings and hand changes, the business's price lists and branding) and
 * keeps a fixed copy. The customer then sees that copy at a private link,
 * whatever is changed afterwards; publishing again makes the next version.
 *
 * **Two halves, kept apart.** `ProposalView` is everything the customer may
 * see: the system, the price they pay, the rebate, the estimates, the
 * business's branding. `ProposalInternal` is the business's own record: cost
 * lines, margin, the price before GST. The view is built without ever
 * holding a cost, so nothing has to be remembered to be taken out, and
 * `COST_WORDS` names what a test checks it never contains.
 *
 * Wording that holds whatever the business writes: a saving or an output is
 * an estimate and says so, a saving is rounded down, nothing is guaranteed.
 */
import type { ISODate } from "../types";
import type { RebateRates } from "../rebates";
import type { ViewBlock } from "./blocks";
import {
  INSTALL_TIMES,
  TEMPLATES,
  VALID_DAYS,
  type BankDetails,
  type BrandImage,
  type BrandKit,
  type FontId,
  type GstMode,
  type PaletteId,
  type TemplateId,
} from "./brand";
import type { Cleaned, Customer, DetailKey, Job } from "./crm";
import { systemDetails } from "./deal";
import { workspaceCatalogue, type Workspace } from "./pricing";
import { panelCatalogue } from "./catalogue";
import {
  costSystem,
  designFinance,
  editedLines,
  lineKey,
  repriced,
  solarVicFor,
  solarVicNote,
  stcValue,
  type CostGroup,
  type DesignExtras,
  type SolarVic,
} from "./quote";
import { designPanels, designSummary, monthlyProduction, type DesignSet } from "./roof-design";
import { YIELD_PER_KW_DAY, batteryKwhOf, systemSpecOf } from "./system";

// ---------------------------------------------------------------------------
// What the customer sees
// ---------------------------------------------------------------------------

export interface ProposalView {
  version: number;
  publishedAt: string;
  /** The last day the price stands. */
  validUntil: ISODate;
  template: TemplateId;
  theme: { palette: PaletteId; primary: string; accent: string; font?: FontId };
  business: {
    name: string;
    tagline: string;
    phone: string;
    email: string;
    website: string;
    address: string;
    abn: string;
    licences: string[];
    about: string;
    points: string[];
    extra: string;
    conditions: string;
    logo: BrandImage | null;
    cover: BrandImage | null;
    photos: BrandImage[];
  };
  customer: { name: string; address: string };
  /** What the job is called: "Solar and battery". */
  title: string;
  /** A few words from the business to this customer. */
  note: string;
  system: {
    panels: number;
    kw: number;
    /** What the battery holds in all, kWh: 0 with none. */
    batteryKwh: number;
    /** The system in lines, as the deal shows it: "PV panel", "Inverter", "Roof type". */
    details: { label: string; value: string }[];
  };
  roof: {
    lat: number;
    lng: number;
    /** Each panel's four corners, in metres east and south of the middle of the roof's picture: x1, y1, … x4, y4. */
    panels: number[][];
  };
  /** What the system is estimated to make, kWh. Null where we have no sunshine record for the home's state. */
  production: { monthlyKwh: number[]; yearKwh: number } | null;
  /** From the customer's own bill, when one was entered. Estimates; the saving is rounded down. */
  bill: {
    now: number;
    after: number;
    saving: number;
    dailyKwh: number;
    /** The share of the home's power the system is estimated to supply, 0 to 1. */
    selfReliance: number;
    /** The bill as it was entered, so the estimate is never shown without what it rests on. */
    assumed: { interval: string; amount: number; supplyPerDay: number; rate: number; feedIn: number; selfUseShare: number };
  } | null;
  price: {
    /** GST included, before the federal rebate. */
    incGst: number;
    /** The federal rebate (STCs) taken off the price. An estimate until the system is installed. */
    stc: number;
    youPay: number;
    /**
     * The Solar Victoria rebate (and interest-free loan), when the business put them on the quote: what the customer
     * pays if Solar Victoria approves them, with the words that must go beside it. `youPay` stays the price without
     * them, which is what stands if they are not approved.
     */
    solarVic: (SolarVic & { note: string }) | null;
    /** What the price covers, in plain words. Never an amount. */
    includes: string[];
    /**
     * How the business writes its prices: as one figure with GST in it, or broken out. Broken out, `beforeGst` and
     * `gst` are the two parts of `incGst`; otherwise they are left out. (A proposal published before this could be
     * chosen has neither.)
     */
    gstShown?: GstMode;
    beforeGst?: number;
    gst?: number;
  };
  /** Years for the estimated saving to add up to the price, to one decimal. Null without a saving. */
  paybackYears: number | null;
  /**
   * The business's own terms, as it has set them. Its statements to its customer, not RENUABL's: the warranty in
   * particular is the business's own workmanship warranty, in its own words.
   */
  terms?: {
    /** Dollars asked up front, worked out from what the customer pays. Null with no deposit. */
    deposit: number | null;
    /** Each share of what the customer pays, with what it comes to. They add up to `price.youPay`. */
    milestones: { name: string; percent: number; amount: number }[];
    /** The account to pay into. Shown only on this business's own proposals. */
    bank: BankDetails | null;
    warranty: { years: number | null; words: string } | null;
    /** How long installation usually takes from going ahead ("3 to 4 weeks"): an estimate. */
    installTime: string | null;
  };
  /** The blocks to show, in order. Left out on a proposal published before they could be arranged (`USUAL_BLOCKS`). */
  blocks?: ViewBlock[];
}

/** The business's own record of a published proposal. Never sent to the customer. */
export interface ProposalInternal {
  cost: number;
  margin: number;
  priceExGst: number;
  lines: { group: CostGroup; label: string; amount: number }[];
  /** The saved roof's version it was worked out from. */
  projectVersion: number;
  /** Which of the roof's designs it is. */
  design: number;
}

/**
 * Words that belong to the business's side of a quote. A test builds a
 * proposal and checks none of these appears anywhere in what the customer is
 * sent, as a field's name at any depth.
 */
export const COST_WORDS = [
  "cost",
  "margin",
  "commission",
  "sku",
  "priceExGst",
  "hardware",
  "install",
  "lines",
  "edits",
  "internal",
] as const;

/** The sections of a proposal, in the order every template shows them. */
export const PROPOSAL_SECTIONS = ["cover", "system", "roof", "production", "bill", "price", "about", "accept"] as const;

// Wording the templates always carry, whatever the business has written.
export const ESTIMATE_NOTE =
  "These figures are estimates worked out from the roof's layout, a long-run record of sunshine and the bill you gave us. They leave out shade, and what you save will depend on how and when you use power and on future prices.";
export const PRODUCTION_NOTE = "An estimate from a long-run sunshine record for each panel's tilt and direction. It leaves out shade.";
export const SAVING_NOTE = "An estimate, rounded down. Not a promise of what you will save.";
export const STC_NOTE =
  "The federal rebate (small-scale technology certificates) is claimed for you and taken off the price. It is an estimate until the system is installed.";
export const NO_SUNSHINE_NOTE = "We don't yet estimate output or savings for homes outside Victoria.";
export const ROOF_NOTE = "The layout is a design. It is checked on site before anything is installed.";
export const ACCEPT_LINE = "I'd like to go ahead with this proposal.";
export const ACCEPT_WITH_CONDITIONS = "I'd like to go ahead with this proposal, and I accept the conditions set out with it.";

/** Victorian postcodes: the only state the designer's sunshine record covers so far. */
export function inVictoria(postcode: string): boolean {
  const n = /^\d{4}$/.test(postcode) ? Number(postcode) : 0;
  return (n >= 3000 && n <= 3999) || (n >= 8000 && n <= 8999);
}

/** A day so many days after another, both YYYY-MM-DD. */
export function addDays(day: ISODate, days: number): ISODate {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** A price with GST in it, as its two parts: what it is before GST, and the GST. They add back up to it exactly. */
export function splitGst(incGst: number): { beforeGst: number; gst: number } {
  const beforeGst = Math.round(incGst / 1.1);
  return { beforeGst, gst: incGst - beforeGst };
}

/** The deposit in dollars: a share of what the customer pays, or the set amount, and never more than the whole. Null with none. */
export function depositOf(deposit: BrandKit["deposit"], youPay: number): number | null {
  if (deposit.kind === "none") return null;
  const amount = deposit.kind === "percent" ? Math.round((youPay * deposit.amount) / 100) : deposit.amount;
  return Math.min(Math.max(0, amount), youPay);
}

/**
 * Each payment milestone with what it comes to, in whole dollars. The last
 * takes up the rounding, so they add up to exactly what the customer pays.
 */
export function milestoneAmounts(milestones: BrandKit["milestones"], youPay: number): { name: string; percent: number; amount: number }[] {
  let left = youPay;
  return milestones.map((m, i) => {
    const amount = i === milestones.length - 1 ? left : Math.round((youPay * m.percent) / 100);
    left -= amount;
    return { name: m.name, percent: m.percent, amount };
  });
}

// What the templates say beside the business's own terms. The business's words are its own; these keep them honest.
export const TIMING_NOTE = "An estimate of how long installation usually takes from the day you go ahead. Your date is confirmed with you.";
/** Beside a business's workmanship warranty: whose it is. It is the business's own promise to its own customer, in its own words. */
export const warrantyNote = (business: string) =>
  `This is ${business}'s own warranty on its workmanship. The products carry their manufacturers' warranties.`;
export const BANK_NOTE = "Check these details with us by phone before you pay, if you have any doubt about a message asking for payment.";

/** A saving as it is shown: rounded down to ten dollars, never up, never below nothing. */
export function shownSaving(billNow: number, billAfter: number): number {
  return Math.max(0, Math.floor((billNow - billAfter) / 10) * 10);
}

const INCLUDED: Partial<Record<CostGroup, string>> = {
  Panels: "Solar panels",
  Inverters: "Inverter",
  Battery: "Battery",
  Racking: "Roof mounting",
  Electrical: "Electrical parts and metering",
  Installation: "Installation",
};

/** The lines of a deal's system details a customer is shown. The rest (NMI, site access, switchboard) are the business's working notes. */
const SHOWN_DETAILS: readonly DetailKey[] = [
  "systemType",
  "systemSize",
  "panel",
  "panelQty",
  "inverter",
  "inverterQty",
  "additionalInverter",
  "inverterCapacity",
  "battery",
  "batteryQty",
  "batteryStorage",
  "roofType",
  "storeys",
  "phases",
];

// ---------------------------------------------------------------------------
// Working a proposal out
// ---------------------------------------------------------------------------

export interface ProposalInputs {
  /** The moment of publishing, and that day in the market's own time zone. */
  now: string;
  today: ISODate;
  version: number;
  job: Pick<Job, "title" | "details">;
  customer: Pick<Customer, "name" | "address">;
  /** The job's saved roof. */
  project: { address: string; lat: number; lng: number; version: number; set: DesignSet; extras: DesignExtras };
  workspace: Workspace;
  rates: RebateRates;
  brand: BrandKit;
  images: readonly BrandImage[];
  choice: ProposalChoice;
}

/** What the person publishing chooses. Everything else is worked out. */
export interface ProposalChoice {
  template: TemplateId;
  validDays: (typeof VALID_DAYS)[number];
  note: string;
}

export const NOTHING_DRAWN = "There are no panels and no battery on the design yet. Draw the system first.";
export const NO_PRICE = "The quote comes to nothing. Check the design and your prices.";
export const missingCosts = (n: number) =>
  `${n} ${n === 1 ? "line on the quote has" : "lines on the quote have"} no cost on file. Give ${n === 1 ? "it" : "each"} a cost in the quote builder (or take it out) before sending a price to a customer.`;

export type Built = { ok: true; view: ProposalView; internal: ProposalInternal } | { ok: false; problems: string[] };

/**
 * A proposal worked out from what is saved: the roof's primary design, read
 * and priced exactly as the designer's quote builder does (`systemSpecOf`,
 * `costSystem`, the hand changes, `stcValue`), with the bill's estimates.
 * Nothing here is taken from a browser. It answers with what stops it being
 * sent, when something does: a customer is never sent a price with a hole in it.
 */
export function buildProposal(input: ProposalInputs): Built {
  const { project, workspace, brand } = input;
  const index = project.set.primary;
  const design = project.set.designs[index];
  const quote = project.extras.quotes[index];
  const form = quote.form;

  const catalogue = workspaceCatalogue(workspace).panels ?? panelCatalogue();
  const spec = systemSpecOf(design, catalogue[0]);
  const summary = designSummary(design, YIELD_PER_KW_DAY);
  const batteryKwh = batteryKwhOf(design);

  const costing = costSystem(spec, form, workspace);
  const lines = editedLines(costing.lines, quote.edits);
  const changed = costing.lines.some((l) => quote.edits[lineKey(l)]);
  const totals = changed ? repriced(costing, lines) : costing;
  const missing = lines.filter((l) => l.missing).length;
  const postcode = /^\d{4}$/.test(form.postcode) ? form.postcode : null;
  const stc = stcValue(costing, postcode, input.today, input.rates, workspace.settings.stcPrice);
  const youPay = totals.priceIncGst - stc;
  const solarVic = solarVicFor(form, spec.panels, totals.priceIncGst, stc, input.rates);

  const problems: string[] = [];
  if (spec.panels === 0 && !spec.battery) problems.push(NOTHING_DRAWN);
  else {
    if (missing) problems.push(missingCosts(missing));
    if (!(youPay > 0)) problems.push(NO_PRICE);
  }
  if (problems.length) return { ok: false, problems };

  // Output and savings only where the sunshine record covers the home.
  const covered = postcode !== null && inVictoria(postcode);
  const monthlyKwh = covered && spec.panels > 0 ? monthlyProduction(design, YIELD_PER_KW_DAY) : null;
  const b = project.extras.bill;
  const entered = {
    amount: Number(b.amount) || 0,
    supplyPerDay: Number(b.supplyPerDay) || 0,
    rate: Number(b.rate) || 0,
    feedIn: Number(b.feedIn) || 0,
  };
  const selfUseShare = workspace.settings.bill.selfUseShare;
  const finance = monthlyKwh ? designFinance({ interval: b.interval, ...entered }, monthlyKwh, batteryKwh, selfUseShare) : null;
  const saving = finance ? shownSaving(finance.billNow, finance.billAfter) : 0;

  const image = (kind: BrandImage["kind"]) => input.images.find((i) => i.kind === kind) ?? null;
  const groups = new Set(lines.map((l) => l.group));

  const view: ProposalView = {
    version: input.version,
    publishedAt: input.now,
    validUntil: addDays(input.today, input.choice.validDays),
    template: input.choice.template,
    theme: { palette: brand.palette, primary: brand.primary, accent: brand.accent, font: brand.font },
    business: {
      name: brand.name,
      tagline: brand.tagline,
      phone: brand.phone,
      email: brand.email,
      website: brand.website,
      address: brand.address,
      abn: brand.abn,
      licences: [...brand.licences],
      about: brand.about,
      points: [...brand.points],
      extra: brand.extra,
      conditions: brand.conditions,
      logo: image("logo"),
      cover: image("cover"),
      photos: input.images.filter((i) => i.kind === "photo"),
    },
    customer: { name: input.customer.name, address: project.address || input.customer.address },
    title: input.job.title,
    note: input.choice.note,
    system: {
      panels: spec.panels,
      kw: summary.kw,
      batteryKwh,
      details: systemDetails(design, form, input.job.details)
        .filter((d) => SHOWN_DETAILS.includes(d.key) && d.value)
        .map((d) => ({ label: d.label, value: d.value as string })),
    },
    roof: {
      lat: project.lat,
      lng: project.lng,
      panels: designPanels(design).map((p) => p.corners.flatMap((c) => [Math.round(c.x * 100) / 100, Math.round(c.y * 100) / 100])),
    },
    production: monthlyKwh ? { monthlyKwh, yearKwh: monthlyKwh.reduce((n, m) => n + m, 0) } : null,
    bill: finance
      ? {
          now: finance.billNow,
          after: finance.billAfter,
          saving,
          dailyKwh: finance.dailyKwh,
          selfReliance: Math.round(finance.selfReliance * 100) / 100,
          assumed: { interval: b.interval, ...entered, selfUseShare },
        }
      : null,
    price: {
      incGst: totals.priceIncGst,
      stc,
      youPay,
      solarVic: solarVic ? { ...solarVic, note: solarVicNote(solarVic) } : null,
      includes: [...Object.entries(INCLUDED).flatMap(([group, words]) => (groups.has(group as CostGroup) ? [words] : [])), "GST"],
      gstShown: brand.gst,
      ...(brand.gst === "excluded" ? splitGst(totals.priceIncGst) : {}),
    },
    paybackYears: saving > 0 ? Math.round((youPay / saving) * 10) / 10 : null,
    terms: {
      deposit: depositOf(brand.deposit, youPay),
      milestones: milestoneAmounts(brand.milestones, youPay),
      bank: brand.bank.number ? { ...brand.bank } : null,
      warranty: brand.warrantyYears !== null || brand.warrantyWords ? { years: brand.warrantyYears, words: brand.warrantyWords } : null,
      installTime: brand.installTime ? (INSTALL_TIMES.find((t) => t.id === brand.installTime)?.label ?? null) : null,
    },
    blocks: brand.blocks
      .filter((block) => block.on)
      .map((block) => ({
        id: block.id,
        heading: block.heading,
        words: block.words,
        image: (block.image && input.images.find((i) => i.id === block.image && i.kind === "block")) || null,
      })),
  };
  const internal: ProposalInternal = {
    cost: totals.cost,
    margin: costing.margin,
    priceExGst: totals.priceExGst,
    lines: lines.map((l) => ({ group: l.group, label: l.label, amount: l.amount })),
    projectVersion: project.version,
    design: index,
  };
  return { ok: true, view, internal };
}

// ---------------------------------------------------------------------------
// Choices, links and what a customer sends back
// ---------------------------------------------------------------------------

/** What was chosen when publishing, as sent: a template we have, a validity we offer, a short note. */
export function cleanChoice(raw: unknown, brand: Pick<BrandKit, "template" | "validDays">): ProposalChoice {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    template: TEMPLATES.some((t) => t.id === r.template) ? (r.template as TemplateId) : brand.template,
    validDays: VALID_DAYS.includes(r.validDays as (typeof VALID_DAYS)[number])
      ? (r.validDays as (typeof VALID_DAYS)[number])
      : brand.validDays,
    note:
      typeof r.note === "string"
        ? r.note
            .replace(/\r\n?/g, "\n")
            .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .slice(0, 1200)
        : "",
  };
}

/** A proposal's private link ends in 48 random hex characters. Anything else is not a link we made. */
export function isProposalToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{48}$/.test(token);
}

/** Where a customer opens a proposal. */
export function proposalPath(token: string): string {
  return `/p/${token}`;
}

export type ProposalState = "live" | "lapsed" | "withdrawn" | "accepted";

/**
 * Where a proposal stands for the customer: accepted stays accepted;
 * withdrawn shows nothing of it; past its last day the price has lapsed and
 * it can't be accepted; otherwise it is live.
 */
export function proposalState(p: { withdrawn: boolean; accepted: boolean; validUntil: ISODate }, today: ISODate): ProposalState {
  if (p.withdrawn) return "withdrawn";
  if (p.accepted) return "accepted";
  return today > p.validUntil ? "lapsed" : "live";
}

const oneLine = (raw: unknown, max: number) =>
  typeof raw === "string"
    ? raw
        .replace(/[\u0000-\u001f\u007f<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

export const ACCEPT_NAME_MISSING = "Type your full name to go ahead.";
export const ACCEPT_TICK_MISSING = "Tick the box to say you'd like to go ahead.";

/** A customer going ahead, as sent: their name typed, and the box ticked by them. */
export function cleanAcceptance(raw: unknown): Cleaned<{ name: string }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = oneLine(r.name, 80);
  if (name.length < 2) return { ok: false, message: ACCEPT_NAME_MISSING };
  if (r.agree !== true) return { ok: false, message: ACCEPT_TICK_MISSING };
  return { ok: true, value: { name } };
}

export const QUESTION_MISSING = "Write your question first.";

/** A customer's question, as sent. */
export function cleanQuestion(raw: unknown): Cleaned<{ text: string }> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = oneLine(r.text, 1000);
  return text ? { ok: true, value: { text } } : { ok: false, message: QUESTION_MISSING };
}

/** The most questions kept from one proposal's link. */
export const MAX_QUESTIONS = 20;

// What goes in the customer's history.
export const published = (version: number) => `Proposal ${version === 1 ? "" : `(version ${version}) `}sent`;
export const PROPOSAL_OPENED = "Proposal opened by the customer";
export const PROPOSAL_WITHDRAWN = "Proposal withdrawn";
export const accepted = (name: string) => `Proposal accepted by ${name}`;
export const asked = (text: string) => `Question on the proposal: ${text}`;
/** Who wrote a history line that came through a proposal's link. */
export const FROM_CUSTOMER = "Customer";

// ---------------------------------------------------------------------------
// The proposal as the business's screens list it
// ---------------------------------------------------------------------------

export interface ProposalStatus {
  state: ProposalState;
  /** The path of the private link ("/p/…"): the screen adds the site's address. */
  path: string;
  version: number;
  publishedAt: string;
  validUntil: ISODate;
  template: TemplateId;
  youPay: number;
  openedAt: string | null;
  acceptedAt: string | null;
  acceptedName: string | null;
}
