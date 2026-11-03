/**
 * Server only. A product's datasheet found online by itself (3 Nov 2026, Martin: "an auto function that does this each
 * time a product is added"). For a panel or inverter on a price list with no figures anywhere: Claude searches the web
 * for the maker's own datasheet PDF for that exact model, the server downloads it (`safeDownload`: https only, every
 * redirect checked, never a private address, a real PDF, `MAX_SHEET_BYTES`), the datasheet reader reads that model's
 * figures, they are checked as a person's save is (`foundFigures`), and kept **unchecked** with the sheet's address
 * (`saveFoundSheet`): used at once, every string on them marked to check until a person confirms them in Settings.
 * Never over figures already kept.
 */
import { lookup } from "node:dns/promises";
import Anthropic from "@anthropic-ai/sdk";
import { KEEP_SHEET_BYTES, foundFigures, sheetCandidates, type SheetKind } from "@/lib/domain/design/datasheets";
import { BLOCKED_SITES, SEARCH_FROM } from "@/lib/domain/design/sol-knowledge";
import { todayInMarket } from "@/lib/domain/market";
import { fetchableUrl, isPrivateAddress } from "@/lib/domain/net";
import { MAX_SHEET_BYTES, readDatasheetWithClaude } from "./datasheet-reader";
import { saveFoundSheet } from "./design-datasheets-repo";

const MODEL = () => process.env.DATASHEET_MODEL?.trim() || "claude-sonnet-5-5";

const FIND_TOOLS: Anthropic.ToolUnion[] = [
  { type: "web_search_20260209", name: "web_search", max_uses: 5, blocked_domains: [...BLOCKED_SITES], user_location: SEARCH_FROM },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3, blocked_domains: [...BLOCKED_SITES], max_content_tokens: 12_000 },
];

const findPrompt = (kind: SheetKind, sku: string, name: string) =>
  `Find the manufacturer's datasheet PDF for this ${kind === "panel" ? "solar panel" : "solar or hybrid inverter"}, sold in Australia:
product code "${sku}", named "${name}".
Search the web. Prefer the maker's own website; a distributor's copy of the maker's datasheet will do only when the maker has none. It must be the datasheet (not a brochure, manual or listing) for this exact model, or a series datasheet whose table includes it. Check the link points to a PDF.
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
    // The host must not resolve to this computer or a private network (a link can be made to point anywhere).
    const ips = await lookup(url.hostname, { all: true }).catch(() => []);
    if (!ips.length || ips.some((a) => isPrivateAddress(a.address))) return null;
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000), cache: "no-store" }).catch(() => null);
    if (!res) return null;
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      url = next ? fetchableUrl(new URL(next, url).toString()) : null;
      continue;
    }
    if (!res.ok || Number(res.headers.get("content-length") ?? 0) > MAX_SHEET_BYTES || !res.body) return null;
    const parts: Uint8Array[] = [];
    let size = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_SHEET_BYTES) {
        await reader.cancel();
        return null;
      }
      parts.push(value);
    }
    const bytes = Buffer.concat(parts);
    return bytes.subarray(0, 5).toString("latin1") === "%PDF-" ? bytes : null;
  }
  return null;
}

export type FindOutcome = "found" | "not-found" | "not-read" | "kept-already" | "off";

/** Finds, reads and keeps one product's datasheet (unchecked). */
export async function findDatasheet(businessId: string, product: { kind: SheetKind; sku: string; name: string }): Promise<FindOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return "off";
  const links = await findSheetLinks(product.kind, product.sku, product.name, apiKey).catch(() => []);
  if (!links.length) return "not-found";
  // Each link the search showed, in turn, until one is a PDF whose figures for this model read clearly.
  let outcome: FindOutcome = "not-found";
  for (const url of links) {
    const bytes = await safeDownload(url);
    if (!bytes) continue;
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const reading = await readDatasheetWithClaude(
      { data: ab, mediaType: "application/pdf" },
      apiKey,
      `${product.name} (${product.sku})`,
    ).catch(() => null);
    const figures = reading ? foundFigures(reading, product.kind, url, todayInMarket()) : null;
    if (!reading || !figures?.ok) {
      outcome = "not-read";
      continue;
    }
    const kept = await saveFoundSheet(
      businessId,
      {
        kind: product.kind,
        sku: product.sku,
        model: reading.model ?? product.name,
        fileName: decodeURIComponent(new URL(url).pathname.split("/").pop() || "datasheet.pdf").slice(0, 120),
        figures: figures.value,
        url,
      },
      bytes.length <= KEEP_SHEET_BYTES ? { bytes, type: "application/pdf" } : null,
    );
    return kept ? "found" : "kept-already";
  }
  return outcome;
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
