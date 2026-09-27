"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BillSummary } from "@/lib/domain/bill";
import { isAboutComplete as aboutComplete } from "@/lib/domain/existing-solar";
import { estimateOutcome, priceSystem, recommendSystem } from "@/lib/domain/recommendation";
import type { CareBilling } from "@/lib/domain/care";
import type { Address, AddOnId, EnergyProfile, SystemConfig, SystemTier } from "@/lib/domain/types";
import { analyseHome, type CallSlot, type ReservationResult } from "@/lib/services/consumer";

/**
 * Client state for the guided purchase flow. Business rules live in
 * `@/lib/domain`; this module only stores answers and derives views of them.
 */

export interface Attribution {
  source: string | null;
  campaign: string | null;
  landedAt: string;
}

export interface FlowState {
  address: Address | null;
  /** Usage read from the customer's electricity bill; the system is sized from it. */
  bill: BillSummary | null;
  profile: Partial<EnergyProfile>;
  tier: SystemTier;
  config: SystemConfig | null; // null = use the tier's recommendation as-is
  addOns: AddOnId[];
  /** RENUABL Care membership, opt-in only (null = not added). */
  care: CareBilling | null;
  installerId: string | null;
  installDate: string | null;
  windowId: string | null;
  reservation: ReservationResult | null;
  /** The customer booked their 15-minute confirmation call via HubSpot. */
  callBooked: boolean;
  /** The time picked in the in-app calendar (null when booked through HubSpot or not yet booked). */
  call: CallSlot | null;
  attribution: Attribution | null;
}

const EMPTY: FlowState = {
  address: null,
  bill: null,
  profile: {},
  tier: "recommended",
  config: null,
  addOns: [],
  care: null,
  installerId: null,
  installDate: null,
  windowId: null,
  reservation: null,
  callBooked: false,
  call: null,
  attribution: null,
};

const DEFAULT_PROFILE: EnergyProfile = { ev: false, evPlanned: false, wantsBattery: false, backup: false };

/** Never shown: FlowGuard keeps customers on the bill step until a bill has been read. */
const NO_BILL: BillSummary = {
  retailer: null,
  periodDays: 365,
  dailyUsageKwh: 15,
  annualUsageKwh: 5475,
  annualSource: "period",
  eveningShare: null,
  usageRate: null,
  feedInRate: null,
  hasSolar: false,
  exportedDailyKwh: null,
};

const STORAGE_KEY = "renuabl.flow.v6";

function load(): FlowState {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

interface FlowContextValue {
  state: FlowState;
  hydrated: boolean;
  update: (patch: Partial<FlowState>) => void;
  reset: () => void;
}

const FlowContext = createContext<FlowContextValue | null>(null);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = load();
    // Capture acquisition source once (e.g. ?utm_source=meta) for LTV attribution.
    if (!loaded.attribution) {
      const params = new URLSearchParams(window.location.search);
      loaded.attribution = {
        source: params.get("utm_source"),
        campaign: params.get("utm_campaign"),
        landedAt: new Date().toISOString(),
      };
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from sessionStorage after mount
    setState(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: flow still works in memory */
    }
  }, [state, hydrated]);

  const update = useCallback((patch: Partial<FlowState>) => setState((s) => ({ ...s, ...patch })), []);
  const reset = useCallback(() => setState({ ...EMPTY, attribution: state.attribution }), [state.attribution]);

  const value = useMemo(() => ({ state, hydrated, update, reset }), [state, hydrated, update, reset]);
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow must be used inside <FlowProvider>");
  return ctx;
}

/** Derived system view: recommendation, the customer's adjusted config, price and outcome. */
export function useSystem() {
  const { state } = useFlow();
  return useMemo(() => {
    const profile: EnergyProfile = { ...DEFAULT_PROFILE, ...state.profile };
    const analysis = analyseHome(state.address);
    const recommendation = recommendSystem(profile, analysis, state.bill ?? NO_BILL);
    const tier = recommendation.tiers[state.tier];
    const config = state.config ?? tier.config;
    const site = { storeys: analysis.storeys, roof: profile.roofType ?? "unsure" };
    const price = priceSystem(config, site, state.addOns);
    const outcome = estimateOutcome(config, recommendation.usage, price);
    return { profile, analysis, site, recommendation, tier, config, price, outcome };
  }, [state.profile, state.address, state.bill, state.tier, state.config, state.addOns]);
}

/** The "About your home" step is done once the bill is read and every question shown is answered. */
export function isAboutComplete(s: Pick<FlowState, "bill" | "profile">) {
  return aboutComplete(s.bill, s.profile);
}
