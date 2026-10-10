/**
 * What the roof designer can be set to: the panels, inverters and batteries in
 * RENUABL's own product library (`../catalogue.ts`), with their electrical
 * limits where those are on file (`electrical.ts`). Names, outputs and sizes
 * only: never a cost, so nothing here needs keeping from the browser. Pure.
 */
import {
  BATTERY,
  HYBRID_INVERTERS,
  HYBRID_INVERTERS_3PH,
  PANEL,
  STRING_INVERTERS,
  STRING_INVERTERS_3PH,
  type InverterItem,
} from "../catalogue";
import { INVERTER_ELECTRICAL, PANEL_ELECTRICAL, type InverterElectrical, type PanelElectrical } from "./electrical";
import type { InverterSpec, PanelSpec } from "./roof-design";

/** A panel the designer can be set to. `sizeKnown` is false when it is drawn at the usual panel's size. */
export type CataloguePanel = PanelSpec & { sizeKnown: boolean; electrical?: PanelElectrical };

/** An inverter the designer can be set to, with its inputs' limits when they are on file. */
export type CatalogueInverter = InverterSpec & { phase?: "single" | "three"; hybrid?: boolean; electrical?: InverterElectrical };

export interface CatalogueBattery {
  sku: string;
  name: string;
  kwh: number;
}

export function panelCatalogue(): CataloguePanel[] {
  return [
    {
      sku: PANEL.sku,
      name: PANEL.name,
      watts: PANEL.watts,
      long: PANEL.heightM,
      short: PANEL.widthM,
      sizeKnown: true,
      ...(PANEL_ELECTRICAL[PANEL.sku] ? { electrical: PANEL_ELECTRICAL[PANEL.sku] } : {}),
    },
  ];
}

export function inverterCatalogue(): CatalogueInverter[] {
  const kind = (list: InverterItem[], phase: "single" | "three", hybrid: boolean): CatalogueInverter[] =>
    list.map((i) => ({
      sku: i.sku,
      name: i.name,
      kw: i.kw,
      phase,
      hybrid,
      ...(INVERTER_ELECTRICAL[i.sku] ? { electrical: INVERTER_ELECTRICAL[i.sku] } : {}),
    }));
  return [
    ...kind(STRING_INVERTERS, "single", false),
    ...kind(STRING_INVERTERS_3PH, "three", false),
    ...kind(HYBRID_INVERTERS, "single", true),
    ...kind(HYBRID_INVERTERS_3PH, "three", true),
  ];
}

export function batteryCatalogue(): CatalogueBattery[] {
  return [{ sku: BATTERY.module.sku, name: BATTERY.module.name, kwh: BATTERY.module.kwh }];
}
