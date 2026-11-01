/**
 * Sol searching makers' own documents online: datasheets, installation manuals and tech notes, to confirm a product's
 * technical points (supported grid types, MPPT inputs, maximum DC voltage, whether it may sit in the sun). His web
 * search and fetch reach only these sites: makers of the panels, inverters, batteries, EV chargers and racking sold in
 * Australia, and the official bodies and networks. A maker not listed can't be searched; add its site here. VERIFY the
 * list as makers change their sites.
 */

export const MAKER_SITES: readonly string[] = [
  // Inverters and batteries
  "sungrowpower.com",
  "fronius.com",
  "sma.de",
  "sma-australia.com.au",
  "goodwe.com",
  "huawei.com",
  "sigenergy.com",
  "tesla.com",
  "enphase.com",
  "solaredge.com",
  "alphaess.com",
  "bydbatterybox.com",
  "fox-ess.com",
  "solisinverters.com",
  "growatt.com",
  "redbacktech.com",
  "selectronic.com.au",
  "victronenergy.com",
  "sofarsolar.com",
  "deyeinverter.com",
  // Panels
  "jinkosolar.com",
  "trinasolar.com",
  "longi.com",
  "canadiansolar.com",
  "recgroup.com",
  "risenenergy.com",
  "jasolar.com",
  "aikosolar.com",
  "qcells.com",
  "maxeon.com",
  // EV chargers
  "myenergi.com",
  "wallbox.com",
  // Racking
  "clenergy.com.au",
  "antaisolar.com",
  // Official bodies and the Victorian networks
  "cer.gov.au",
  "cleanenergycouncil.org.au",
  "solaraccreditation.com.au",
  "esv.vic.gov.au",
  "energy.vic.gov.au",
  "solar.vic.gov.au",
  "ausnetservices.com.au",
  "citipower.com.au",
  "powercor.com.au",
  "jemena.com.au",
  "unitedenergy.com.au",
];

/** How many searches and page reads one answer may make, so a question can't run up the cost. */
export const MAKER_SEARCHES = 4;
export const MAKER_FETCHES = 3;
/** The most of one fetched page or PDF Sol reads, in tokens. */
export const MAKER_PAGE_TOKENS = 30_000;

/** Sol's rules for checking a product against its maker's documents. */
export const SOL_MAKER_DOCS = `Makers' documents: to confirm a product's technical points (supported grid types and phases, MPPT inputs and their currents, maximum DC input voltage, start-up voltage, battery compatibility, IP rating and whether it may be installed in direct sun, clearances and mounting, operating temperatures, warranty conditions), look first at the business's checked figures with datasheet_lookup; when they don't settle it, or the person asks, use web_search on the maker's own site (and web_fetch to read a datasheet, installation manual or tech note it found). Searches only reach makers' and official sites. Name the exact model the figure is for, and the document it came from with its date or version where shown; prefer the maker's Australian documents and the latest version. When documents disagree, or you can't find it, say so plainly; never fill a gap with a figure from another model or a guess. Say that the installer confirms it against the manual on the day. Don't search for what you can answer from the facts here or the business's own records.`;

/** The cited pages under an answer: each once, in the order first cited, at most `max`. */
export function sourcesLine(cited: readonly { url: string; title?: string | null }[], max = 4): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const c of cited) {
    if (!/^https:\/\//i.test(c.url) || seen.has(c.url)) continue;
    seen.add(c.url);
    lines.push(`- ${c.title?.trim() ? `${c.title.trim().slice(0, 100)}: ` : ""}${c.url}`);
    if (lines.length >= max) break;
  }
  return lines.length ? `Sources:\n${lines.join("\n")}` : "";
}
