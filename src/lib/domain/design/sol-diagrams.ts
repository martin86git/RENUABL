/**
 * Diagrams Sol draws in his chat (31 Oct 2026, as Primero's): a labelled picture that shows a real business case
 * better than words (a battery's clearances, a roof's setbacks, how strings run to an inverter). He writes the drawing
 * as SVG; it is kept with his turn and drawn under his words.
 *
 * What he writes is never trusted as it stands. `cleanSvg` rebuilds it from an allowlist: drawing elements only (no
 * script, style, foreignObject, image, link or animation), drawing attributes only (no event handlers, no href, no
 * style), and a `url(...)` only when it points inside the drawing (`url(#id)`). The chat then shows it as a picture
 * (`<img src="data:image/svg+xml...">`), where a browser runs no script and fetches nothing, so even what slipped through
 * could do nothing. Pure, tested.
 */

export interface SolDiagram {
  title: string;
  /** The drawing, cleaned: one `<svg>` with a viewBox. */
  svg: string;
  /** One line under it: what it is, and what to check it against. */
  caption?: string;
}

export const DIAGRAMS_PER_TURN = 6;
/** Characters of SVG a diagram may hold, before and after cleaning. */
export const DIAGRAM_MAX = 24_000;
/** The typeface a drawing's words fall back to (a picture can't load the site's own, so the nearest system ones). */
export const DIAGRAM_FONT = "Inter, Helvetica Neue, Helvetica, Arial, sans-serif";

const ELEMENTS = new Set([
  "svg",
  "g",
  "defs",
  "rect",
  "line",
  "polyline",
  "polygon",
  "circle",
  "ellipse",
  "path",
  "text",
  "tspan",
  "title",
  "marker",
  "pattern",
  "clipPath",
  "linearGradient",
  "radialGradient",
  "stop",
]);

const ATTRIBUTES = new Set([
  "viewBox",
  "xmlns",
  "preserveAspectRatio",
  "id",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "fx",
  "fy",
  "dx",
  "dy",
  "width",
  "height",
  "d",
  "points",
  "transform",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
  "opacity",
  "font-size",
  "font-weight",
  "font-family",
  "font-style",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
  "marker-start",
  "marker-mid",
  "marker-end",
  "markerWidth",
  "markerHeight",
  "markerUnits",
  "refX",
  "refY",
  "orient",
  "patternUnits",
  "patternTransform",
  "gradientUnits",
  "gradientTransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "clip-path",
]);

/** Elements whose whole content goes with them, text included. */
const DROP_WITH_CONTENT = new Set(["script", "style", "foreignobject", "iframe", "object", "embed", "audio", "video", "canvas"]);

const escText = (s: string) =>
  s
    .replace(/&(?!(?:#\d+|#x[\da-f]+|[a-z]+);)/gi, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A value is kept only when nothing in it reaches outside the drawing or runs. */
function safeValue(value: string): boolean {
  const v = value.replace(/[\s\u0000-\u001f]/g, "").toLowerCase();
  if (/javascript:|data:|expression\(|@import|<|>/.test(v)) return false;
  // url(...) only to something inside the drawing.
  for (const m of v.matchAll(/url\(([^)]*)\)/g)) if (!/^['"]?#[\w-]+['"]?$/.test(m[1])) return false;
  return true;
}

/**
 * The SVG Sol wrote, rebuilt from the allowlist; null when no drawing is left (no `<svg>` root with a viewBox, or
 * too long). Unknown elements are dropped but their own content kept (a stray `<a>` round some text keeps the text),
 * except those in `DROP_WITH_CONTENT`, which go whole.
 */
export function cleanSvg(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const src = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");
  if (src.length > DIAGRAM_MAX * 2) return null;
  const out: string[] = [];
  const open: string[] = [];
  let skip = 0;
  let sawRoot = false;
  const token = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)|(<)/g;
  for (const m of src.matchAll(token)) {
    const [, closing, rawName, attrs, selfClose, text, stray] = m;
    if (text !== undefined || stray !== undefined) {
      // Words only inside text; a stray "<" there is the words' own, written safely.
      if (!skip && open.some((n) => n === "text" || n === "tspan" || n === "title")) out.push(escText(text ?? "<"));
      continue;
    }
    const name = rawName.includes(":") ? "" : rawName;
    if (DROP_WITH_CONTENT.has(rawName.toLowerCase().replace(/^.*:/, ""))) {
      if (selfClose) continue;
      skip += closing ? -1 : 1;
      if (skip < 0) skip = 0;
      continue;
    }
    if (skip) continue;
    if (!ELEMENTS.has(name)) continue;
    if (closing) {
      const at = open.lastIndexOf(name);
      if (at < 0) continue;
      while (open.length > at) out.push(`</${open.pop()}>`);
      continue;
    }
    if (name === "svg" && !open.length) {
      if (sawRoot) break;
      sawRoot = true;
    } else if (!open.length) continue; // Nothing outside the root.
    const kept: string[] = [];
    for (const a of attrs.matchAll(/([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      const attr = a[1];
      const value = a[3] ?? a[4] ?? a[5] ?? "";
      if (!ATTRIBUTES.has(attr) || !safeValue(value)) continue;
      if (name === "svg" && (attr === "width" || attr === "height")) continue; // It takes the width it is given.
      kept.push(`${attr}="${escAttr(value.trim())}"`);
    }
    if (name === "svg" && !open.length) {
      if (!kept.some((k) => k.startsWith("viewBox="))) return null;
      if (!kept.some((k) => k.startsWith("xmlns="))) kept.unshift('xmlns="http://www.w3.org/2000/svg"');
      // Words without a typeface of their own read in the site's, not the browser's serif.
      if (!kept.some((k) => k.startsWith("font-family="))) kept.push(`font-family="${escAttr(DIAGRAM_FONT)}"`);
    }
    const tag = `<${name}${kept.length ? ` ${kept.join(" ")}` : ""}`;
    if (selfClose) out.push(`${tag}/>`);
    else {
      out.push(`${tag}>`);
      open.push(name);
    }
  }
  if (!sawRoot) return null;
  while (open.length) out.push(`</${open.pop()}>`);
  const svg = out.join("");
  return svg.length <= DIAGRAM_MAX ? svg : null;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** A diagram as kept and drawn, or null when nothing safe is left of it. */
export function cleanDiagram(raw: unknown): SolDiagram | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title, 100);
  const svg = cleanSvg(r.svg);
  if (!title || !svg) return null;
  const caption = str(r.caption, 240);
  return { title, svg, ...(caption ? { caption } : {}) };
}

export function cleanDiagrams(raw: unknown): SolDiagram[] {
  return (Array.isArray(raw) ? raw : [])
    .map(cleanDiagram)
    .filter((d): d is SolDiagram => d !== null)
    .slice(0, DIAGRAMS_PER_TURN);
}

/** The drawing as a picture's address, for an `<img>`: a browser runs nothing in it and fetches nothing for it. */
export const diagramSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
