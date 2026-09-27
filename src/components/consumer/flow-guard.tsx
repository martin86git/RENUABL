"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useFlow, isProfileComplete, type FlowState } from "./flow-state";
import { stepHref, type FlowSlug } from "./steps";

const needsProfile = (s: FlowState): FlowSlug | null => (isProfileComplete(s.profile) ? null : "profile");

const REQUIREMENTS: Record<FlowSlug, (s: FlowState) => FlowSlug | null> = {
  analysing: () => null,
  profile: () => null,
  system: needsProfile,
  extras: needsProfile,
  installer: needsProfile,
  date: (s) => needsProfile(s) ?? (!s.installerId ? "installer" : null),
  reserve: (s) => needsProfile(s) ?? (!s.installerId ? "installer" : !s.installDate || !s.windowId ? "date" : null),
  confirmed: (s) => (!s.reservation ? "reserve" : null),
};

/** Sends the customer back to the first incomplete step instead of a broken screen. */
export function FlowGuard({ step, children }: { step: FlowSlug; children: ReactNode }) {
  const { state, hydrated } = useFlow();
  const router = useRouter();
  const redirectTo = hydrated ? REQUIREMENTS[step](state) : null;

  useEffect(() => {
    if (redirectTo) router.replace(stepHref(redirectTo));
  }, [redirectTo, router]);

  if (!hydrated || redirectTo) {
    return <div className="m-5 h-[60vh] animate-pulse rounded-3xl bg-surface-2/60 lg:m-12" aria-busy="true" aria-label="Loading" />;
  }
  return <>{children}</>;
}
