// Post-install home energy data for "My RENUABL". Replace with telemetry API.

export interface HourPoint {
  hour: number;
  solar: number; // kW
  usage: number; // kW
}

export interface DayTotal {
  label: string;
  solarKwh: number;
  usageKwh: number;
  gridKwh: number;
}

export interface Insight {
  id: string;
  title: string;
  body: string;
  tone: "positive" | "neutral" | "tip";
}

export interface HealthItem {
  id: string;
  label: string;
  status: "good" | "attention";
  detail: string;
}

export interface Upgrade {
  id: string;
  title: string;
  body: string;
  estimate: string;
}

export const HOME_SYSTEM = {
  owner: "Alex",
  address: "14 Wattle Street, Marrickville",
  installedOn: "2026-06-18",
  solarKw: 8.8,
  batteryKwh: 13.5,
  installer: "Brightline Electrical",
};

function bell(hour: number, peak: number, centre = 12.5, spread = 3.2) {
  const v = peak * Math.exp(-((hour - centre) ** 2) / (2 * spread ** 2));
  return hour < 6 || hour > 19 ? 0 : Math.round(v * 100) / 100;
}

const usageShape = [
  0.4, 0.35, 0.3, 0.3, 0.3, 0.45, 0.9, 1.4, 1.1, 0.7, 0.6, 0.6, 0.7, 0.6, 0.6, 0.8, 1.2, 2.1, 2.6, 2.4, 1.9, 1.4, 0.9, 0.6,
];

export const TODAY_CURVE: HourPoint[] = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  solar: bell(hour, 6.4),
  usage: usageShape[hour],
}));

export const TODAY = {
  solarKwh: 38.6,
  usageKwh: 24.1,
  selfPoweredShare: 0.91,
  batteryPercent: 82,
  savedToday: 9.4,
  exportedKwh: 14.8,
  headline: "Your home ran on sunshine for most of today.",
  narrative: "Solar covered 91% of what you used. Your battery filled by 1pm and will carry you through tonight's evening peak.",
};

export const WEEK: DayTotal[] = [
  { label: "Mon", solarKwh: 34.1, usageKwh: 22.8, gridKwh: 2.1 },
  { label: "Tue", solarKwh: 29.4, usageKwh: 25.3, gridKwh: 3.9 },
  { label: "Wed", solarKwh: 18.2, usageKwh: 23.9, gridKwh: 8.6 },
  { label: "Thu", solarKwh: 36.8, usageKwh: 21.4, gridKwh: 1.2 },
  { label: "Fri", solarKwh: 37.5, usageKwh: 26.2, gridKwh: 1.8 },
  { label: "Sat", solarKwh: 39.2, usageKwh: 29.7, gridKwh: 2.4 },
  { label: "Sun", solarKwh: 38.6, usageKwh: 24.1, gridKwh: 2.2 },
];

export const MONTH_SUMMARY = {
  savings: 214,
  savingsSinceInstall: 612,
  co2AvoidedKg: 486,
  selfPoweredShare: 0.84,
};

export const INSIGHTS: Insight[] = [
  {
    id: "ins1",
    title: "Evenings are your biggest opportunity",
    body: "Most of your grid use happens between 6 and 8pm. Running the dishwasher at midday instead could save around $9 a month.",
    tone: "tip",
  },
  {
    id: "ins2",
    title: "Best week since install",
    body: "You powered 88% of your home from the sun this week, up from 79% last week.",
    tone: "positive",
  },
  {
    id: "ins3",
    title: "Cloudy Wednesday, handled",
    body: "Generation dropped by half on Wednesday. Your battery covered the gap until 4pm.",
    tone: "neutral",
  },
];

export const HEALTH: HealthItem[] = [
  { id: "h1", label: "Solar panels", status: "good", detail: "All 20 panels producing as expected" },
  { id: "h2", label: "Inverter", status: "good", detail: "Online · firmware up to date" },
  { id: "h3", label: "Battery", status: "good", detail: "82% charged · health 100%" },
  { id: "h4", label: "Connection", status: "attention", detail: "Wi-Fi signal is weak at the inverter. Data may be delayed." },
];

export const UPGRADES: Upgrade[] = [
  { id: "u1", title: "Smart EV charger", body: "Charge your car from surplus solar, automatically.", estimate: "From $1,650" },
  { id: "u2", title: "Add 4 panels", body: "Your roof has space for about 1.8 kW more on the north-west face.", estimate: "From $1,420" },
  { id: "u3", title: "Hot water heat pump", body: "Heat water with midday sunshine instead of the evening grid.", estimate: "From $2,900" },
];
