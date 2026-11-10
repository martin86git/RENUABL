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
  termsInUse,
  VALID_DAYS,
  type BankDetails,
  type BrandImage,
  type BrandKit,
  type ChartStyle,
  type FontId,
  type GstMode,
  type PaletteId,
  type TemplateId,
  type TermsFile,
} from "./brand";
import type { Cleaned, Customer, DetailKey, Job } from "./crm";
import { systemDetails } from "./deal";
import type { DepositStatus } from "./deposit";
import { workspaceCatalogue, type Workspace } from "./pricing";
import { panelCatalogue } from "./catalogue";
import {
  costSystem,
  designFinance,
  editedLines,
  undecidedLines,
  variationsOf,
  lineKey,
  repriced,
  sharedHome,
  solarVicFor,
  solarVicNote,
  stcValue,
  type CostGroup,
  type CostLine,
  type DesignExtras,
  type SolarVic,
} from "./quote";
import {
  DESIGN_GOALS,
  designPanels,
  designSummary,
  faceFacing,
  facePanels,
  monthlyProduction,
  panelFacing,
  panelOf,
  type DesignGoal,
  type DesignSet,
  type RoofDesign,
} from "./roof-design";
import { NETCC_INFORMATION, STANDARD_TERMS_VERSION, fillTerms, type TermsSection } from "./standard-terms";
import { YIELD_PER_KW_DAY, batteryKwhOf, shiftingKwhOf, systemSpecOf } from "./system";
import { TILT } from "./tilt";

// ---------------------------------------------------------------------------
// What the customer sees
// ---------------------------------------------------------------------------

export interface ProposalView {
  version: number;
  publishedAt: string;
  /** The last day the price stands. */
  validUntil: ISODate;
  template: TemplateId;
  /** The page's colours and type, and how the year's output is drawn (`chart`: bars when left out, as on proposals published before it could be chosen). */
  theme: { palette: PaletteId; primary: string; accent: string; font?: FontId; chart?: ChartStyle };
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
  /**
   * An indicative proposal: the systems worked out from the roof from above and the bill, sent to a new lead for
   * their thoughts before anyone visits. It can't be accepted: the customer tells the business which suits them and
   * leaves notes, the home is visited to confirm, and a final proposal follows. Left out on a final proposal.
   */
  indicative?: boolean;
  system: {
    panels: number;
    kw: number;
    /** What the battery holds in all, kWh: 0 with none. */
    batteryKwh: number;
    /**
     * Of that, what carries the home's evenings, kWh: all of it, less a module held back for blackouts. For the
     * home's day. Left out on a proposal published before the day was shown (the whole battery is then taken).
     */
    eveningKwh?: number;
    /** The system in lines, as the deal shows it: "PV panel", "Inverter", "Roof type". */
    details: { label: string; value: string }[];
  };
  roof: {
    lat: number;
    lng: number;
    /** Each panel's four corners, in metres east and south of the middle of the roof's picture: x1, y1, … x4, y4. */
    panels: number[][];
    /**
     * Each panel's tilt (degrees up from flat) and the way it faces (degrees clockwise from north), in the same
     * order, for the home's day. Left out on a proposal published before the day was shown.
     */
    aspects?: number[][];
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
    /** Dollars asked up front, to the cent, worked out from what the customer pays (`price.youPay`). Null with no deposit. */
    deposit: number | null;
    /** Each share of what the customer pays, with what it comes to. They add up to `price.youPay`. */
    milestones: { name: string; percent: number; amount: number }[];
    /** The account to pay into. Shown only on this business's own proposals. */
    bank: BankDetails | null;
    /** The business's own card payment page, when it has given one. Left out on a proposal published before it could. */
    payLink?: string | null;
    warranty: { years: number | null; words: string } | null;
    /** How long installation usually takes from going ahead ("3 to 4 weeks"): an estimate. */
    installTime: string | null;
  };
  /**
   * The standard terms and conditions this proposal was sent with, when the business has them switched on: the
   * wording as it stood (so a proposal already sent keeps its own), its version, and the consumer information.
   * Null when they were off. Left out on a proposal published before there were any.
   */
  contract?: {
    version: string;
    netcc: { heading: string; intro: string; guides: string[]; url: string; seller: string };
    terms: TermsSection[];
  } | null;
  /**
   * The business's own terms and conditions, when it sends its own instead of ours: the PDF it uploaded, by id and
   * name, served only from this proposal's link. Left out (or null) otherwise.
   */
  ownTerms?: TermsFile | null;
  /** The blocks to show, in order. Left out on a proposal published before they could be arranged (`USUAL_BLOCKS`). */
  blocks?: ViewBlock[];
  /**
   * The systems the customer chooses between, when the roof has two or more goal designs (Quickest payback, Maximum
   * return, Maximum independence), in that order; the recommended one is what the rest of the view shows. Left out
   * with one design. The customer picks one when going ahead (`viewForChoice`).
   */
  options?: ProposalOption[];
  /**
   * The costs decided on each job that were left out, in the customer's words (`variationsOf`), shown with
   * `VARIATIONS_NOTE`: they may apply, found at the site inspection. Absent on proposals published before 1 Nov 2026.
   */
  variations?: string[];
}

/**
 * Which option a customer picks: a "Design it for me" goal, or one of the roof's designs by its place (`design-2`) when
 * the business offered designs by hand. Kept as `accepted_option`.
 */
export type OptionKey = DesignGoal | `design-${number}`;

/** One system a customer can choose, with everything that differs between them. Estimates throughout, as the rest. */
export interface ProposalOption {
  goal: OptionKey;
  name: string;
  promise: string;
  recommended: boolean;
  /** A battery module held back to keep chosen circuits on in a blackout. */
  backup: boolean;
  system: ProposalView["system"];
  roofPanels: number[][];
  roofAspects?: number[][];
  price: Pick<ProposalView["price"], "incGst" | "stc" | "youPay" | "solarVic" | "beforeGst" | "gst">;
  production: ProposalView["production"];
  bill: ProposalView["bill"];
  paybackYears: number | null;
  deposit: number | null;
  milestones: { name: string; percent: number; amount: number }[];
  variations?: string[];
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
  /** Each option's own side, when the customer chooses between options (`internalForChoice`). */
  options?: { goal: OptionKey; design: number; cost: number; margin: number; priceExGst: number; lines: ProposalInternal["lines"] }[];
}

/** What each goal is called on a proposal, and what it promises, in the customer's words. Never a figure. */
export const GOAL_WORDS: Record<DesignGoal, { name: string; promise: string }> = {
  payback: { name: "Quickest payback", promise: "The smallest outlay, paying for itself soonest." },
  return: { name: "Maximum return", promise: "Solar and a battery: more back over the years, for a slower payback." },
  independence: {
    name: "Maximum independence",
    promise: "The most of your power from your own roof, with chosen circuits kept on in a blackout.",
  },
};

/**
 * The proposal as the customer sees it with one option chosen: that option's system, roof, price, estimates and
 * deposit in place of the recommended one's. Unchanged without options, or for a goal it doesn't offer.
 */
export function viewForChoice(view: ProposalView, goal: OptionKey | null | undefined): ProposalView {
  const o = view.options?.find((x) => x.goal === goal);
  if (!o) return view;
  return {
    ...view,
    system: o.system,
    roof: { lat: view.roof.lat, lng: view.roof.lng, panels: o.roofPanels, ...(o.roofAspects ? { aspects: o.roofAspects } : {}) },
    production: o.production,
    bill: o.bill,
    price: { ...view.price, ...o.price },
    paybackYears: o.paybackYears,
    ...(o.variations ? { variations: o.variations } : {}),
    ...(view.terms ? { terms: { ...view.terms, deposit: o.deposit, milestones: o.milestones } } : {}),
  };
}

/** The business's side of the option chosen: its lines for the order and the installation allowance. */
export function internalForChoice(internal: ProposalInternal, goal: OptionKey | null | undefined): ProposalInternal {
  const o = internal.options?.find((x) => x.goal === goal);
  return o ? { ...internal, cost: o.cost, margin: o.margin, priceExGst: o.priceExGst, lines: o.lines, design: o.design } : internal;
}

/** The option a customer would be choosing by default: the recommended one. */
export const recommendedGoal = (view: Pick<ProposalView, "options">): OptionKey | null =>
  view.options?.find((o) => o.recommended)?.goal ?? view.options?.[0]?.goal ?? null;

/** The most options a customer is offered on one link (1 Nov 2026, as Primero's): the primary and up to four more. */
export const MAX_PROPOSAL_OPTIONS = 5;

/**
 * The roof's designs that go to the customer as options, in order. When the business has offered designs by hand
 * (`RoofDesign.offer`), the primary first and then those, up to `MAX_PROPOSAL_OPTIONS`, each called by its goal or
 * "Option N" (never the designer's own label, which is theirs); otherwise the goal designs from "Design it for me",
 * when there are two or more. None with fewer than two.
 */
export function offeredDesigns(
  set: Pick<DesignSet, "designs" | "primary">,
): { goal: OptionKey; at: number; name: string; promise: string }[] {
  if (set.designs.some((d, i) => d.offer && i !== set.primary)) {
    const picked = [set.primary, ...set.designs.flatMap((d, i) => (d.offer && i !== set.primary ? [i] : []))].slice(
      0,
      MAX_PROPOSAL_OPTIONS,
    );
    return picked.map((at, n) => {
      const goal = set.designs[at].goal;
      return {
        goal: `design-${at}` as OptionKey,
        at,
        name: goal ? GOAL_WORDS[goal].name : `Option ${n + 1}`,
        promise: goal ? GOAL_WORDS[goal].promise : "",
      };
    });
  }
  const goals = DESIGN_GOALS.flatMap((goal) => {
    const at = set.designs.findIndex((d) => d.goal === goal);
    return at >= 0 ? [{ goal: goal as OptionKey, at, name: GOAL_WORDS[goal].name, promise: GOAL_WORDS[goal].promise }] : [];
  });
  return goals.length >= 2 ? goals : [];
}

/** The offered design marked recommended, else the primary. */
export function recommendedAt(set: Pick<DesignSet, "designs" | "primary">, offered: readonly { at: number }[]): number {
  return offered.find((o) => set.designs[o.at].recommended)?.at ?? set.primary;
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
export const ACCEPT_WITH_TERMS = "I'd like to go ahead with this proposal, and I accept the terms and conditions set out with it.";
export const ACCEPT_WITH_CONDITIONS = "I'd like to go ahead with this proposal, and I accept the conditions set out with it.";
// An indicative proposal: what it is, how the business works from it, and what the customer does with it in place of
// going ahead. Never a promise: everything on it is confirmed at the site visit.
export const INDICATIVE_LABEL = "Indicative proposal";
export const INDICATIVE_INTRO =
  "These systems are worked out from your roof seen from above and your power bill. We'd love your thoughts before we visit.";
export const INDICATIVE_PRICE_NOTE = "An indicative price. We confirm it, and the design, when we visit your home.";
export const INDICATIVE_STEPS: readonly { name: string; words: string }[] = [
  { name: "Indicative proposal", words: "We design your system from above and price it from your bill. This is that step." },
  { name: "Site visit", words: "We visit your home to check the roof, the switchboard and where everything goes." },
  { name: "Final proposal", words: "We send the final design and price. Nothing is agreed until you accept it." },
];
export const INDICATIVE_NOT_ACCEPTABLE =
  "This is an indicative proposal, so it can't be accepted yet. Tell us what you think in the chat and we'll arrange a visit.";
export const FEEDBACK_MISSING = "Choose a system, or write a note, first.";

/**
 * The customer's thoughts on an indicative proposal as one message in the chat: the system that suits them best (by
 * its name on the proposal) and their note. Empty with neither.
 */
export function feedbackMessage(choice: { name: string } | null, note: string): string {
  const words = note.trim();
  return [choice ? `${choice.name} suits us best.` : "", words].filter(Boolean).join("\n\n");
}

/** When the business sends its own terms: they are named, so the customer knows which document they accept. */
export const acceptWithOwnTerms = (business: string) =>
  `I'd like to go ahead with this proposal, and I accept ${business}'s terms and conditions attached to it.`;

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

/**
 * The deposit in dollars, to the cent: a share of what the customer pays, or
 * the set amount, and never more than the whole. `youPay` is the price after
 * the federal rebate and without any Solar Victoria rebate (what stands if
 * that isn't approved). Null with none.
 */
export function depositOf(deposit: BrandKit["deposit"], youPay: number): number | null {
  if (deposit.kind === "none") return null;
  // Worked in cents, so 12.5% of $11,455 is $1,431.88 and never a figure with a long tail.
  const cents = deposit.kind === "percent" ? Math.round(youPay * deposit.amount) : Math.round(deposit.amount * 100);
  return Math.min(Math.max(0, cents), Math.round(youPay * 100)) / 100;
}

/**
 * Each payment milestone with what it comes to, to the cent (as the deposit
 * is, so a 20% deposit and a 20% first milestone are the same figure). The
 * last takes up the rounding, so they add up to exactly what the customer pays.
 */
export function milestoneAmounts(milestones: BrandKit["milestones"], youPay: number): { name: string; percent: number; amount: number }[] {
  let left = Math.round(youPay * 100);
  return milestones.map((m, i) => {
    const cents = i === milestones.length - 1 ? left : Math.round(youPay * m.percent);
    left -= cents;
    return { name: m.name, percent: m.percent, amount: cents / 100 };
  });
}

// What the templates say beside the business's own terms. The business's words are its own; these keep them honest.
export const TIMING_NOTE = "An estimate of how long installation usually takes from the day you go ahead. Your date is confirmed with you.";
/** Beside a business's workmanship warranty: whose it is. It is the business's own promise to its own customer, in its own words. */
export const warrantyNote = (business: string) =>
  `This is ${business}'s own warranty on its workmanship. The products carry their manufacturers' warranties.`;
export const BANK_NOTE = "Check these details with us by phone before you pay, if you have any doubt about a message asking for payment.";

/** The line a customer ticks to go ahead: it names what they accept with the proposal, when there is anything. */
export function acceptLine(view: Pick<ProposalView, "contract" | "business" | "ownTerms">): string {
  if (view.contract) return ACCEPT_WITH_TERMS;
  if (view.ownTerms) return acceptWithOwnTerms(view.business.name);
  return view.business.conditions ? ACCEPT_WITH_CONDITIONS : ACCEPT_LINE;
}

/**
 * The "Details" at the head of the terms and conditions: who the agreement
 * is between, the property, the system, the price and what was promised
 * about time and warranty, and which document comes first if they disagree
 * (as clause 1 of the terms says). Built from the proposal's own figures,
 * never typed: it can't say something the proposal doesn't.
 */
export function contractDetails(view: ProposalView): { rows: { label: string; value: string }[]; documents: string[] } {
  const b = view.business;
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
  const seller = [b.name, b.abn && `ABN ${b.abn}`, b.address, b.phone, b.email].filter(Boolean).join(", ");
  const rows = [
    { label: "Customer", value: view.customer.name },
    { label: "Seller", value: seller },
    { label: "Property", value: view.customer.address },
    { label: "System", value: view.system.details.map((d) => `${d.label}: ${d.value}`).join("; ") },
    { label: "System price, including GST", value: money(view.price.incGst) },
    { label: "Less the federal rebate (STCs), an estimate until installation", value: money(view.price.stc) },
    { label: "Price payable", value: money(view.price.youPay) },
    ...(view.terms?.installTime ? [{ label: "Installation time (an estimate)", value: view.terms.installTime }] : []),
    ...(view.terms?.warranty?.years
      ? [{ label: "Workmanship warranty", value: `${view.terms.warranty.years} ${view.terms.warranty.years === 1 ? "year" : "years"}` }]
      : []),
    {
      label: "The price stands until",
      value: new Date(`${view.validUntil}T00:00:00Z`).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    },
  ].filter((row) => row.value);
  return {
    rows,
    documents: [
      ...(b.conditions ? ["The special conditions in this proposal"] : []),
      "This proposal (the system, the price and the payment terms)",
      "These terms and conditions",
    ],
  };
}

/** A saving as it is shown: rounded down to ten dollars, never up, never below nothing. */
export function shownSaving(billNow: number, billAfter: number): number {
  return Math.max(0, Math.floor((billNow - billAfter) / 10) * 10);
}

const INCLUDED: Partial<Record<CostGroup, string>> = {
  Panels: "Solar panels",
  Inverters: "Inverter",
  Battery: "Battery",
  "EV charger": "EV charger",
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
  "evCharger",
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
  /** Sent as an indicative proposal, for the customer's thoughts before a site visit (`ProposalView.indicative`). */
  indicative: boolean;
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
export function buildProposal(given: ProposalInputs): Built {
  // Every design priced with the primary's home (phase, storeys, roof) and its costs decided on each job (8 Nov 2026,
  // Martin: decided once; a design saved before that rule still held its own answers, undecided, and stopped the proposal).
  const input: ProposalInputs = {
    ...given,
    project: {
      ...given.project,
      extras: { ...given.project.extras, quotes: sharedHome(given.project.extras.quotes, given.project.set.primary) },
    },
  };
  const { project, brand } = input;
  const index = project.set.primary;
  const design = project.set.designs[index];
  const form = project.extras.quotes[index].form;

  const main = workOut(input, index);
  if (!main.ok) return { ok: false, problems: main.problems };
  const { spec, lines, totals, costing, stc, youPay, solarVic, monthlyKwh, finance, saving, b, entered, selfUseShare, variations } = main;
  const summary = designSummary(design, YIELD_PER_KW_DAY);
  const batteryKwh = batteryKwhOf(design);

  // The options the customer chooses between (`offeredDesigns`): the designs offered by hand, else the goal designs.
  // Every one is priced in full, or nothing is sent.
  const offered = offeredDesigns(project.set);
  const recommended = recommendedAt(project.set, offered);
  const worked = offered.map((g) => ({ ...g, out: workOut(input, g.at) }));
  const failing = worked.filter((w) => !w.out.ok);
  if (failing.length)
    return {
      ok: false,
      problems: failing.flatMap((w) => (w.out.ok ? [] : w.out.problems.map((p) => `${w.name}: ${p}`))),
    };

  const image = (kind: BrandImage["kind"]) => input.images.find((i) => i.kind === kind) ?? null;
  const groups = new Set(lines.map((l) => l.group));

  const view: ProposalView = {
    version: input.version,
    publishedAt: input.now,
    validUntil: addDays(input.today, input.choice.validDays),
    template: input.choice.template,
    theme: { palette: brand.palette, primary: brand.primary, accent: brand.accent, font: brand.font, chart: brand.chart },
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
    ...(input.choice.indicative ? { indicative: true } : {}),
    system: {
      panels: spec.panels,
      kw: summary.kw,
      batteryKwh,
      eveningKwh: shiftingKwhOf(design),
      details: systemDetails(design, form, input.job.details)
        .filter((d) => SHOWN_DETAILS.includes(d.key) && d.value)
        .map((d) => ({ label: d.label, value: d.value as string })),
    },
    roof: {
      lat: project.lat,
      lng: project.lng,
      panels: roofPanels(design),
      aspects: roofAspects(design),
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
      payLink: brand.payLink || null,
      warranty: brand.warrantyYears !== null || brand.warrantyWords ? { years: brand.warrantyYears, words: brand.warrantyWords } : null,
      installTime: brand.installTime ? (INSTALL_TIMES.find((t) => t.id === brand.installTime)?.label ?? null) : null,
    },
    ownTerms: termsInUse(brand) === "own" && brand.ownTerms ? { ...brand.ownTerms } : null,
    contract:
      termsInUse(brand) === "standard"
        ? {
            version: STANDARD_TERMS_VERSION,
            netcc: {
              heading: NETCC_INFORMATION.heading,
              intro: NETCC_INFORMATION.intro,
              guides: [...NETCC_INFORMATION.guides],
              url: NETCC_INFORMATION.url,
              // Only a business that says it is an Approved Seller is described as one.
              seller: brand.netccApproved
                ? NETCC_INFORMATION.approvedSeller.replaceAll("{seller}", brand.name)
                : NETCC_INFORMATION.notStated,
            },
            terms: fillTerms({ seller: brand.name, customer: input.customer.name }),
          }
        : null,
    ...(variations.length ? { variations } : {}),
    blocks: brand.blocks
      .filter((block) => block.on)
      .map((block) => ({
        id: block.id,
        heading: block.heading,
        words: block.words,
        image: (block.image && input.images.find((i) => i.id === block.image && i.kind === "block")) || null,
      })),
    ...(worked.length
      ? {
          options: worked.map(({ goal, at, out, name, promise }) => {
            if (!out.ok) throw new Error("unreachable");
            const d = project.set.designs[at];
            const quoteForm = project.extras.quotes[at].form;
            return {
              goal,
              name,
              promise,
              recommended: at === recommended,
              backup: Boolean(d.battery?.backup),
              system: {
                panels: out.spec.panels,
                kw: designSummary(d, YIELD_PER_KW_DAY).kw,
                batteryKwh: batteryKwhOf(d),
                eveningKwh: shiftingKwhOf(d),
                details: systemDetails(d, quoteForm, input.job.details)
                  .filter((x) => SHOWN_DETAILS.includes(x.key) && x.value)
                  .map((x) => ({ label: x.label, value: x.value as string })),
              },
              roofPanels: roofPanels(d),
              roofAspects: roofAspects(d),
              price: {
                incGst: out.totals.priceIncGst,
                stc: out.stc,
                youPay: out.youPay,
                solarVic: out.solarVic ? { ...out.solarVic, note: solarVicNote(out.solarVic) } : null,
                ...(brand.gst === "excluded" ? splitGst(out.totals.priceIncGst) : {}),
              },
              production: out.monthlyKwh ? { monthlyKwh: out.monthlyKwh, yearKwh: out.monthlyKwh.reduce((n, m) => n + m, 0) } : null,
              bill: out.finance
                ? {
                    now: out.finance.billNow,
                    after: out.finance.billAfter,
                    saving: out.saving,
                    dailyKwh: out.finance.dailyKwh,
                    selfReliance: Math.round(out.finance.selfReliance * 100) / 100,
                    assumed: { interval: b.interval, ...entered, selfUseShare },
                  }
                : null,
              paybackYears: out.saving > 0 ? Math.round((out.youPay / out.saving) * 10) / 10 : null,
              deposit: depositOf(brand.deposit, out.youPay),
              milestones: milestoneAmounts(brand.milestones, out.youPay),
              variations: out.variations,
            };
          }),
        }
      : {}),
  };
  const internal: ProposalInternal = {
    cost: totals.cost,
    margin: costing.margin,
    priceExGst: totals.priceExGst,
    lines: internalLines(lines),
    projectVersion: project.version,
    design: index,
    ...(worked.length
      ? {
          options: worked.map(({ goal, at, out }) => {
            if (!out.ok) throw new Error("unreachable");
            return {
              goal,
              design: at,
              cost: out.totals.cost,
              margin: out.costing.margin,
              priceExGst: out.totals.priceExGst,
              lines: internalLines(out.lines),
            };
          }),
        }
      : {}),
  };
  return { ok: true, view, internal };
}

/** A quote's lines as kept on the business's side: a product's code and how many where the line is one product (for the order). */
const internalLines = (lines: readonly CostLine[]): ProposalInternal["lines"] =>
  lines.map((l) => ({
    group: l.group,
    label: l.label,
    amount: l.amount,
    ...(l.qty !== undefined ? { qty: l.qty } : {}),
    ...(l.sku ? { sku: l.sku } : {}),
  }));

/** Each panel's four corners, in metres from the middle of the roof's picture, to the centimetre. */
const roofPanels = (design: RoofDesign) =>
  designPanels(design).map((p) => p.corners.flatMap((c) => [Math.round(c.x * 100) / 100, Math.round(c.y * 100) / 100]));

/** Each panel's tilt and the way it faces, in the order of `roofPanels`. */
const roofAspects = (design: RoofDesign) => [
  ...design.faces.flatMap((face) => facePanels(face, panelOf(design)).map(() => [face.tilt ?? TILT.roof, Math.round(faceFacing(face))])),
  ...(design.loose ?? []).map((p) => [p.tilt ?? TILT.roof, Math.round(panelFacing(p))]),
];

/**
 * One of the roof's designs read and priced exactly as the designer's quote
 * builder does (`systemSpecOf`, `costSystem`, the hand changes, `stcValue`),
 * with the bill's estimates; or what stops it being sent.
 */
function workOut(input: ProposalInputs, at: number) {
  const { project, workspace } = input;
  const design = project.set.designs[at];
  const quote = project.extras.quotes[at];
  const form = quote.form;
  const catalogue = workspaceCatalogue(workspace).panels ?? panelCatalogue();
  const spec = systemSpecOf(design, catalogue[0]);
  // What the battery shifts into the evening: a module held for blackouts doesn't count towards the saving.
  const batteryKwh = shiftingKwhOf(design);
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
  const undecided = undecidedLines(costing.lines, quote.edits);
  if (spec.panels === 0 && !spec.battery) problems.push(NOTHING_DRAWN);
  else {
    if (missing) problems.push(missingCosts(missing));
    if (undecided.length) problems.push(undecidedCosts(undecided.map((l) => l.label)));
    if (!(youPay > 0)) problems.push(NO_PRICE);
  }
  if (problems.length) return { ok: false as const, problems };

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
  const variations = variationsOf(costing.lines, quote.edits);
  return {
    ok: true as const,
    spec,
    costing,
    lines,
    totals,
    stc,
    youPay,
    solarVic,
    monthlyKwh,
    finance,
    saving,
    b,
    entered,
    selfUseShare,
    variations,
  };
}

/** The line over the costs that may apply, for the customer's page and the PDF. */
export { VARIATIONS_NOTE } from "./quote";

/** What stops a proposal while costs decided on each job haven't been included or left out. */
export const undecidedCosts = (labels: readonly string[]) =>
  `Decide on ${labels
    .join(", ")
    .replace(/, ([^,]*)$/, " and $1")
    .toLowerCase()} in the quote first: include each, or leave it out.`;

// ---------------------------------------------------------------------------
// Choices, links and what a customer sends back
// ---------------------------------------------------------------------------

/**
 * What was chosen when publishing, as sent: a template we have, a validity we offer, a short note, and whether it is
 * indicative. Only an explicit true or false moves that; otherwise it is `indicative`, which the server works out from
 * the deal's stage (a lead or a designed roof goes out indicative to start).
 */
export function cleanChoice(raw: unknown, brand: Pick<BrandKit, "template" | "validDays">, indicative = false): ProposalChoice {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    indicative: typeof r.indicative === "boolean" ? r.indicative : indicative,
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

// What goes in the customer's history.
export const published = (version: number, indicative = false) =>
  `${indicative ? "Indicative proposal" : "Proposal"} ${version === 1 ? "" : `(version ${version}) `}sent`;
export const PROPOSAL_OPENED = "Proposal opened by the customer";
export const PROPOSAL_WITHDRAWN = "Proposal withdrawn";
export const accepted = (name: string) => `Proposal accepted by ${name}`;
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
  /** Sent as an indicative proposal: for the customer's thoughts, not to accept. */
  indicative: boolean;
  /** The deposit on this version, once it is accepted: what is asked and where it stands. Null with no deposit, or not accepted. */
  deposit: DepositStatus | null;
}
