/**
 * The deal note over the designer, kept to what matters for the design (18 Nov 2026, Martin: the brief was "just a big
 * dump of text"; of everything in it only that she's looking for solar and a battery, and that her bill is $150, are of
 * any consequence). Read by rule from the words Sol's design request rests on (`AskQuote`s): the labelled facts a lead
 * page or a note writes ("Looking for: …", "Power bill: …") that bear on the design, each as a short line, nothing else.
 * With no such facts, the first thing the customer said, cut short. Pure, tested.
 */

/** The labels that bear on a design, and how each is said. Anything else ("Stage", "Consent", "Home") is left out. */
const KEEP: { match: RegExp; say: (value: string) => string }[] = [
  { match: /^(looking for|wants|interested in|after)$/i, say: (v) => `Wants ${lower(v)}` },
  { match: /^(power bill|bill|electricity bill|spend)$/i, say: (v) => `Bill ${lower(v)}` },
  { match: /^(usage|daily use)$/i, say: (v) => `Uses ${lower(v)}` },
  { match: /^(battery)$/i, say: (v) => `Battery: ${lower(v)}` },
  { match: /^(roof)$/i, say: (v) => `Roof: ${lower(v)}` },
  { match: /^(storeys|stories)$/i, say: (v) => `${v} storey` },
  { match: /^(phase|power supply)$/i, say: (v) => `${v} phase` },
  { match: /^(timing|when|timeframe)$/i, say: (v) => `Timing: ${lower(v)}` },
  { match: /^(ev|ev charger|electric car)$/i, say: (v) => `EV: ${lower(v)}` },
];

export const NOTE_POINTS_MAX = 4;
const FALLBACK_MAX = 110;

const lower = (v: string) => (/^[A-Z][a-z]/.test(v) ? v[0].toLowerCase() + v.slice(1) : v);

/** "Label: value" runs in a line of text, in order. A label is one to four words starting with a capital. */
export function labelled(text: string): { label: string; value: string }[] {
  const flat = text.replace(/\s+/g, " ").trim();
  const re = /(?:^|\s)([A-Z][A-Za-z]*(?: [A-Za-z]+){0,3}):\s/g;
  const marks: { label: string; start: number; end: number }[] = [];
  for (let m = re.exec(flat); m; m = re.exec(flat)) marks.push({ label: m[1], start: m.index, end: re.lastIndex });
  return marks.map((m, i) => ({
    label: m.label,
    value: flat
      .slice(m.end, i + 1 < marks.length ? marks[i + 1].start : flat.length)
      .trim()
      .replace(/[.,;]+$/, ""),
  }));
}

/** The deal note's points from what the request rests on: the facts that bear on the design, at most four. */
export function notePoints(quotes: readonly { text: string }[]): string[] {
  const out: string[] = [];
  for (const q of quotes)
    for (const { label, value } of labelled(q.text)) {
      const keep = KEEP.find((k) => k.match.test(label.trim()));
      if (!keep || !value || value.length > 80) continue;
      const line = keep.say(value);
      if (!out.some((o) => o.toLowerCase() === line.toLowerCase())) out.push(line);
    }
  if (out.length) return out.slice(0, NOTE_POINTS_MAX);
  // Written freely ("Olivia wants solar and a battery… bill about $480 a quarter"): what they want and the bill, read out.
  const all = quotes.map((q) => q.text).join(" ");
  const free = [wantsIn(all), billIn(all)].filter((x): x is string => Boolean(x));
  if (free.length) return free;
  const first = quotes
    .find((q) => q.text.trim())
    ?.text.replace(/\s+/g, " ")
    .trim();
  if (!first) return [];
  return [first.length > FALLBACK_MAX ? `${first.slice(0, FALLBACK_MAX - 1).trimEnd()}…` : first];
}

/** What they want, from words written freely: solar, a battery, an EV charger. */
export function wantsIn(text: string): string | null {
  const t = text.toLowerCase();
  const items = [
    /\bsolar\b|\bpanels?\b/.test(t) ? "solar" : null,
    /\bbatter(y|ies)\b/.test(t) ? "a battery" : null,
    /\bev\b|electric car|car charger|ev charger/.test(t) ? "an EV charger" : null,
  ].filter(Boolean) as string[];
  if (!items.length) return null;
  return `Wants ${items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0]}`;
}

/** Their bill, from words written freely: the dollar figure said near "bill", with its period when given. */
export function billIn(text: string): string | null {
  const m = /\bbills?\b[^$]{0,30}(\$\s?[\d,]+(?:\.\d+)?)(\s*(?:a|per|each|every)\s+(?:month|quarter|year|week|two months))?/i.exec(text);
  return m ? `Bill ${m[1].replace(/\s/g, "")}${m[2] ?? ""}` : null;
}
