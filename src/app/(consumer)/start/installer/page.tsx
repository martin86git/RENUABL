"use client";

import { BadgeCheck, Clock, ShieldCheck, Star, Wrench } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { Disclosure } from "@/components/ui/controls";
import { Badge, Button, Card, cn } from "@/components/ui/primitives";
import { matchInstallers } from "@/lib/services/consumer";
import type { Installer } from "@/lib/domain/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

function TrustRows({ installer }: { installer: Installer }) {
  const rows = [
    { icon: Star, label: `${installer.rating.toFixed(1)} rating`, detail: `${installer.reviewCount} reviews` },
    {
      icon: Wrench,
      label: `${installer.installsCompleted.toLocaleString("en-AU")} installs`,
      detail: `${installer.yearsOperating} years operating`,
    },
    { icon: Clock, label: `${Math.round(installer.onTimeRate * 100)}% on time`, detail: "Arrives in your window" },
    { icon: ShieldCheck, label: "Licensed & accredited", detail: installer.accreditations[0] },
  ];
  return (
    <ul className="divide-y divide-line">
      {rows.map(({ icon: Icon, label, detail }) => (
        <li key={label} className="flex items-center gap-3 py-3">
          <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <span className="text-[15px] font-medium">{label}</span>
          <span className="ml-auto truncate text-right text-[13px] text-muted">{detail}</span>
        </li>
      ))}
    </ul>
  );
}

function InstallerScreen() {
  const router = useRouter();
  const { state, update } = useFlow();
  const matches = useMemo(() => matchInstallers(state.address?.postcode ?? ""), [state.address?.postcode]);
  const selectedId = state.installerId ?? matches[0]?.installer.id;
  const match = matches.find((m) => m.installer.id === selectedId) ?? matches[0];
  const isTopMatch = match?.installer.id === matches[0]?.installer.id;
  const alternatives = matches.filter((m) => m.installer.id !== match?.installer.id);

  // Default to the best match without asking the customer to choose.
  useEffect(() => {
    if (!state.installerId && matches[0]) update({ installerId: matches[0].installer.id });
  }, [state.installerId, matches, update]);

  if (!match) return null;
  const { installer } = match;

  return (
    <FlowStep
      title="We've matched your installer"
      subtitle={`Chosen for their track record near ${state.address?.suburb ?? "you"} and availability for your install.`}
      cta={
        <Button
          size="lg"
          className="w-full lg:w-auto"
          onClick={() => {
            // Selecting a different installer invalidates their calendar slot.
            router.push(stepHref("date"));
          }}
        >
          Choose my installation date
        </Button>
      }
    >
      <div className="mx-auto max-w-xl lg:mx-0">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-ink text-[20px] font-semibold text-canvas">
              {initials(installer.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[20px] font-semibold">{installer.name}</p>
                <BadgeCheck className="h-5 w-5 text-info" aria-label="Verified RENUABL installer" />
              </div>
              <p className="text-[14px] text-muted">Based in {installer.suburbBase}</p>
            </div>
          </div>
          <div className="mt-4">
            {isTopMatch ? <Badge tone="positive">Best match for your home</Badge> : <Badge tone="info">Your choice</Badge>}
          </div>
          <div className="mt-4">
            <TrustRows installer={installer} />
          </div>
          <div className="mt-2 border-t border-line">
            <Disclosure title="Why we matched them">
              <ul className="space-y-2">
                {match.reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-positive" />
                    {r}
                  </li>
                ))}
              </ul>
            </Disclosure>
          </div>
          <p className="mt-2 rounded-2xl bg-surface-2 px-4 py-3 text-[14px] text-ink-2">
            Backed by the RENUABL workmanship guarantee. If anything isn&apos;t right, we make it right.
          </p>
        </Card>

        <div className="mt-5 flex flex-col items-center gap-4 lg:items-start">
          {alternatives.length > 0 && (
            <Dialog.Root>
              <Dialog.Trigger className="text-[14px] text-muted underline-offset-4 hover:text-ink hover:underline">
                View alternatives
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
                <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-[28px] bg-surface p-6 pb-safe shadow-[var(--shadow-lift)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]">
                  <Dialog.Title className="text-[17px] font-semibold">Other installers near you</Dialog.Title>
                  <Dialog.Description className="mt-1 text-[14px] text-muted">
                    All are RENUABL-verified. We still recommend {matches[0].installer.name}.
                  </Dialog.Description>
                  <ul className="mt-4 space-y-2">
                    {alternatives.map((m) => (
                      <li key={m.installer.id}>
                        <Dialog.Close asChild>
                          <button
                            type="button"
                            onClick={() => update({ installerId: m.installer.id, installDate: null, windowId: null })}
                            className={cn(
                              "flex w-full items-center justify-between rounded-2xl border border-line px-4 py-3 text-left hover:border-line-strong",
                            )}
                          >
                            <span>
                              <span className="block text-[15px] font-medium">{m.installer.name}</span>
                              <span className="block text-[13px] text-muted">
                                {m.installer.rating.toFixed(1)} ★ · {m.installer.installsCompleted.toLocaleString("en-AU")} installs
                              </span>
                            </span>
                            <span className="text-[13px] font-medium text-ink-2">Select</span>
                          </button>
                        </Dialog.Close>
                      </li>
                    ))}
                  </ul>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
          {!isTopMatch && (
            <button
              type="button"
              className="text-[14px] text-ink-2 underline underline-offset-4"
              onClick={() => update({ installerId: matches[0].installer.id, installDate: null, windowId: null })}
            >
              Go back to our recommended installer
            </button>
          )}
          <AskRenuabl context="installer" prompt="How do you choose installers?" className="w-full" />
        </div>
      </div>
    </FlowStep>
  );
}

export default function InstallerPage() {
  return (
    <FlowGuard step="installer">
      <InstallerScreen />
    </FlowGuard>
  );
}
