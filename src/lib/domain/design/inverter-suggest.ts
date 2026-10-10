/**
 * "Suggest one" in the roof designer's inverter list: from the panels on the
 * design, which inverters in the catalogue would suit. Sizing an inverter is
 * arithmetic and limits, so it is worked out by rule, the same every time,
 * with the reason written beside each suggestion. Pure, tested.
 *
 * The rules:
 *  - one suggestion for each kind of inverter the catalogue has (single or
 *    three phase, with or without a battery input), since the designer can't
 *    know the home's supply or whether a battery is wanted;
 *  - the smallest inverter the panels don't oversize: panels up to 133% of
 *    its rating (`COSTING.maxArrayToInverter`);
 *  - when no single one is big enough, several of the largest, on three phase
 *    only (a single-phase home is limited to one);
 *  - between two of the same size, the one whose input limits are on file,
 *    so its strings can be checked;
 *  - and when strings are drawn, whether they fit its inputs.
 */
import { COSTING } from "../costing";
import type { CatalogueInverter } from "./catalogue";
import { checkString, type PanelElectrical } from "./electrical";
import { MAX_INVERTERS } from "./roof-design";

const MAX_ARRAY_RATIO = COSTING.maxArrayToInverter;

export interface InverterSuggestion {
  inverter: CatalogueInverter;
  /** How many of it. */
  count: number;
  /** "Three phase hybrid". */
  kind: string;
  /** Why this one, in a sentence or two. */
  why: string;
}

/** An inverter's supply and whether it takes a battery: as the catalogue says, else read from its name. */
const phaseOf = (i: CatalogueInverter) =>
  i.phase ?? (/three|3s?-?ph/i.test(i.name) ? "three" : /single|1s?-?ph/i.test(i.name) ? "single" : null);
const hybridOf = (i: CatalogueInverter) => i.hybrid ?? /hybrid/i.test(i.name);

export function suggestInverters(input: {
  /** The panels on the design, in kW. */
  arrayKw: number;
  inverters: CatalogueInverter[];
  panel?: PanelElectrical;
  /** The strings drawn, as panels in each. */
  strings: number[];
}): InverterSuggestion[] {
  const { arrayKw, panel } = input;
  if (!(arrayKw > 0)) return [];
  const strings = input.strings.filter((n) => n > 0);
  const out: InverterSuggestion[] = [];
  for (const phase of ["single", "three"] as const) {
    for (const hybrid of [false, true]) {
      const kind = input.inverters.filter((i) => phaseOf(i) === phase && hybridOf(i) === hybrid);
      if (!kind.length) continue;
      const bySize = [...kind].sort((a, b) => a.kw - b.kw || Number(Boolean(b.electrical)) - Number(Boolean(a.electrical)));
      let pick = bySize.find((i) => arrayKw <= i.kw * MAX_ARRAY_RATIO);
      let count = 1;
      if (!pick) {
        // None is big enough alone: several of the largest, where the supply allows more than one.
        if (phase === "single") continue;
        const largest = bySize[bySize.length - 1];
        pick = bySize.find((i) => i.kw === largest.kw) ?? largest;
        count = Math.ceil(arrayKw / (pick.kw * MAX_ARRAY_RATIO));
        if (count > MAX_INVERTERS) continue;
      }
      const share = Math.round((arrayKw / (pick.kw * count)) * 100);
      let why = `${arrayKw.toFixed(2)} kW of panels is ${share}% of ${count > 1 ? `the ${count} inverters'` : "its"} ${(pick.kw * count).toFixed((pick.kw * count) % 1 ? 1 : 0)} kW (up to ${Math.round(MAX_ARRAY_RATIO * 100)}% is allowed for).`;
      const e = pick.electrical;
      if (!e) why += " Its input limits aren't on file, so strings can't be checked against it.";
      else if (strings.length && panel) {
        const connectors = e.mppts.reduce((n, m) => n + m.strings, 0) * count;
        const bad = strings.filter((n) => {
          const lines = checkString({ panels: n, panel, inverter: e, mppt: 0, sharing: 1 }).lines;
          // The voltage limits are the inverter's own, whichever input a string ends up on.
          return lines.slice(0, 4).some((l) => l.ok === false);
        }).length;
        why +=
          strings.length > connectors
            ? ` Your ${strings.length} strings are more than its ${connectors} string connections.`
            : bad
              ? ` ${bad} of your ${strings.length} strings ${bad === 1 ? "is" : "are"} outside its voltage limits as drawn.`
              : ` Your ${strings.length === 1 ? "string fits" : `${strings.length} strings fit`} its voltage limits and connections.`;
      } else why += ` It has ${e.mppts.length} inputs, and strings can be checked against it.`;
      out.push({
        inverter: pick,
        count,
        kind: `${phase === "single" ? "Single" : "Three"} phase${hybrid ? " hybrid (takes a battery)" : ""}`,
        why,
      });
    }
  }
  return out;
}
