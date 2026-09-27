"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { priceSystem, recommendSystem, estimateOutcome } from "@/lib/domain/recommendation";
import type { Address, EnergyProfile, SystemConfig } from "@/lib/domain/types";
import type { ReservationResult } from "@/lib/services/consumer";

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
  profile: Partial<EnergyProfile>;
  config: SystemConfig | null; // null = use recommendation as-is
  installerId: string | null;
  installDate: string | null;
  windowId: string | null;
  reservation: ReservationResult | null;
  call: { date: string; time: string } | null;
  attribution: Attribution | null;
}

const EMPTY: FlowState = {
  address: null,
  profile: {},
  config: null,
  installerId: null,
  installDate: null,
  windowId: null,
  reservation: null,
  call: null,
  attribution: null,
};

const DEFAULT_PROFILE: EnergyProfile = {
  household: "3-4",
  bill: "400-700",
  daytime: "sometimes",
  ev: "none",
  storeys: "single",
  backup: "nice-to-have",
};

const STORAGE_KEY = "renuabl.flow.v1";

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
    const recommendation = recommendSystem(profile);
    const config = state.config ?? recommendation.recommended;
    const price = priceSystem(config, profile);
    const outcome = estimateOutcome(config, profile, price);
    return { profile, recommendation, config, price, outcome };
  }, [state.profile, state.config]);
}

export function isProfileComplete(p: Partial<EnergyProfile>): p is EnergyProfile {
  return Boolean(p.household && p.bill && p.daytime && p.ev && p.storeys && p.backup);
}
