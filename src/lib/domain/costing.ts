/**
 * Turns a system into a bill of materials at supplier cost, then into the
 * customer's price: (products + installation) x (1 + margin) + GST. Rebates are in rebates.ts.
 * Product choices and rules are RENUABL's; supplier prices are in catalogue.ts.
 */
import {
  BATTERY,
  BOS,
  EV_CHARGER,
  HEAT_PUMP,
  HYBRID_INVERTERS,
  HYBRID_INVERTERS_3PH,
  PANEL,
  RACKING,
  STRING_INVERTERS,
  STRING_INVERTERS_3PH,
  type InverterItem,
  type Phase,
} from "./catalogue";
import type { RoofType } from "./types";

export const COSTING = {
  margin: 0.2,
  gst: 0.1,
  /** Solar installation labour. Read as 30c per watt of panels. CONFIRM with RENUABL. */
  solarInstallPerWatt: 0.3,
  /** Installing one battery stack, whatever its number of modules. */
  batteryInstallPerStack: 1800,
  /** Added to the installation for a double-storey home. */
  doubleStoreyInstall: 400,
  /** Added to the installation only when a three-phase inverter is fitted. */
  threePhaseInstall: 150,
  /** Under STC rules the panel array can be at most 133% of the inverter's nameplate rating. */
  maxArrayToInverter: 1.33,
  /** Rail per panel (portrait): its width plus this, for the top and the bottom of the panel. */
  railAllowanceM: 0.1,
  railsPerPanelRow: 2,
  /** A 40 A isolator is used for inverters whose AC output is at most this (A per phase); above it, 63 A. */
  isolator40MaxAmps: 32,
  /** Grid voltage (per phase) for an inverter's rated AC output current. */
  gridVolts: 230,
  /** EV charger installation, ex GST. */
  evChargerInstall: 1000,
  // PLACEHOLDERS (not in the supplier list): confirm with Primero before launch.
  heatPumpInstall: 1200,
  addOnPrices: { "smart-switchboard": 1450, "home-backup": 1850, "smart-home": 690 } as Record<string, number>,
} as const;

export type CostGroup = "solar" | "battery" | "ev-charger" | "heat-pump" | "smart-switchboard" | "home-backup" | "smart-home";

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
  /** Three-phase homes get three-phase inverters. "Not sure" is quoted as single phase. */
  phase: Phase;
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

export function inverterOptions(kind: "string" | "hybrid", phase: Phase) {
  if (kind === "hybrid") return phase === "three" ? HYBRID_INVERTERS_3PH : HYBRID_INVERTERS;
  return phase === "three" ? STRING_INVERTERS_3PH : STRING_INVERTERS;
}

/** Most panels the largest inverter for the phase allows. */
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

/** Rated AC output current per phase: 8 kW single phase ≈ 34.8 A; 15 kW three phase ≈ 21.7 A. */
export function acOutputAmps(kw: number, phase: Phase) {
  return (kw * 1000) / (COSTING.gridVolts * (phase === "three" ? 3 : 1));
}

/**
 * The inverter's AC isolator: NHP 40 A (2-pole single phase, 3-pole three phase)
 * while the output is at most 32 A per phase; above that (single-phase 8 kW and
 * up) the 63 A. Three-phase residential inverters stay under 40 A a phase.
 */
export function acIsolatorFor(inverterKw: number, phase: Phase) {
  if (phase === "three") return BOS.acIsolator3ph;
  return acOutputAmps(inverterKw, phase) <= COSTING.isolator40MaxAmps ? BOS.acIsolator : BOS.acIsolator63;
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
    const clips = Math.ceil((input.panelCount * BOS.panelClip.perPanel) / BOS.panelClip.packSize) * BOS.panelClip.packSize;
    lines.push(line("solar", PANEL.sku, PANEL.name, input.panelCount, PANEL.cost));
    lines.push(line("solar", RACKING.rail.sku, `${RACKING.rail.name} (${rails.metres} m needed)`, rails.lengths, RACKING.rail.cost));
    lines.push(
      line("solar", RACKING.splice.sku, RACKING.splice.name, Math.max(0, rails.lengths - COSTING.railsPerPanelRow), RACKING.splice.cost),
    );
    lines.push(line("solar", kit.sku, kit.name, Math.ceil(kw / kit.kw), kit.cost));
    lines.push(line("solar", BOS.dcLabels.sku, BOS.dcLabels.name, 1, BOS.dcLabels.cost));
    lines.push(line("solar", BOS.mc4.sku, BOS.mc4.name, BOS.mc4.minPairs, BOS.mc4.cost));
    lines.push(line("solar", BOS.panelClip.sku, `${BOS.panelClip.name} (${BOS.panelClip.perPanel} per panel)`, clips, BOS.panelClip.cost));
    lines.push(
      line(
        "solar",
        null,
        `Solar installation (${round2(kw)} kW at $${COSTING.solarInstallPerWatt}/W)`,
        1,
        round2(kw * 1000 * COSTING.solarInstallPerWatt),
      ),
    );
    if (input.storeys === "double") lines.push(line("solar", null, "Double-storey installation", 1, COSTING.doubleStoreyInstall));
  }

  // Inverter: the battery controller when there's a battery (or one is planned), else a string inverter.
  const three = input.phase === "three";
  let fitted: InverterItem | null = null;
  if (hybrid && (input.panelCount > 0 || modules > 0)) {
    fitted = selectInverter(kw, inverterOptions("hybrid", input.phase));
    lines.push(line(modules > 0 ? "battery" : "solar", fitted.sku, fitted.name, 1, fitted.cost));
  } else if (input.panelCount > 0 && !input.existingSolar) {
    fitted = selectInverter(kw, inverterOptions("string", input.phase));
    lines.push(line("solar", fitted.sku, fitted.name, 1, fitted.cost));
  }
  if (fitted) {
    const group: CostGroup = modules > 0 && input.panelCount === 0 ? "battery" : "solar";
    const iso = acIsolatorFor(fitted.kw, input.phase);
    lines.push(line(group, iso.sku, iso.name, 1, iso.cost));
    if (three) lines.push(line(group, null, "Three-phase inverter installation", 1, COSTING.threePhaseInstall));
  }

  if (modules > 0) {
    const stacks = Math.ceil(modules / BATTERY.modulesPerStack);
    const gateway = three ? BATTERY.gateway3ph : BATTERY.gateway;
    const sensor = three ? BATTERY.sensor3ph : BATTERY.sensor;
    lines.push(line("battery", BATTERY.module.sku, BATTERY.module.name, modules, BATTERY.module.cost));
    lines.push(line("battery", BATTERY.mount.sku, BATTERY.mount.name, stacks, BATTERY.mount.cost));
    lines.push(line("battery", gateway.sku, gateway.name, 1, gateway.cost));
    if (input.existingSolar) lines.push(line("battery", sensor.sku, sensor.name, 1, sensor.cost));
    lines.push(line("battery", BOS.batteryLabels.sku, BOS.batteryLabels.name, 1, BOS.batteryLabels.cost));
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
    lines.push(line("ev-charger", null, "EV charger installation", 1, COSTING.evChargerInstall));
  }
  for (const id of input.addOns) {
    if (id === "heat-pump") {
      for (const item of HEAT_PUMP) lines.push(line("heat-pump", item.sku, item.name, 1, item.cost));
      lines.push(line("heat-pump", null, "Heat pump installation (placeholder)", 1, COSTING.heatPumpInstall));
    } else if (id in COSTING.addOnPrices) {
      lines.push(line(id as CostGroup, null, `${id} (placeholder price)`, 1, COSTING.addOnPrices[id]));
    }
  }
  return lines;
}

/** Supplier cost -> customer price, including margin and GST. */
export function sellPrice(cost: number) {
  return Math.round(cost * (1 + COSTING.margin) * (1 + COSTING.gst));
}
