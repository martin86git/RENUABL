/**
 * For tests only: a roof, a priced workspace and a brand to work a proposal
 * out from. One north face of sixteen panels at the made-up example address,
 * a real wholesaler's price list (the same fixture the quote's tests use),
 * and a made-up business. Nothing here is used by the site.
 */
import { readFileSync } from "node:fs";
import { readXlsxRows } from "@/lib/server/xlsx";
import { VERIFIED_RATES } from "../rebates";
import { defaultBrand, type BrandImage, type BrandKit } from "./brand";
import { DEFAULT_WORKSPACE, readSupplierList, type Workspace } from "./pricing";
import type { ProposalInputs } from "./proposal";
import { cleanExtras, costSystem, defaultBill, editedLines, lineKey, type LineEdit } from "./quote";
import { cleanDesignSet, type DesignSet, type Face } from "./roof-design";
import { systemSpecOf } from "./system";

export const ADDRESS = "8 Example Court, Glen Waverley VIC 3150";
export const PLACE = { lat: -37.87812, lng: 145.16432 };

const face: Face = {
  id: "a",
  points: [
    { x: -5, y: -2 },
    { x: 5, y: -2 },
    { x: 5, y: 2 },
    { x: -5, y: 2 },
  ],
  angle: 0,
  landscape: false,
  setback: 0,
  facing: "N",
  off: [],
};

/** The roof's designs as they are saved: one design, with the panel and inverter chosen from the price list. */
export function sampleSet(withBattery = false): DesignSet {
  const set = cleanDesignSet({
    ...PLACE,
    faces: [face],
    panel: { sku: "JKM475N-48QL6-DB", name: "Jinko 475W", watts: 475, long: 1.762, short: 1.134 },
    inverters: [{ sku: "SGWSG5.0RS", name: "Sungrow 5kW Single Phase 2 MPPT Inverter", kw: 5 }],
    ...(withBattery ? { battery: { sku: "SIG11130001", name: "Sigenergy 8 kWh module", kwh: 8, qty: 2, x: 8, y: 0 } } : {}),
  });
  if (!set) throw new Error("the sample design didn't read");
  return set;
}

export function pricedWorkspace(): Workspace {
  const rows = readXlsxRows(readFileSync("src/lib/domain/__fixtures__/awm-price-list.xlsx"));
  return { ...DEFAULT_WORKSPACE, lists: [readSupplierList("awm.xlsx", rows, "2026-10-10")] };
}

export const sampleBrand = (): BrandKit => ({
  ...defaultBrand("Example Solar"),
  tagline: "Solar for example homes",
  phone: "0491 570 006",
  email: "hello@example.com",
  website: "https://example.com",
  address: "1 Sample Street, Glen Waverley VIC 3150",
  abn: "51824753556",
  licences: ["REC 00000 (example)"],
  about: "A made-up business for tests.",
  points: ["Example point one", "Example point two"],
  extra: "Example payment terms.",
  conditions: "Example conditions of sale.",
  primary: "#0f4c81",
  accent: "#c2410c",
});

export const SAMPLE_IMAGES: BrandImage[] = [
  { id: "img_0000000000000000000000aa", kind: "logo", width: 400, height: 120 },
  { id: "img_0000000000000000000000bb", kind: "cover", width: 1800, height: 800 },
  { id: "img_0000000000000000000000cc", kind: "photo", width: 1600, height: 1200 },
];

/**
 * Everything a proposal is worked out from, with a bill entered and every
 * quote line priced: a line the price list has no cost for is given one by
 * hand, as a business would in the quote builder. `over` changes any of it.
 */
export function sampleInputs(over: Partial<ProposalInputs> & { withBattery?: boolean; unpriced?: boolean } = {}): ProposalInputs {
  const { withBattery, unpriced, ...rest } = over;
  const workspace = pricedWorkspace();
  const set = sampleSet(withBattery);
  const blank = cleanExtras(null, 1, { bill: defaultBill(workspace.settings.bill), postcode: "3150" });
  const costing = costSystem(systemSpecOf(set.designs[0]), blank.quotes[0].form, workspace);
  const edits: Record<string, LineEdit> = {};
  if (!unpriced) for (const line of editedLines(costing.lines, {})) if (line.missing) edits[lineKey(line)] = { amount: 100 };
  const extras = {
    bill: { ...blank.bill, interval: "quarterly" as const, amount: "600" },
    quotes: [{ form: blank.quotes[0].form, edits }],
  };
  return {
    now: "2026-10-12T01:00:00.000Z",
    today: "2026-10-12",
    version: 1,
    job: { title: "Solar", details: {} },
    customer: { name: "Alex Example", address: ADDRESS },
    project: { address: ADDRESS, ...PLACE, version: 3, set, extras },
    workspace,
    rates: VERIFIED_RATES,
    brand: sampleBrand(),
    images: SAMPLE_IMAGES,
    choice: { template: "classic", validDays: 14, note: "Thanks for having us out." },
    ...rest,
  };
}
