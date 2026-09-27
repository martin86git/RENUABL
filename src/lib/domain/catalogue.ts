/**
 * The products RENUABL quotes, at supplier cost. Source: AWM Clayton solar
 * price list, August 2026 (supplied by RENUABL). Prices are ex GST.
 * To update: change the prices here (same SKUs) and redeploy.
 */

export const PRICE_LIST = { source: "AWM Clayton", edition: "August 2026", pricesIncludeGst: false } as const;

export interface CatalogueItem {
  sku: string;
  name: string;
  cost: number;
}

export interface PanelItem extends CatalogueItem {
  watts: number;
  /** Mounted portrait: height is up the roof, width across. */
  heightM: number;
  widthM: number;
}

export interface InverterItem extends CatalogueItem {
  kw: number;
}

export const PANEL: PanelItem = {
  sku: "JKM475N-48QL6-DB",
  name: "Jinko 475W All Black Dual Glass Mono N-Type",
  cost: 123.5,
  watts: 475,
  // VERIFY against the Jinko datasheet; drives rail quantities.
  heightM: 1.762,
  widthM: 1.134,
};

export type Phase = "single" | "three";

/** Solar-only systems (no battery now or planned): Sungrow string inverters. */
export const STRING_INVERTERS_3PH: InverterItem[] = [
  { sku: "SGWSG5.0RT", name: "Sungrow 5kW Three Phase Solar 2 MPPT Inverter", cost: 1295, kw: 5 },
  { sku: "SGWSG8.0RT", name: "Sungrow 8kW Three Phase Solar 2MPPT Inverter", cost: 1400, kw: 8 },
  { sku: "SGWSG10RT", name: "Sungrow 10kW Three Phase Solar 2 MPPT Inverter", cost: 1655, kw: 10 },
  { sku: "SGWSG15RT", name: "Sungrow 15kW Three Phase Solar 2 MPPT Inverter", cost: 1949, kw: 15 },
];

export const STRING_INVERTERS: InverterItem[] = [
  { sku: "SGWSG5.0RS", name: "Sungrow 5kW Single Phase 2 MPPT Inverter", cost: 870, kw: 5 },
  { sku: "SGWSG8.0RS-G3-ADA", name: "Sungrow 8kW Single Phase 3 MPPT String Inverter", cost: 1650, kw: 8 },
  { sku: "SGWSG10RS-G3-ADA", name: "Sungrow 10kW Single Phase 3MPPT Inverter", cost: 1755.55, kw: 10 },
];

/** Battery systems on three-phase homes. */
export const HYBRID_INVERTERS_3PH: InverterItem[] = [
  { sku: "SIG11010047", name: "Sigenergy 5.0kW SigenStor Three Phase Controller", cost: 2300, kw: 5 },
  { sku: "SIG11010045", name: "Sigenergy 10.0kW SigenStor Three Phase Controller", cost: 2663, kw: 10 },
  { sku: "SIG11010046", name: "Sigenergy 15.0kW SigenStor Three Phase Controller", cost: 3511, kw: 15 },
];

/** Battery systems: the Sigenergy SigenStor controller is the (hybrid) inverter. */
export const HYBRID_INVERTERS: InverterItem[] = [
  { sku: "SIG11040025", name: "Sigenergy 5.0kW SigenStor Single Phase Controller", cost: 1343, kw: 5 },
  { sku: "SIG11040026", name: "Sigenergy 6.0kW SigenStor Single Phase Controller", cost: 1453, kw: 6 },
  { sku: "SIG11040040", name: "Sigenergy 8.0kW SigenStor Single Phase Controller", cost: 2482, kw: 8 },
  { sku: "SIG11040041", name: "Sigenergy 10.0kW SigenStor Single Phase Controller", cost: 2675, kw: 10 },
];

export const BATTERY = {
  module: { sku: "SIG11130001", name: "Sigenergy 8.0kWh SigenStor Battery Module", cost: 2299, kwh: 8 },
  modulesPerStack: 6,
  mount: { sku: "SIG30020002", name: "Sigenergy SigenStor Wall Mount Installation Kit", cost: 202 },
  /** Needed for backup during outages. */
  gateway: { sku: "SIG11110049", name: "Sigen Energy Gateway Single Phase", cost: 695 },
  gateway3ph: { sku: "SIG11110048", name: "Sigen Energy Gateway Three Phase 30kw", cost: 859 },
  /** Reads the existing system when a battery is added to it. */
  sensor: { sku: "SIG1426000005", name: "Sigenergy Single Phase Power Sensor With External CT 120", cost: 115 },
  sensor3ph: { sku: "SIG1426000007", name: "Sigenergy Three Phase Power Sensor With External CT 120", cost: 217 },
} as const;

export const RACKING = {
  rail: { sku: "ANTRAIL4800/B", name: "Antai Black Rail 4800mm", cost: 24.81, lengthM: 4.8 },
  /** Each kit covers up to 2.0 kW of panels. */
  tinKit: { sku: "ANTTIN20", name: "Antai 2.0kW Tin Kit (Black)", cost: 49, kw: 2 },
  tileKit: { sku: "ANTTILE20", name: "Antai 2.0kW Tile Kit (Black)", cost: 99.8, kw: 2 },
  /** Flat roofs: panels tilted 10–15° (in place of the tin kit). */
  tiltKit: { sku: "ANTTILT10/15", name: "Antai 2.0kW Black Tilt Kit 10-15 Degrees", cost: 129, kw: 2 },
  splice: { sku: "ANTSPLICE", name: "Antai Black Splice", cost: 1.88 },
} as const;

export const EV_CHARGER: CatalogueItem = { sku: "SIG11070011", name: "Sigenergy 7.0kW EV AC Charger", cost: 908 };

export const HEAT_PUMP: CatalogueItem[] = [
  { sku: "FSRHP250M1-U1", name: "HAIER 250L R290 Hot Water Heat Pump", cost: 2199 },
  { sku: "BPSQIK15R", name: "Quick Installation Kit to suit Haier Heat Pumps", cost: 169.1 },
];

/** Balance of system (RENUABL's list). */
export const BOS = {
  dcLabels: { sku: "MMELABELDC", name: "DC Solar Label Kit AS/NZS 4777.1:2024 with Site Map", cost: 16.85 },
  /** Needed as well as the DC kit when there is solar and a battery. */
  batteryLabels: { sku: "AWMPVBATTERY", name: "Universal Battery Label Kit", cost: 28 },
  /** Minimum of ten male/female pairs per job. */
  mc4: { sku: "NEAMC4EVO2", name: "MC4 EVO2 Connector Pairs", cost: 3.5, minPairs: 10 },
  /** Four per panel, bought in whole packs of 100. */
  panelClip: { sku: "MTLCLIP-M4X2/SS", name: "2 Wire Cable Clip", cost: 0.235, perPanel: 4, packSize: 100 },
  /** AC isolators: 40 A for inverters up to 32 A output; a 63 A for bigger single-phase inverters (see acIsolatorFor). */
  acIsolator: { sku: "NHPNL140L", name: "NHP 40 Amp 2 Pole 250 Volt AC IP66 Large N-Line Industrial Isolator", cost: 17 },
  acIsolator3ph: { sku: "NHPNL340L", name: "NHP 40 Amp 3 Pole 500 Volt AC IP66 Large N-Line Industrial Isolator", cost: 19.57 },
  /**
   * STAND-IN: the list has no NHP 63 A 2-pole, so this is its 63 A 3-pole (ZJ Beny).
   * Swap for the 63 A 2-pole once it's on the price list.
   */
  acIsolator63: { sku: "ZJBBYA-63-L", name: "ZJ Beny 250 Volt 63 Amp 3 Pole AC Weatherproof Isolator Switch", cost: 23.95 },
} as const;
