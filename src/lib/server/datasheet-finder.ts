/**
 * Server only. A product's datasheet found online by itself (3 Nov 2026, Martin: "an auto function that does this each
 * time a product is added"). For a panel or inverter on a price list with no figures anywhere: Claude searches the web
 * for the maker's own datasheet PDF for that exact model, the server downloads it (`safeDownload`: https only, every
 * redirect checked, never a private address, a real PDF, `MAX_SHEET_BYTES`), the datasheet reader reads that model's
 * figures, they are checked as a person's save is (`foundFigures`), and kept **unchecked** with the sheet's address
 * (`saveFoundSheet`): used at once, every string on them marked to check until a person confirms them in Settings.
 * Never over figures already kept.
 */
import { lookup as dnsLookup } from "node:dns";
import type { LookupFunction } from "node:net";
import { get as httpsGet } from "node:https";
import Anthropic from "@anthropic-ai/sdk";
import { KEEP_SHEET_BYTES, foundFigures, sheetCandidates, type SheetKind } from "@/lib/domain/design/datasheets";
import type { InverterElectrical, PanelElectrical } from "@/lib/domain/design/electrical";
import { BLOCKED_SITES, SEARCH_FROM } from "@/lib/domain/design/sol-knowledge";
import { todayInMarket } from "@/lib/domain/market";
import { fetchableUrl, isPrivateAddress } from "@/lib/domain/net";
import { MAX_SHEET_BYTES, readDatasheetWithClaude, type SheetType } from "./datasheet-reader";
import { replaceWithFoundSheet, saveFoundSheet } from "./design-datasheets-repo";

const MODEL = () => process.env.DATASHEET_MODEL?.trim() || "claude-sonnet-5-5";

const FIND_TOOLS: Anthropic.ToolUnion[] = [
  { type: "web_search_20260209", name: "web_search", max_uses: 5, blocked_domains: [...BLOCKED_SITES], user_location: SEARCH_FROM },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3, blocked_domains: [...BLOCKED_SITES], max_content_tokens: 12_000 },
];

const findPrompt = (kind: SheetKind, sku: string, name: string) =>
  `Find the manufacturer's datasheet PDF for this ${kind === "panel" ? "solar panel" : "solar or hybrid inverter"}, sold in Australia:
product code "${sku}", named "${name}".
Search the web. Prefer the maker's own website; a distributor's copy of the maker's datasheet will do only when the maker has none. Prefer the Australian version: the maker's Australian site (often .com.au) or a sheet marked AU, Australia or Oceania (OC), over a European, US or other market's sheet; take another market's only when there is no Australian one. It must be the datasheet (not a brochure, manual or listing) for this exact model, or a series datasheet whose table includes it: every letter of the product code counts (a -DV sheet is not a -DB panel's). Check the link points to a PDF.
End your reply with one line: "URL: " and the https link to the PDF, or "URL: none" if you can't find one you're sure of. Never make up a link.`;

/** The PDF link Claude found for the product, or null. */
/** Every link a search result or a page fetched carried, however the web tools nest them. */
function linksIn(blocks: readonly unknown[]): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.url === "string") out.push(o.url);
      for (const [k, x] of Object.entries(o)) if (k !== "url" && typeof x === "object") walk(x);
    }
  };
  for (const b of blocks) if (b && typeof b === "object" && /tool_result$/.test(String((b as { type?: unknown }).type))) walk(b);
  return out;
}

/** The links to try for the product's datasheet, best first: only those the search really showed (`sheetCandidates`). */
export async function findSheetLinks(kind: SheetKind, sku: string, name: string, apiKey: string): Promise<string[]> {
  const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: findPrompt(kind, sku, name) }];
  let text = "";
  const seen: string[] = [];
  // The web tools run on Anthropic's side; a long search may pause and is carried on (a few times at most).
  for (let turn = 0; turn < 4; turn++) {
    const m = await client.messages.create({ model: MODEL(), max_tokens: 2000, tools: FIND_TOOLS, messages });
    seen.push(...linksIn(m.content));
    text = m.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    if (m.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: m.content });
  }
  const answer = [...text.matchAll(/URL:\s*(\S+)/g)].pop()?.[1]?.replace(/[)>\].,]+$/, "") ?? null;
  return sheetCandidates(answer && answer.toLowerCase() !== "none" ? answer : null, seen, sku);
}

/** A public https PDF, every hop checked: null when it isn't one, is too big, or can't be had. */
export async function safeDownload(raw: string): Promise<Buffer | null> {
  let url = fetchableUrl(raw);
  for (let hop = 0; url && hop < 5; hop++) {
    const got = await getOnce(url).catch(() => null);
    if (!got) return null;
    if (got.redirect !== undefined) {
      url = got.redirect ? fetchableUrl(new URL(got.redirect, url).toString()) : null;
      continue;
    }
    return got.bytes.subarray(0, 5).toString("latin1") === "%PDF-" ? got.bytes : null;
  }
  return null;
}

/**
 * The address is looked up as the connection is made, and refused there when it is this computer or a private network:
 * checked once and fetched later, a site could answer a public address to the check and a private one to the fetch
 * (3 Nov 2026, a bug review).
 */
const publicOnly: LookupFunction = (host, options, done) => {
  dnsLookup(host, { ...options, all: true }, (err, found) => {
    if (err) return done(err, "", 0);
    const list = (Array.isArray(found) ? found : []) as { address: string; family: number }[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) return done(new Error("private address"), "", 0);
    if ((options as { all?: boolean }).all) return (done as unknown as (e: null, a: typeof list) => void)(null, list);
    done(null, list[0].address, list[0].family);
  });
};

/** One request: a redirect's address, or the body up to `MAX_SHEET_BYTES`. Null when it isn't to be had. */
function getOnce(url: URL): Promise<{ redirect: string | null } | { redirect?: undefined; bytes: Buffer } | null> {
  return new Promise((resolve) => {
    const req = httpsGet(url, { lookup: publicOnly, timeout: 20_000, headers: { "user-agent": "RENUABL datasheet finder" } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        res.resume();
        return resolve({ redirect: res.headers.location ?? null });
      }
      if (status < 200 || status >= 300 || Number(res.headers["content-length"] ?? 0) > MAX_SHEET_BYTES) {
        res.resume();
        return resolve(null);
      }
      const parts: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_SHEET_BYTES) {
          res.destroy();
          return resolve(null);
        }
        parts.push(chunk);
      });
      res.on("end", () => resolve({ bytes: Buffer.concat(parts) }));
      res.on("error", () => resolve(null));
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

export type FindOutcome = "found" | "not-found" | "not-read" | "kept-already" | "off";

/** A link tried for a sheet and why it wasn't used, so Sol can say plainly what happened. */
export type Tried = { url: string; why: string };

type Product = { kind: SheetKind; sku: string; name: string };
type ReadSheet = {
  sheet: {
    kind: SheetKind;
    sku: string;
    model: string;
    fileName: string;
    figures: PanelElectrical | InverterElectrical;
    url: string | null;
  };
  file: { bytes: Buffer; type: string } | null;
};

/** Each link in turn, until one is a PDF whose figures for this model read clearly: the sheet to keep, or why not. */
async function firstReadable(
  product: Product,
  links: readonly string[],
  apiKey: string,
  tried: Tried[] = [],
): Promise<ReadSheet | "not-found" | "not-read"> {
  let outcome: "not-found" | "not-read" = "not-found";
  for (const url of links) {
    const bytes = await safeDownload(url);
    if (!bytes) {
      tried.push({ url, why: "wouldn't open as a PDF (a broken link, or not a PDF)" });
      continue;
    }
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    // The product code exactly: a sheet for a near model (-DV for -DB) isn't this product's.
    const reading = await readDatasheetWithClaude(
      { data: ab, mediaType: "application/pdf" },
      apiKey,
      `${product.sku} exactly (a different suffix is another product), ${product.name}`,
    ).catch(() => null);
    const figures = reading ? foundFigures(reading, product.kind, url, todayInMarket()) : null;
    if (!reading || !figures?.ok) {
      tried.push({ url, why: "opened, but this exact model's figures weren't on it, or didn't read clearly" });
      outcome = "not-read";
      continue;
    }
    return {
      sheet: {
        kind: product.kind,
        sku: product.sku,
        model: reading.model ?? product.name,
        fileName: sheetName(url),
        figures: figures.value,
        url,
      },
      file: bytes.length <= KEEP_SHEET_BYTES ? { bytes, type: "application/pdf" } : null,
    };
  }
  return outcome;
}

/** Finds, reads and keeps one product's datasheet (unchecked). */
export async function findDatasheet(businessId: string, product: Product): Promise<FindOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return "off";
  const links = await findSheetLinks(product.kind, product.sku, product.name, apiKey).catch(() => []);
  if (!links.length) return "not-found";
  const got = await firstReadable(product, links, apiKey);
  if (typeof got === "string") return got;
  return (await saveFoundSheet(businessId, { ...got.sheet, url: got.sheet.url ?? "" }, got.file)) ? "found" : "kept-already";
}

/**
 * Sol puts the right sheet in place of what is kept for a product, at a member's word (8 Nov 2026, Martin). `given` is a
 * PDF link Sol saw in his answer, tried first; then the web is searched as the finder does (Australia's sheet first).
 * The new figures are kept unchecked, to confirm in Settings. Answers what was kept, or why nothing was.
 */
export async function replaceDatasheet(
  businessId: string,
  product: Product,
  given: string | null,
): Promise<{ ok: true; sheet: ReadSheet["sheet"] } | { ok: false; why: "off" | "not-found" | "not-read"; tried: Tried[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const tried: Tried[] = [];
  if (!apiKey) return { ok: false, why: "off", tried };
  let got: ReadSheet | "not-found" | "not-read" = "not-found";
  if (given) got = await firstReadable(product, [given], apiKey, tried);
  if (typeof got === "string") {
    const links = (await findSheetLinks(product.kind, product.sku, product.name, apiKey).catch(() => [])).filter((u) => u !== given);
    const next = links.length ? await firstReadable(product, links, apiKey, tried) : "not-found";
    got = typeof next === "string" && got === "not-read" ? got : next;
  }
  if (typeof got === "string") return { ok: false, why: got, tried };
  await replaceWithFoundSheet(businessId, got.sheet, got.file);
  return { ok: true, sheet: got.sheet };
}

/** Looks for each in turn (a few at a time at most), keeping what is found; how many were found. */
export async function findDatasheets(
  businessId: string,
  products: readonly { kind: SheetKind; sku: string; name: string }[],
): Promise<number> {
  let found = 0;
  for (const p of products) if ((await findDatasheet(businessId, p).catch(() => "not-found" as const)) === "found") found++;
  return found;
}

/** The sheet's file name from its address; a stray "%" in it doesn't stop the figures being kept (3 Nov 2026). */
function sheetName(url: string): string {
  const last = new URL(url).pathname.split("/").pop() || "datasheet.pdf";
  try {
    return decodeURIComponent(last).slice(0, 120);
  } catch {
    return last.slice(0, 120);
  }
}

/**
 * Sol keeps a sheet the member attached to their message (a PDF or a photo of it) in place of what is kept for the
 * product, read for that exact model and marked to check like a sheet found online.
 */
export async function replaceDatasheetFromFile(
  businessId: string,
  product: Product,
  file: { name: string; type: SheetType; bytes: Buffer },
): Promise<{ ok: true; sheet: ReadSheet["sheet"] } | { ok: false; why: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { ok: false, why: "Datasheets can't be read here (no Claude key on the site)." };
  if (file.bytes.length > MAX_SHEET_BYTES) return { ok: false, why: "That file is too big to read." };
  const ab = file.bytes.buffer.slice(file.bytes.byteOffset, file.bytes.byteOffset + file.bytes.byteLength) as ArrayBuffer;
  const reading = await readDatasheetWithClaude(
    { data: ab, mediaType: file.type },
    apiKey,
    `${product.sku} exactly (a different suffix is another product), ${product.name}`,
  ).catch(() => null);
  if (!reading) return { ok: false, why: "The file couldn't be read just now." };
  const figures = foundFigures(reading, product.kind, `the file ${file.name}, attached to Sol`, todayInMarket());
  if (!figures.ok) return { ok: false, why: figures.message };
  const sheet = {
    kind: product.kind,
    sku: product.sku,
    model: reading.model ?? product.name,
    fileName: file.name.slice(0, 120),
    figures: figures.value,
    url: null,
  };
  const keep = file.type === "application/pdf" && file.bytes.length <= KEEP_SHEET_BYTES ? { bytes: file.bytes, type: file.type } : null;
  await replaceWithFoundSheet(businessId, sheet, keep);
  return { ok: true, sheet };
}
