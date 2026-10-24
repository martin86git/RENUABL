"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { loadTargets, saveTargets } from "@/lib/services/crm";
import { ArrayGauge } from "./solar-gauges";
import { ui } from "./design-shell";

const FIELDS = [
  { key: "sales", label: "Sales a month", unit: "$", hint: "At quoted prices, inc. GST" },
  { key: "deals", label: "Deals sold a month", unit: "", hint: "Deals moved to Won" },
  { key: "kw", label: "Solar sold a month", unit: "kW", hint: "From the deals' designs" },
] as const;
type Form = Record<(typeof FIELDS)[number]["key"], string>;

/**
 * Settings → Sales targets: what the overview's panel arrays light up to each month. A blank target leaves that array aiming at
 * the business's own average of the three months before.
 */
export function TargetsSettings() {
  const [form, setForm] = useState<Form>({ sales: "", deals: "", kw: "" });
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    void loadTargets().then((res) => {
      if (!res.ok) return setStatus({ ok: false, text: res.message });
      setForm({
        sales: res.targets.sales?.toString() ?? "",
        deals: res.targets.deals?.toString() ?? "",
        kw: res.targets.kw?.toString() ?? "",
      });
    });
  }, []);
  const save = async () => {
    const res = await saveTargets(form);
    if (!res.ok) return setStatus({ ok: false, text: res.message });
    setForm({
      sales: res.targets.sales?.toString() ?? "",
      deals: res.targets.deals?.toString() ?? "",
      kw: res.targets.kw?.toString() ?? "",
    });
    setStatus({ ok: true, text: "Saved. The overview's arrays now light up to these." });
  };
  return (
    <div className={clsx(ui.page, "max-w-3xl")}>
      <p className={ui.eyebrow}>Settings · CRM</p>
      <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Sales targets</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
        What the panel arrays on your overview light up to each month. Leave one blank and its array aims at your own average of the three
        months before.
      </p>
      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Each target is an array on the overview, lit as the month gets there: a glimpse of how it reads. */}
        <div className="mx-auto w-56 shrink-0 space-y-2.5 rounded-xl bg-primary p-4 sm:mx-0">
          {FIELDS.map((f) => (
            <ArrayGauge key={f.key} share={form[f.key] ? 0.62 : 0} cols={10} now={0.55} label={f.label} />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="flex items-center gap-2 text-[13px] font-medium text-ink">{f.label}</span>
              <span className="mt-1.5 flex items-center gap-2">
                {f.unit === "$" && <span className="text-sm text-muted">$</span>}
                <input
                  className={clsx(ui.input, "max-w-48 tabular-nums")}
                  inputMode="decimal"
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder="Your 3-month average"
                />
                {f.unit === "kW" && <span className="text-sm text-muted">kW</span>}
              </span>
              <span className="mt-1 block text-xs text-muted">{f.hint}</span>
            </label>
          ))}
          <div className="flex items-center gap-3">
            <button className={ui.primary} onClick={() => void save()}>
              Save targets
            </button>
            {status && <p className={clsx("text-sm", status.ok ? "text-ink-2" : "text-danger")}>{status.text}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
