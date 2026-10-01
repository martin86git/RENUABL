import type { Address } from "@/lib/domain/types";

// Stand-in for an address autocomplete provider. Launch market: Victoria.
export const SAMPLE_ADDRESSES: Address[] = [
  { line: "8 Example Court", suburb: "Glen Waverley", state: "VIC", postcode: "3150" },
  { line: "14 Wattle Street", suburb: "Brunswick", state: "VIC", postcode: "3056" },
  { line: "22 Jacaranda Avenue", suburb: "Northcote", state: "VIC", postcode: "3070" },
  { line: "9 Elm Grove", suburb: "Richmond", state: "VIC", postcode: "3121" },
  { line: "118 Station Street", suburb: "Box Hill", state: "VIC", postcode: "3128" },
  { line: "7 Bay View Road", suburb: "Brighton", state: "VIC", postcode: "3186" },
  { line: "3 Banksia Close", suburb: "Werribee", state: "VIC", postcode: "3030" },
  { line: "41 Grevillea Crescent", suburb: "Geelong West", state: "VIC", postcode: "3218" },
  { line: "26 Wattlebird Way", suburb: "Ballarat Central", state: "VIC", postcode: "3350" },
  { line: "12 Ironbark Drive", suburb: "Bendigo", state: "VIC", postcode: "3550" },
];

export function formatAddress(a: Address) {
  return `${a.line}, ${a.suburb} ${a.state} ${a.postcode}`;
}
