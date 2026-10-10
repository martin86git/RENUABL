/**
 * What a panel makes at a tilt and a direction, beside the same panel lying
 * flat, for the roof designer. Pure, tested.
 *
 * The sunshine is `MONTHLY_SUN`: what falls on flat ground in Melbourne each
 * month (NASA POWER). Getting from
 * flat ground to a tilted panel is the textbook method (Duffie and Beckman,
 * "Solar Engineering of Thermal Processes"), a month at a time on each month's
 * middle day:
 *
 *  1. How clear the month is: its sunshine over what arrives above the
 *     atmosphere. From that, how much of it is diffuse sky light rather than
 *     direct beam (Erbs, Klein and Duffie, 1982, monthly correlation).
 *  2. The day spread over its hours (Collares-Pereira and Rabl, 1979).
 *  3. Each quarter of an hour, the beam turned onto the panel by the angle the
 *     sun meets it at; the sky light partly following the sun and partly spread
 *     over the sky the panel can see (Hay and Davies, 1980); and a little
 *     bounced up off the ground.
 *
 * Checked against figures published for Melbourne: this gives a north panel
 * its best year at about 31 degrees (published: about 32), a flat panel 89% of
 * that best (published: about 86%), east or west at a common pitch about 86%
 * and south about 70% (published: 83 to 86% and 67%). Where it differs it
 * credits tilting with slightly less than the published tables do.
 *
 * What is not in it: shade, the panel running hotter or cooler, glass
 * reflecting more at glancing angles, flat panels holding dirt, and tilted
 * rows shading one another on a flat roof. VERIFY before a figure
 * from here is put in front of a customer.
 */

/**
 * Sunshine by month for Melbourne, January to December (kWh per square metre a
 * day on a flat surface; NASA POWER climatology for -37.9, 145.2). VERIFY
 * before the designer is used outside Victoria: other places need their own record.
 */
export const MONTHLY_SUN = [7.17, 6.26, 5.04, 3.48, 2.29, 1.79, 1.94, 2.71, 3.91, 5.31, 6.32, 7.05];

export const MELBOURNE_LATITUDE = -37.8;

/** `roof`: the pitch a face or panel starts at, a common tiled roof (VERIFY). It is also the pitch the site's yield setting is taken to be for. */
export const TILT = { roof: 22, max: 60 } as const;

export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
/** The day of the year that stands for each month (Klein's mean days). */
const MEAN_DAY = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344] as const;
/** Sunshine above the atmosphere, kW per square metre. */
const SOLAR_CONSTANT = 1.367;
/** The share of sunshine the ground sends back up: grass, paving, roofs. */
const GROUND = 0.2;
const STEP_HOURS = 0.25;

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const turn = (degrees: number) => ((degrees % 360) + 360) % 360;
const worked = new Map<number, number[]>();

/**
 * The sunshine on a panel for an average day of each month, in kWh per square metre.
 * `tilt` is degrees up from flat; `bearing` is the compass direction the panel faces, clockwise from north.
 */
export function sunOnPlane(tilt: number, bearing: number): number[] {
  const t = Math.max(0, Math.min(90, Math.round(tilt)));
  // A flat panel faces nowhere.
  const b = t === 0 ? 0 : Math.round(turn(bearing)) % 360;
  const known = worked.get(t * 360 + b);
  if (known) return known;
  const phi = rad(MELBOURNE_LATITUDE);
  const months = MONTHLY_SUN.map((ground, m) => {
    const n = MEAN_DAY[m];
    const declination = rad(23.45 * Math.sin(rad((360 * (284 + n)) / 365)));
    const sunset = Math.acos(-Math.tan(phi) * Math.tan(declination));
    const orbit = 1 + 0.033 * Math.cos(rad((360 * n) / 365));
    const above =
      (24 / Math.PI) *
      SOLAR_CONSTANT *
      orbit *
      (Math.cos(phi) * Math.cos(declination) * Math.sin(sunset) + sunset * Math.sin(phi) * Math.sin(declination));
    const clearness = ground / above;
    const diffuseShare =
      sunset <= rad(81.4)
        ? 1.391 - 3.56 * clearness + 4.189 * clearness ** 2 - 2.137 * clearness ** 3
        : 1.311 - 3.022 * clearness + 3.427 * clearness ** 2 - 1.821 * clearness ** 3;
    const diffuseDay = ground * diffuseShare;
    const a = 0.409 + 0.5016 * Math.sin(sunset - rad(60));
    const c = 0.6609 - 0.4767 * Math.sin(sunset - rad(60));
    let total = 0;
    for (let hour = -12 + STEP_HOURS / 2; hour < 12; hour += STEP_HOURS) {
      const w = rad(15 * hour);
      if (Math.abs(w) >= sunset) continue;
      // Where the sun is: how far up, and how far to the east and to the north.
      const up = Math.cos(phi) * Math.cos(declination) * Math.cos(w) + Math.sin(phi) * Math.sin(declination);
      if (up <= 0) continue;
      const east = -Math.cos(declination) * Math.sin(w);
      const north = Math.sin(declination) * Math.cos(phi) - Math.cos(declination) * Math.sin(phi) * Math.cos(w);
      const shape = ((Math.PI / 24) * (Math.cos(w) - Math.cos(sunset))) / (Math.sin(sunset) - sunset * Math.cos(sunset));
      const all = Math.max(0, (a + c * Math.cos(w)) * shape * ground) * STEP_HOURS;
      const diffuse = Math.min(all, shape * diffuseDay * STEP_HOURS);
      const beam = all - diffuse;
      // How squarely the sun meets the panel, beside how squarely it meets flat ground.
      const meets = Math.max(
        0,
        east * Math.sin(rad(t)) * Math.sin(rad(b)) + north * Math.sin(rad(t)) * Math.cos(rad(b)) + up * Math.cos(rad(t)),
      );
      const onto = Math.min(meets / Math.max(up, 0.087), 10);
      // The share of the sky light that comes from around the sun, and so turns with the beam.
      const aroundSun = Math.min(1, beam / (SOLAR_CONSTANT * orbit * up * STEP_HOURS));
      total +=
        (beam + diffuse * aroundSun) * onto +
        (diffuse * (1 - aroundSun) * (1 + Math.cos(rad(t)))) / 2 +
        (all * GROUND * (1 - Math.cos(rad(t)))) / 2;
    }
    return total;
  });
  worked.set(t * 360 + b, months);
  return months;
}

/** The same, averaged over the year's days. */
export function yearOnPlane(tilt: number, bearing: number): number {
  return sunOnPlane(tilt, bearing).reduce((sum, day, m) => sum + day * MONTH_DAYS[m], 0) / 365;
}

/** What tilting adds over the year beside lying flat, as a share: 0.1 is ten per cent more. Below zero when it faces away from the sun. */
export function gainOverFlat(tilt: number, bearing: number): number {
  return yearOnPlane(tilt, bearing) / yearOnPlane(0, 0) - 1;
}

/** The tilt that makes the most over a year facing a direction, to the degree. */
export function bestTilt(bearing: number): number {
  let best = 0;
  for (let tilt = 1; tilt <= TILT.max; tilt++) if (yearOnPlane(tilt, bearing) > yearOnPlane(best, bearing)) best = tilt;
  return best;
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"] as const;
/** A bearing as a compass point, to the nearest of sixteen. */
export function compass(bearing: number): string {
  return POINTS[Math.round(turn(bearing) / 22.5) % 16];
}
