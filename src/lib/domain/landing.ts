/**
 * Ad landing pages: one angle each, each starting the same plan with a preset.
 * "battery" is for Victorian homes that already have solar ("Got solar? Add a
 * battery"): the plan starts with "Would you like a battery?" answered yes, and
 * the bill's exports bring up the existing-solar questions as usual.
 * Copy is pure and tested: no rebate amounts, no feed-in figures, nothing
 * "exact", "guaranteed", "best" or "first".
 */

export type LandingKey = "battery";

export interface LandingPage {
  key: LandingKey;
  path: string;
  /** In HubSpot notes and staff texts. */
  label: string;
  title: string;
  description: string;
  eyebrow: string;
  headline: string;
  lead: string;
  points: string[];
  addressLabel: string;
  /** Why now, true and without figures. */
  urgency: string;
}

export const LANDING_PAGES: Record<LandingKey, LandingPage> = {
  battery: {
    key: "battery",
    path: "/battery",
    label: "Got solar? Add a battery",
    title: "Add a battery to your solar",
    description:
      "Already have solar in Victoria? Upload your bill and see the battery sized to your home, with the federal battery incentive worked out, in about 2 minutes.",
    eyebrow: "Already have solar?",
    headline: "Keep your sunshine for the evening.",
    lead: "Most of your solar goes to the grid during the day for a small credit, then you buy power back every evening. A battery stores it for when you need it.",
    points: [
      "Sized from your bill, in about 2 minutes",
      "Keeps your panels: we add to what you have",
      "The federal battery incentive worked out for you",
      "You pick your install day",
      "Free to reserve, nothing charged until you're happy",
    ],
    addressLabel: "Your battery plan, priced in about 2 minutes.",
    urgency: "The federal battery incentive gets smaller over time, so it's worth looking now.",
  },
};

export const landingLabel = (key: LandingKey | null | undefined) => (key ? LANDING_PAGES[key].label : undefined);
