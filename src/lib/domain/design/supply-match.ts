/**
 * An inverter against the home's supply (21 Nov 2026, Martin: "the designer should warn you that you have selected a 3
 * phase inverter when the home is single phase. it shouldnt allow you to blindly allow it"). A three-phase inverter
 * can't be connected to a single-phase supply, so it is never put on such a design without the home being changed to
 * three phase first. A single-phase inverter on a three-phase home is common and allowed. Pure, tested.
 */

type Supplied = { name: string; sku?: string; phase?: "single" | "three" };

/**
 * What a maker's own model code says of the supply (21 Nov 2026: Sungrow's SG20RT was listed as "Multi MPPT String
 * Solar Inverter" and its SH20RT as "Single Phase", so neither was caught by name). Sungrow: SG or SH, the size, then
 * RT, T or CX for three phase and RS for single. Other makers' codes aren't read. VERIFY against Sungrow's range.
 */
function phaseFromCode(text: string): "single" | "three" | null {
  const m = text.match(/S[GH]\d+(?:\.\d+)?(RT|RS|T|CX)(?![A-Z])/i);
  if (!m) return null;
  return m[1]!.toUpperCase() === "RS" ? "single" : "three";
}

/** An inverter's supply: as its list says, else its maker's model code, else read from its name; null when none says. */
export function inverterPhase(i: Supplied): "single" | "three" | null {
  return (
    i.phase ??
    phaseFromCode(`${i.sku ?? ""} ${i.name}`) ??
    (/three|3s?-?ph|\b3p\b/i.test(i.name) ? "three" : /single|1s?-?ph/i.test(i.name) ? "single" : null)
  );
}

/** Whether this inverter can't go on a home with this supply: a three-phase one on single phase. */
export function clashesWithSupply(i: Supplied, home: "single" | "three"): boolean {
  return home === "single" && inverterPhase(i) === "three";
}

/** The inverters on a design that can't go on the home's supply, by name, once each. */
export function supplyClashes(inverters: readonly Supplied[], home: "single" | "three"): string[] {
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
