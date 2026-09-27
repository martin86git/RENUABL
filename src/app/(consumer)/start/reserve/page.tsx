"use client";

import { Battery, Gauge, Gift, House, Loader2, Lock, Plus, PlugZap, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CareIncludedCard, CareUpsell } from "@/components/consumer/care-upsell";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow, useSystem } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { PRODUCT_IMAGES } from "@/components/ui/brand-art";
import { Button, Card, StatRow, cn } from "@/components/ui/primitives";
import { CARE_FREE_MONTHS, CARE_PLAN, careIncludedFor, careIncludedValue, carePriceLabel } from "@/lib/domain/care";
import { formatCurrency, formatDate } from "@/lib/domain/format";
import type { ContactDetails, ContactErrors } from "@/lib/domain/contact";
import { TIER_LABELS, describeSystem, suggestedAdditions } from "@/lib/domain/recommendation";
import { getWindow } from "@/lib/domain/scheduling";
import type { AddOnId, LineItemId } from "@/lib/domain/types";
import { formatAddress } from "@/lib/mock/addresses";
import { getInstaller, reserveInstall } from "@/lib/services/consumer";

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
  const { config, price, recommendation, site, profile } = useSystem();
  const [contact, setContact] = useState<ContactDetails>(state.contact ?? { firstName: "", lastName: "", mobile: "", email: "" });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const installer = state.installerId ? getInstaller(state.installerId) : undefined;
  const window = state.windowId ? getWindow(state.windowId) : undefined;

  async function reserve() {
    setBusy(true);
    setProblem(null);
    const careIncluded = careIncludedFor(state.tier);
    const result = await reserveInstall({
      contact,
      depositAfterCall: price.deposit,
      care: state.care,
      careIncluded,
      details: {
        Home: state.address ? formatAddress(state.address) : undefined,
        System: describeSystem(config),
        Option: TIER_LABELS[state.tier],
        "Price after rebates": formatCurrency(price.total),
        "Install date": state.installDate
          ? `${formatDate(state.installDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}${window ? `, arrival ${window.label}` : ""}`
          : undefined,
        Installer: installer?.name,
        "RENUABL Care": careIncluded ? `${CARE_FREE_MONTHS} months free` : state.care ? carePriceLabel(state.care) : "Not added",
        "Bill usage": state.bill ? `${state.bill.dailyUsageKwh} kWh/day${state.bill.sample ? " (sample bill)" : ""}` : undefined,
        "Existing solar": state.bill?.hasSolar
          ? `${profile.existingSize ?? "?"}${profile.existingPlan ? `, ${profile.existingPlan}` : ""}`
          : undefined,
        Roof: profile.roofType,
        "Ad source": [state.attribution?.source, state.attribution?.campaign].filter(Boolean).join(" / ") || undefined,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.errors ?? {});
      setProblem(result.message ?? (result.errors ? "Please check your details." : "Something went wrong. Please try again."));
      return;
    }
    update({ reservation: result.reservation, contact });
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
        <p className="text-[15px] text-ink">Due today</p>
        <p className="text-[19px] tabular-nums text-positive">$0</p>
      </div>
      <p className="mt-1 text-[12px] leading-snug text-muted">
        After your 15-minute confirmation call we&apos;ll send a secure link for a {formatCurrency(price.deposit)} refundable deposit to
        lock in your date.
      </p>
    </Card>
  );

  const fieldProps = (key: keyof ContactDetails) => ({
    value: contact[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setContact((c) => ({ ...c, [key]: e.target.value }));
      if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
      setProblem(null);
    },
    "aria-invalid": Boolean(errors[key]),
    className: cn(field, "mt-1", errors[key] && "ring-danger"),
  });
  const fieldError = (key: keyof ContactDetails) =>
    errors[key] && <span className="mt-1 block text-[12px] text-danger">{errors[key]}</span>;

  const details = (
    <Card className="p-5">
      <p className="text-[15px] text-ink">Your details</p>
      <p className="text-[12.5px] text-muted">So we can confirm your system and your date.</p>
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[12.5px] text-muted">First name</span>
            <input autoComplete="given-name" {...fieldProps("firstName")} />
            {fieldError("firstName")}
          </label>
          <label className="block">
            <span className="text-[12.5px] text-muted">Last name</span>
            <input autoComplete="family-name" {...fieldProps("lastName")} />
            {fieldError("lastName")}
          </label>
        </div>
        <label className="block">
          <span className="text-[12.5px] text-muted">Mobile</span>
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder="0412 345 678" {...fieldProps("mobile")} />
          {fieldError("mobile")}
        </label>
        <label className="block">
          <span className="text-[12.5px] text-muted">Email</span>
          <input type="email" autoComplete="email" placeholder="you@example.com" {...fieldProps("email")} />
          {fieldError("email")}
        </label>
      </div>
      <p className="mt-4 flex items-center gap-2 text-[12px] text-muted">
        <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} /> We only use your details for your RENUABL system. No spam.
      </p>
      {problem && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
    </Card>
  );

  return (
    <FlowStep
      width="wide"
      title="Reserve your date."
      subtitle="Nothing to pay today. Reserve your installation date, then confirm everything on a quick call."
      cta={
        <div>
          <Button size="lg" className="w-full lg:w-80" disabled={busy} onClick={() => void reserve()}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Reserve my date"}
          </Button>
          <p className="mt-2 text-center text-[11.5px] leading-snug text-muted lg:text-left">
            Nothing to pay today.
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
          {details}
          {summary}
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
