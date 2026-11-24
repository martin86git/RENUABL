"use client";

import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { XERO_RESULT_WORDS, xeroInvoiceUrl, type BillsWhen, type XeroResult, type XeroSettings } from "@/lib/domain/design/xero";
import {
  connectXeroHere,
  disconnectXero,
  loadXero,
  raiseXeroInvoice,
  saveXeroSettings,
  sendXeroBill,
  syncXeroNow,
  type XeroView,
} from "@/lib/services/xero";
import { ui } from "./design-shell";

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });

const STATUS_WORDS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting approval",
  AUTHORISED: "Approved, unpaid",
  PAID: "Paid",
  VOIDED: "Voided",
  DELETED: "Deleted",
  sending: "Sending",
  failed: "Didn't go",
};
const BILL_CHOICES: { value: BillsWhen; label: string }[] = [
  { value: "matched", label: "Once they match the job's installation allowance" },
  { value: "any", label: "As soon as they're put against a job" },
  { value: "off", label: "Don't send installer invoices" },
];

/**
 * Settings → Xero (25 Nov 2026, Martin): the business's own Xero organisation. Signed proposals raise the customer's
 * invoice there, Xero's payments mark the deal's customer invoice paid, and installer invoices go as draft bills.
 */
export function XeroSettings() {
  const [view, setView] = useState<XeroView | { error: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(async () => setView(await loadXero()), []);
  useEffect(() => {
    // Coming back from Xero without the small window: ?xero= says how it went.
    const back = new URLSearchParams(window.location.search).get("xero") as XeroResult | null;
    void loadXero().then((v) => {
      setView(v);
      if (back && back in XERO_RESULT_WORDS) setNote(XERO_RESULT_WORDS[back]);
    });
  }, []);

  const act = async (key: string, run: () => Promise<{ ok: boolean; message?: string; number?: string }>, done?: string) => {
    setBusy(key);
    setNote(null);
    const a = await run();
    setBusy(null);
    setNote(a.ok ? (done ?? null) : (a.message ?? "That didn't go through."));
    await load();
  };
  const connect = async () => {
    setBusy("connect");
    setNote(null);
    const r = await connectXeroHere();
    setBusy(null);
    setNote(XERO_RESULT_WORDS[r]);
    await load();
  };

  return (
    <div className={clsx(ui.page, "max-w-3xl space-y-6")}>
      <div>
        <p className={ui.eyebrow}>Settings</p>
        <h1 className="mt-2 text-[28px] leading-tight tracking-tight text-ink">Xero</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Connect your Xero organisation and your books keep up by themselves: when a customer signs, their invoice is raised in Xero; when
          Xero shows it paid, the deal&apos;s customer invoice is marked paid; and installer invoices go to Xero as draft bills.
        </p>
      </div>
      {!view ? (
        <div className="min-h-[20dvh]" aria-busy="true" />
      ) : "error" in view ? (
        <p className="text-sm text-ink-2">{view.error}</p>
      ) : !view.available ? (
        <section className={clsx(ui.card, "p-5 sm:p-6")}>
          <p className="text-sm text-ink-2">Xero isn&apos;t set up on RENUABL yet. It will appear here once it is.</p>
        </section>
      ) : !view.connection ? (
        <section className={clsx(ui.card, "space-y-4 p-5 sm:p-6")}>
          <h2 className="text-base font-semibold text-ink">Connect Xero</h2>
          <p className="text-sm leading-relaxed text-ink-2">
            Xero opens in a small window and asks which organisation to connect. RENUABL only adds invoices, bills and the contacts on them,
            and reads whether invoices it raised are paid.
          </p>
          <button className={ui.primary} disabled={busy === "connect"} onClick={() => void connect()}>
            {busy === "connect" ? "Waiting for Xero…" : "Connect Xero"}
          </button>
          {note && <p className="text-sm text-ink-2">{note}</p>}
        </section>
      ) : (
        <Connected
          view={view as XeroView & { connection: NonNullable<XeroView["connection"]> }}
          busy={busy}
          note={note}
          act={act}
          connect={connect}
        />
      )}
    </div>
  );
}

function Connected({
  view,
  busy,
  note,
  act,
  connect,
}: {
  view: XeroView & { connection: NonNullable<XeroView["connection"]> };
  busy: string | null;
  note: string | null;
  act: (key: string, run: () => Promise<{ ok: boolean; message?: string }>, done?: string) => Promise<void>;
  connect: () => Promise<void>;
}) {
  const c = view.connection;
  const [s, setS] = useState<XeroSettings>(c.settings);
  const changed = JSON.stringify(s) !== JSON.stringify(c.settings);
  const set = <K extends keyof XeroSettings>(k: K, v: XeroSettings[K]) => setS((x) => ({ ...x, [k]: v }));

  return (
    <>
      <section className={clsx(ui.card, "space-y-3 p-5 sm:p-6")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">{c.tenantName || "Your Xero organisation"}</h2>
          <span className={clsx("text-sm", c.problem ? "text-danger" : "text-positive")}>
            {c.problem ? "Needs connecting again" : "Connected"}
          </span>
        </div>
        <p className="text-xs text-muted">
          Connected by {c.connectedBy} on {when(c.connectedAt)}
          {c.syncedAt ? ` · last checked with Xero ${when(c.syncedAt)}` : ""}
        </p>
        {c.problem && <p className="text-sm text-danger">{c.problem}</p>}
        <div className="flex flex-wrap gap-2">
          {c.problem && (
            <button className={ui.primary} disabled={busy !== null} onClick={() => void connect()}>
              Connect Xero again
            </button>
          )}
          <button className={ui.quiet} disabled={busy !== null} onClick={() => void act("sync", syncXeroNow, "Up to date with Xero.")}>
            {busy === "sync" ? "Checking…" : "Check with Xero now"}
          </button>
          <button
            className={ui.quiet}
            disabled={busy !== null}
            onClick={() => {
              if (window.confirm("Disconnect Xero? What was already sent stays in Xero."))
                void act("off", disconnectXero, "Xero is disconnected.");
            }}
          >
            Disconnect
          </button>
        </div>
        {note && <p className="text-sm text-ink-2">{note}</p>}
      </section>

      <section className={clsx(ui.card, "space-y-5 p-5 sm:p-6")}>
        <h2 className="text-base font-semibold text-ink">How invoices and bills go</h2>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--primary)]"
            checked={s.invoices}
            onChange={(e) => set("invoices", e.target.checked)}
          />
          <span className="text-ink">
            Raise the customer&apos;s invoice when they sign
            <span className="block text-xs text-muted">
              One invoice for what they pay: the system with GST, less the federal rebate (STCs), with the deposit and payment milestones
              written under it.
            </span>
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={ui.label}>Raise invoices as</span>
            <select
              className={clsx(ui.input, "mt-1")}
              value={s.status}
              onChange={(e) => set("status", e.target.value as XeroSettings["status"])}
            >
              <option value="DRAFT">Drafts, to approve in Xero</option>
              <option value="AUTHORISED">Approved, ready to send</option>
            </select>
          </label>
          <label className="block">
            <span className={ui.label}>Due, days after the invoice</span>
            <input
              className={clsx(ui.input, "mt-1")}
              type="number"
              min={0}
              max={90}
              value={s.dueDays}
              onChange={(e) => set("dueDays", Math.max(0, Math.min(90, Number(e.target.value) || 0)))}
            />
          </label>
          <label className="block">
            <span className={ui.label}>Sales account code</span>
            <input className={clsx(ui.input, "mt-1")} value={s.salesAccount} onChange={(e) => set("salesAccount", e.target.value)} />
          </label>
          <label className="block">
            <span className={ui.label}>Account code for the STC line</span>
            <input className={clsx(ui.input, "mt-1")} value={s.stcAccount} onChange={(e) => set("stcAccount", e.target.value)} />
          </label>
          <label className="block">
            <span className={ui.label}>Tax on the STC line</span>
            <select
              className={clsx(ui.input, "mt-1")}
              value={s.stcTax}
              onChange={(e) => set("stcTax", e.target.value as XeroSettings["stcTax"])}
            >
              <option value="BASEXCLUDED">BAS excluded</option>
              <option value="OUTPUT">GST on income</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-muted">Check the STC line&apos;s account and tax with your accountant before relying on it.</p>
        <div className="space-y-2">
          <span className={ui.label}>Installer invoices as draft bills</span>
          {BILL_CHOICES.map((o) => (
            <label key={o.value} className="flex items-center gap-3 text-sm text-ink">
              <input
                type="radio"
                name="bills"
                className="size-4 accent-[var(--primary)]"
                checked={s.bills === o.value}
                onChange={() => set("bills", o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
        <label className="block sm:w-1/2">
          <span className={ui.label}>Account code for installation bills</span>
          <input className={clsx(ui.input, "mt-1")} value={s.billsAccount} onChange={(e) => set("billsAccount", e.target.value)} />
        </label>
        <button
          className={ui.primary}
          disabled={!changed || busy !== null}
          onClick={() => void act("save", () => saveXeroSettings(s), "Saved.")}
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
      </section>

      {view.toInvoice.length > 0 && (
        <section className={clsx(ui.card, "space-y-3 p-5 sm:p-6")}>
          <h2 className="text-base font-semibold text-ink">Signed, with no invoice in Xero</h2>
          <p className="text-xs text-muted">Signed before Xero was connected, or one Xero turned away.</p>
          <ul className="divide-y divide-line text-sm">
            {view.toInvoice.map((j) => (
              <li key={j.jobId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                <span className="min-w-0">
                  <span className="text-ink">{j.customer}</span>
                  <span className="text-muted">
                    {" "}
                    · {j.title} · {money(j.youPay)} · signed {when(j.signedAt)}
                  </span>
                </span>
                <button
                  className={ui.quiet}
                  disabled={busy !== null}
                  onClick={() => void act(j.jobId, () => raiseXeroInvoice(j.jobId), "Invoice raised in Xero.")}
                >
                  {busy === j.jobId ? "Raising…" : "Raise invoice"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.toBill.length > 0 && (
        <section className={clsx(ui.card, "space-y-3 p-5 sm:p-6")}>
          <h2 className="text-base font-semibold text-ink">Installer invoices not in Xero</h2>
          <ul className="divide-y divide-line text-sm">
            {view.toBill.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                <span className="min-w-0">
                  <span className="text-ink">{b.installer || "Installer"}</span>
                  <span className="text-muted">
                    {" "}
                    · {b.number || "no number"} · {money(b.subTotal)} ex GST · {b.customer}
                    {b.status === "match"
                      ? " · matches"
                      : b.status === "over"
                        ? " · over the allowance"
                        : b.status === "under"
                          ? " · under the allowance"
                          : ""}
                  </span>
                </span>
                <button
                  className={ui.quiet}
                  disabled={busy !== null}
                  onClick={() => void act(b.id, () => sendXeroBill(b.id), "Sent to Xero as a bill.")}
                >
                  {busy === b.id ? "Sending…" : "Send as bill"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.recent.length > 0 && (
        <section className={clsx(ui.card, "space-y-3 p-5 sm:p-6")}>
          <h2 className="text-base font-semibold text-ink">Sent to Xero</h2>
          <ul className="divide-y divide-line text-sm">
            {view.recent.map((l) => (
              <li key={`${l.kind}-${l.ref}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                <span className="min-w-0">
                  <span className="text-ink">
                    {l.kind === "invoice" ? "Invoice" : "Bill"} {l.number}
                  </span>
                  <span className="text-muted">
                    {" "}
                    · {l.customer}
                    {l.total !== null ? ` · ${money(l.total)}` : ""} · {when(l.at)}
                  </span>
                  {l.error && <span className="block text-xs text-danger">{l.error}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={clsx(
                      "text-xs",
                      l.status === "PAID" ? "text-positive" : l.status === "failed" ? "text-danger" : "text-ink-2",
                    )}
                  >
                    {STATUS_WORDS[l.status] ?? l.status}
                  </span>
                  {l.xeroId && (
                    <a
                      className="text-muted hover:text-ink"
                      href={xeroInvoiceUrl(l.xeroId, l.kind)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open in Xero"
                    >
                      <ExternalLink className="size-4" aria-hidden />
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
