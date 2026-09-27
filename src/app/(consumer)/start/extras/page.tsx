"use client";

import { ArrowRight, Check, Plus } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow, useSystem } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { PRODUCT_IMAGES } from "@/components/ui/brand-art";
import { Button, Card, cn } from "@/components/ui/primitives";
import { formatCurrency } from "@/lib/domain/format";
import { ADD_ONS } from "@/lib/domain/recommendation";
import type { AddOnId } from "@/lib/domain/types";

function ExtrasScreen() {
  const router = useRouter();
  const { state, update } = useFlow();
  const { price } = useSystem();

  const toggle = (id: AddOnId) =>
    update({ addOns: state.addOns.includes(id) ? state.addOns.filter((a) => a !== id) : [...state.addOns, id] });

  return (
    <FlowStep
      title="Enhance your system."
      subtitle="Add or remove products to suit your home."
      ask={<AskRenuabl context="extras" title="Ask RENUABL" subtitle="Which upgrades are right for me?" />}
      cta={
        <Button size="lg" className="w-full lg:w-72" onClick={() => router.push(stepHref("installer"))}>
          Continue <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </Button>
      }
    >
      <ul className="max-w-xl space-y-3">
        {ADD_ONS.map((a) => {
          const added = state.addOns.includes(a.id);
          return (
            <li key={a.id}>
              <Card className={cn("flex items-center gap-4 p-3 pr-4 transition", added && "ring-1 ring-forest/40")}>
                <span className="relative block h-[68px] w-[68px] shrink-0 overflow-hidden rounded-xl bg-white">
                  <Image src={PRODUCT_IMAGES[a.id]} fill sizes="68px" alt="" aria-hidden className="object-contain" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-ink">{a.name}</span>
                  <span className="block text-[12.5px] leading-snug text-muted">{a.blurb}</span>
                  <span className="mt-1 block text-[12px] text-ink-2">+ {formatCurrency(a.price)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggle(a.id)}
                  aria-pressed={added}
                  aria-label={added ? `Remove ${a.name}` : `Add ${a.name}`}
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full border transition",
                    added ? "border-forest bg-forest text-white" : "border-ink/70 text-ink hover:bg-surface-2",
                  )}
                >
                  {added ? <Check className="h-4 w-4" strokeWidth={2.2} /> : <Plus className="h-4 w-4" strokeWidth={1.8} />}
                </button>
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-[13px] text-muted" aria-live="polite">
        Your system: {formatCurrency(price.total)} after rebates{state.addOns.length ? ` · ${state.addOns.length} added` : ""}. Optional —
        you can add these any time later.
      </p>
    </FlowStep>
  );
}

export default function ExtrasPage() {
  return (
    <FlowGuard step="extras">
      <ExtrasScreen />
    </FlowGuard>
  );
}
