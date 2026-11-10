/**
 * Server only. Fetches a public https page or picture on RENUABL's behalf (a news story's preview picture), with every
 * hop checked: https only (`fetchableUrl`), and the host's addresses looked up as the connection is made and refused
 * when private or local (`isPrivateAddress`), so a site can't answer a public address to a check and a private one to
 * the fetch. At most `maxBytes`, five redirects and 15 seconds a hop; null on anything else.
 */
import { lookup as dnsLookup } from "node:dns";
import { get as httpsGet } from "node:https";
import type { LookupFunction } from "node:net";
import { fetchableUrl, isPrivateAddress } from "@/lib/domain/net";

const publicOnly: LookupFunction = (host, options, done) => {
  dnsLookup(host, { ...options, all: true }, (err, found) => {
    if (err) return done(err, "", 0);
    const list = (Array.isArray(found) ? found : []) as { address: string; family: number }[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) return done(new Error("private address"), "", 0);
    if ((options as { all?: boolean }).all) return (done as unknown as (e: null, a: typeof list) => void)(null, list);
    done(null, list[0].address, list[0].family);
  });
};

type Hop = { redirect: string | null } | { bytes: Buffer; contentType: string };

function getOnce(url: URL, maxBytes: number, accept: string): Promise<Hop | null> {
  return new Promise((resolve) => {
    const req = httpsGet(url, { lookup: publicOnly, timeout: 15_000, headers: { "user-agent": "RENUABL news preview", accept } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        res.resume();
        return resolve({ redirect: res.headers.location ?? null });
      }
      if (status < 200 || status >= 300 || Number(res.headers["content-length"] ?? 0) > maxBytes) {
        res.resume();
        return resolve(null);
      }
      const parts: Buffer[] = [];
      let size = 0;
      let cut = false;
      res.on("data", (chunk: Buffer) => {
        if (cut) return;
        size += chunk.length;
        parts.push(chunk);
        // A page is read only so far (its preview picture is near the top); a picture past the limit is refused.
        if (size > maxBytes) {
          cut = true;
          res.destroy();
          resolve(
            accept.startsWith("text/")
              ? { bytes: Buffer.concat(parts).subarray(0, maxBytes), contentType: String(res.headers["content-type"] ?? "") }
              : null,
          );
        }
      });
      res.on("end", () => !cut && resolve({ bytes: Buffer.concat(parts), contentType: String(res.headers["content-type"] ?? "") }));
      res.on("error", () => !cut && resolve(null));
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

/** The body of a public https address (a page is cut at `maxBytes`; a picture over it is refused), or null. */
export async function safeFetch(
  raw: string,
  maxBytes: number,
  kind: "page" | "picture",
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const accept = kind === "page" ? "text/html,application/xhtml+xml" : "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5";
  let url = fetchableUrl(raw);
  for (let hop = 0; url && hop < 5; hop++) {
    const got = await getOnce(url, maxBytes, accept).catch(() => null);
    if (!got) return null;
    if ("redirect" in got) {
      url = got.redirect ? fetchableUrl(new URL(got.redirect, url).toString()) : null;
      continue;
    }
    return got;
  }
  return null;
}
