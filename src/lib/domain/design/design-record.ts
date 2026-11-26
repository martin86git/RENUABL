/**
 * The line a saved roof design writes on its deal's timeline (25 Nov 2026, Martin: the deal opens on its timeline, and a
 * design being done is one of the things in it, as HubSpot's activity feed shows). One line a deal a day: a later save
 * the same day replaces it, so a designer saving every few minutes leaves one entry, not dozens.
 */
import { designSummary, type DesignSet } from "./roof-design";

/** Every design-saved line starts with this, so a later save finds and replaces it. */
export const DESIGN_SAVED = "Roof design saved";

/** How long a design-saved line is replaced rather than a new one written. */
export const DESIGN_SAVED_HOURS = 12;

/** "Roof design saved · 6.6 kW, 14 panels, 13.5 kWh battery · 3 designs", from the primary design. */
export function designSavedLine(set: DesignSet): string {
  const design = set.designs[set.primary] ?? set.designs[0];
  const parts: string[] = [];
  if (design) {
    const sum = designSummary(design);
    if (sum.panels) parts.push(`${sum.kw} kW, ${sum.panels} panel${sum.panels === 1 ? "" : "s"}`);
    const battery = design.battery;
    if (battery) parts.push(`${Math.round(battery.kwh * battery.qty * 10) / 10} kWh battery`);
    if (design.charger) parts.push("EV charger");
  }
  const what = parts.join(", ");
  const count = set.designs.length > 1 ? `${set.designs.length} designs` : "";
  return [DESIGN_SAVED, what, count].filter(Boolean).join(" · ");
}

/** Whether a line on the record is a design-saved one. */
export function isDesignSavedLine(text: string): boolean {
  return text.startsWith(DESIGN_SAVED);
}
