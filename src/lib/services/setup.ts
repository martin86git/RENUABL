"use client";
/** Sol's setup wizard for the screens (domain/design/setup.ts): where it stands, skipping a step, putting it away. */
import type { SetupStep, SetupView } from "@/lib/domain/design/setup";
import { ask } from "./crm";

export interface SetupAnswer {
  view: SetupView;
  putAway: boolean;
  firstName: string | null;
}

const PATH = "/api/design/setup";

export const loadSetup = () => ask<SetupAnswer>(PATH);
export const skipSetup = (step: SetupStep, skip = true) =>
  ask<SetupAnswer>(PATH, { method: "POST", body: { do: skip ? "skip" : "unskip", step } });
export const putSetupAway = (away = true) => ask<SetupAnswer>(PATH, { method: "POST", body: { do: away ? "away" : "back" } });

/** Opens the wizard from anywhere (the cog's menu, Sol). */
export const SETUP_OPEN = "renuabl:setup-open";
export const openSetup = () => window.dispatchEvent(new Event(SETUP_OPEN));
