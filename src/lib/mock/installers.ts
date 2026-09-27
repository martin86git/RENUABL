import type { Crew, Installer } from "@/lib/domain/types";

// Installer network for development. Replace with the installer network API.
//
// Primero Electric & Solar (primerosolar.com.au, Malvern East) is RENUABL's
// installer of choice in Victoria. Its rating and review count are its public
// Google figures as supplied (Sept 2026: 4.7 from 141 reviews) — refresh them
// from the Google Business Profile before launch. Service area, capacity and
// performance figures are PLACEHOLDERS used only for matching and the portal
// demo; `verifiedStats` stays false so none of them are shown to customers.
// The other installers are fictional.
export const INSTALLERS: Installer[] = [
  {
    id: "ins_primero",
    name: "Primero Electric & Solar",
    suburbBase: "Malvern East",
    servicePostcodes: [[3000, 3999]], // all of Victoria — confirm with Primero
    rating: 4.7,
    reviewCount: 141,
    reviewSource: "Google",
    installsCompleted: 1500,
    yearsOperating: 10,
    onTimeRate: 0.97,
    firstTimePassRate: 0.98,
    accreditations: ["Accredited & insured"],
    weeklyCapacity: 14,
    preferred: true,
    verifiedStats: false,
  },
  {
    id: "ins_bayside",
    name: "Bayside Solar Co.",
    suburbBase: "Cheltenham",
    servicePostcodes: [
      [3141, 3207], // south-east suburbs
      [3910, 3944], // Mornington Peninsula
    ],
    rating: 4.8,
    reviewCount: 268,
    installsCompleted: 980,
    yearsOperating: 8,
    onTimeRate: 0.95,
    firstTimePassRate: 0.96,
    accreditations: ["SAA accredited installer", "Licensed electrical contractor"],
    weeklyCapacity: 9,
    verifiedStats: true, // fictional installer
  },
  {
    id: "ins_westwind",
    name: "Westwind Energy",
    suburbBase: "Sunshine",
    servicePostcodes: [
      [3000, 3062], // inner and western suburbs
      [3335, 3340], // Melton
      [3427, 3431], // Sunbury
    ],
    rating: 4.7,
    reviewCount: 190,
    installsCompleted: 1240,
    yearsOperating: 14,
    onTimeRate: 0.93,
    firstTimePassRate: 0.95,
    accreditations: ["SAA accredited installer", "Licensed electrical contractor", "Battery endorsed"],
    weeklyCapacity: 11,
    verifiedStats: true, // fictional installer
  },
  {
    id: "ins_greenfield",
    name: "Greenfield Power",
    suburbBase: "Geelong",
    servicePostcodes: [[3211, 3228]], // Geelong and Bellarine
    rating: 4.8,
    reviewCount: 305,
    installsCompleted: 1410,
    yearsOperating: 10,
    onTimeRate: 0.96,
    firstTimePassRate: 0.97,
    accreditations: ["SAA accredited installer", "Licensed electrical contractor", "Battery endorsed"],
    weeklyCapacity: 12,
    verifiedStats: true, // fictional installer
  },
  {
    id: "ins_goldfields",
    name: "Goldfields Energy",
    suburbBase: "Ballarat",
    servicePostcodes: [
      [3350, 3357], // Ballarat
      [3550, 3556], // Bendigo
    ],
    rating: 4.8,
    reviewCount: 156,
    installsCompleted: 720,
    yearsOperating: 9,
    onTimeRate: 0.96,
    firstTimePassRate: 0.97,
    accreditations: ["SAA accredited installer", "Licensed electrical contractor", "Battery endorsed"],
    weeklyCapacity: 7,
    verifiedStats: true, // fictional installer
  },
];

export const CURRENT_INSTALLER_ID = "ins_primero";

export const CREWS: Crew[] = [
  { id: "crew_a", name: "Crew A", lead: "Michael Tran" },
  { id: "crew_b", name: "Crew B", lead: "Priya Nair" },
  { id: "crew_c", name: "Crew C", lead: "Luca Romano" },
];

export const CURRENT_USER = { name: "Michael Tran", firstName: "Michael" };
