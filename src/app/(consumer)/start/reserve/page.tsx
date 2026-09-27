"use client";

import { Apple, ChevronRight, CreditCard, Landmark, Loader2, Lock, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow, useSystem } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { Button, Card, StatRow, cn } from "@/components/ui/primitives";
import { formatCurrency, formatDate } from "@/lib/domain/format";
import { describeSystem } from "@/lib/domain/recommendation";
import { getWindow } from "@/lib/domain/scheduling";
import { formatAddress } from "@/lib/mock/addresses";
import { getInstaller, reserveDeposit, type PaymentMethod } from "@/lib/services/consumer";

function GoogleG() {
  return (
    <span aria-hidden className="text-[15px] font-semibold">
      G
    </span>
  );
}

const METHODS: { id: PaymentMethod; label: string; icon: ReactNode }[] = [
  { id: "card", label: "Card", icon: <CreditCard className="h-4 w-4" strokeWidth={1.5} /> },
  { id: "apple-pay", label: "Apple Pay", icon: <Apple className="h-4 w-4" strokeWidth={1.5} /> },
  { id: "google-pay", label: "Google Pay", icon: <GoogleG /> },
  { id: "bank-transfer", label: "Bank transfer", icon: <Landmark className="h-4 w-4" strokeWidth={1.5} /> },
];

const field = "h-11 w-full rounded-xl bg-canvas px-4 text-[15px] outline-none ring-1 ring-line placeholder:text-muted/70 focus:ring-ink/40";

function ReserveScreen() {
  const router = useRouter();
  const { state, update } = useFlow();
  const { config, price } = useSystem();
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [busy, setBusy] = useState(false);
  const installer = state.installerId ? getInstaller(state.installerId) : undefined;
  const window = state.windowId ? getWindow(state.windowId) : undefined;

  async function pay() {
    setBusy(true);
    const reservation = await reserveDeposit(price.deposit, method);
    update({ reservation });
    router.push(stepHref("confirmed"));
  }

  const breakdown = (
    <div className="divide-y divide-line">
      {price.lines.map((l) => (
        <StatRow key={l.label} label={l.label} value={formatCurrency(l.amount)} />
      ))}
      <StatRow
        label={<span className="font-medium text-positive">Rebates we claim for you</span>}
        value={<span className="font-semibold text-positive">−{formatCurrency(price.rebates)}</span>}
      />
      <StatRow label={<span className="text-ink">Total after rebates</span>} value={formatCurrency(price.total)} />
    </div>
  );

  const summary = (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] text-ink">Your RENUABL System</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{describeSystem(config)}</p>
        </div>
        <p className="text-[19px] tabular-nums text-ink">{formatCurrency(price.total)}</p>
      </div>
      <Dialog.Root>
        <Dialog.Trigger className="mt-1 flex w-full items-center justify-end gap-1 text-[12.5px] text-ink-2 hover:text-ink lg:hidden">
          View details <ChevronRight className="h-3.5 w-3.5" />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[28px] bg-canvas p-6 pb-safe shadow-[var(--shadow-lift)]">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-[18px] font-medium">Your system</Dialog.Title>
              <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">Price breakdown</Dialog.Description>
            <div className="mt-2">{breakdown}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="mt-4 hidden lg:block">{breakdown}</div>
      <div className="mt-3 divide-y divide-line border-t border-line lg:mt-1">
        {state.address && (
          <StatRow label="Home" value={<span className="block max-w-[220px] truncate">{formatAddress(state.address)}</span>} />
        )}
        {installer && <StatRow label="Installer" value={installer.name} />}
        {state.installDate && (
          <StatRow
            label="Installation"
            value={`${formatDate(state.installDate, { weekday: "short", day: "numeric", month: "short" })}${window ? ` · ${window.label}` : ""}`}
          />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-4">
        <p className="text-[15px] text-ink">Due today (refundable)</p>
        <p className="text-[19px] tabular-nums text-ink">{formatCurrency(price.deposit)}</p>
      </div>
    </Card>
  );

  const payment = (
    <Card className="p-5">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={method === m.id}
            onClick={() => setMethod(m.id)}
            className={cn(
              "flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-[13.5px] transition",
              method === m.id ? "ring-[1.5px] ring-ink text-ink" : "ring-1 ring-line text-ink-2 hover:ring-line-strong",
            )}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {method === "card" ? (
        <div className="mt-5 space-y-3">
          {/* Placeholder fields: replace with the payment provider's hosted fields before launch. */}
          <label className="block">
            <span className="text-[12.5px] text-muted">Card number</span>
            <input inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" className={cn(field, "mt-1")} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12.5px] text-muted">Expiry date</span>
              <input autoComplete="cc-exp" placeholder="MM / YY" className={cn(field, "mt-1")} />
            </label>
            <label className="block">
              <span className="text-[12.5px] text-muted">CVC</span>
              <input inputMode="numeric" autoComplete="cc-csc" placeholder="123" className={cn(field, "mt-1")} />
            </label>
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-canvas px-4 py-3 text-[13px] text-ink-2">
          {method === "bank-transfer"
            ? "We'll show our bank details and a reference number on the next screen. Your date is held for 48 hours."
            : `You'll confirm with ${method === "apple-pay" ? "Apple Pay" : "Google Pay"} on your device.`}
        </p>
      )}
      <p className="mt-4 flex items-center gap-2 text-[12px] text-muted">
        <Lock className="h-3.5 w-3.5" strokeWidth={1.6} /> Your payment is secure and encrypted.
      </p>
    </Card>
  );

  return (
    <FlowStep
      title="Secure your system."
      subtitle="Pay a reservation deposit to lock in your quote and installation date. Fully refundable."
      cta={
        <div>
          <Button size="lg" className="w-full lg:w-80" disabled={busy} onClick={() => void pay()}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : `Pay ${formatCurrency(price.deposit)} to reserve`}
          </Button>
          <p className="mt-2 text-center text-[11.5px] leading-snug text-muted lg:text-left">
            Fully refundable if you change your mind.
            <br />
            Next: 15-minute system confirmation.
          </p>
        </div>
      }
    >
      <div className="grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        {summary}
        {payment}
      </div>
    </FlowStep>
  );
}

export default function ReservePage() {
  return (
    <FlowGuard step="reserve">
      <ReserveScreen />
    </FlowGuard>
  );
}
