/**
 * The kit on a design in a few words each, for the line under the designer's kit rounds (10 Nov 2026, Martin: what is
 * on the design, make and model, wasn't plain unless the marks on the picture were noticed). Pure, tested.
 */

/** The maker: the first word of the product's name ("Sungrow 5kW Hybrid…" → "Sungrow"). */
export function makerOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** The most a product's words run to on the line before they are cut. */
export const KIT_WORDS_MAX = 26;

const cut = (words: string) => (words.length > KIT_WORDS_MAX ? `${words.slice(0, KIT_WORDS_MAX - 1).trimEnd()}…` : words);

/** A product as its maker and model ("Sungrow SH5.0RS"); the name alone when there is no code or it already says it. */
export function productWords(name: string, sku?: string | null): string {
  const code = sku?.trim();
  if (!code || name.toLowerCase().includes(code.toLowerCase())) return cut(name.trim());
  const maker = makerOf(name);
  return cut(maker && maker.toLowerCase() !== code.toLowerCase() ? `${maker} ${code}` : code);
}

/** The panels as how many, the maker and the watts ("25 × Jinko 475 W"). */
export function panelWords(count: number, name: string | undefined, watts: number | undefined): string {
  const maker = name ? makerOf(name) : "";
  const kind = [maker, watts ? `${watts} W` : ""].filter(Boolean).join(" ") || "panels";
  return `${count} × ${kind}`;
}
