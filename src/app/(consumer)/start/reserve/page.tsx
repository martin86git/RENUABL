"use client";

import { Apple, Battery, CreditCard, Gauge, Gift, House, Landmark, Loader2, Lock, Plus, PlugZap, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CareIncludedCard, CareUpsell } from "@/components/consumer/care-upsell";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow, useSystem } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { PRODUCT_IMAGES } from "@/components/ui/brand-art";
import { Button, Card, StatRow, cn } from "@/components/ui/primitives";
import { CARE_FREE_MONTHS, CARE_PLAN, careIncludedFor, careIncludedValue, carePriceLabel } from "@/lib/domain/care";
import { formatCurrency, formatDate } from "@/lib/domain/format";
import { TIER_LABELS, describeSystem, suggestedAdditions } from "@/lib/domain/recommendation";
import { getWindow } from "@/lib/domain/scheduling";
import type { AddOnId, LineItemId } from "@/lib/domain/types";
import { formatAddress } from "@/lib/mock/addresses";
import { getInstaller, reserveDeposit, type PaymentMethod } from "@/lib/services/consumer";

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** Accepted card marks, drawn small beside "Card". */
function CardMarks() {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1" aria-hidden>
      <span className="text-[10.5px] font-extrabold italic tracking-tight text-[#1A1F71]">VISA</span>
      <span className="relative flex h-3.5 w-[22px]">
        <span className="absolute left-0 h-3.5 w-3.5 rounded-full bg-[#EB001B]" />
        <span className="absolute right-0 h-3.5 w-3.5 rounded-full bg-[#F79E1B] mix-blend-multiply" />
      </span>
    </span>
  );
}

const METHODS: { id: PaymentMethod; label: string; icon: ReactNode; extra?: ReactNode }[] = [
  {
    id: "card",
    label: "Card",
    icon: (
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-forest text-white">
        <CreditCard className="h-4 w-4" strokeWidth={1.7} />
      </span>
    ),
    extra: <CardMarks />,
  },
  {
    id: "apple-pay",
    label: "Apple Pay",
    icon: (
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-black text-white">
        <Apple className="h-4 w-4" strokeWidth={1.7} />
      </span>
    ),
  },
  {
    id: "google-pay",
    label: "Google Pay",
    icon: (
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white ring-1 ring-line">
        <GoogleG />
      </span>
    ),
  },
  {
    id: "bank-transfer",
    label: "Bank transfer",
    icon: (
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-sage text-forest">
        <Landmark className="h-4 w-4" strokeWidth={1.7} />
      </span>
    ),
  },
];

const ITEM_ICONS: Partial<Record<LineItemId, typeof Sun>> = {
  solar: Sun,
  battery: Battery,
  "ev-charger": PlugZap,
  monitoring: Gauge,
  "double-storey": House,
};

/** Small tile for a basket line: product photo for add-ons, a line icon otherwise. */
function ItemArt({ id }: { id: LineItemId }) {
  const img = PRODUCT_IMAGES[id];
  const Icon = ITEM_ICONS[id];
  return (
    <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas">
      {img ? (
        <Image src={img} fill sizes="44px" alt="" aria-hidden className="object-contain" unoptimized />
      ) : (
        Icon && <Icon className="h-5 w-5 text-ink" strokeWidth={1.4} aria-hidden />
      )}
    </span>
  );
}

const field = "h-11 w-full rounded-xl bg-canvas px-4 text-[15px] outline-none ring-1 ring-line placeholder:text-muted/70 focus:ring-ink/40";

function ReserveScreen() {
  const router = useRouter();
  const { state, update } = useFlow();
  const { config, price, recommendation, site } = useSystem();
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [busy, setBusy] = useState(false);
  const installer = state.installerId ? getInstaller(state.installerId) : undefined;
  const window = state.windowId ? getWindow(state.windowId) : undefined;

  async function pay() {
    setBusy(true);
    const reservation = await reserveDeposit(price.deposit, method, state.care, careIncludedFor(state.tier));
    update({ reservation });
    router.push(stepHref("confirmed"));
  }

  const setConfig = (patch: Partial<typeof config>) => update({ config: { ...config, ...patch } });
  const removeItem = (id: LineItemId) => {
    if (id === "battery") setConfig({ batteryKwh: 0 });
    else if (id === "ev-charger") setConfig({ evCharger: false });
    else update({ addOns: state.addOns.filter((a) => a !== id) });
  };
  const addItem = (id: LineItemId) => {
    if (id === "battery") setConfig({ batteryKwh: recommendation.tiers.recommended.config.batteryKwh });
    else if (id === "ev-charger") setConfig({ evCharger: true });
    else update({ addOns: [...state.addOns, id as AddOnId] });
  };
  const suggestions = suggestedAdditions(config, recommendation.tiers.recommended.config, state.addOns, site);
  const careIncluded = careIncludedFor(state.tier);

  const basket = (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] text-ink">Your RENUABL System</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{describeSystem(config)}</p>
        </div>
        <p className="text-[19px] tabular-nums text-ink">{formatCurrency(price.total)}</p>
      </div>
      <ul className="mt-4 divide-y divide-line border-t border-line">
        {price.lines.map((l) => (
          <li key={l.id} className="flex items-center gap-3 py-3">
            <ItemArt id={l.id} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] text-ink">{l.label}</p>
              <p className="text-[12px]">
                {l.removable ? (
                  <button
                    type="button"
                    onClick={() => removeItem(l.id)}
                    className="text-muted underline-offset-4 hover:text-danger hover:underline"
                  >
                    Remove
                  </button>
                ) : l.id === "solar" ? (
                  <Link href={stepHref("system")} className="text-muted underline-offset-4 hover:text-ink hover:underline">
                    Edit
                  </Link>
                ) : (
                  <span className="text-muted">Included</span>
                )}
              </p>
            </div>
            <p className="text-[14px] tabular-nums text-ink">{formatCurrency(l.amount)}</p>
          </li>
        ))}
        {careIncluded && (
          <li className="flex items-center gap-3 py-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sage text-forest">
              <Gift className="h-5 w-5" strokeWidth={1.6} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] text-ink">
                {CARE_PLAN.name} · {CARE_FREE_MONTHS} months
              </p>
              <p className="text-[12px] text-muted">Included with {TIER_LABELS.independence}</p>
            </div>
            <p className="text-right text-[14px]">
              <s className="mr-1.5 text-muted">{formatCurrency(careIncludedValue())}</s>
              <span className="font-semibold text-positive">Free</span>
            </p>
          </li>
        )}
        <li>
          <StatRow
            label={<span className="font-medium text-positive">Rebates we claim for you</span>}
            value={<span className="font-semibold text-positive">−{formatCurrency(price.rebates)}</span>}
          />
        </li>
        <li>
          <StatRow label={<span className="text-ink">Total after rebates</span>} value={formatCurrency(price.total)} />
        </li>
      </ul>
    </Card>
  );

  const additions = suggestions.length > 0 && (
    <Card className="p-5">
      <p className="text-[15px] text-ink">Add to your system</p>
      <p className="text-[12.5px] text-muted">Homes like yours often add these. Installed on the same day.</p>
      <ul className="mt-3 divide-y divide-line">
        {suggestions.map((sg) => (
          <li key={sg.id} className="flex items-center gap-3 py-3">
            <ItemArt id={sg.id} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-ink">{sg.label}</p>
              <p className="truncate text-[12px] text-muted">{sg.blurb}</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] tabular-nums text-ink-2">+{formatCurrency(sg.amount)}</p>
              <button
                type="button"
                onClick={() => addItem(sg.id)}
                aria-label={`Add ${sg.label}`}
                className="mt-1 inline-flex h-8 items-center gap-1 rounded-full border border-ink/70 px-3 text-[12.5px] text-ink hover:bg-surface-2"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.8} /> Add
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );

  const care = careIncluded ? <CareIncludedCard /> : <CareUpsell value={state.care} onChange={(c) => update({ care: c })} />;

  const summary = (
    <Card className="p-5">
      <p className="text-[15px] text-ink">Order summary</p>
      <div className="mt-2 divide-y divide-line">
        {state.address && (
          <StatRow label="Home" value={<span className="block max-w-[220px] truncate">{formatAddress(state.address)}</span>} />
        )}
        {installer && <StatRow label="Installer" value={installer.name} />}
        {state.installDate && (
          <StatRow
            label="Installation"
            value={`${formatDate(state.installDate, { weekday: "short", day: "numeric", month: "short" })}${window ? ` · arrival ${window.label}` : ""}`}
          />
        )}
        <StatRow label="System after rebates" value={formatCurrency(price.total)} />
        {careIncluded ? (
          <StatRow label={CARE_PLAN.name} value={<span className="text-positive">{CARE_FREE_MONTHS} months free</span>} />
        ) : (
          state.care && (
            <StatRow label={CARE_PLAN.name} value={<span className="text-right">{carePriceLabel(state.care)} · after switch-on</span>} />
          )
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
              "flex h-12 items-center gap-2.5 rounded-xl px-2.5 text-left text-[13.5px] transition",
              method === m.id
                ? "bg-sage/45 text-forest ring-[1.5px] ring-forest"
                : "bg-surface text-ink-2 ring-1 ring-line hover:bg-canvas hover:ring-line-strong",
            )}
          >
            {m.icon}
            <span className="shrink-0">{m.label}</span>
            {m.extra}
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
      width="wide"
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
      <div className="grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="space-y-5">
          {basket}
          {additions}
          {care}
        </div>
        <div className="space-y-5 lg:sticky lg:top-6">
          {summary}
          {payment}
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
