"use client";

import { ArrowRight, BadgeCheck, ChartColumn, ChevronRight, CircleCheck, ShieldCheck, Star, UserRound, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { Button, Card } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { getAvailability, matchInstallers } from "@/lib/services/consumer";

function InstallerScreen() {
  const router = useRouter();
  const { state, update } = useFlow();
  const matches = useMemo(() => matchInstallers(state.address?.postcode ?? ""), [state.address?.postcode]);
  const selectedId = state.installerId ?? matches[0]?.installer.id;
  const match = matches.find((m) => m.installer.id === selectedId) ?? matches[0];
  const isTopMatch = match?.installer.id === matches[0]?.installer.id;
  const alternatives = matches.filter((m) => m.installer.id !== match?.installer.id);
  const firstAvailable = useMemo(() => (match ? getAvailability(match.installer.id)[0]?.date : undefined), [match]);

  // RENUABL chooses by default; the customer never has to compare.
  useEffect(() => {
    if (!state.installerId && matches[0]) update({ installerId: matches[0].installer.id });
  }, [state.installerId, matches, update]);

  if (!match) return null;
  const { installer } = match;
  const choose = (id: string) => update({ installerId: id, installDate: null, windowId: null });

  return (
    <FlowStep
      width="narrow"
      title="Your installer is matched."
      subtitle="We've found the best installer for your home."
      cta={
        <Button size="lg" className="w-full lg:w-72" onClick={() => router.push(stepHref("date"))}>
          Continue <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </Button>
      }
    >
      <div className="max-w-md space-y-4">
        <Card className="p-5">
          <div className="flex items-start gap-4">
            {/* Monogram until the installer's own logo is supplied. */}
            <span
              className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-sage text-[18px] tracking-wide text-forest"
              aria-hidden
            >
              {installer.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </span>
            <div className="min-w-0">
              <p className="text-[17px] text-ink">{installer.name}</p>
              {(installer.verifiedStats || installer.reviewSource) && (
                <p className="flex items-center gap-1 text-[13px] text-ink-2">
                  <Star className="h-4 w-4 fill-[#e8a93a] text-[#e8a93a]" strokeWidth={0} aria-hidden />
                  {installer.rating.toFixed(1)}{" "}
                  <span className="text-muted">
                    ({installer.reviewCount} {installer.reviewSource ? `${installer.reviewSource} ` : ""}reviews)
                  </span>
                </p>
              )}
              {installer.preferred && <p className="text-[12.5px] text-positive">RENUABL installer of choice</p>}
              <ul className="mt-2 space-y-1 text-[13px] text-ink-2">
                {[
                  "Accredited & insured",
                  "Local to your area",
                  firstAvailable ? `Available ${formatDate(firstAvailable, { day: "numeric", month: "short" })}` : null,
                ]
                  .filter(Boolean)
                  .map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <CircleCheck className="h-4 w-4 fill-positive text-white" strokeWidth={2} aria-hidden /> {t}
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-[14px] text-ink">Why we matched them</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Best fit for your location, system and preferred installation window.
            </p>
            <ul className="mt-2 space-y-1 text-[13px] text-muted">
              {match.reasons.slice(1, 4).map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          </div>

          {alternatives.length > 0 && (
            <Dialog.Root>
              <Dialog.Trigger className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-canvas px-4 py-3 text-left">
                <UserRound className="h-5 w-5 text-muted" strokeWidth={1.5} />
                <span className="flex-1">
                  <span className="block text-[13px] text-ink-2">Prefer another installer?</span>
                  <span className="block text-[12px] text-muted">View alternatives</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted" />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
                <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-[28px] bg-canvas p-6 pb-safe shadow-[var(--shadow-lift)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[460px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-[18px] font-medium">Other installers near you</Dialog.Title>
                    <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
                      <X className="h-5 w-5" />
                    </Dialog.Close>
                  </div>
                  <Dialog.Description className="mt-1 text-[13px] text-muted">
                    All are RENUABL-vetted. We still recommend {matches[0].installer.name}.
                  </Dialog.Description>
                  <ul className="mt-4 space-y-2">
                    {alternatives.map((m) => (
                      <li key={m.installer.id}>
                        <Dialog.Close asChild>
                          <button
                            type="button"
                            onClick={() => choose(m.installer.id)}
                            className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-left shadow-[var(--shadow-soft)]"
                          >
                            <span>
                              <span className="block text-[15px]">{m.installer.name}</span>
                              <span className="block text-[12px] text-muted">
                                {m.installer.verifiedStats
                                  ? `${m.installer.rating.toFixed(1)} ★ · ${m.installer.installsCompleted.toLocaleString("en-AU")} installs`
                                  : "RENUABL-vetted installer"}
                              </span>
                            </span>
                            <span className="text-[13px] text-ink-2">Select</span>
                          </button>
                        </Dialog.Close>
                      </li>
                    ))}
                  </ul>
                  {!isTopMatch && (
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        onClick={() => choose(matches[0].installer.id)}
                        className="mt-4 text-[13px] text-ink-2 underline underline-offset-4"
                      >
                        Go back to our recommended installer
                      </button>
                    </Dialog.Close>
                  )}
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </Card>

        <ul className="grid grid-cols-3 gap-2 pt-2 text-center text-[11.5px] leading-tight text-muted">
          {[
            { icon: ShieldCheck, label: "Vetted installers" },
            { icon: BadgeCheck, label: "Accredited & insured" },
            { icon: ChartColumn, label: "Proven track record" },
          ].map(({ icon: Icon, label }) => (
            <li key={label} className="flex flex-col items-center gap-2">
              <Icon className="h-7 w-7 text-ink" strokeWidth={1.2} aria-hidden />
              {label}
            </li>
          ))}
        </ul>
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
