"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Bell } from "lucide-react";
import clsx from "clsx";
import { GET_READY, installReminderEmail } from "@/lib/domain/design/schedule";
import { REMINDER_DAY_CHOICES, rankedLists, type BusinessPrefs } from "@/lib/domain/design/prefs";
import { MAX_INSTALLERS } from "@/lib/domain/design/job-card";
import { loadPrefs, savePrefs } from "@/lib/services/after-sale";
import { loadWorkspace } from "@/lib/services/design-store";
import { ui } from "./design-shell";

export type AfterSalePart = "suppliers" | "installers" | "invoices" | "automations";

const TITLES: Record<AfterSalePart, { title: string; intro: string }> = {
  suppliers: {
    title: "Suppliers and ordering",
    intro:
      "Each price list you upload is a supplier. Put them in your order of preference: a product on more than one list is ordered from the first. Add each supplier's email to send its purchase orders from the Ordering Station.",
  },
  installers: {
    title: "Installers",
    intro:
      "The installers you send job cards to. Each gets the card by email with the panel layout, the string design and a private link to it on their phone, where they add notes and photos. Taking someone off this list closes their links.",
  },
  invoices: {
    title: "Installer invoices",
    intro: "An installer's invoice within this many dollars (ex GST) of what the quote allowed for its installation counts as a match.",
  },
  automations: {
    title: "Customer reminders",
    intro: "What RENUABL sends your customers for you. Each has its own switch, and starts off: nothing is sent until you turn it on.",
  },
};

/** Settings → the after-sale pages: suppliers, the installer invoice tolerance, and the automations that reach customers. */
export function AfterSaleSettings({ part }: { part: AfterSalePart }) {
  const [prefs, setPrefs] = useState<BusinessPrefs | null>(null);
  const [lists, setLists] = useState<string[]>([]);
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let gone = false;
    void loadPrefs().then((res) => {
      if (gone) return;
      if (res.ok) setPrefs(res.prefs);
      else setState({ ok: false, message: res.message });
    });
    if (part === "suppliers") void loadWorkspace().then((w) => !gone && setLists(w.lists.map((l) => l.name)));
    return () => {
      gone = true;
    };
  }, [part]);

  const save = async () => {
    if (!prefs) return;
    setBusy(true);
    const res = await savePrefs(prefs);
    setBusy(false);
    if (res.ok) {
      setPrefs(res.prefs);
      setState({ ok: true, message: "Saved." });
    } else setState({ ok: false, message: res.message });
  };

  const { title, intro } = TITLES[part];
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-10">
      <h1 className="text-[26px] tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{intro}</p>
      {!prefs && !state && <p className="mt-8 text-sm text-muted">Loading…</p>}
      {prefs && part === "suppliers" && <Suppliers prefs={prefs} lists={lists} onChange={setPrefs} />}
      {prefs && part === "invoices" && (
        <label className={clsx(ui.label, "mt-6 max-w-xs")}>
          Tolerance, ex GST ($)
          <input
            type="number"
            min={0}
            max={2000}
            className={clsx(ui.input, "mt-1.5 tabular-nums")}
            value={prefs.invoiceTolerance}
            onChange={(e) => setPrefs({ ...prefs, invoiceTolerance: Math.max(0, Math.min(2000, Math.round(Number(e.target.value) || 0))) })}
          />
        </label>
      )}
      {prefs && part === "automations" && <Automations prefs={prefs} onChange={setPrefs} />}
      {prefs && part === "installers" && <Installers prefs={prefs} onChange={setPrefs} />}
      {prefs && (
        <div className="mt-8 flex items-center gap-3">
          <button type="button" className={ui.primary} disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </button>
          {state && (
            <span className={clsx("text-sm", state.ok ? "text-positive" : "text-warning")} role="status">
              {state.message}
            </span>
          )}
        </div>
      )}
      {!prefs && state && (
        <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}

function Suppliers({ prefs, lists, onChange }: { prefs: BusinessPrefs; lists: string[]; onChange: (p: BusinessPrefs) => void }) {
  const order = rankedLists(prefs, lists);
  if (!order.length)
    return <p className="mt-6 rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-2">Upload a price list in Price lists first.</p>;
  const move = (i: number, by: number) => {
    const next = [...order];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    onChange({ ...prefs, supplierRank: next });
  };
  const contact = (name: string) => prefs.suppliers[name] ?? { label: "", email: "" };
  return (
    <ol className="mt-6 space-y-3">
      {order.map((name, i) => (
        <li key={name} className={clsx(ui.card, "grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-end")}>
          <div className="flex items-center gap-1 sm:flex-col">
            <button
              type="button"
              className="text-muted hover:text-ink disabled:opacity-30"
              disabled={i === 0}
              onClick={() => move(i, -1)}
              aria-label={`Prefer ${name}`}
            >
              <ArrowUp className="size-4" />
            </button>
            <span className="w-5 text-center text-sm tabular-nums text-ink">{i + 1}</span>
            <button
              type="button"
              className="text-muted hover:text-ink disabled:opacity-30"
              disabled={i === order.length - 1}
              onClick={() => move(i, 1)}
              aria-label={`Prefer ${name} less`}
            >
              <ArrowDown className="size-4" />
            </button>
          </div>
          <label className={ui.label}>
            Supplier name <span className="font-normal text-muted">(list: {name})</span>
            <input
              className={clsx(ui.input, "mt-1.5")}
              value={contact(name).label}
              placeholder={name}
              onChange={(e) =>
                onChange({ ...prefs, suppliers: { ...prefs.suppliers, [name]: { ...contact(name), label: e.target.value } } })
              }
            />
          </label>
          <label className={ui.label}>
            Purchase orders to
            <input
              type="email"
              className={clsx(ui.input, "mt-1.5")}
              value={contact(name).email}
              placeholder="orders@supplier.com.au"
              onChange={(e) =>
                onChange({ ...prefs, suppliers: { ...prefs.suppliers, [name]: { ...contact(name), email: e.target.value } } })
              }
            />
          </label>
        </li>
      ))}
    </ol>
  );
}

/** The installers on file: a name, the email the job card goes to, and a phone. New ones get their id when saved. */
function Installers({ prefs, onChange }: { prefs: BusinessPrefs; onChange: (p: BusinessPrefs) => void }) {
  const set = (i: number, field: "name" | "email" | "phone", value: string) =>
    onChange({ ...prefs, installers: prefs.installers.map((x, k) => (k === i ? { ...x, [field]: value } : x)) });
  return (
    <section className={clsx(ui.card, "mt-6 p-5")}>
      {prefs.installers.length ? (
        <ul className="space-y-3">
          {prefs.installers.map((x, i) => (
            <li key={x.id || i} className="grid gap-2 sm:grid-cols-[1fr_1.3fr_0.9fr_auto]">
              <input
                className={ui.input}
                value={x.name}
                placeholder="Name"
                aria-label="Installer's name"
                onChange={(e) => set(i, "name", e.target.value)}
              />
              <input
                className={ui.input}
                type="email"
                value={x.email}
                placeholder="Email"
                aria-label="Installer's email"
                onChange={(e) => set(i, "email", e.target.value)}
              />
              <input
                className={ui.input}
                value={x.phone}
                placeholder="Phone"
                aria-label="Installer's phone"
                onChange={(e) => set(i, "phone", e.target.value)}
              />
              <button
                type="button"
                className={ui.quiet}
                onClick={() => onChange({ ...prefs, installers: prefs.installers.filter((_, k) => k !== i) })}
                aria-label={`Take ${x.name || "this installer"} off the list`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">No installers on file yet.</p>
      )}
      <button
        type="button"
        className={clsx(ui.quiet, "mt-4")}
        disabled={prefs.installers.length >= MAX_INSTALLERS}
        onClick={() => onChange({ ...prefs, installers: [...prefs.installers, { id: "", name: "", email: "", phone: "" }] })}
      >
        Add an installer
      </button>
      <p className="mt-3 text-xs text-muted">An installer needs a name and an email to be kept. Up to {MAX_INSTALLERS}.</p>
    </section>
  );
}

function Automations({ prefs, onChange }: { prefs: BusinessPrefs; onChange: (p: BusinessPrefs) => void }) {
  const on = prefs.automations.installReminders;
  const sample = installReminderEmail({ business: "Your business", firstName: "Sarah", date: "2026-10-23", contact: "your phone number" });
  return (
    <section className={clsx(ui.card, "mt-6 p-5")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-medium text-ink">
            <Bell className="size-4 text-sun-line" aria-hidden /> Installation reminder
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            An email to the customer before their installation day, with the date and how to get ready. It names your business, and a reply
            goes to the email in your company details.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => onChange({ ...prefs, automations: { ...prefs.automations, installReminders: !on } })}
          className={clsx("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-sun-line" : "bg-line-strong")}
        >
          <span className="sr-only">Send installation reminders</span>
          <span className={clsx("absolute top-1 size-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
        </button>
      </div>
      <label className={clsx(ui.label, "mt-4 max-w-xs")}>
        Sent
        <select
          className={clsx(ui.input, "mt-1.5")}
          value={prefs.reminderDaysBefore}
          onChange={(e) => onChange({ ...prefs, reminderDaysBefore: Number(e.target.value) })}
        >
          {REMINDER_DAY_CHOICES.map((d) => (
            <option key={d} value={d}>
              {d} {d === 1 ? "day" : "days"} before the installation
            </option>
          ))}
        </select>
      </label>
      <details className="mt-4 rounded-md bg-surface-2 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-ink">See the email</summary>
        <p className="mt-3 font-medium text-ink">{sample.subject}</p>
        <p className="mt-2 text-ink-2">Hi Sarah,</p>
        <p className="mt-2 text-ink-2">Your business will be installing your solar on Friday 23 October. A few things to get ready:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
          {GET_READY.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </details>
      <p className="mt-3 text-xs text-muted">
        Sent once a day, in the morning, to customers whose job has an installation date and an email address.
      </p>
    </section>
  );
}
