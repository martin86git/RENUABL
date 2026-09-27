"use client";

import { useRouter } from "next/navigation";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { FlowStep } from "@/components/consumer/flow-shell";
import { isProfileComplete, useFlow } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { ChoiceCards, type ChoiceOption } from "@/components/ui/controls";
import { EnergyOrb } from "@/components/ui/energy-orb";
import { Button, Card } from "@/components/ui/primitives";
import type { EnergyProfile } from "@/lib/domain/types";

type Question<K extends keyof EnergyProfile> = {
  key: K;
  title: string;
  hint?: string;
  columns?: 2 | 3 | 4;
  options: ChoiceOption<EnergyProfile[K]>[];
};

const QUESTIONS = [
  {
    key: "household",
    title: "Who lives here?",
    columns: 3,
    options: [
      { value: "1-2", label: "1–2 people" },
      { value: "3-4", label: "3–4 people" },
      { value: "5+", label: "5 or more" },
    ],
  } satisfies Question<"household">,
  {
    key: "bill",
    title: "Roughly, what's your power bill each quarter?",
    hint: "A best guess is fine.",
    columns: 4,
    options: [
      { value: "under-400", label: "Under $400" },
      { value: "400-700", label: "$400 – $700" },
      { value: "700-1000", label: "$700 – $1,000" },
      { value: "over-1000", label: "Over $1,000" },
    ],
  } satisfies Question<"bill">,
  {
    key: "daytime",
    title: "Is someone usually home during the day?",
    columns: 3,
    options: [
      { value: "mostly-home", label: "Most days" },
      { value: "sometimes", label: "Some days" },
      { value: "mostly-away", label: "Rarely" },
    ],
  } satisfies Question<"daytime">,
  {
    key: "ev",
    title: "Do you drive an electric car?",
    columns: 3,
    options: [
      { value: "have", label: "Yes" },
      { value: "planning", label: "Thinking about it" },
      { value: "none", label: "No" },
    ],
  } satisfies Question<"ev">,
  {
    key: "storeys",
    title: "How many storeys is your home?",
    columns: 2,
    options: [
      { value: "single", label: "Single storey" },
      { value: "double", label: "Two or more" },
    ],
  } satisfies Question<"storeys">,
  {
    key: "backup",
    title: "How important is keeping the lights on in a blackout?",
    columns: 3,
    options: [
      { value: "important", label: "Very important" },
      { value: "nice-to-have", label: "Nice to have" },
      { value: "not-needed", label: "Not needed" },
    ],
  } satisfies Question<"backup">,
] as const;

export default function ProfilePage() {
  const router = useRouter();
  const { state, update } = useFlow();
  const profile = state.profile;
  const answered = QUESTIONS.filter((q) => profile[q.key] !== undefined).length;
  const complete = isProfileComplete(profile);

  const set = <K extends keyof EnergyProfile>(key: K, value: EnergyProfile[K]) =>
    // Changing answers resets any manual system adjustments to a fresh recommendation.
    update({ profile: { ...profile, [key]: value }, config: null });

  const cta = (
    <Button size="lg" className="w-full lg:w-auto" disabled={!complete} onClick={() => router.push(stepHref("system"))}>
      {complete ? "See my recommendation" : `${answered} of ${QUESTIONS.length} answered`}
    </Button>
  );

  return (
    <FlowStep
      title="Tell us about your home"
      subtitle="Six quick questions. We use them to size a system that fits how you actually live."
      cta={cta}
      aside={
        <>
          <Card className="flex flex-col items-center p-8 text-center">
            <EnergyOrb size={160} />
            <p className="mt-4 text-[17px] font-semibold">No expertise needed</p>
            <p className="mt-1 text-[15px] text-muted">
              We&apos;ll handle kilowatts, inverters and approvals. You just tell us about your routine.
            </p>
          </Card>
          <AskRenuabl context="profile" prompt="Not sure how to answer?" />
        </>
      }
    >
      <div className="space-y-10">
        {QUESTIONS.map((q) => (
          <fieldset key={q.key}>
            <legend className="text-[18px] font-semibold">{q.title}</legend>
            {"hint" in q && q.hint && <p className="mt-1 text-[14px] text-muted">{q.hint}</p>}
            <div className="mt-4">
              <ChoiceCards
                label={q.title}
                columns={q.columns}
                value={profile[q.key] as string | undefined}
                onChange={(v) => set(q.key, v as never)}
                options={q.options as unknown as ChoiceOption<string>[]}
              />
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-10 lg:hidden">
        <AskRenuabl context="profile" prompt="Not sure how to answer?" />
      </div>
    </FlowStep>
  );
}
