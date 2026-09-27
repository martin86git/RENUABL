"use client";

import { CreditCard, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AskRenuabl } from "@/components/consumer/ask-renuabl";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow, useSystem } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { Button, Card, StatRow, cn } from "@/components/ui/primitives";
import { formatCurrency, formatDate } from "@/lib/domain/format";
import { getWindow } from "@/lib/domain/scheduling";
import { formatAddress } from "@/lib/mock/addresses";
import { getInstaller, reserveDeposit, type PaymentMethod } from "@/lib/services/consumer";

function WalletMark({ kind }: { kind: "apple" | "google" }) {
  return <span className="font-semibold tracking-tight">{kind === "apple" ? "Apple Pay" : "Google Pay"}</span>;
}

function ReserveScreen() {
  const router = useRouter();
  const { state, update } = useFlow();
  const { config, price, outcome } = useSystem();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [showCard, setShowCard] = useState(false);
  const installer = state.installerId ? getInstaller(state.installerId) : undefined;
  const window = state.windowId ? getWindow(state.windowId) : undefined;

  async function pay(m: PaymentMethod) {
    setMethod(m);
    const reservation = await reserveDeposit(price.deposit, m);
    update({ reservation });
    router.push(stepHref("confirm"));
  }

  const summary = (
    <Card className="p-6 sm:p-8">
      <p className="text-[13px] font-medium text-muted">Your order</p>
      <p className="mt-1 text-[22px] font-semibold">RENUABL Home</p>
      <p className="text-[15px] text-muted">
        {outcome.solarKw} kW solar
        {config.batteryKwh > 0 && ` · ${config.batteryKwh} kWh battery`}
        {config.evCharger && " · EV charger"}
      </p>
      <div className="mt-5 divide-y divide-line border-t border-line">
        {state.address && (
          <StatRow label="Home" value={<span className="block max-w-[240px] truncate">{formatAddress(state.address)}</span>} />
        )}
        {installer && <StatRow label="Installer" value={installer.name} />}
        {state.installDate && (
          <StatRow
            label="Installation"
            value={`${formatDate(state.installDate, { weekday: "short", day: "numeric", month: "short" })}${window ? ` · ${window.label}` : ""}`}
          />
        )}
        <StatRow label="System price" value={formatCurrency(price.gross)} />
        <StatRow label="Rebates we claim for you" value={`−${formatCurrency(price.rebates)}`} />
        <StatRow
          label={<span className="font-medium text-ink">Total after rebates</span>}
          value={<span className="text-[17px]">{formatCurrency(price.total)}</span>}
        />
      </div>
    </Card>
  );

  const busy = method !== null;

  return (
    <FlowStep
      title="Reserve your installation"
      subtitle="Hold your date with a small, fully refundable deposit. The rest is due after your system is switched on."
      wide
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="order-2 lg:order-1 lg:col-span-6">{summary}</div>
        <div className="order-1 space-y-4 lg:order-2 lg:col-span-5 lg:col-start-8">
          <Card className="p-6 sm:p-8">
            <div className="flex items-baseline justify-between">
              <p className="text-[15px] font-semibold">Due today</p>
              <p className="text-[32px] font-semibold tracking-tight tabular-nums">{formatCurrency(price.deposit)}</p>
            </div>
            <p className="mt-1 text-[14px] text-muted">Refundable reservation deposit</p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void pay("apple-pay")}
                className="flex h-14 w-full items-center justify-center rounded-full bg-black text-[17px] text-white disabled:opacity-60"
                aria-label="Pay with Apple Pay"
              >
                {method === "apple-pay" ? <Loader2 className="h-5 w-5 animate-spin" /> : <WalletMark kind="apple" />}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void pay("google-pay")}
                className="flex h-14 w-full items-center justify-center rounded-full border border-line bg-white text-[17px] text-[#15161a] disabled:opacity-60"
                aria-label="Pay with Google Pay"
              >
                {method === "google-pay" ? <Loader2 className="h-5 w-5 animate-spin" /> : <WalletMark kind="google" />}
              </button>
              {!showCard ? (
                <Button variant="secondary" size="lg" className="w-full" disabled={busy} onClick={() => setShowCard(true)}>
                  <CreditCard className="h-5 w-5" /> Pay by card
                </Button>
              ) : (
                <form
                  className="space-y-3 pt-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void pay("card");
                  }}
                >
                  {/* Placeholder fields: wire to the payment provider's hosted fields before launch. */}
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="Card number"
                    aria-label="Card number"
                    className="h-12 w-full rounded-2xl border border-line bg-canvas px-4 text-[16px] outline-none focus:border-ink"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      required
                      autoComplete="cc-exp"
                      placeholder="MM / YY"
                      aria-label="Expiry"
                      className="h-12 rounded-2xl border border-line bg-canvas px-4 text-[16px] outline-none focus:border-ink"
                    />
                    <input
                      required
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="CVC"
                      aria-label="Security code"
                      className="h-12 rounded-2xl border border-line bg-canvas px-4 text-[16px] outline-none focus:border-ink"
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={busy}>
                    {method === "card" ? <Loader2 className="h-5 w-5 animate-spin" /> : `Pay ${formatCurrency(price.deposit)}`}
                  </Button>
                </form>
              )}
            </div>

            <ul className={cn("mt-6 space-y-2 text-[13px] text-muted")}>
              <li>• Fully refundable until your installation is confirmed.</li>
              <li>• Next: a 15-minute call to confirm your roof and switchboard.</li>
              <li>• Nothing else is charged today.</li>
            </ul>
            <p className="mt-4 flex items-center gap-1.5 text-[12px] text-muted">
              <Lock className="h-3.5 w-3.5" /> Secure payment
            </p>
          </Card>
          <AskRenuabl context="checkout" prompt="Questions about paying?" />
        </div>
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
