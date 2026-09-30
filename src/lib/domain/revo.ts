/**
 * Revo, RENUABL's guide: one short, friendly line for where the customer is
 * and what they've just chosen, so Revo narrates the journey and backs up each
 * choice. Plain words, no invented figures or claims, never "AI". Pure and tested.
 */
import type { AskContext } from "./ask-types";

export interface RevoFacts {
  /** The route: "profile", "system", "extras", "installer", "date", "reserve", "confirmed". */
  step: string;
  suburb?: string;
  dailyKwh?: number;
  hasSolar?: boolean;
  wantsBattery?: boolean;
  tier?: "essential" | "recommended" | "independence";
  batteryKwh?: number;
  evCharger?: boolean;
  backupAdded?: boolean;
  addOns?: number;
  partner?: string;
  /** "Tuesday 14 October" */
  installDate?: string;
  firstName?: string;
}

const kwh = (n: number) => n.toLocaleString("en-AU", { maximumFractionDigits: 1 });

export function revoLine(f: RevoFacts): string {
  switch (f.step) {
    case "analysing":
      return "Hi, I'm Revo. I'm looking at the sunshine where you live.";
    case "profile":
      if (f.dailyKwh === undefined)
        return `Hi, I'm Revo. Pop in your latest electricity bill and I'll size a system to what your home really uses.`;
      if (f.wantsBattery === true) return "A battery's a great call: it keeps your sunshine for the evening.";
      if (f.wantsBattery === false) return "Solar only is a great start. You can add a battery any time later.";
      return f.hasSolar
        ? `Got it: about ${kwh(f.dailyKwh)} kWh a day, and you already have solar. A few quick questions and I'll do the rest.`
        : `Got it: about ${kwh(f.dailyKwh)} kWh a day. A few quick questions about your home and I'll do the rest.`;
    case "system":
      if (f.tier === "essential")
        return "Essential keeps it simple: solar only, at the lowest upfront cost. You can add a battery any time.";
      if (f.tier === "independence") return "Maximum adds a smart EV charger, so your car can run on your own sunshine too.";
      return f.batteryKwh
        ? `Recommended pairs your solar with a ${kwh(f.batteryKwh)} kWh battery, so you use your own sunshine well into the evening.`
        : "Here's the system I've sized from your bill. Tap any part to see how it works.";
    case "extras":
      if (f.backupAdded) return "Blackout Backup added: your chosen circuits stay on when the grid goes down.";
      if (f.addOns) return "Nice. Anything you've ticked to talk about, we'll go through on your 15-minute call.";
      return "These are all optional. Add what suits you, or skip ahead: you can add them later.";
    case "installer":
      return f.partner
        ? `${f.partner} is matched to your area. They'll install your system and look after you afterwards.`
        : "I'm finding the right installation partner for your home.";
    case "date":
      return f.installDate
        ? `${f.installDate} it is. Your installation partner arrives between 7 and 9am.`
        : "Pick any day that suits you. Your installation partner arrives between 7 and 9am.";
    case "reserve":
      return "Nothing to pay today, and no commitment. Next is your 15-minute call, where you'll see your design and products.";
    case "confirmed":
      return `You're all set${f.firstName ? `, ${f.firstName}` : ""}! Your details are on their way to your inbox. Need a different time? Tap "Change".`;
    default:
      return "Hi, I'm Revo. Ask me anything about solar, batteries or your home.";
  }
}

/** The Ask Revo context for a route (what Revo knows the customer is looking at). */
export function revoContext(step: string): AskContext {
  const map: Record<string, AskContext> = {
    profile: "profile",
    system: "recommendation",
    extras: "extras",
    installer: "installer",
    date: "schedule",
    reserve: "checkout",
    confirmed: "checkout",
  };
  return map[step] ?? "home";
}

/** Revo's bubble on pages outside the flow (no figures or claims). */
export const REVO_PAGE_LINES = {
  home: "Hi, I'm Revo! Got a question about solar, batteries or rebates? Chat with me.",
  learn: "Reading up? Ask me anything as you go.",
} as const;
