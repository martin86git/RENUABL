"use client";

import { Battery, Gauge, Gift, House, Loader2, Lock, PhoneCall, Plus, PlugZap, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CallBooking } from "@/components/consumer/call-booking";
import { CareIncludedCard, CareUpsell } from "@/components/consumer/care-upsell";
import { FlowGuard } from "@/components/consumer/flow-guard";
import { FlowStep } from "@/components/consumer/flow-shell";
import { useFlow, useInstallLead, useSystem } from "@/components/consumer/flow-state";
import { stepHref } from "@/components/consumer/steps";
import { PRODUCT_IMAGES } from "@/components/ui/brand-art";
import { Toggle } from "@/components/ui/controls";
import { Button, Card, StatRow, cn } from "@/components/ui/primitives";
import { CARE_ENABLED, CARE_FREE_MONTHS, CARE_PLAN, careIncludedFor, careIncludedValue, carePriceLabel } from "@/lib/domain/care";
import { formatCurrency, formatDate } from "@/lib/domain/format";
import type { ContactDetails, ContactErrors } from "@/lib/domain/contact";
import { describeInverter } from "@/lib/domain/inverter";
import { useWhoopOpen } from "@/lib/services/whoop";
import { trackLead } from "@/lib/services/meta-pixel";
import { WHOOP_COPY, whoopEligible } from "@/lib/domain/whoop-offer";
import { HEALTHY_INTEREST_LABEL } from "@/lib/domain/healthy-home";
import { RESERVED_CELEBRATION, priceHeader } from "@/lib/domain/flow-moments";
import { ConsentBoxes, NO_CONSENT, type ConsentState } from "@/components/consumer/consent-boxes";
import { PRICE_INCLUDES, RESERVE_NO_COMMITMENT, TIER_LABELS, describeSystem, suggestedAdditions } from "@/lib/domain/recommendation";
import { solarVictoriaApplies } from "@/lib/domain/rebates";
import { getWindow, installDateNote } from "@/lib/domain/scheduling";
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
  const { config, price, recommendation, site, profile, rates } = useSystem();
  const [contact, setContact] = useState<ContactDetails>(state.contact ?? { firstName: "", lastName: "", mobile: "", email: "" });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [callMissing, setCallMissing] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(NO_CONSENT);
  const [consentMissing, setConsentMissing] = useState(false);
  const consentRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const whoopOpen = useWhoopOpen();
  const lead = useInstallLead();
  const installer = state.installerId ? getInstaller(state.installerId) : undefined;
  const window = state.windowId ? getWindow(state.windowId) : undefined;

  async function reserve() {
    // The call is part of reserving: nobody leaves this step without a time booked.
    if (!state.callBooked) {
      setCallMissing(true);
      callRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // Terms, Privacy and contact about their plan must be ticked; tips and offers stay optional.
    if (!consent.terms) {
      setConsentMissing(true);
      consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    setProblem(null);
    const careIncluded = careIncludedFor(state.tier);
    const result = await reserveInstall({
      contact,
      depositAfterCall: price.deposit,
      care: CARE_ENABLED ? state.care : null,
      careIncluded,
      installDate: state.installDate,
      call: state.call,
      consent,
      healthyHomeInterest: state.healthyInterest,
      job: {
        address: state.address,
        system: config,
        site,
        packageName: `${TIER_LABELS[state.tier]} · ${describeSystem(config)}`,
        value: price.total,
        solarVictoria: price.rebateLines.some((r) => r.id.startsWith("sv-")),
        installDate: state.installDate,
      },
      order: {
        address: state.address ? formatAddress(state.address) : undefined,
        installer: installer?.name,
        installDate: state.installDate
          ? formatDate(state.installDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          : undefined,
        arrival: window?.label,
        system: `${TIER_LABELS[state.tier]}: ${describeSystem(config)}`,
        lines: price.lines.map((l) => ({ label: l.label, amount: l.amount })),
        gross: price.gross,
        rebates: price.rebateLines.map((r) => ({ label: r.label, amount: r.amount })),
        total: price.total,
        loan: price.loan || undefined,
        outOfPocket: price.outOfPocket,
        deposit: price.deposit,
        discuss: price.discuss.map((d) => d.label),
        interested: price.interested.map((d) => d.label),
      },
      details: {
        Home: state.address ? formatAddress(state.address) : undefined,
        System: describeSystem(config),
        Option: TIER_LABELS[state.tier],
        "Price after rebates": formatCurrency(price.total),
        "Install date": state.installDate
          ? `${formatDate(state.installDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}${window ? `, arrival ${window.label}` : ""}`
          : undefined,
        Installer: installer?.name,
        "Discuss on call": price.discuss.map((d) => d.label).join(", ") || undefined,
        "Interested (coming soon)": price.interested.map((d) => d.label).join(", ") || undefined,
        "RENUABL Care": !CARE_ENABLED
          ? undefined
          : careIncluded
            ? `${CARE_FREE_MONTHS} months free`
            : state.care
              ? carePriceLabel(state.care)
              : "Not added",
        "Bill usage": state.bill ? `${state.bill.dailyUsageKwh} kWh/day${state.bill.sample ? " (sample bill)" : ""}` : undefined,
        "Existing solar": state.bill?.hasSolar
          ? `${profile.existingSize ?? "?"}${profile.existingPlan ? `, ${profile.existingPlan}` : ""}`
          : undefined,
        "Existing inverter": state.existingInverter ? describeInverter(state.existingInverter) : undefined,
        Roof:
          profile.roofType === "flat"
            ? `flat (${profile.flatMount === "tilt" ? "tilted, if space allows" : "laid flat"})`
            : profile.roofType,
        Storeys: profile.storeys ?? "single",
        Phase: profile.phase,
        "Ad source": [state.attribution?.source, state.attribution?.campaign].filter(Boolean).join(" / ") || undefined,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.errors ?? {});
      setProblem(result.message ?? (result.errors ? "Please check your details." : "Something went wrong. Please try again."));
      return;
    }
    // The reservation is the lead (it's now in HubSpot): count it once for Meta, with no details.
    if (!state.reservedTracked) trackLead();
    update({ reservation: result.reservation, contact, reservedTracked: true });
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
  const rebateTotal = price.rebateLines.reduce((sum, r) => sum + r.amount, 0);

  const basket = (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] text-ink">{priceHeader(rebateTotal)}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{describeSystem(config)}</p>
        </div>
        <p className="animate-fade-up text-[22px] tabular-nums text-ink">{formatCurrency(price.total)}</p>
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
                    className="tap-area text-muted underline-offset-4 hover:text-danger hover:underline"
                  >
                    Remove
                  </button>
                ) : l.id === "solar" ? (
                  <Link href={stepHref("system")} className="tap-area text-muted underline-offset-4 hover:text-ink hover:underline">
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
        {whoopOpen && whoopEligible(config) && (
          <li className="flex items-center gap-3 py-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-sun-bright">
              <Gift className="h-5 w-5" strokeWidth={1.6} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-ink">{WHOOP_COPY.giftLine}</p>
              <p className="text-[12px] text-muted">
                <span className="font-medium text-sun-ink">{RESERVED_CELEBRATION.whoopUnlocked}</span> · {WHOOP_COPY.ships}
              </p>
            </div>
            <p className="text-[14px] font-semibold tabular-nums text-sun-ink">$0</p>
          </li>
        )}
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
        <li className="py-3">
          <div className="flex items-baseline justify-between">
            <p className="text-[14px] text-ink">Price before rebates</p>
            <p className="text-[14px] tabular-nums text-ink">{formatCurrency(price.gross)}</p>
          </div>
        </li>
        {price.rebateLines.map((r) => (
          <li key={r.id} className="flex items-baseline justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-positive">{r.label}</p>
              <p className="text-[12px] text-muted">{r.detail}</p>
            </div>
            <p className="text-[14px] font-semibold tabular-nums text-positive">−{formatCurrency(r.amount)}</p>
          </li>
        ))}
        <li>
          <StatRow label={<span className="text-ink">Total after rebates</span>} value={formatCurrency(price.total)} />
          <p className="pb-2 text-[12px] text-muted">{PRICE_INCLUDES}</p>
        </li>
        {price.loan > 0 && (
          <>
            <li>
              <StatRow
                label="Solar Victoria interest-free loan"
                value={<span className="tabular-nums">−{formatCurrency(price.loan)}</span>}
              />
            </li>
            <li>
              <StatRow
                label={<span className="font-medium text-ink">Your upfront cost</span>}
                value={<span className="font-medium">{formatCurrency(price.outOfPocket)}</span>}
              />
            </li>
          </>
        )}
      </ul>
      {price.discuss.length > 0 && (
        <div className="mt-3 rounded-xl bg-canvas px-3.5 py-3 text-[12.5px] leading-snug text-ink-2">
          <p className="text-ink">To discuss on your call</p>
          <ul className="mt-1.5 space-y-1.5">
            {price.discuss.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <span>{d.label}</span>
                <button
                  type="button"
                  onClick={() => removeItem(d.id)}
                  className="tap-area text-muted underline underline-offset-4 hover:text-ink"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-muted">Not included in your price. We&apos;ll talk it through and quote it on your call.</p>
        </div>
      )}
      {price.interested.length > 0 && (
        <div className="mt-3 rounded-xl bg-canvas px-3.5 py-3 text-[12.5px] leading-snug text-ink-2">
          <p className="text-ink">Coming soon</p>
          <ul className="mt-1.5 space-y-1.5">
            {price.interested.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <span>{d.label}</span>
                <button
                  type="button"
                  onClick={() => removeItem(d.id)}
                  className="tap-area text-muted underline underline-offset-4 hover:text-ink"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-muted">Not included in your price. We&apos;ll let you know when it&apos;s available.</p>
        </div>
      )}
      {rates.source !== "live" && (
        <p className="mt-3 text-[11.5px] leading-snug text-muted">Rebate amounts are confirmed on your call before anything is final.</p>
      )}
    </Card>
  );

  // Solar Victoria (VIC homes only): the panel rebate and its loan are for new solar systems, including replacements.
  const sv = rates.solarVictoria;
  const loanMonthly = price.loan > 0 ? Math.round((price.loan / sv.loanMonths) * 100) / 100 : 0;
  const svEligibleSystem = config.panelCount > 0 && !config.existingSolar && sv.pvRebateMax > 0;
  const solarVic = solarVictoriaApplies(state.address?.state ?? null) && (
    <Card className="p-5">
      <p className="text-[15px] text-ink">Solar Victoria</p>
      {!svEligibleSystem ? (
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
          {config.existingSolar
            ? "Solar Victoria's rebate and interest-free loan are for new solar systems, so they don't apply when adding to the panels you have."
            : "Solar Victoria's rebate and interest-free loan are for new solar panels, so they don't apply to this system."}{" "}
          <a href={sv.eligibilityUrl} target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-4">
            Solar Victoria&apos;s criteria
          </a>
        </p>
      ) : (
        <>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
            Victorian homes may be eligible for a solar panel rebate of up to {formatCurrency(sv.pvRebateMax)}
            {sv.pvLoanMax > 0 ? ` and an interest-free loan of up to ${formatCurrency(sv.pvLoanMax)}` : ""}.{" "}
            <a href={sv.eligibilityUrl} target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-4">
              Check eligibility
            </a>
          </p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px] text-ink">Apply the Solar Victoria rebate</p>
              <p className="text-[12px] text-muted">If you&apos;re eligible. We confirm it with you on the call.</p>
            </div>
            <Toggle
              label="Apply the Solar Victoria rebate"
              checked={state.solarVic.rebate}
              onChange={(rebate) => update({ solarVic: { rebate, loan: rebate && state.solarVic.loan } })}
            />
          </div>
          {sv.pvLoanMax > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[14px] text-ink">Take the interest-free loan</p>
                  <p className="text-[12px] text-muted">
                    Up to {formatCurrency(sv.pvLoanMax)} off your upfront cost, repaid to Solar Victoria interest free. Comes with the
                    rebate.
                  </p>
                </div>
                <Toggle
                  label="Take the Solar Victoria interest-free loan"
                  checked={state.solarVic.rebate && state.solarVic.loan}
                  onChange={(loan) => update({ solarVic: { rebate: loan || state.solarVic.rebate, loan } })}
                />
              </div>
              {price.loan > 0 && (
                <div className="mt-3 rounded-xl bg-sage/50 px-3.5 py-3 text-forest" aria-live="polite">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13.5px]">Your upfront cost with the loan</p>
                    <p className="text-[18px] font-medium tabular-nums">{formatCurrency(price.outOfPocket)}</p>
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-forest/80">
                    {formatCurrency(price.total)} after rebates, less the {formatCurrency(price.loan)} loan. Then{" "}
                    {formatCurrency(loanMonthly)} a month for {sv.loanMonths / 12} years, interest free. Subject to Solar Victoria&apos;s
                    eligibility criteria.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
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

  const care = !CARE_ENABLED ? null : careIncluded ? (
    <CareIncludedCard />
  ) : (
    <CareUpsell value={state.care} onChange={(c) => update({ care: c })} />
  );

  const summary = (
    <Card className="p-5">
      <p className="text-[15px] text-ink">Order summary</p>
      <div className="mt-2 divide-y divide-line">
        {state.address && (
          <StatRow label="Home" value={<span className="block max-w-[220px] truncate">{formatAddress(state.address)}</span>} />
        )}
        {installer && <StatRow label="Installation partner" value={installer.name} />}
        {state.installDate && (
          <StatRow
            label="Installation"
            value={`${formatDate(state.installDate, { weekday: "short", day: "numeric", month: "short" })}${window ? ` · arrival ${window.label}` : ""}`}
          />
        )}
        {state.installDate && <p className="py-2 text-[12px] leading-snug text-muted">{installDateNote(lead.solarVic)}</p>}
        <StatRow label="System after rebates" value={formatCurrency(price.total)} />
        {careIncluded ? (
          <StatRow label={CARE_PLAN.name} value={<span className="text-positive">{CARE_FREE_MONTHS} months free</span>} />
        ) : (
          CARE_ENABLED &&
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
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 px-3.5 text-[12.5px] leading-snug text-ink-2">
        <input
          type="checkbox"
          checked={state.healthyInterest}
          onChange={(e) => update({ healthyInterest: e.target.checked })}
          className="mt-px h-4 w-4 shrink-0 accent-[var(--primary)]"
        />
        <span>
          {HEALTHY_INTEREST_LABEL} <span className="text-muted">(Optional)</span>
        </span>
      </label>
      <div ref={consentRef} className="scroll-mt-6">
        <ConsentBoxes kind="reserve" value={consent} onChange={setConsent} missing={consentMissing} className="mt-4" />
      </div>
      {problem && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
    </Card>
  );

  const callCard = (
    <div ref={callRef} className="scroll-mt-6">
      <Card className={cn("p-5", callMissing && !state.callBooked && "ring-2 ring-danger/60")}>
        <div className="flex items-start gap-4">
          <PhoneCall className="mt-0.5 h-6 w-6 shrink-0 text-ink" strokeWidth={1.3} aria-hidden />
          <div className="min-w-0">
            <p className="text-[15px] text-ink">Book your 15-minute call</p>
            <p className="text-[12.5px] leading-snug text-muted">
              Needed to reserve. We check your roof, switchboard and access, and show you your design and products. Not a sales call.
            </p>
            <div className="mt-2">
              <CallBooking prompt="Pick a day and time that suits you." />
            </div>
            {callMissing && !state.callBooked && (
              <p className="mt-2 text-[13px] text-danger" role="alert">
                Please choose a time for your 15-minute call to reserve your date.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <FlowStep
      width="wide"
      title="Reserve your date."
      subtitle="Nothing to pay today. Reserve your installation date; on a quick call we'll show you your design and products."
      cta={
        <div>
          <Button size="lg" className="w-full lg:w-80" disabled={busy} onClick={() => void reserve()}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Reserve my date"}
          </Button>
          <p className="mt-2 max-w-md text-center text-[11.5px] leading-snug text-muted lg:text-left">{RESERVE_NO_COMMITMENT}</p>
        </div>
      }
    >
      <div className="grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="space-y-5">
          {basket}
          {solarVic}
          {additions}
          {care}
        </div>
        <div className="space-y-5 lg:sticky lg:top-6">
          {details}
          {callCard}
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
