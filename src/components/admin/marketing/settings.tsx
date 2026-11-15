"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, cn } from "@/components/ui/primitives";
import { DAILY_CAP, SENDING_HOURS } from "@/lib/domain/marketing/sequences";
import { footerLines, type EdmBrand } from "@/lib/domain/marketing/edm";
import { loadMarketingSettings, saveMarketingSettings, type MarketingSettingsView } from "@/lib/services/marketing";
import { field } from "./edm-builder";

const box = "rounded-2xl bg-surface p-5 shadow-[var(--shadow-soft)]";

/** The sender and look set once, the day's cap, a pause for everything, and what's set up to send. */
export function MarketingSettingsPage() {
  const [view, setView] = useState<MarketingSettingsView | null>(null);
  const [brand, setBrand] = useState<EdmBrand | null>(null);
  const [cap, setCap] = useState<number>(DAILY_CAP.default);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    loadMarketingSettings().then((r) => {
      if (!r.ok) return setMsg({ ok: false, text: r.message });
      setView(r);
      setBrand(r.settings.brand);
      setCap(r.settings.dailyCap);
      setPaused(r.settings.paused);
    });
  }, []);

  if (!view || !brand)
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <Loader2 className="size-4 animate-spin" /> Loading
      </p>
    );

  async function save() {
    setBusy(true);
    const r = await saveMarketingSettings({ brand: brand!, dailyCap: cap, paused });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setBrand(r.settings.brand);
    setCap(r.settings.dailyCap);
    setMsg({ ok: true, text: "Saved." });
  }

  const ready: [string, boolean, string][] = [
    ["Email service", view.ready.email, "SendGrid or Resend, with EMAIL_FROM on a verified domain"],
    ["Site address", view.ready.siteUrl, "SITE_URL, so the unsubscribe and tracking links work"],
    ["Hourly sending", view.ready.cron, "CRON_SECRET, so the hourly batch runs"],
    [
      "Bounces and complaints",
      view.ready.bounces,
      "SENDGRID_WEBHOOK_PUBLIC_KEY or RESEND_WEBHOOK_SECRET, with the webhook pointed at /api/m/events",
    ],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-[22px] font-semibold tracking-tight">Marketing settings</h1>

      <section className={box}>
        <h2 className="text-[15px] font-semibold">Ready to send</h2>
        <ul className="mt-3 space-y-2 text-[13px]">
          {ready.map(([label, ok, how]) => (
            <li key={label} className="flex items-start gap-2">
              {ok ? <Check className="mt-0.5 size-4 text-positive" /> : <X className="mt-0.5 size-4 text-danger" />}
              <span>
                <span className="font-medium">{label}</span>
                {!ok && <span className="text-muted"> · needs {how}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={box}>
        <h2 className="text-[15px] font-semibold">Sender and look</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-[12px] text-muted">
            From name
            <input
              value={brand.fromName}
              onChange={(e) => setBrand({ ...brand, fromName: e.target.value })}
              className={cn(field, "mt-1")}
            />
          </label>
          <label className="text-[12px] text-muted">
            Replies go to (blank: the site&apos;s reply address)
            <input
              value={brand.replyTo ?? ""}
              onChange={(e) => setBrand({ ...brand, replyTo: e.target.value || null })}
              className={cn(field, "mt-1")}
            />
          </label>
          <label className="text-[12px] text-muted">
            Button colour
            <span className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={brand.colour}
                onChange={(e) => setBrand({ ...brand, colour: e.target.value })}
                className="h-10 w-14 rounded-lg border border-line"
              />
              <span className="font-mono text-[13px] text-ink">{brand.colour}</span>
            </span>
          </label>
          <label className="text-[12px] text-muted">
            Postal address in the footer (optional)
            <input
              value={brand.address ?? ""}
              onChange={(e) => setBrand({ ...brand, address: e.target.value || null })}
              className={cn(field, "mt-1")}
            />
          </label>
          <label className="text-[12px] text-muted sm:col-span-2">
            Why they&apos;re getting it (in the footer)
            <input value={brand.reason} onChange={(e) => setBrand({ ...brand, reason: e.target.value })} className={cn(field, "mt-1")} />
          </label>
        </div>
        <div className="mt-4 rounded-xl bg-canvas p-3 text-[12px] leading-relaxed text-muted">
          <p className="mb-1 font-medium text-ink-2">Every email&apos;s footer</p>
          {footerLines(brand).map((l) => (
            <p key={l}>{l}</p>
          ))}
          <p className="underline">Unsubscribe from these emails.</p>
        </div>
      </section>

      <section className={box}>
        <h2 className="text-[15px] font-semibold">Sending</h2>
        <p className="mt-1 text-[13px] text-muted">
          Batches go each hour on working days, {SENDING_HOURS.from} am to {SENDING_HOURS.until - 12} pm Melbourne time, never on Victorian
          public holidays.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="text-[12px] text-muted">
            Most emails a day
            <input
              type="number"
              min={DAILY_CAP.min}
              max={DAILY_CAP.max}
              value={cap}
              onChange={(e) => setCap(Number(e.target.value))}
              className={cn(field, "mt-1 w-32")}
            />
          </label>
          <label className="flex items-center gap-2 pb-2.5 text-[13px]">
            <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
            Pause all marketing email (campaigns and sequences hold where they are)
          </label>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          A new sending domain warms up best starting small (a few hundred a day) and growing over weeks.
        </p>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} Save
        </Button>
        {msg && <span className={cn("text-[13px]", msg.ok ? "text-positive" : "text-danger")}>{msg.text}</span>}
      </div>
    </div>
  );
}
