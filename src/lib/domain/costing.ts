/**
 * Turns a system into a bill of materials at supplier cost, then into the
 * customer's price: (products + installation) x (1 + margin) + GST, less rebates.
 * Product choices and rules are RENUABL's; supplier prices are in catalogue.ts.
 */
import {
  BATTERY,
  EV_CHARGER,
  HEAT_PUMP,
  HYBRID_INVERTERS,
  PANEL,
  RACKING,
  SOLAR_BOS,
  STRING_INVERTERS,
  type InverterItem,
} from "./catalogue";
import type { RoofType } from "./types";

export const COSTING = {
  margin: 0.2,
  gst: 0.1,
  /** Solar installation labour. Read as 30c per watt of panels. CONFIRM with RENUABL. */
  solarInstallPerWatt: 0.3,
  /** Installing one battery stack, whatever its number of modules. */
  batteryInstallPerStack: 1800,
  /** Under STC rules the panel array can be at most 133% of the inverter's nameplate rating. */
  maxArrayToInverter: 1.33,
  /** Rail per panel (portrait): its width plus this, for the top and the bottom of the panel. */
  railAllowanceM: 0.1,
  railsPerPanelRow: 2,
  // PLACEHOLDERS (not in the supplier list): confirm with Primero before launch.
  evChargerInstall: 450,
  heatPumpInstall: 1200,
  doubleStorey: 650,
  addOnPrices: { "smart-switchboard": 1450, "home-backup": 1850, "smart-home": 690 } as Record<string, number>,
  rebates: {
    // PLACEHOLDERS: confirm STC price, deeming years and the battery factor for the install year.
    stcPrice: 38,
    zoneRating: 1.185, // Melbourne, zone 4
    deemingYears: 5,
    batteryStcsPerKwh: 8.4,
  },
} as const;

export type CostGroup =
  "solar" | "battery" | "ev-charger" | "heat-pump" | "smart-switchboard" | "home-backup" | "smart-home" | "double-storey";

export interface BomLine {
  group: CostGroup;
  sku: string | null; // null for labour and placeholders
  description: string;
  qty: number;
  unitCost: number;
  total: number;
}

export interface CostingInput {
  panelCount: number;
  batteryKwh: number;
  evCharger: boolean;
  /** Keeps an existing system: no string inverter; the battery controller takes any extra panels. */
  existingSolar?: boolean;
  /** Solar-only now, but with an inverter ready for a battery later. */
  batteryReady?: boolean;
  roof: RoofType;
  storeys: "single" | "double";
  addOns: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function arrayKw(panelCount: number) {
  return (panelCount * PANEL.watts) / 1000;
}

/** Smallest inverter the array may connect to (array <= 133% of its rating); the largest if none. */
export function selectInverter(kw: number, options: InverterItem[]): InverterItem {
  return options.find((i) => i.kw * COSTING.maxArrayToInverter >= kw) ?? options[options.length - 1];
}

/** Most panels the largest single-phase inverter allows. */
export function maxPanelsForInverter(options: InverterItem[] = HYBRID_INVERTERS) {
  const largest = Math.max(...options.map((i) => i.kw));
  return Math.floor((largest * COSTING.maxArrayToInverter * 1000) / PANEL.watts);
}

/** Rail for portrait panels: (width + 0.1 m) x 2 per panel, bought in 4.8 m lengths. */
export function railLengths(panelCount: number) {
  const metres = panelCount * COSTING.railsPerPanelRow * (PANEL.widthM + COSTING.railAllowanceM);
  return { metres: round2(metres), lengths: Math.ceil(metres / RACKING.rail.lengthM) };
}

export function batteryModules(kwh: number) {
  return Math.ceil(kwh / BATTERY.module.kwh);
}

/** $1,800 per stack; modules in a further stack cost $1,800 / modules-per-stack each. */
export function batteryInstallCost(modules: number) {
  if (modules <= 0) return 0;
  const extra = Math.max(0, modules - BATTERY.modulesPerStack);
  return COSTING.batteryInstallPerStack + extra * (COSTING.batteryInstallPerStack / BATTERY.modulesPerStack);
}

function line(group: CostGroup, sku: string | null, description: string, qty: number, unitCost: number): BomLine {
  return { group, sku, description, qty, unitCost, total: round2(qty * unitCost) };
}

export function billOfMaterials(input: CostingInput): BomLine[] {
  const lines: BomLine[] = [];
  const kw = arrayKw(input.panelCount);
  const modules = batteryModules(input.batteryKwh);
  const hybrid = modules > 0 || Boolean(input.batteryReady);

  if (input.panelCount > 0) {
    const rails = railLengths(input.panelCount);
    const kit = input.roof === "tin" ? RACKING.tinKit : RACKING.tileKit;
    lines.push(line("solar", PANEL.sku, PANEL.name, input.panelCount, PANEL.cost));
    lines.push(line("solar", RACKING.rail.sku, `${RACKING.rail.name} (${rails.metres} m needed)`, rails.lengths, RACKING.rail.cost));
    lines.push(
      line("solar", RACKING.splice.sku, RACKING.splice.name, Math.max(0, rails.lengths - COSTING.railsPerPanelRow), RACKING.splice.cost),
    );
    lines.push(line("solar", kit.sku, kit.name, Math.ceil(kw / kit.kw), kit.cost));
    for (const item of SOLAR_BOS) lines.push(line("solar", item.sku, item.name, bosQty(item.sku), item.cost));
    lines.push(
      line(
        "solar",
        null,
        `Solar installation (${round2(kw)} kW at $${COSTING.solarInstallPerWatt}/W)`,
        1,
        round2(kw * 1000 * COSTING.solarInstallPerWatt),
      ),
    );
  }

  // Inverter: the battery controller when there's a battery (or one is planned), else a string inverter.
  if (hybrid && (input.panelCount > 0 || modules > 0)) {
    const inv = selectInverter(kw, HYBRID_INVERTERS);
    lines.push(line(modules > 0 ? "battery" : "solar", inv.sku, inv.name, 1, inv.cost));
  } else if (input.panelCount > 0 && !input.existingSolar) {
    const inv = selectInverter(kw, STRING_INVERTERS);
    lines.push(line("solar", inv.sku, inv.name, 1, inv.cost));
  }

  if (modules > 0) {
    const stacks = Math.ceil(modules / BATTERY.modulesPerStack);
    lines.push(line("battery", BATTERY.module.sku, BATTERY.module.name, modules, BATTERY.module.cost));
    lines.push(line("battery", BATTERY.mount.sku, BATTERY.mount.name, stacks, BATTERY.mount.cost));
    lines.push(line("battery", BATTERY.gateway.sku, BATTERY.gateway.name, 1, BATTERY.gateway.cost));
    if (input.existingSolar) lines.push(line("battery", BATTERY.sensor.sku, BATTERY.sensor.name, 1, BATTERY.sensor.cost));
    lines.push(
      line(
        "battery",
        null,
        `Battery installation (${stacks} stack${stacks > 1 ? "s" : ""}, ${modules} modules)`,
        1,
        batteryInstallCost(modules),
      ),
    );
  }

  if (input.evCharger) {
    lines.push(line("ev-charger", EV_CHARGER.sku, EV_CHARGER.name, 1, EV_CHARGER.cost));
    lines.push(line("ev-charger", null, "EV charger installation (placeholder)", 1, COSTING.evChargerInstall));
  }
  for (const id of input.addOns) {
    if (id === "heat-pump") {
      for (const item of HEAT_PUMP) lines.push(line("heat-pump", item.sku, item.name, 1, item.cost));
      lines.push(line("heat-pump", null, "Heat pump installation (placeholder)", 1, COSTING.heatPumpInstall));
    } else if (id in COSTING.addOnPrices) {
      lines.push(line(id as CostGroup, null, `${id} (placeholder price)`, 1, COSTING.addOnPrices[id]));
    }
  }
  if (input.storeys === "double" && input.panelCount > 0) {
    lines.push(line("double-storey", null, "Double-storey installation (placeholder)", 1, COSTING.doubleStorey));
  }
  return lines;
}

/** Share of a pack or drum one typical job uses. */
function bosQty(sku: string) {
  if (sku === "MC4GENPR20") return 0.25; // ~5 pairs
  if (sku === "HPPSOLARHDT2550") return 0.5; // ~25 m
  if (sku === "TON4TDC") return 0.3; // ~30 m
  return 1;
}

/** Supplier cost -> customer price, including margin and GST. */
export function sellPrice(cost: number) {
  return Math.round(cost * (1 + COSTING.margin) * (1 + COSTING.gst));
}

/** Solar and battery rebates (STCs), taken off the price at the point of sale. */
export function rebatesFor(input: Pick<CostingInput, "panelCount" | "batteryKwh">) {
  const r = COSTING.rebates;
  const solarStcs = Math.floor(arrayKw(input.panelCount) * r.zoneRating * r.deemingYears);
  const batteryStcs = Math.floor(batteryModules(input.batteryKwh) * BATTERY.module.kwh * r.batteryStcsPerKwh);
  return Math.round((solarStcs + batteryStcs) * r.stcPrice);
}
