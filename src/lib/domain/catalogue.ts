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

/** Solar-only systems (no battery now or planned): Sungrow single-phase string inverters. */
export const STRING_INVERTERS: InverterItem[] = [
  { sku: "SGWSG5.0RS", name: "Sungrow 5kW Single Phase 2 MPPT Inverter", cost: 870, kw: 5 },
  { sku: "SGWSG8.0RS-G3-ADA", name: "Sungrow 8kW Single Phase 3 MPPT String Inverter", cost: 1650, kw: 8 },
  { sku: "SGWSG10RS-G3-ADA", name: "Sungrow 10kW Single Phase 3MPPT Inverter", cost: 1755.55, kw: 10 },
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
  /** Reads the existing system when a battery is added to it. */
  sensor: { sku: "SIG1426000005", name: "Sigenergy Single Phase Power Sensor With External CT 120", cost: 115 },
} as const;

export const RACKING = {
  rail: { sku: "ANTRAIL4800/B", name: "Antai Black Rail 4800mm", cost: 24.81, lengthM: 4.8 },
  /** Each kit covers up to 2.0 kW of panels. */
  tinKit: { sku: "ANTTIN20", name: "Antai 2.0kW Tin Kit (Black)", cost: 49, kw: 2 },
  tileKit: { sku: "ANTTILE20", name: "Antai 2.0kW Tile Kit (Black)", cost: 99.8, kw: 2 },
  splice: { sku: "ANTSPLICE", name: "Antai Black Splice", cost: 1.88 },
} as const;

export const EV_CHARGER: CatalogueItem = { sku: "SIG11070011", name: "Sigenergy 7.0kW EV AC Charger", cost: 908 };

export const HEAT_PUMP: CatalogueItem[] = [
  { sku: "FSRHP250M1-U1", name: "HAIER 250L R290 Hot Water Heat Pump", cost: 2199 },
  { sku: "BPSQIK15R", name: "Quick Installation Kit to suit Haier Heat Pumps", cost: 169.1 },
];

/** Balance of system per solar job: DC isolator, MC4 connectors, conduit, cable, labels. */
export const SOLAR_BOS: CatalogueItem[] = [
  { sku: "NHPNL432PV", name: "4P 32A 1500V DC IP66 Isolator", cost: 31.95 },
  { sku: "MC4GENPR20", name: "Genuine MC4 - Pack of 20 PAIRS", cost: 58.99 },
  { sku: "HPPSOLARHDT2550", name: "25mm Solar Corrugated Conduit 50 Metres Grey HD", cost: 78 },
  { sku: "TON4TDC", name: "Tonglin 4mm DC Twin Cable (100 Mtr Drum)", cost: 167.9 },
  { sku: "MMELABELDC", name: "DC Solar Label Kit AS/NZS 4777.1:2024 with Site Map", cost: 16.85 },
];
