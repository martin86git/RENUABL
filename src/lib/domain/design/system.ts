/**
 * The system a design describes, as the quote needs it. Pure. It lives here,
 * and not in the designer's screen, because two things must read a design
 * the same way: the quote beside the drawing, and the proposal the server
 * works out from the saved design. One function, so they can't disagree.
 */
import { yieldPerKw } from "../sunshine";
import type { SystemSpec } from "./quote";
import { arrayCount, designSummary, panelOf, tiltedPanels, type RoofDesign } from "./roof-design";
import { MONTHLY_SUN } from "./tilt";

/** What a kilowatt of panels makes in a day, from the same sunshine record the designer's months use. */
export const YIELD_PER_KW_DAY = yieldPerKw({ annual: MONTHLY_SUN.reduce((n, m) => n + m, 0) / 12 });

/** What `systemSpecOf` reads of a design: the drawing, and the products named on it. */
export type SystemSource = Pick<RoofDesign, "faces" | "loose" | "panel" | "inverters" | "battery">;

/**
 * The system on a drawing: how many panels and which, the inverters and the
 * battery named on it, and what the drawing says about the installation
 * (separate arrays, panels at a tilt). `firstListed` is the first panel on
 * the business's lists, which a design that names no panel is priced with.
 */
export function systemSpecOf(design: SystemSource, firstListed?: { sku: string; name: string }): SystemSpec {
  const size = panelOf(design);
  const tilts = tiltedPanels(design);
  const battery = design.battery;
  return {
    panels: designSummary(design).panels,
    panel: {
      sku: design.panel?.sku ?? firstListed?.sku ?? "",
      name: design.panel?.name ?? firstListed?.name ?? "Panels",
      watts: size.watts,
      short: size.short,
    },
    inverters: (design.inverters ?? []).map((i) => ({ sku: i.sku, name: i.name })),
    battery: battery ? { sku: battery.sku, name: battery.name, kwh: battery.kwh, qty: battery.qty } : null,
    arrays: arrayCount(design),
    tiltedPanels: tilts.count,
    tiltDegrees: tilts.steepest,
  };
}

/** What a design's battery holds in all, kWh, to one decimal: 0 with none. */
export function batteryKwhOf(design: Pick<RoofDesign, "battery">): number {
  return design.battery ? Math.round(design.battery.kwh * design.battery.qty * 10) / 10 : 0;
}
