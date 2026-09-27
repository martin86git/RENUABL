"use client";

import { ArrowRight, Car, Fan, House, Waves, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { FlowStep } from "@/components/consumer/flow-shell";
import { isProfileComplete, useFlow } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { Mascot } from "@/components/ui/brand-art";
import { YesNo } from "@/components/ui/controls";
import { Button, Script } from "@/components/ui/primitives";
import type { EnergyProfile } from "@/lib/domain/types";

const QUESTIONS: { key: keyof EnergyProfile; label: string; icon: LucideIcon }[] = [
  { key: "ev", label: "Do you have an EV or plan to get one?", icon: Car },
  { key: "pool", label: "Do you have a pool or spa?", icon: Waves },
  { key: "electricHeating", label: "Do you use electric heating or cooling?", icon: Fan },
  { key: "backup", label: "Want backup power during outages?", icon: House },
];

export default function ProfilePage() {
  const router = useRouter();
  const { state, update } = useFlow();
  const profile = state.profile;
  const complete = isProfileComplete(profile);

  // Changing answers resets manual adjustments so the recommendation stays honest.
  const set = (key: keyof EnergyProfile, value: boolean) => update({ profile: { ...profile, [key]: value }, config: null });

  return (
    <FlowStep
      width="wide"
      title="Tell us about your home."
      subtitle="A few quick details so we can recommend the right solution for you."
      ask={<AskRenuabl context="profile" title="Not sure?" subtitle="Ask RENUABL anything about your home." arrow="light" />}
      cta={
        <Button size="lg" className="w-full lg:w-72" disabled={!complete} onClick={() => router.push(stepHref("system"))}>
          Continue <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* Desktop: icon cards. Mobile: one card with rows, toggles right-aligned. */}
        <ul className="hidden space-y-2.5 lg:block">
          {QUESTIONS.map(({ key, label, icon: Icon }) => (
            <li key={key} className="flex gap-5 rounded-[var(--radius-card)] bg-surface px-5 py-4 shadow-[var(--shadow-soft)]">
              <Icon className="mt-1 h-7 w-7 shrink-0 text-ink" strokeWidth={1.3} aria-hidden />
              <div>
                <p className="max-w-[210px] text-[13.5px] leading-snug text-ink-2">{label}</p>
                <div className="mt-2.5">
                  <YesNo label={label} value={profile[key]} onChange={(v) => set(key, v)} />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <ul className="divide-y divide-line rounded-[var(--radius-card)] bg-surface px-5 shadow-[var(--shadow-soft)] lg:hidden">
          {QUESTIONS.map(({ key, label }) => (
            <li key={key} className="py-4">
              <p className="text-[14px] text-ink-2">{label}</p>
              <div className="mt-2 flex justify-end">
                <YesNo label={label} value={profile[key]} onChange={(v) => set(key, v)} />
              </div>
            </li>
          ))}
        </ul>

        <div className="relative hidden items-center justify-center lg:flex">
          <Mascot className="h-auto w-[300px] xl:w-[330px]" float />
          <Script className="absolute -right-2 bottom-4 text-[22px] xl:right-4">
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
    </FlowStep>
  );
}
