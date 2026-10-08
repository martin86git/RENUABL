"use client";

import { ArrowRight, BatteryCharging, Car, Home as HomeIcon, House, Info, PlugZap, Sun, Zap, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { FlowStep } from "@/components/consumer/flow-shell";
import { BillUpload } from "@/components/consumer/bill-upload";
import { EarlyContact } from "@/components/consumer/early-contact";
import { SavingsReveal } from "@/components/consumer/savings-reveal";
import { InverterPhotos } from "@/components/consumer/inverter-photos";
import { isAboutComplete, useFlow } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { Mascot } from "@/components/ui/brand-art";
import { ChoiceChips, Toggle, YesNo } from "@/components/ui/controls";
import { Button, Script } from "@/components/ui/primitives";
import { trackBillUploaded, trackSpendEstimated } from "@/lib/services/meta-pixel";
import { SPEND_COPY, SPEND_ESTIMATE_ENABLED, isIndicative } from "@/lib/domain/spend-estimate";
import { SpendEstimate } from "@/components/consumer/spend-estimate";
import {
  EXISTING_PLAN_OPTIONS,
  EXISTING_SIZE_OPTIONS,
  EXPAND_DISCLAIMER,
  PHASE_OPTIONS,
  FLAT_MOUNT_NOTE,
  FLAT_MOUNT_OPTIONS,
  ROOF_OPTIONS,
  asksAboutBattery,
  existingSolarQuestions,
  homeDetailsSummary,
  solarSituation,
} from "@/lib/domain/existing-solar";
import type { InverterSummary } from "@/lib/domain/inverter";
import { formatAddress } from "@/lib/mock/addresses";
import type { EnergyProfile, ExistingSolarPlan, ExistingSolarSize, FlatMount, RoofType } from "@/lib/domain/types";

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
  // The notes follow the last question shown, inside its card.
  const notes = (
    <>
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
          Your bill only shows the power you buy. We&apos;ll estimate what your current panels cover from what they export, and confirm your
          new system on the 15-minute call.
        </p>
      )}
    </>
  );
  return (
    <>
      <QuestionCard icon={Sun} question="How big is your current solar system?">
        <ChoiceChips<ExistingSolarSize>
          label="How big is your current solar system?"
          options={EXISTING_SIZE_OPTIONS}
          value={profile.existingSize}
          onChange={(existingSize) =>
            onChange({ existingSize, existingPlan: existingSize === "unsure" ? profile.existingPlan : undefined })
          }
        />
        {!showPlan && notes}
      </QuestionCard>
      {showPlan && (
        <QuestionCard icon={Sun} question="Would you like to replace your existing system, or expand it?">
          <ChoiceChips<ExistingSolarPlan>
            label="Replace or expand your existing system"
            options={EXISTING_PLAN_OPTIONS}
            value={profile.existingPlan}
            onChange={(existingPlan) => onChange({ existingPlan })}
          />
          {notes}
        </QuestionCard>
      )}
    </>
  );
}

/** One question to a card (icon on desktop). `aside` sits on the right, e.g. a switch. */
function QuestionCard({
  icon: Icon,
  question,
  aside,
  children,
}: {
  icon: LucideIcon;
  question: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-5 rounded-[var(--radius-card)] bg-surface px-5 py-4 shadow-[var(--shadow-soft)]" aria-label={question}>
      <Icon className="mt-1 hidden h-7 w-7 shrink-0 text-ink lg:block" strokeWidth={1.3} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[14px] leading-snug text-ink-2 lg:text-[13.5px]">{question}</p>
          {aside}
        </div>
        <div className={aside ? "" : "mt-2.5"}>{children}</div>
      </div>
    </section>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { state, update } = useFlow();
  const profile = state.profile;
  const complete = isAboutComplete(state);
  // Pressing Continue without a bill points back to the upload.
  const [missingBill, setMissingBill] = useState(false);
  const billRef = useRef<HTMLDivElement>(null);
  const next = () => {
    if (!state.bill) {
      setMissingBill(true);
      billRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    router.push(stepHref("system"));
  };

  const situation = state.bill ? solarSituation(state.bill, profile) : "new";
  const existing = existingSolarQuestions(state.bill, profile);
  const batteryQuestion = QUESTIONS.filter((q) => q.key === "wantsBattery" && asksAboutBattery(state.bill, profile));
  const otherQuestions = QUESTIONS.filter((q) => q.key !== "wantsBattery");

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
      subtitle="Your latest bill is all we need to size your system to what you actually use."
      ask={<AskRenuabl context="profile" title="Not sure?" subtitle="Ask Revo anything about your home." arrow="light" />}
      cta={
        <Button size="lg" className="w-full lg:w-72" disabled={Boolean(state.bill) && !complete} onClick={next}>
          Continue <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-4">
          {/* Before the bill: an optional mobile so the team can call to help (texted straight away). */}
          <EarlyContact />
          <div ref={billRef} className="scroll-mt-6 space-y-4">
            {/* A real bill replaces a spend estimate; while there's only an estimate, the upload stays open. */}
            <BillUpload
              bill={isIndicative(state.bill) ? null : state.bill}
              address={state.address ? formatAddress(state.address) : undefined}
              onRead={(bill) => {
                // The bill was read by the server: counted once for Meta (no details sent).
                if (!state.billTracked) trackBillUploaded();
                update({ bill, config: null, billTracked: true });
              }}
            />
            {SPEND_ESTIMATE_ENABLED && (!state.bill || isIndicative(state.bill)) && (
              <>
                <p className="flex items-center gap-3 text-[12.5px] uppercase tracking-[0.12em] text-muted" aria-hidden>
                  <span className="h-px flex-1 bg-line" />
                  {SPEND_COPY.or}
                  <span className="h-px flex-1 bg-line" />
                </p>
                <SpendEstimate
                  bill={state.bill}
                  onPick={(bill) => {
                    if (!state.spendTracked) trackSpendEstimated();
                    update({ bill, config: null, spendTracked: true });
                  }}
                />
              </>
            )}
            {state.bill && <SavingsReveal />}
            {missingBill && !state.bill && (
              <p className="text-[13.5px] text-ink-2" role="alert">
                {SPEND_ESTIMATE_ENABLED
                  ? "Please upload your latest bill, or tell us roughly what you spend, to continue."
                  : "Please upload your latest bill to continue: we size your system from it."}
              </p>
            )}
          </div>
          {existing.size && (
            <ExistingSolar
              profile={profile}
              situation={situation}
              onChange={change}
              inverter={state.existingInverter}
              onInverter={(existingInverter) => update({ existingInverter })}
            />
          )}
          {/* After the bill, one question: the battery. Everything else is optional, with defaults, and checked on the call. */}
          {state.bill &&
            batteryQuestion.map(({ key, label, icon }) => (
              <QuestionCard key={key} icon={icon} question={label}>
                <div className="flex justify-end lg:justify-start">
                  <YesNo label={label} value={profile[key]} onChange={(v) => set(key, v)} />
                </div>
              </QuestionCard>
            ))}
          {state.bill && (
            <details className="group rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-soft)]">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block text-[14px] text-ink">Your home details (optional)</span>
                  <span className="block text-[12.5px] leading-snug text-muted">
                    {homeDetailsSummary(profile)} Change anything that&apos;s different, or we&apos;ll check it on your call.
                  </span>
                </span>
                <span className="shrink-0 text-[13px] text-forest underline-offset-4 group-open:hidden">Change</span>
              </summary>
              <div className="space-y-4 px-5 pb-5">
                <QuestionCard icon={HomeIcon} question="What's your roof made of?">
                  <ChoiceChips<RoofType>
                    label="What's your roof made of?"
                    options={ROOF_OPTIONS}
                    value={profile.roofType}
                    onChange={(roofType) => change({ roofType })}
                  />
                </QuestionCard>
                {profile.roofType === "flat" && (
                  <QuestionCard icon={Sun} question="How would you like your panels?">
                    <ChoiceChips<FlatMount>
                      label="How would you like your panels?"
                      options={FLAT_MOUNT_OPTIONS}
                      value={profile.flatMount ?? "flat"}
                      onChange={(flatMount) => change({ flatMount })}
                    />
                    <p className="mt-2 text-[12px] leading-snug text-muted">{FLAT_MOUNT_NOTE[profile.flatMount ?? "flat"]}</p>
                  </QuestionCard>
                )}
                <QuestionCard
                  icon={House}
                  question="Double-storey home?"
                  aside={
                    <Toggle
                      label="Double-storey home"
                      checked={profile.storeys === "double"}
                      onChange={(double) => change({ storeys: double ? "double" : "single" })}
                    />
                  }
                >
                  <p className="text-[12px] text-muted">{profile.storeys === "double" ? "Double storey" : "Single storey"}</p>
                </QuestionCard>
                <QuestionCard icon={Zap} question="Is your power single or three phase?">
                  <ChoiceChips<"single" | "three" | "unsure">
                    label="Is your power single or three phase?"
                    options={PHASE_OPTIONS}
                    value={profile.phase}
                    onChange={(phase) => change({ phase })}
                  />
                  <p className="mt-2 text-[12px] leading-snug text-muted">
                    Tip: three main switches side by side in your switchboard usually means three phase.
                  </p>
                </QuestionCard>
                {otherQuestions.map(({ key, label, icon }) => (
                  <QuestionCard key={key} icon={icon} question={label}>
                    <div className="flex justify-end lg:justify-start">
                      <YesNo label={label} value={profile[key]} onChange={(v) => set(key, v)} />
                    </div>
                  </QuestionCard>
                ))}
              </div>
            </details>
          )}
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
