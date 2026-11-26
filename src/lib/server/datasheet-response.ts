/**
 * Server only. A product's datasheet as served to whoever may open it (a proposal's customer, a job card's team,
 * installer or inspector): shown in the browser, kept out of search, no referrer, sandboxed so nothing in it runs.
 */
export function datasheetResponse(file: { fileName: string; type: string; bytes: Buffer } | null): Response {
  if (!file) return new Response("Not found", { status: 404 });
  const name = file.fileName || `datasheet${file.type === "application/pdf" ? ".pdf" : ""}`;
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.type,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
      "content-security-policy": "sandbox; default-src 'none'; img-src 'self'",
    },
  });
}
