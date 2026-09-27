import type { Crew, Installer } from "@/lib/domain/types";

// Fictional Victorian installers for development. Replace with the installer network API.
export const INSTALLERS: Installer[] = [
  {
    id: "ins_brightline",
    name: "Brightline Electrical",
    suburbBase: "Brunswick",
    servicePostcodes: [
      [3000, 3207], // metropolitan Melbourne
      [3750, 3810], // outer north and east
    ],
    rating: 4.9,
    reviewCount: 412,
    installsCompleted: 1860,
    yearsOperating: 11,
    onTimeRate: 0.97,
    firstTimePassRate: 0.98,
    accreditations: ["SAA accredited designer & installer", "Licensed electrical contractor", "Battery endorsed"],
    weeklyCapacity: 14,
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
  },
];

export const CURRENT_INSTALLER_ID = "ins_brightline";

export const CREWS: Crew[] = [
  { id: "crew_a", name: "Crew A", lead: "Sam Okafor" },
  { id: "crew_b", name: "Crew B", lead: "Priya Nair" },
  { id: "crew_c", name: "Crew C", lead: "Luca Romano" },
];
