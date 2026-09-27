import type { Address } from "@/lib/domain/types";

// Stand-in for an address autocomplete provider.
export const SAMPLE_ADDRESSES: Address[] = [
  { line: "14 Wattle Street", suburb: "Marrickville", state: "NSW", postcode: "2204" },
  { line: "7 Harbour View Road", suburb: "Mosman", state: "NSW", postcode: "2088" },
  { line: "22 Jacaranda Avenue", suburb: "Newtown", state: "NSW", postcode: "2042" },
  { line: "3 Banksia Close", suburb: "Penrith", state: "NSW", postcode: "2750" },
  { line: "118 Station Street", suburb: "Parramatta", state: "NSW", postcode: "2150" },
  { line: "41 Grevillea Crescent", suburb: "Randwick", state: "NSW", postcode: "2031" },
  { line: "9 Elm Grove", suburb: "Richmond", state: "VIC", postcode: "3121" },
  { line: "56 Bay Road", suburb: "Brighton", state: "VIC", postcode: "3186" },
];

export function formatAddress(a: Address) {
  return `${a.line}, ${a.suburb} ${a.state} ${a.postcode}`;
}
