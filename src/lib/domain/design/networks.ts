/**
 * Victoria's electricity distributors (DNSPs) and what Sol knows of their connection rules, for the team chat's Grid
 * connections channel and Sol's own chat. Every limit here is the usual one as read on 1 Nov 2026 from Victoria's
 * energy department and the distributors' published guides: they change, so Sol always points to the distributor's
 * current connection guide and never states a limit as certain. VERIFY each figure against the distributors' guides
 * before relying on it.
 */

export interface Distributor {
  id: string;
  name: string;
  /** Where it runs the network, in words. */
  area: string;
  /** The first four digits of the meter's NMI on its network (on the customer's bill). */
  nmiStarts: string;
  url: string;
}

export const VIC_DISTRIBUTORS: readonly Distributor[] = [
  {
    id: "citipower",
    name: "CitiPower",
    area: "Melbourne's CBD and inner suburbs",
    nmiStarts: "6102",
    url: "https://www.citipower.com.au",
  },
  {
    id: "powercor",
    name: "Powercor",
    area: "Melbourne's western suburbs and central and western Victoria",
    nmiStarts: "6203",
    url: "https://www.powercor.com.au",
  },
  {
    id: "jemena",
    name: "Jemena",
    area: "Melbourne's north and north-west",
    nmiStarts: "6001",
    url: "https://www.jemena.com.au",
  },
  {
    id: "united-energy",
    name: "United Energy",
    area: "Melbourne's south-east and the Mornington Peninsula",
    nmiStarts: "6407",
    url: "https://www.unitedenergy.com.au",
  },
  {
    id: "ausnet",
    name: "AusNet Services",
    area: "Melbourne's outer east and north, and eastern and northern Victoria (Gippsland, the north-east)",
    nmiStarts: "6305",
    url: "https://www.ausnetservices.com.au",
  },
];

/** The Victorian government's page on the emergency backstop, the one rule all five share. */
export const BACKSTOP_SOURCE = "https://www.energy.vic.gov.au/about-energy/victorias-emergency-backstop-mechanism-for-solar";

/** Which distributor a deal's typed Distributor detail names, by any of its usual spellings. */
export function distributorNamed(text: string | null | undefined): Distributor | null {
  const t = (text ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!t) return null;
  if (t.includes("citipower")) return VIC_DISTRIBUTORS[0];
  if (t.includes("powercor")) return VIC_DISTRIBUTORS[1];
  if (t.includes("jemena")) return VIC_DISTRIBUTORS[2];
  if (t.includes("united") || t === "ue") return VIC_DISTRIBUTORS[3];
  if (t.includes("ausnet") || t.includes("sppausnet")) return VIC_DISTRIBUTORS[4];
  return null;
}

/** Which distributor a meter's NMI belongs to, from its first four digits. */
export function distributorForNmi(nmi: string | null | undefined): Distributor | null {
  const n = (nmi ?? "").replace(/\s/g, "");
  return VIC_DISTRIBUTORS.find((d) => n.startsWith(d.nmiStarts)) ?? null;
}

/**
 * Sol's knowledge of the distributors' connection rules. He answers the team's questions about a particular network
 * (export limits, pre-approval, the backstop) with the usual rule, says it is the usual one, and points to the
 * distributor's current guide: the distributor decides each application.
 */
export const SOL_NETWORKS = `Grid connections: you help the team with the Victorian distributors' (DNSPs') connection rules, especially in the team chat's Grid connections channel. The five networks, with where they run and the first four digits of the meter's NMI on their network (the NMI is on the customer's bill): ${VIC_DISTRIBUTORS.map((d) => `${d.name} (${d.area}; NMI ${d.nmiStarts}…; ${d.url})`).join("; ")}. Which network a home is on is decided by the NMI or the bill, never by guessing from a suburb near a boundary; for a deal, look at its Distributor and NMI details (deal_details) first.
What usually applies (as read in late 2026; say it is the usual rule and to check the distributor's current connection guide, since limits and processes change and each application is assessed on its own):
- Pre-approval: apply to the distributor before installing, through its own online portal; it may approve the full export, approve it export limited, or ask for more. Don't book the install until it is through.
- Exports: a fixed export limit of 5 kW per phase is the usual default on every Victorian network, and a site can be limited lower (even to zero) where the local network is full. Inverter capacity on a single-phase home is usually up to 10 kW (more needs approval, or three phases).
- Flexible exports: CitiPower, Powercor and United Energy have been bringing in flexible export limits (up to about 10 kW per phase when the network has room, less when it hasn't), AusNet offers flexible exports where a site would otherwise be held to a low fixed limit, and Jemena's was planned; which sites qualify and the limits are each distributor's call, so check its current offer.
- The emergency backstop (Victorian government, from 1 October 2024; ${BACKSTOP_SOURCE}): new solar systems up to 200 kW, and inverter replacements that aren't like-for-like warranty swaps, must be able to be switched down remotely in an emergency: an inverter on the distributor's approved list that talks CSIP-AUS (directly or through a gateway), kept connected to the internet, registered with the distributor. A home whose inverter can't is limited, often to zero export.
- Batteries count toward the inverter capacity the distributor approves; an AC-coupled battery adds its inverter's rating.
- After the install: the electrician lodges the certificate of electrical safety and the electrical works request; the retailer arranges the meter to be reconfigured; exports start only then.
Never say a site will be approved, nor give a figure as the network's for that home: the distributor decides. When asked something specific you aren't sure of for that network (a fee, a form's name, a limit on a particular feeder), say so and send them to the distributor's connection guide or its customer team.`;

/**
 * Which distributor most of a Victorian postcode is on (8 Nov 2026, Martin: the Distributor field fills itself once the
 * deal's address is known). A best guess for the deal's Distributor field until someone types it: the boundaries run
 * through postcodes, so a home near one can be on the next network. The NMI on the bill settles it, and wins whenever
 * it is on the deal. VERIFY against the distributors' own maps before relying on a postcode near a boundary. Ranges
 * are inclusive, first match wins (the exceptions come before the wide ranges they sit in).
 */
const VIC_POSTCODES: readonly [from: number, to: number, id: string][] = [
  // CitiPower: the CBD and inner suburbs.
  [3000, 3008, "citipower"],
  [3010, 3010, "citipower"],
  [3050, 3054, "citipower"],
  [3065, 3068, "citipower"],
  [3101, 3103, "citipower"],
  [3121, 3124, "citipower"],
  [3126, 3126, "citipower"],
  [3141, 3144, "citipower"],
  [3146, 3146, "citipower"],
  [3181, 3183, "citipower"],
  [3205, 3207, "citipower"],
  // Jemena: Melbourne's north and north-west.
  [3011, 3013, "jemena"],
  [3031, 3049, "jemena"],
  [3055, 3064, "jemena"],
  [3070, 3075, "jemena"],
  [3078, 3081, "jemena"],
  [3084, 3085, "jemena"],
  // United Energy: the south-east and the Mornington Peninsula.
  [3104, 3104, "united-energy"],
  [3125, 3125, "united-energy"],
  [3127, 3133, "united-energy"],
  [3145, 3145, "united-energy"],
  [3147, 3153, "united-energy"],
  [3161, 3204, "united-energy"],
  [3910, 3944, "united-energy"],
  [3975, 3977, "united-energy"],
  // AusNet: the outer east and north, Gippsland and the north-east.
  [3076, 3077, "ausnet"],
  [3082, 3083, "ausnet"],
  [3086, 3099, "ausnet"],
  [3105, 3116, "ausnet"],
  [3134, 3140, "ausnet"],
  [3154, 3160, "ausnet"],
  [3658, 3749, "ausnet"],
  [3750, 3909, "ausnet"],
  [3945, 3974, "ausnet"],
  [3978, 3999, "ausnet"],
  // Powercor: the western suburbs and central and western Victoria.
  [3014, 3030, "powercor"],
  [3208, 3657, "powercor"],
];

/** The states and territories with one distributor for (nearly) every home. */
const ONE_NETWORK: Record<string, string> = {
  SA: "SA Power Networks",
  TAS: "TasNetworks",
  ACT: "Evoenergy",
  NT: "Power and Water",
};

/** How a deal's distributor was found: its NMI (certain), its state (one network there), or its postcode (a guess). */
export type DistributorBasis = "nmi" | "state" | "postcode";
export interface DistributorGuess {
  name: string;
  how: DistributorBasis;
}

export const DISTRIBUTOR_BASIS_WORDS: Record<DistributorBasis, string> = {
  nmi: "From the NMI",
  state: "The state's network",
  postcode: "From the postcode, check the NMI",
};

/** The postcode and state in an address ("12 Example St, Glen Waverley VIC 3150"). */
function placeIn(address: string): { postcode: number | null; state: string | null } {
  const postcode = [...address.matchAll(/(?<![\d/-])(\d{4})(?![\d/-])/g)].map((m) => Number(m[1])).filter((p) => p >= 200);
  const state = /\b(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\b/i.exec(address)?.[1]?.toUpperCase() ?? null;
  return { postcode: postcode.length ? postcode[postcode.length - 1] : null, state };
}

/**
 * The distributor a deal's home is on, as far as can be told without asking anyone: by its NMI when the deal has one,
 * else by the state where there is only one network, else by a Victorian postcode. Null when none of those say.
 */
export function distributorFor(o: { address?: string | null; nmi?: string | null }): DistributorGuess | null {
  const byNmi = distributorForNmi(o.nmi);
  if (byNmi) return { name: byNmi.name, how: "nmi" };
  const { postcode, state } = placeIn(o.address ?? "");
  if (state && ONE_NETWORK[state]) return { name: ONE_NETWORK[state], how: "state" };
  const victorian = postcode !== null && postcode >= 3000 && postcode <= 3999 && (state === null || state === "VIC");
  if (!victorian) return null;
  const id = VIC_POSTCODES.find(([from, to]) => postcode >= from && postcode <= to)?.[2];
  const d = VIC_DISTRIBUTORS.find((x) => x.id === id);
  return d ? { name: d.name, how: "postcode" } : null;
}
