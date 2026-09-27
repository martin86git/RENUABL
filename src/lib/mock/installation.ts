import type { HandoverRecord } from "@/lib/domain/handover";
import { HOME_SYSTEM } from "./home-energy";

/**
 * The example home's installation record, shown on My RENUABL before a real
 * one exists. Always labelled as an example; it has no photos (we don't show
 * made-up installation photos).
 */
export const EXAMPLE_INSTALLATION: HandoverRecord = {
  key: "example",
  jobReference: "RN-EXAMPLE",
  arrays: 2,
  photos: [],
  serials: {
    panels: Array.from({ length: 28 }, (_, i) => `JK475EXAMPLE${String(i + 1).padStart(3, "0")}`),
    inverter: "SIGEXAMPLE10K01",
    batteries: ["SIGBATEXAMPLE01", "SIGBATEXAMPLE02"],
  },
  summary: {
    address: HOME_SYSTEM.address,
    system: `${HOME_SYSTEM.solarKw} kW solar · ${HOME_SYSTEM.batteryKwh} kWh battery`,
    installer: HOME_SYSTEM.installer,
    installedOn: HOME_SYSTEM.installedOn,
  },
  updatedAt: "",
  submittedAt: `${HOME_SYSTEM.installedOn}T06:00:00.000Z`,
};
