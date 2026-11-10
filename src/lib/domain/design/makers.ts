/**
 * Who makes a product, whether an inverter takes a battery, and which batteries work with which inverters (10 Nov 2026,
 * moved out of battery-suggest.ts so the quote can use them too). Pure, tested, no imports.
 */

/** Makers the designer knows, as their names flatten (spaces and marks taken out). */
const MAKERS = [
  "sungrow",
  "sigenergy",
  "goodwe",
  "solaredge",
  "byd",
  "tesla",
  "fronius",
  "alphaess",
  "enphase",
  "huawei",
  "redback",
  "growatt",
];
/** Other ways a maker's name is written on price lists ("Sigen Energy Gateway"). */
const ALIASES: Record<string, string> = { sigen: "sigenergy" };

/** The maker a product is from: one the designer knows, by name with the spaces taken out, else the first word. */
export function makerOf(name: string): string {
  const flat = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const known = MAKERS.find((m) => flat.startsWith(m));
  if (known) return known;
  const alias = Object.keys(ALIASES).find((a) => flat.startsWith(a));
  if (alias) return ALIASES[alias];
  return (name.trim().split(/\s+/)[0] ?? "").toLowerCase();
}

const SPELLING: Record<string, string> = {
  byd: "BYD",
  goodwe: "GoodWe",
  solaredge: "SolarEdge",
  alphaess: "AlphaESS",
};
/** A maker as people write it. */
export function makerName(maker: string): string {
  return SPELLING[maker] ?? (maker ? maker[0].toUpperCase() + maker.slice(1) : "");
}

/** Whether an inverter takes a battery: its own flag when the list gives one, else its name. */
export function takesBattery(inverter: { name: string; hybrid?: boolean }): boolean {
  if (typeof inverter.hybrid === "boolean") return inverter.hybrid;
  return /hybrid|\bSH\d|sigenstor/i.test(inverter.name);
}

/**
 * Makers whose batteries are AC coupled: they bring their own inverter and work beside any (10 Nov 2026, Martin: "a
 * Sungrow inverter takes only Sungrow batteries, or an AC coupled battery like a Sigenergy"). A Sigenergy battery comes
 * with its own controller, which the quote adds (`needsController`). VERIFY against each
 * maker's range: some sell both kinds.
 */
export const AC_COUPLED_MAKERS = ["sigenergy", "tesla", "enphase"] as const;

/** Whether a battery is AC coupled: its maker, or "AC coupled" in its name. */
export function acCoupled(battery: { name: string }): boolean {
  return (AC_COUPLED_MAKERS as readonly string[]).includes(makerOf(battery.name)) || /ac[s-]?coupl/i.test(battery.name);
}

/**
 * Whether a battery works with the inverters on a design: anything goes with no inverter yet; else the same maker as an
 * inverter that takes a battery (a hybrid; a string inverter of the same maker doesn't make its batteries fit), or an
 * AC coupled one, which works beside any.
 */
export function batteryFits(battery: { name: string }, inverters: readonly { name: string; hybrid?: boolean }[]): boolean {
  if (!inverters.length) return true;
  if (acCoupled(battery)) return true;
  const maker = makerOf(battery.name);
  return inverters.some((i) => takesBattery(i) && makerOf(i.name) === maker);
}

/** Makers whose batteries carry their own inverter inside (a Powerwall, an Enphase IQ battery): nothing more is needed. */
export const INVERTER_BUILT_IN = ["tesla", "enphase"] as const;

/**
 * Whether a battery needs its maker's controller (or hybrid inverter) added to the system (10 Nov 2026, Martin: a
 * Sigenergy battery sold alone, or beside a Sungrow inverter, needs a Sigenergy controller, and the quote left it out):
 * yes unless its inverter is built in, or the design already has a hybrid inverter of its maker.
 */
export function needsController(battery: { name: string }, inverters: readonly { name: string; hybrid?: boolean }[]): boolean {
  const maker = makerOf(battery.name);
  if ((INVERTER_BUILT_IN as readonly string[]).includes(maker)) return false;
  return !inverters.some((i) => takesBattery(i) && makerOf(i.name) === maker);
}

/** Whether a product's name says it is for three phase supply. */
const threePhase = (name: string) => /three[\s-]?phase|3[\s-]?phase|\b3p\b|\btp\b/i.test(name);

/**
 * The controller to add for a battery: its maker's smallest controller or hybrid inverter on the lists for the home's
 * phase (else any phase, the smallest), or null when the lists have none of its maker.
 */
export function controllerFor<T extends { name: string; kw: number; hybrid?: boolean }>(
  battery: { name: string },
  inverters: readonly T[],
  phase: "single" | "three",
): T | null {
  const maker = makerOf(battery.name);
  const own = inverters.filter((i) => makerOf(i.name) === maker && takesBattery(i)).sort((a, b) => a.kw - b.kw);
  return own.find((i) => threePhase(i.name) === (phase === "three")) ?? own[0] ?? null;
}
