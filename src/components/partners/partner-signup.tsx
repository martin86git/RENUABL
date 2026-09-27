"use client";

import { ArrowLeft, ArrowRight, Check, CircleCheck, FileUp, Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Card, cn } from "@/components/ui/primitives";
import { PREVIEW_MODE } from "@/lib/config";
import type { AddressSuggestion } from "@/lib/domain/address";
import { todayInMarket } from "@/lib/domain/market";
import {
  CERTIFICATE_UPLOAD,
  EMPTY_PARTNER_DRAFT,
  MIN_PUBLIC_LIABILITY,
  PARTNER_BENEFITS,
  PARTNER_FIELD_STEP,
  PARTNER_TYPES,
  RADIUS_LIMITS,
  RATE_FIELDS,
  SUGGESTED_MARGIN,
  SUPPLY_ITEMS,
  draftRates,
  draftToApplication,
  formatAbn,
  partnerSummary,
  rateComparison,
  rateForDisplay,
  suggestedRates,
  validatePartnerApplication,
  type InstallRates,
  type PartnerDraft,
  type PartnerErrors,
} from "@/lib/domain/partner";
import type { Address } from "@/lib/domain/types";
import { resolveAddress, submitPartnerApplication, suggestAddresses } from "@/lib/services/partners";

type Step = "intro" | "type" | "business" | "area" | "credentials" | "rates" | "supply" | "review" | "done";

const DRAFT_KEY = "renuabl.partner.draft.v1";
const field =
  "h-12 w-full rounded-xl bg-canvas px-4 text-[16px] text-ink outline-none ring-1 ring-line placeholder:text-muted/70 focus:ring-ink/50";

function loadDraft(): PartnerDraft {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY_PARTNER_DRAFT, ...JSON.parse(raw) } : EMPTY_PARTNER_DRAFT;
  } catch {
    return EMPTY_PARTNER_DRAFT;
  }
}

function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13.5px] text-ink-2">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[12.5px] text-danger" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1.5 block text-[12.5px] leading-snug text-muted">{hint}</span>
      )}
    </label>
  );
}

/** Base address: Google address search (sample addresses in a preview without a key). */
function BaseAddress({ value, onChange, error }: { value: Address | null; onChange: (a: Address | null) => void; error?: string }) {
  const [query, setQuery] = useState(value ? `${value.line}, ${value.suburb}` : "");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const session = useRef("");
  useEffect(() => {
    session.current = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
  }, []);

  useEffect(() => {
    if (value && query === `${value.line}, ${value.suburb}`) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      const res = await suggestAddresses(query, session.current, controller.signal);
      setSuggestions(res.suggestions);
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, value]);

  async function pick(s: AddressSuggestion) {
    setBusy(true);
    const address = await resolveAddress(s.id, session.current);
    setBusy(false);
    setSuggestions([]);
    if (address) {
      setQuery(`${address.line}, ${address.suburb}`);
      onChange(address);
    }
  }

  return (
    <Field label="Your base address" hint="Where your crews start from. We measure job distances from here." error={error}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          className={cn(field, "pl-11")}
          value={query}
          placeholder="Start typing an address"
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange(null);
          }}
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls="base-suggestions"
        />
        {busy && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />}
      </div>
      {suggestions.length > 0 && (
        <ul id="base-suggestions" role="listbox" className="mt-2 overflow-hidden rounded-xl bg-surface ring-1 ring-line">
          {suggestions.map((s) => (
            <li key={s.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => void pick(s)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <span>
                  <span className="block text-[14px] text-ink">{s.main}</span>
                  <span className="block text-[12.5px] text-muted">{s.secondary}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}

/** One installation rate: the suggestion in grey, and a gentle note when it's well above or below. */
function RateInput({
  fieldDef,
  value,
  onChange,
}: {
  fieldDef: (typeof RATE_FIELDS)[number];
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const suggested = rateForDisplay(fieldDef.key, suggestedRates()[fieldDef.key]);
  const typedNumber = value && value.trim() !== "" ? Number(value.replace(/[$,\s]/g, "")) : null;
  const comparison = typedNumber !== null && Number.isFinite(typedNumber) ? rateComparison(typedNumber, suggested) : null;
  const unit = fieldDef.unit;
  const suggestedLabel = unit === "$" ? `$${suggested.toLocaleString("en-AU")}` : `${suggested} ${unit}`;
  return (
    <div className="py-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14.5px] text-ink">{fieldDef.label}</p>
          {fieldDef.detail && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{fieldDef.detail}</p>}
        </div>
        <div className="relative w-32 shrink-0">
          {unit === "$" && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-muted">$</span>}
          <input
            inputMode="decimal"
            aria-label={fieldDef.label}
            className={cn(field, "h-11 text-right tabular-nums", unit === "$" ? "pl-7 pr-3" : "pl-3 pr-12")}
            value={value ?? ""}
            placeholder={suggested.toLocaleString("en-AU")}
            onChange={(e) => onChange(e.target.value)}
          />
          {unit !== "$" && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-muted">{unit}</span>
          )}
        </div>
      </div>
      <p
        className={cn(
          "mt-1.5 text-[12px]",
          comparison === "above" ? "text-warning" : comparison === "below" ? "text-positive" : "text-muted",
        )}
      >
        {comparison === "above"
          ? `Above our suggestion (${suggestedLabel}): you may win fewer jobs.`
          : comparison === "below"
            ? `Below our suggestion (${suggestedLabel}): more competitive.`
            : comparison === "in line"
              ? `In line with our suggestion (${suggestedLabel}).`
              : `Suggested: ${suggestedLabel}. Leave blank to use it.`}
      </p>
    </div>
  );
}

export function PartnerSignup() {
  const [draft, setDraft] = useState<PartnerDraft>(EMPTY_PARTNER_DRAFT);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<Step>("intro");
  const [certificate, setCertificate] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<PartnerErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved draft after mount
    setDraft(loadDraft());
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage unavailable: the form still works */
    }
  }, [draft, loaded]);

  const set = (patch: Partial<PartnerDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const steps: Step[] = useMemo(
    () => ["type", "business", "area", "credentials", "rates", ...(draft.type === "retailer" ? (["supply"] as Step[]) : []), "review"],
    [draft.type],
  );
  const index = steps.indexOf(step);
  const validation = useMemo(
    () => validatePartnerApplication(draftToApplication(draft), { today: todayInMarket(), hasCertificate: Boolean(certificate) }),
    [draft, certificate],
  );
  const allErrors: PartnerErrors = "errors" in validation ? validation.errors : {};
  const stepErrors = (s: Step) =>
    Object.fromEntries(Object.entries(allErrors).filter(([k]) => PARTNER_FIELD_STEP[k as keyof PartnerErrors] === s)) as PartnerErrors;

  const go = (s: Step) => {
    setStep(s);
    setErrors({});
    setProblem(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  function next() {
    const e = stepErrors(step);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    go(steps[index + 1]);
  }

  async function submit() {
    if ("errors" in validation) {
      const first = Object.keys(validation.errors)[0] as keyof PartnerErrors;
      go(PARTNER_FIELD_STEP[first]);
      setErrors(stepErrors(PARTNER_FIELD_STEP[first]));
      return;
    }
    setBusy(true);
    const result = await submitPartnerApplication(draftToApplication(draft), certificate);
    setBusy(false);
    if (!result.ok) {
      if (result.errors && Object.keys(result.errors).length) {
        const first = Object.keys(result.errors)[0] as keyof PartnerErrors;
        go(PARTNER_FIELD_STEP[first]);
        setErrors(result.errors);
      }
      setProblem(result.message ?? "Please check your details.");
      return;
    }
    setReference(result.reference);
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    go("done");
  }

  const heading = (title: string, subtitle?: string) => (
    <div className="mb-6">
      {index >= 0 && (
        <p className="mb-2 text-[12.5px] text-muted">
          Step {index + 1} of {steps.length}
        </p>
      )}
      <h1 className="text-[30px] font-normal leading-tight tracking-[-0.03em] lg:text-[38px]">{title}</h1>
      {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p>}
    </div>
  );

  const nav = (label = "Continue", onClick: () => void = next) => (
    <div className="mt-8 flex items-center gap-3">
      {index > 0 && (
        <Button variant="secondary" size="lg" onClick={() => go(steps[index - 1])} aria-label="Back">
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </Button>
      )}
      <Button size="lg" className="flex-1 sm:flex-none sm:px-10" onClick={onClick} disabled={busy}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : label}
        {!busy && <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />}
      </Button>
    </div>
  );

  const rates: InstallRates = draftRates(draft);

  return (
    <div className="mx-auto w-full max-w-xl px-5 pb-16 pt-6 sm:px-8 lg:pt-12">
      {step === "intro" && (
        <div>
          <p className="text-[13px] tracking-wide text-leaf">RENUABL partners</p>
          <h1 className="mt-2 text-[34px] font-normal leading-[1.08] tracking-[-0.035em] lg:text-[46px]">
            Install more systems. Chase fewer leads.
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            RENUABL helps Victorian households go solar the simple way. They upload their electricity bill, we recommend one system sized to
            their home, and they book an install date. Then we match each job with a trusted local partner. That could be you.
          </p>
          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {PARTNER_BENEFITS.map((b) => (
              <li key={b.title}>
                <Card className="h-full p-5">
                  <CircleCheck className="h-5 w-5 text-positive" strokeWidth={1.8} aria-hidden />
                  <p className="mt-3 text-[15px] text-ink">{b.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{b.detail}</p>
                </Card>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[13px] leading-relaxed text-muted">
            It takes about 10 minutes. Have your ABN, accreditation number, electrical licence and certificate of currency handy.
          </p>
          <Button size="lg" className="mt-6 w-full sm:w-auto sm:px-10" onClick={() => go("type")}>
            Become a partner <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </Button>
        </div>
      )}

      {step === "type" && (
        <div>
          {heading("How will you work with RENUABL?", "Choose one. It decides what we ask next.")}
          <div role="radiogroup" aria-label="Partner type" className="space-y-3">
            {PARTNER_TYPES.map((t) => {
              const selected = draft.type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => set({ type: t.value })}
                  className={cn(
                    "flex w-full items-start gap-4 rounded-[var(--radius-card)] bg-surface p-5 text-left shadow-[var(--shadow-soft)] ring-1 transition",
                    selected ? "ring-leaf" : "ring-transparent hover:ring-line-strong",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                      selected ? "border-leaf bg-leaf text-canvas" : "border-line-strong",
                    )}
                  >
                    {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="block text-[16px] text-ink">
                      {t.label} <span className="text-muted">· {t.title}</span>
                    </span>
                    <span className="mt-1.5 block text-[13.5px] leading-relaxed text-muted">{t.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {errors.type && <p className="mt-3 text-[13px] text-danger">{errors.type}</p>}
          {nav()}
        </div>
      )}

      {step === "business" && (
        <div>
          {heading("About you and your business.")}
          <div className="space-y-4">
            <Field label="Your full name" error={errors.fullName}>
              <input className={field} autoComplete="name" value={draft.fullName} onChange={(e) => set({ fullName: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mobile" error={errors.mobile}>
                <input
                  className={field}
                  type="tel"
                  autoComplete="tel"
                  placeholder="0412 345 678"
                  value={draft.mobile}
                  onChange={(e) => set({ mobile: e.target.value })}
                />
              </Field>
              <Field label="Email" error={errors.email}>
                <input
                  className={field}
                  type="email"
                  autoComplete="email"
                  value={draft.email}
                  onChange={(e) => set({ email: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Business name" error={errors.businessName}>
              <input
                className={field}
                autoComplete="organization"
                value={draft.businessName}
                onChange={(e) => set({ businessName: e.target.value })}
              />
            </Field>
            <Field label="ABN" error={errors.abn}>
              <input
                className={field}
                inputMode="numeric"
                placeholder="51 824 753 556"
                value={draft.abn}
                onChange={(e) => set({ abn: e.target.value })}
                onBlur={() => set({ abn: formatAbn(draft.abn) })}
              />
            </Field>
            <Field label="Business website (optional)" error={errors.website}>
              <input
                className={field}
                inputMode="url"
                placeholder="yourbusiness.com.au"
                value={draft.website}
                onChange={(e) => set({ website: e.target.value })}
              />
            </Field>
            <Field label="Business address" error={errors.businessAddress}>
              <input
                className={field}
                autoComplete="street-address"
                value={draft.businessAddress}
                onChange={(e) => set({ businessAddress: e.target.value })}
              />
            </Field>
          </div>
          {nav()}
        </div>
      )}

      {step === "area" && (
        <div>
          {heading("Where do you work?", "We only send you jobs inside your area.")}
          <div className="space-y-6">
            <BaseAddress value={draft.base} onChange={(base) => set({ base })} error={errors.base} />
            <div>
              <div className="flex items-baseline justify-between">
                <p className="text-[13.5px] text-ink-2">How far will you travel?</p>
                <p className="text-[20px] tabular-nums text-ink">{draft.radiusKm} km</p>
              </div>
              <input
                type="range"
                min={RADIUS_LIMITS.min}
                max={RADIUS_LIMITS.max}
                step={5}
                value={draft.radiusKm}
                onChange={(e) => set({ radiusKm: Number(e.target.value) })}
                aria-label="Job radius in kilometres"
                className="mt-3 w-full accent-[var(--leaf)]"
              />
              <p className="mt-1 text-[12.5px] text-muted">
                {draft.base
                  ? `You'll get jobs within ${draft.radiusKm} km of ${draft.base.suburb}.`
                  : `Between ${RADIUS_LIMITS.min} and ${RADIUS_LIMITS.max} km from your base.`}
              </p>
              {errors.radiusKm && <p className="mt-1 text-[12.5px] text-danger">{errors.radiusKm}</p>}
            </div>
          </div>
          {nav()}
        </div>
      )}

      {step === "credentials" && (
        <div>
          {heading("Your credentials.", "We check these before sending you any work.")}
          <div className="space-y-4">
            <Field
              label="Accreditation number"
              hint="Solar Accreditation Australia (formerly CEC), e.g. A1234567."
              error={errors.accreditationNumber}
            >
              <input
                className={field}
                autoCapitalize="characters"
                value={draft.accreditationNumber}
                onChange={(e) => set({ accreditationNumber: e.target.value })}
              />
            </Field>
            <Field label="Electrical licence number" error={errors.electricalLicence}>
              <input
                className={field}
                autoCapitalize="characters"
                value={draft.electricalLicence}
                onChange={(e) => set({ electricalLicence: e.target.value })}
              />
            </Field>
            <div>
              <p className="mb-1.5 text-[13.5px] text-ink-2">Public liability cover</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Public liability cover">
                {[10_000_000, 20_000_000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={draft.publicLiability === String(v)}
                    onClick={() => set({ publicLiability: String(v) })}
                    className={cn(
                      "h-11 rounded-full px-5 text-[14px] ring-1 transition",
                      draft.publicLiability === String(v) ? "bg-primary text-primary-ink ring-primary" : "bg-surface text-ink-2 ring-line",
                    )}
                  >
                    ${v / 1_000_000} million
                  </button>
                ))}
                <input
                  className={cn(field, "h-11 w-40")}
                  inputMode="numeric"
                  aria-label="Other amount"
                  placeholder="Other amount"
                  value={["10000000", "20000000"].includes(draft.publicLiability) ? "" : draft.publicLiability}
                  onChange={(e) => set({ publicLiability: e.target.value.replace(/[^\d]/g, "") })}
                />
              </div>
              <p className={cn("mt-1.5 text-[12.5px]", errors.publicLiability ? "text-danger" : "text-muted")}>
                {errors.publicLiability ?? `At least $${MIN_PUBLIC_LIABILITY / 1_000_000} million.`}
              </p>
            </div>
            <Field label="Cover runs until" error={errors.expires}>
              <input className={field} type="date" value={draft.expires} onChange={(e) => set({ expires: e.target.value })} />
            </Field>
            <div>
              <p className="mb-1.5 text-[13.5px] text-ink-2">Certificate of currency</p>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl bg-canvas px-4 py-4 ring-1",
                  errors.certificate ? "ring-danger" : "ring-line",
                )}
              >
                <FileUp className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.6} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink-2">
                  {certificate ? certificate.name : "Upload a PDF or photo"}
                </span>
                <span className="text-[13px] text-leaf">{certificate ? "Change" : "Choose"}</span>
                <input
                  type="file"
                  className="sr-only"
                  accept={CERTIFICATE_UPLOAD.types.join(",")}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > CERTIFICATE_UPLOAD.maxBytes) {
                      setErrors((x) => ({ ...x, certificate: "That file is over 4 MB. Try a PDF or a smaller photo." }));
                      return;
                    }
                    setCertificate(f);
                  }}
                />
              </label>
              <p className={cn("mt-1.5 text-[12.5px]", errors.certificate ? "text-danger" : "text-muted")}>
                {errors.certificate ?? "It should show at least $10 million public liability. Kept private."}
              </p>
              {PREVIEW_MODE && !certificate && (
                <button
                  type="button"
                  className="tap-area mt-2 text-[12.5px] text-leaf underline underline-offset-4"
                  onClick={async () => {
                    const res = await fetch("/samples/sample-certificate-of-currency.pdf");
                    const blob = await res.blob();
                    setCertificate(new File([blob], "sample-certificate-of-currency.pdf", { type: "application/pdf" }));
                    setErrors((x) => ({ ...x, certificate: undefined }));
                  }}
                >
                  Testing? Use a sample certificate (preview only)
                </button>
              )}
            </div>
          </div>
          {nav()}
        </div>
      )}

      {step === "rates" && (
        <div>
          {heading(
            "Your installation rates.",
            "Set your own rates, ex GST. The suggestions in grey keep customer prices competitive on RENUABL; leave a box blank to use them.",
          )}
          <Card className="divide-y divide-line px-5">
            {RATE_FIELDS.map((f) => (
              <RateInput
                key={f.key}
                fieldDef={f}
                value={draft.rates[f.key]}
                onChange={(v) => set({ rates: { ...draft.rates, [f.key]: v } })}
              />
            ))}
          </Card>
          {errors.rates && <p className="mt-3 text-[13px] text-danger">{errors.rates}</p>}
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            Example: a 6.6 kW single-storey job {rates.nearHomeKm > 0 ? `within ${rates.nearHomeKm} km pays` : "pays"} $
            {Math.round(6600 * rates.nearHomePerWatt).toLocaleString("en-AU")}; further away, $
            {Math.round(6600 * rates.solarPerWatt).toLocaleString("en-AU")}.
          </p>
          {nav()}
        </div>
      )}

      {step === "supply" && (
        <div>
          {heading(
            "Your supply costs.",
            "What you pay for the products customers choose on RENUABL, ex GST. We use them, your installation rates and your margin to price your jobs. Leave a box blank to use our supplier's cost.",
          )}
          {(["Panels", "Solar inverters", "Battery inverters", "Battery", "EV charger"] as const).map((group) => (
            <div key={group} className="mb-5">
              <p className="mb-2 text-[13px] text-muted">{group}</p>
              <Card className="divide-y divide-line px-5">
                {SUPPLY_ITEMS.filter((i) => i.group === group).map((item) => (
                  <div key={item.sku} className="flex items-center justify-between gap-4 py-3">
                    <span className="min-w-0 text-[13.5px] leading-snug text-ink">{item.name}</span>
                    <span className="relative w-32 shrink-0">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-muted">$</span>
                      <input
                        inputMode="decimal"
                        aria-label={`Your cost for ${item.name}`}
                        className={cn(field, "h-11 pl-7 pr-3 text-right tabular-nums")}
                        placeholder={item.suggested.toLocaleString("en-AU", { maximumFractionDigits: 2 })}
                        value={draft.supply[item.sku] ?? ""}
                        onChange={(e) => set({ supply: { ...draft.supply, [item.sku]: e.target.value } })}
                      />
                    </span>
                  </div>
                ))}
              </Card>
            </div>
          ))}
          {errors.supply && <p className="mb-3 text-[13px] text-danger">{errors.supply}</p>}
          <Field
            label="Your margin"
            hint={`On products and installation, before GST. Suggested: ${SUGGESTED_MARGIN * 100}%.`}
            error={errors.margin}
          >
            <span className="relative block w-40">
              <input
                inputMode="decimal"
                className={cn(field, "pr-9 text-right tabular-nums")}
                placeholder={String(SUGGESTED_MARGIN * 100)}
                value={draft.margin}
                onChange={(e) => set({ margin: e.target.value })}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">%</span>
            </span>
          </Field>
          {nav()}
        </div>
      )}

      {step === "review" && (
        <div>
          {heading("Check and send.", "We'll verify your details and be in touch.")}
          {"application" in validation ? (
            <Card className="divide-y divide-line px-5">
              {Object.entries(partnerSummary(validation.application, { reference: "On submission", certificate: certificate?.name }))
                .filter(([k]) => k !== "Reference")
                .map(([k, v]): [string, string] => {
                  if (k !== "Supply costs") return [k, v];
                  const own = SUPPLY_ITEMS.filter((i) => (draft.supply[i.sku] ?? "").trim() !== "").length;
                  return [k, `${own} of ${SUPPLY_ITEMS.length} products at your own cost; our supplier's cost for the rest.`];
                })
                .map(([k, v]) => (
                  <div key={k} className="py-3">
                    <p className="text-[12.5px] text-muted">{k}</p>
                    <p className="mt-0.5 break-words text-[14px] leading-snug text-ink">{v}</p>
                  </div>
                ))}
            </Card>
          ) : (
            <Card className="p-5 text-[14px] text-ink-2">
              A few details still need attention.{" "}
              <button
                type="button"
                className="tap-area text-leaf underline underline-offset-4"
                onClick={() => {
                  const first = Object.keys(allErrors)[0] as keyof PartnerErrors;
                  go(PARTNER_FIELD_STEP[first]);
                  setErrors(stepErrors(PARTNER_FIELD_STEP[first]));
                }}
              >
                Fix them
              </button>
            </Card>
          )}
          <label className="mt-5 flex items-start gap-3 text-[13.5px] leading-relaxed text-ink-2">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--leaf)]"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm these details are correct, and I&apos;m authorised to apply on behalf of this business.
          </label>
          {problem && (
            <p className="mt-3 text-[13px] text-danger" role="alert">
              {problem}
            </p>
          )}
          {confirmed ? (
            nav("Send my application", () => void submit())
          ) : (
            <div className="mt-8 flex items-center gap-3">
              <Button variant="secondary" size="lg" onClick={() => go(steps[index - 1])} aria-label="Back">
                <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.6} />
              </Button>
              <Button size="lg" className="flex-1 sm:flex-none sm:px-10" disabled>
                Send my application
              </Button>
            </div>
          )}
        </div>
      )}

      {step === "done" && (
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-leaf text-canvas">
            <Check className="h-7 w-7" strokeWidth={2.4} />
          </span>
          <h1 className="mt-6 text-[32px] font-normal tracking-[-0.03em]">Application received.</h1>
          <p className="mt-2 text-[15px] text-muted">Your reference is {reference}.</p>
          <Card className="mt-8 p-5 text-left">
            <p className="text-[15px] text-ink">What happens next</p>
            <ol className="mt-3 space-y-2.5 text-[13.5px] leading-relaxed text-muted">
              <li>1. We check your accreditation, electrical licence and insurance.</li>
              <li>2. We call you to talk through your rates and area.</li>
              <li>3. Once approved, jobs in your area start coming through to your partner portal.</li>
            </ol>
          </Card>
        </div>
      )}
    </div>
  );
}
