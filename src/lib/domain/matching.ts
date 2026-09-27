import type { Installer, InstallerMatch } from "./types";

function servesPostcode(installer: Installer, postcode: number) {
  return installer.servicePostcodes.some(([lo, hi]) => postcode >= lo && postcode <= hi);
}

/**
 * Rank installers for a job. RENUABL presents the top match by default;
 * the rest are only exposed behind a secondary "alternatives" link.
 */
export function rankInstallers(installers: Installer[], postcode: string): InstallerMatch[] {
  const pc = Number.parseInt(postcode, 10);

  return (
    installers
      .filter((i) => Number.isNaN(pc) || servesPostcode(i, pc))
      .map((installer) => {
        const quality = installer.rating / 5; // 0..1
        const reliability = installer.onTimeRate;
        const workmanship = installer.firstTimePassRate;
        const experience = Math.min(1, installer.installsCompleted / 1500);
        const capacity = Math.min(1, installer.weeklyCapacity / 12);

        const score = quality * 0.3 + reliability * 0.25 + workmanship * 0.25 + experience * 0.1 + capacity * 0.1;

        const reasons: string[] = [];
        if (installer.preferred) reasons.push(`RENUABL's installation partner of choice, based in ${installer.suburbBase}.`);
        else reasons.push(`Works in your area, based in ${installer.suburbBase}.`);
        if (installer.reviewSource)
          reasons.push(`Rated ${installer.rating.toFixed(1)} from ${installer.reviewCount} ${installer.reviewSource} reviews.`);
        // Performance claims only when the figures are verified.
        if (installer.verifiedStats) {
          if (installer.onTimeRate >= 0.95) reasons.push(`Arrives on time for ${Math.round(installer.onTimeRate * 100)}% of installs.`);
          if (installer.firstTimePassRate >= 0.95)
            reasons.push(`${Math.round(installer.firstTimePassRate * 100)}% of systems pass inspection first time.`);
          if (installer.rating >= 4.8) reasons.push(`Rated ${installer.rating.toFixed(1)} by ${installer.reviewCount} RENUABL customers.`);
        }

        return { installer, score: Math.round(score * 1000) / 1000, reasons };
      })
      // The preferred partner leads wherever it operates; everyone else by score.
      .sort((a, b) => Number(Boolean(b.installer.preferred)) - Number(Boolean(a.installer.preferred)) || b.score - a.score)
  );
}

/** Installers customers may be matched with: fictional demo installers only in preview. */
export function customerNetwork<T extends { fictional?: boolean }>(installers: T[], preview: boolean): T[] {
  return preview ? installers : installers.filter((i) => !i.fictional);
}
