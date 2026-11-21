/**
 * An inverter against the home's supply (21 Nov 2026, Martin: "the designer should warn you that you have selected a 3
 * phase inverter when the home is single phase. it shouldnt allow you to blindly allow it"). A three-phase inverter
 * can't be connected to a single-phase supply, so it is never put on such a design without the home being changed to
 * three phase first. A single-phase inverter on a three-phase home is common and allowed. Pure, tested.
 */

/** An inverter's supply: as its list says, else read from its name; null when neither says. */
export function inverterPhase(i: { name: string; phase?: "single" | "three" }): "single" | "three" | null {
  return i.phase ?? (/three|3s?-?ph|\b3p\b/i.test(i.name) ? "three" : /single|1s?-?ph/i.test(i.name) ? "single" : null);
}

/** Whether this inverter can't go on a home with this supply: a three-phase one on single phase. */
export function clashesWithSupply(i: { name: string; phase?: "single" | "three" }, home: "single" | "three"): boolean {
  return home === "single" && inverterPhase(i) === "three";
}

/** The inverters on a design that can't go on the home's supply, by name, once each. */
export function supplyClashes(inverters: readonly { name: string; phase?: "single" | "three" }[], home: "single" | "three"): string[] {
  return [...new Set(inverters.filter((i) => clashesWithSupply(i, home)).map((i) => i.name))];
}

/** What is said when a three-phase inverter is picked for a single-phase home. */
export function clashWords(name: string): string {
  return `${name} is a three-phase inverter, and this home is set as single phase. A three-phase inverter can't be connected to a single-phase supply.`;
}

/** What Sol says when asked for one in words. */
export function clashRefusal(name: string): string {
  return `${clashWords(name)} Choose a single-phase inverter, or set the home to three phase first if it is.`;
}
