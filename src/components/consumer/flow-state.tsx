"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BillSummary } from "@/lib/domain/bill";
import { landingSource } from "@/lib/domain/google-ads";
import type { ContactDetails } from "@/lib/domain/contact";
import type { InverterSummary } from "@/lib/domain/inverter";
import { VERIFIED_RATES, type RebateRates } from "@/lib/domain/rebates";
import type { Sunshine } from "@/lib/domain/sunshine";
import { isAboutComplete as aboutComplete, solarSituation } from "@/lib/domain/existing-solar";
import { SOLAR_VIC_LEAD_DAYS, installLeadDays } from "@/lib/domain/scheduling";
import { ASSUMPTIONS, estimateOutcome, priceSystem, recommendSystem } from "@/lib/domain/recommendation";
import type { CareBilling } from "@/lib/domain/care";
import type { LandingKey } from "@/lib/domain/landing";
import type { Address, AddOnId, EnergyProfile, SystemConfig, SystemTier } from "@/lib/domain/types";
import { partnerPricingFor } from "@/lib/domain/partner";
import {
  analyseHome,
  fetchRebateRates,
  fetchSupplierPrices,
  fetchRoofInsights,
  fetchSunshine,
  getInstaller,
  type CallSlot,
  type ReservationResult,
} from "@/lib/services/consumer";
import { roofPanelLimit, usableRoofSunHours, type RoofInsights } from "@/lib/domain/solar-roof";
import type { RoofModel } from "@/lib/domain/roof-layout";

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
  /** The postcode the partner-matching sequence last ran for (it plays once per address). */
  matchedPostcode: string | null;
  installDate: string | null;
  windowId: string | null;
  reservation: ReservationResult | null;
  /** Given when reserving; also pre-fills the call booking. */
  contact: ContactDetails | null;
  /** An existing inverter read from the customer's photos (expanding an existing system). */
  existingInverter: InverterSummary | null;
  /** Today's rebate rules, loaded once per visit (null until loaded: the verified copy is used). */
  rates: RebateRates | null;
  /** Supplier prices imported on /admin (by SKU), fetched each visit. */
  prices: { costs: Record<string, number>; fetchedAt: number } | null;
  /** NASA POWER sunshine for the home's coordinates. */
  sunshine: Sunshine | null;
  /** Google Solar API roof data for the home's coordinates (data null: Google has none). */
  roof: { lat: number; lng: number; data: RoofInsights | null; model?: RoofModel | null; reason?: string } | null;
  /** Solar Victoria (VIC homes only): the customer's choices at checkout. */
  solarVic: { rebate: boolean; loan: boolean };
  /** The customer booked their 15-minute confirmation call via HubSpot. */
  callBooked: boolean;
  /** The time picked in the in-app calendar (null when booked through HubSpot or not yet booked). */
  call: CallSlot | null;
  attribution: Attribution | null;
  /** Meta BillUploaded sent for this visit (once a bill is read). */
  billTracked: boolean;
  /** The spend-range estimate was sent to Meta once (SpendEstimated). */
  spendTracked: boolean;
  /** Meta Lead sent for this visit (once a date is reserved). */
  reservedTracked: boolean;
  /** "I'm interested in healthy home upgrades" on the reserve step (optional, unticked). */
  healthyInterest: boolean;
  /** The landing page the plan started from (`LANDING_PAGES`), e.g. "battery"; null = the home page. */
  entry: LandingKey | null;
  /** A mobile was left at the top of "About your home" (we've texted them and staff will call). */
  earlyContact: boolean;
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
  matchedPostcode: null,
  installDate: null,
  windowId: null,
  reservation: null,
  contact: null,
  existingInverter: null,
  rates: null,
  prices: null,
  sunshine: null,
  roof: null,
  solarVic: { rebate: false, loan: false },
  callBooked: false,
  call: null,
  attribution: null,
  billTracked: false,
  spendTracked: false,
  reservedTracked: false,
  healthyInterest: false,
  entry: null,
  earlyContact: false,
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

const STORAGE_KEY = "renuabl.flow.v7";

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
        // utm_source when the ad link has one, else "google"/"meta" from their click IDs.
        source: landingSource(window.location.search),
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

  // Rebate rules: once per visit, or when the saved copy is from another day.
  useEffect(() => {
    if (!hydrated) return;
    const today = new Date().toISOString().slice(0, 10);
    if (state.rates?.asOf === today) return;
    let cancelled = false;
    void fetchRebateRates().then((rates) => {
      if (!cancelled && rates) setState((s) => ({ ...s, rates }));
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, state.rates?.asOf]);

  // Supplier prices from the latest import: once per visit, refreshed after 10 minutes.
  useEffect(() => {
    if (!hydrated) return;
    if (state.prices && Date.now() - state.prices.fetchedAt < 10 * 60_000) return;
    let cancelled = false;
    void fetchSupplierPrices().then((costs) => {
      if (!cancelled && costs) setState((s) => ({ ...s, prices: { costs, fetchedAt: Date.now() } }));
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, state.prices]);

  // NASA sunshine for the home's coordinates.
  const lat = state.address?.lat;
  const lng = state.address?.lng;
  useEffect(() => {
    if (!hydrated || lat === undefined || lng === undefined) return;
    if (state.sunshine && Math.abs(state.sunshine.lat - lat) < 0.01 && Math.abs(state.sunshine.lng - lng) < 0.01) return;
    let cancelled = false;
    void fetchSunshine(lat, lng).then((sunshine) => {
      if (!cancelled) setState((s) => ({ ...s, sunshine }));
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, lat, lng, state.sunshine]);

  // Google's roof data for the home, once per address (every lookup is charged).
  const roofDone = Boolean(
    state.roof &&
    state.roof.model !== undefined &&
    // Only Google's own "no roof here" is final; a setup or network failure is asked again next visit.
    (state.roof.data !== null || state.roof.reason === "no-coverage" || state.roof.reason === "not-this-home") &&
    lat !== undefined &&
    lng !== undefined &&
    Math.abs(state.roof.lat - lat) < 1e-5 &&
    Math.abs(state.roof.lng - lng) < 1e-5,
  );
  useEffect(() => {
    if (!hydrated || lat === undefined || lng === undefined || roofDone) return;
    let cancelled = false;
    void fetchRoofInsights(lat, lng).then((r) => {
      if (!cancelled) setState((s) => ({ ...s, roof: { lat, lng, data: r.insights, model: r.model, reason: r.reason } }));
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, lat, lng, roofDone]);

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

/** Days to the first install day, and whether Solar Victoria approval may be needed (new systems in Victoria). */
export function useInstallLead() {
  const { state } = useFlow();
  const expanding = Boolean(state.bill && solarSituation(state.bill, { ...DEFAULT_PROFILE, ...state.profile }) === "expand");
  const days = installLeadDays({ state: state.address?.state, expandingExistingSolar: expanding });
  return { days, solarVic: days === SOLAR_VIC_LEAD_DAYS };
}

/** Derived system view: recommendation, the customer's adjusted config, price and outcome. */
export function useSystem() {
  const { state } = useFlow();
  return useMemo(() => {
    const profile: EnergyProfile = { ...DEFAULT_PROFILE, ...state.profile };
    const phase = state.profile.phase === "three" ? "three" : "single";
    const rates = state.rates ?? VERIFIED_RATES;
    const analysis = {
      ...analyseHome(state.address),
      sunshine: state.sunshine,
      roofSunHours: state.roof?.data ? usableRoofSunHours(state.roof.data) : null,
      // Never more panels than Google's roof data says could fit (confirmed on the call).
      maxPanels: roofPanelLimit(
        phase === "three" ? ASSUMPTIONS.maxPanels : ASSUMPTIONS.maxPanelsSinglePhase,
        state.roof?.data?.panelsThatFit,
        ASSUMPTIONS.minPanels,
      ),
    };
    const recommendation = recommendSystem(profile, analysis, state.bill ?? NO_BILL);
    const tier = recommendation.tiers[state.tier];
    const config = state.config ?? tier.config;
    const site = {
      storeys: profile.storeys ?? "single",
      roof: profile.roofType ?? "unsure",
      phase,
      tilt: profile.roofType === "flat" && profile.flatMount === "tilt",
    } as const;
    const incentives = {
      state: state.address?.state ?? null,
      postcode: state.address?.postcode ?? null,
      installDate: state.installDate,
      solarVicRebate: state.solarVic.rebate,
      solarVicLoan: state.solarVic.rebate && state.solarVic.loan,
    };
    const partner = partnerPricingFor(state.installerId ? getInstaller(state.installerId) : undefined, state.address);
    const price = priceSystem(config, site, state.addOns, incentives, rates, partner, state.prices?.costs);
    const outcome = estimateOutcome(config, recommendation.usage, price);
    // The two systems the guided brief puts side by side: solar only, and solar with the battery we'd suggest.
    const option = (t: SystemTier) => {
      const c = recommendation.tiers[t].config;
      const p = priceSystem(c, site, state.addOns, incentives, rates, partner, state.prices?.costs);
      return { tier: t, config: c, price: p, outcome: estimateOutcome(c, recommendation.usage, p) };
    };
    const options = { essential: option("essential"), recommended: option("recommended") };
    return { profile, analysis, site, recommendation, tier, config, price, outcome, rates, options };
  }, [
    state.profile,
    state.address,
    state.roof,
    state.bill,
    state.tier,
    state.config,
    state.addOns,
    state.solarVic,
    state.installDate,
    state.rates,
    state.prices,
    state.sunshine,
    state.installerId,
  ]);
}

/** The "About your home" step is done once the bill is read and every question shown is answered. */
export function isAboutComplete(s: Pick<FlowState, "bill" | "profile">) {
  return aboutComplete(s.bill, s.profile);
}
