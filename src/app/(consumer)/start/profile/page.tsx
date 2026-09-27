"use client";

import { ArrowRight, BatteryCharging, Car, Home as HomeIcon, House, Info, PlugZap, Sun, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { FlowStep } from "@/components/consumer/flow-shell";
import { BillUpload } from "@/components/consumer/bill-upload";
import { InverterPhotos } from "@/components/consumer/inverter-photos";
import { isAboutComplete, useFlow } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { Mascot } from "@/components/ui/brand-art";
import { ChoiceChips, Toggle, YesNo } from "@/components/ui/controls";
import { Button, Script } from "@/components/ui/primitives";
import {
  EXISTING_PLAN_OPTIONS,
  EXISTING_SIZE_OPTIONS,
  EXPAND_DISCLAIMER,
  PHASE_OPTIONS,
  ROOF_OPTIONS,
  asksAboutBattery,
  existingSolarQuestions,
  solarSituation,
} from "@/lib/domain/existing-solar";
import type { InverterSummary } from "@/lib/domain/inverter";
import type { EnergyProfile, ExistingSolarPlan, ExistingSolarSize, RoofType } from "@/lib/domain/types";

type YesNoKey = "ev" | "evPlanned" | "wantsBattery" | "backup";

const QUESTIONS: { key: YesNoKey; label: string; icon: LucideIcon }[] = [
  { key: "ev", label: "Do you charge an EV at home now?", icon: PlugZap },
  { key: "evPlanned", label: "Planning to get an EV (or another one)?", icon: Car },
  { key: "wantsBattery", label: "Would you like a battery?", icon: BatteryCharging },
  { key: "backup", label: "Want backup power during outages?", icon: House },
];

function ExistingSolar({
  profile,
  situation,
  onChange,
  inverter,
  onInverter,
}: {
  profile: Partial<EnergyProfile>;
  situation: "new" | "expand" | "replace";
  onChange: (patch: Partial<EnergyProfile>) => void;
  inverter: InverterSummary | null;
  onInverter: (i: InverterSummary) => void;
}) {
  const showPlan = profile.existingSize === "unsure";
  return (
    <div className="rounded-[var(--radius-card)] bg-surface px-5 py-4 shadow-[var(--shadow-soft)]">
      <div className="flex gap-5">
        <Sun className="mt-1 h-7 w-7 shrink-0 text-ink" strokeWidth={1.3} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-snug text-ink-2">How big is your current solar system?</p>
          <div className="mt-2.5">
            <ChoiceChips<ExistingSolarSize>
              label="How big is your current solar system?"
              options={EXISTING_SIZE_OPTIONS}
              value={profile.existingSize}
              onChange={(existingSize) =>
                onChange({ existingSize, existingPlan: existingSize === "unsure" ? profile.existingPlan : undefined })
              }
            />
          </div>
          {showPlan && (
            <>
              <p className="mt-4 text-[13.5px] leading-snug text-ink-2">Would you like to replace your existing system, or expand it?</p>
              <div className="mt-2.5">
                <ChoiceChips<ExistingSolarPlan>
                  label="Replace or expand your existing system"
                  options={EXISTING_PLAN_OPTIONS}
                  value={profile.existingPlan}
                  onChange={(existingPlan) => onChange({ existingPlan })}
                />
              </div>
            </>
          )}
          {profile.existingSize && situation === "expand" && (!showPlan || profile.existingPlan) && (
            <>
              {!inverter && (
                <p className="mt-4 flex gap-2.5 rounded-xl bg-sage/50 px-3.5 py-3 text-[12.5px] leading-snug text-forest" role="note">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden />
                  {EXPAND_DISCLAIMER}
                </p>
              )}
              <InverterPhotos inverter={inverter} onRead={onInverter} />
            </>
          )}
          {situation === "replace" && (
            <p className="mt-4 flex gap-2.5 rounded-xl bg-canvas px-3.5 py-3 text-[12.5px] leading-snug text-ink-2" role="note">
              <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden />
              Your bill only shows the power you buy. We&apos;ll estimate what your current panels cover from what they export, and confirm
              your new system on the 15-minute call.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { state, update } = useFlow();
  const profile = state.profile;
  const complete = isAboutComplete(state);

  const situation = state.bill ? solarSituation(state.bill, profile) : "new";
  const existing = existingSolarQuestions(state.bill, profile);
  const questions = QUESTIONS.filter((q) => q.key !== "wantsBattery" || asksAboutBattery(state.bill, profile));

  // Changing answers resets manual adjustments so the recommendation stays honest.
  const change = (patch: Partial<EnergyProfile>) => update({ profile: { ...profile, ...patch }, config: null });
  const set = (key: YesNoKey, value: boolean) =>
    // Wanting a battery (or not) picks the option we lead with; the customer can still switch.
    key === "wantsBattery"
      ? update({ profile: { ...profile, wantsBattery: value }, config: null, tier: value ? "recommended" : "essential" })
      : change({ [key]: value });

  return (
    <FlowStep
      width="wide"
      title="Tell us about your home."
      subtitle="Your latest bill and a few quick questions, so we size your system to what you actually use."
      ask={<AskRenuabl context="profile" title="Not sure?" subtitle="Ask RENUABL anything about your home." arrow="light" />}
      cta={
        <Button size="lg" className="w-full lg:w-72" disabled={!complete} onClick={() => router.push(stepHref("system"))}>
          Continue <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-4">
          <BillUpload bill={state.bill} onRead={(bill) => update({ bill, config: null })} />
          {existing.size && (
            <ExistingSolar
              profile={profile}
              situation={situation}
              onChange={change}
              inverter={state.existingInverter}
              onInverter={(existingInverter) => update({ existingInverter })}
            />
          )}
          <div className="flex gap-5 rounded-[var(--radius-card)] bg-surface px-5 py-4 shadow-[var(--shadow-soft)]">
            <HomeIcon className="mt-1 hidden h-7 w-7 shrink-0 text-ink lg:block" strokeWidth={1.3} aria-hidden />
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-[13.5px] leading-snug text-ink-2">What&apos;s your roof made of?</p>
                <div className="mt-2.5">
                  <ChoiceChips<RoofType>
                    label="What's your roof made of?"
                    options={ROOF_OPTIONS}
                    value={profile.roofType}
                    onChange={(roofType) => change({ roofType })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13.5px] leading-snug text-ink-2">Double-storey home?</p>
                  <p className="text-[12px] text-muted">{profile.storeys === "double" ? "Double storey" : "Single storey"}</p>
                </div>
                <Toggle
                  label="Double-storey home"
                  checked={profile.storeys === "double"}
                  onChange={(double) => change({ storeys: double ? "double" : "single" })}
                />
              </div>
              <div>
                <p className="text-[13.5px] leading-snug text-ink-2">Is your power single or three phase?</p>
                <div className="mt-2.5">
                  <ChoiceChips<"single" | "three" | "unsure">
                    label="Is your power single or three phase?"
                    options={PHASE_OPTIONS}
                    value={profile.phase}
                    onChange={(phase) => change({ phase })}
                  />
                </div>
                <p className="mt-2 text-[12px] leading-snug text-muted">
                  Tip: three main switches side by side in your switchboard usually means three phase.
                </p>
              </div>
              {profile.roofType === "flat" && (
                <p className="text-[12px] leading-snug text-muted">
                  On a flat roof we tilt your panels 10–15° towards the sun, so they make more power and rain washes them clean. The tilt
                  frames are included in your price.
                </p>
              )}
              {(profile.roofType === "unsure" || profile.phase === "unsure") && (
                <p className="text-[12px] text-muted">No problem. We&apos;ll confirm it on your call.</p>
              )}
            </div>
          </div>
          {/* Desktop: icon cards. Mobile: one card with rows, toggles right-aligned. */}
          <ul className="hidden space-y-2.5 lg:block">
            {questions.map(({ key, label, icon: Icon }) => (
              <li key={key} className="flex gap-5 rounded-[var(--radius-card)] bg-surface px-5 py-4 shadow-[var(--shadow-soft)]">
                <Icon className="mt-1 h-7 w-7 shrink-0 text-ink" strokeWidth={1.3} aria-hidden />
                <div>
                  <p className="max-w-[280px] text-[13.5px] leading-snug text-ink-2">{label}</p>
                  <div className="mt-2.5">
                    <YesNo label={label} value={profile[key]} onChange={(v) => set(key, v)} />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <ul className="divide-y divide-line rounded-[var(--radius-card)] bg-surface px-5 shadow-[var(--shadow-soft)] lg:hidden">
            {questions.map(({ key, label }) => (
              <li key={key} className="py-4">
                <p className="text-[14px] text-ink-2">{label}</p>
                <div className="mt-2 flex justify-end">
                  <YesNo label={label} value={profile[key]} onChange={(v) => set(key, v)} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Mascot and script travel together and stay in view. Sticky makes its own layer, so it needs the page colour for the mascot's multiply blend. */}
        <div className="hidden lg:block">
          <div className="sticky top-8 mx-auto w-fit bg-canvas">
            <Mascot pose="battery" className="h-auto w-[380px] xl:w-[440px]" />
            <Script className="absolute -bottom-2 right-0 text-[24px] xl:-right-6">
              Smarter
              <br />
              &nbsp;energy.
              <br />
              &nbsp;&nbsp;Brighter
              <br />
              &nbsp;&nbsp;&nbsp;tomorrows.
            </Script>
          </div>
        </div>
      </div>
    </FlowStep>
  );
}
