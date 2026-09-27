import type { Crew, Installer } from "@/lib/domain/types";

// Fictional installers for development. Replace with the installer network API.
export const INSTALLERS: Installer[] = [
  {
    id: "ins_brightline",
    name: "Brightline Electrical",
    suburbBase: "Marrickville",
    servicePostcodes: [
      [2000, 2234],
      [2745, 2770],
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
    id: "ins_harbour",
    name: "Harbour Solar Co.",
    suburbBase: "Brookvale",
    servicePostcodes: [
      [2060, 2110],
      [2000, 2050],
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
    suburbBase: "Parramatta",
    servicePostcodes: [
      [2111, 2200],
      [2745, 2770],
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
    suburbBase: "Richmond",
    servicePostcodes: [[3000, 3207]],
    rating: 4.8,
    reviewCount: 305,
    installsCompleted: 1410,
    yearsOperating: 10,
    onTimeRate: 0.96,
    firstTimePassRate: 0.97,
    accreditations: ["SAA accredited installer", "Licensed electrical contractor", "Battery endorsed"],
    weeklyCapacity: 12,
  },
];

export const CURRENT_INSTALLER_ID = "ins_brightline";

export const CREWS: Crew[] = [
  { id: "crew_a", name: "Crew A", lead: "Sam Okafor" },
  { id: "crew_b", name: "Crew B", lead: "Priya Nair" },
  { id: "crew_c", name: "Crew C", lead: "Luca Romano" },
];
