/**
 * Server only. Reads the cells of an Excel (.xlsx) file as rows of text, every
 * sheet one after another. Enough for supplier price lists: shared and inline
 * strings, numbers; no formulas are evaluated (their saved values are read).
 */
import { inflateRawSync } from "node:zlib";

function unzip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  // End of central directory: the last "PK\x05\x06".
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(dataStart, dataStart + size);
    if (method === 0) files.set(name, data);
    else if (method === 8) files.set(name, inflateRawSync(data));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");

/** Text of every <t> inside a string item (rich text has several runs). */
const textOf = (xml: string) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");

function colIndex(ref: string) {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function readXlsxRows(data: ArrayBuffer | Buffer): string[][] {
  const files = unzip(Buffer.isBuffer(data) ? data : Buffer.from(data));
  const shared = [...(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    textOf(m[1]),
  );
  const sheets = [...files.keys()]
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const rows: string[][] = [];
  for (const sheet of sheets) {
    const xml = files.get(sheet)!.toString("utf8");
    for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const row: string[] = [];
      for (const c of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const body = c[2] ?? "";
        const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
        const type = attrs.match(/\bt="(\w+)"/)?.[1];
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        const text = type === "s" ? (shared[Number(v)] ?? "") : type === "inlineStr" ? textOf(body) : v !== undefined ? decode(v) : "";
        row[ref ? colIndex(ref) : row.length] = text;
      }
      const filled = Array.from(row, (x) => x ?? "");
      if (filled.some((x) => x.trim())) rows.push(filled);
    }
  }
  return rows;
}
