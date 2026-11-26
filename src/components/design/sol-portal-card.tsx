"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight, Check, Copy, PanelRight } from "lucide-react";
import {
  FIELD_WORDS,
  PRE_APPROVAL_FIELDS,
  type PreApprovalChange,
  type PreApprovalField,
  type PreApprovalView,
} from "@/lib/domain/design/preapproval";
import { portalOf, portalWindow, type PortalFact, type SolPortal } from "@/lib/domain/design/sol-portal";
import { loadPreApproval, savePreApproval } from "@/lib/services/preapproval";

/** Opens the portal as a window of its own down the right of the screen, RENUABL staying in view beside it. */
function openPortal(url: string) {
  const s = window.screen as Screen & { availLeft?: number; availTop?: number };
  window.open(
    url,
    "renuabl-network-portal",
    portalWindow({ width: s.availWidth, height: s.availHeight, left: s.availLeft, top: s.availTop }),
  );
}

const TONE = { through: "text-positive", waiting: "text-warning", missing: "text-danger" } as const;
const field = "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-[var(--primary)]";
const quiet = "rounded-full px-3 py-1.5 text-xs font-medium text-ink ring-1 ring-line hover:ring-line-strong disabled:text-muted";
const solid =
  "inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-ink disabled:bg-surface-2 disabled:text-muted";

/** The deal's lines, each copied in a press. */
function Facts({ facts, heading }: { facts: PortalFact[]; heading: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    });
  };
  if (!facts.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink">{heading}</p>
        <button
          type="button"
          onClick={() => copy("all", facts.map((f) => `${f.label}: ${f.value}`).join("\n"))}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-ink-2 ring-1 ring-line hover:text-ink"
        >
          {copied === "all" ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
          {copied === "all" ? "Copied" : "Copy all"}
        </button>
      </div>
      <ul className="mt-2 divide-y divide-line rounded-xl ring-1 ring-line">
        {facts.map((f) => (
          <li key={f.label}>
            <button
              type="button"
              onClick={() => copy(f.label, f.value)}
              title={`Copy ${f.label}`}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-canvas"
            >
              <span className="w-32 shrink-0 text-xs text-muted">{f.label}</span>
              <span className="min-w-0 flex-1 break-words text-[13px] font-medium text-ink">{f.value}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-ink-2">
                {copied === f.label ? <Check className="size-3.5 text-positive" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                {copied === f.label ? "Copied" : "Copy"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A step's heading: its number in a round, ticked once done. */
function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span
        className={clsx(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          done ? "bg-positive text-white" : "bg-surface-2 text-ink-2 ring-1 ring-line",
        )}
        aria-hidden
      >
        {done ? <Check className="size-3" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">{title}</p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

/**
 * A deal's network pre-approval, worked through in three steps (26 Nov 2026, Martin; preapproval.ts): the details the
 * portal asks for (with boxes for what the deal doesn't know yet), the portal itself in its own window, and where the
 * application stands, kept on the deal. `suggest` is what Sol took from the member's words, filled in and saved only
 * on a press. Used under Sol's answer and on the Pre-approvals page.
 */
export function PreApprovalCard({ jobId, start, suggest }: { jobId: string; start?: PreApprovalView; suggest?: PreApprovalChange }) {
  const [view, setView] = useState<PreApprovalView | null>(start ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState<Partial<Record<PreApprovalField, string>>>(() =>
    Object.fromEntries(PRE_APPROVAL_FIELDS.filter((k) => suggest?.[k]).map((k) => [k, suggest![k]!])),
  );
  const [reference, setReference] = useState(suggest?.reference ?? "");
  const [limit, setLimit] = useState(suggest?.exportLimit ?? "");
  const [limited, setLimited] = useState(suggest?.status === "Approved, export limited" || Boolean(suggest?.exportLimit));

  useEffect(() => {
    let live = true;
    void loadPreApproval(jobId).then((res) => {
      if (!live) return;
      if (res.ok) setView(res.view);
      else setProblem(res.message);
    });
    return () => {
      live = false;
    };
  }, [jobId]);

  const save = async (change: PreApprovalChange) => {
    setBusy(true);
    setProblem(null);
    const res = await savePreApproval(jobId, change);
    setBusy(false);
    if (!res.ok) return setProblem(res.message);
    setView(res.view);
    setTyped({});
  };

  if (!view)
    return <div className="max-w-xl rounded-2xl bg-surface p-4 text-sm text-muted ring-1 ring-line">{problem ?? "Reading the deal…"}</div>;

  // The boxes: what the application still needs, and anything Sol filled in from what was said.
  const boxes = PRE_APPROVAL_FIELDS.filter((k) => !view.fields[k] || typed[k] !== undefined);
  const filled = Object.fromEntries(Object.entries(typed).filter(([, v]) => v?.trim())) as PreApprovalChange;
  // What Sol took from their words about where it stands, where the deal doesn't say so already: saved on a press.
  const pending: PreApprovalChange = {
    ...(suggest?.status && suggest.status !== view.status ? { status: suggest.status } : {}),
    ...(suggest?.reference && suggest.reference !== view.reference ? { reference: suggest.reference } : {}),
    ...(suggest?.exportLimit && suggest.exportLimit !== view.exportLimit ? { exportLimit: suggest.exportLimit } : {}),
  };
  const pendingWords = [
    pending.status,
    pending.reference ? `reference ${pending.reference}` : "",
    pending.exportLimit ? `export limit ${pending.exportLimit} kW` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const detailsDone = !view.missing.fields.length && !view.missing.other.length;

  return (
    <div className="max-w-xl rounded-2xl bg-surface p-4 text-sm ring-1 ring-line" data-preapproval={view.jobId}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-sun-ink">
        <PanelRight className="size-3.5" aria-hidden /> Network pre-approval
      </p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold text-ink">
          {view.customer}
          {view.network ? ` · ${view.network.name}` : ""}
        </p>
        <p className={clsx("text-xs font-medium", TONE[view.tone])}>
          {view.status}
          {view.reference ? ` · ref ${view.reference}` : ""}
          {view.exportLimit && view.status === "Approved, export limited" ? ` · ${view.exportLimit} kW` : ""}
        </p>
      </div>
      {view.network?.guessed && (
        <p className="mt-1 text-xs text-warning">The network was read from the postcode: check the NMI on the bill.</p>
      )}
      {!view.network && (
        <p className="mt-1 text-xs text-warning">The deal has no NMI or Victorian address to read its network from. Add the NMI below.</p>
      )}

      <div className="mt-4 space-y-5">
        <Step n={1} done={detailsDone} title="The details the portal asks for">
          {(boxes.length > 0 || view.missing.other.length > 0) && (
            <div className="mb-3 rounded-xl bg-canvas p-3">
              <p className="text-xs font-medium text-ink">
                {view.missing.fields.length || view.missing.other.length ? "Still needed" : "To save"}
              </p>
              {boxes.length > 0 && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {boxes.map((k) => (
                    <label key={k} className="text-[11px] text-muted">
                      {FIELD_WORDS[k].label}
                      {k === "phases" ? (
                        <select
                          className={clsx(field, "mt-1")}
                          value={typed[k] ?? ""}
                          onChange={(e) => setTyped((t) => ({ ...t, [k]: e.target.value }))}
                        >
                          <option value="">Choose…</option>
                          <option>Single phase</option>
                          <option>Three phase</option>
                        </select>
                      ) : (
                        <input
                          className={clsx(field, "mt-1")}
                          value={typed[k] ?? ""}
                          placeholder={FIELD_WORDS[k].hint}
                          onChange={(e) => setTyped((t) => ({ ...t, [k]: e.target.value }))}
                        />
                      )}
                    </label>
                  ))}
                </div>
              )}
              {view.missing.other.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-ink-2">
                  {view.missing.other.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
              {boxes.length > 0 && (
                <button
                  type="button"
                  className={clsx(solid, "mt-3")}
                  disabled={busy || !Object.keys(filled).length}
                  onClick={() => void save(filled)}
                >
                  Save to the deal
                </button>
              )}
            </div>
          )}
          <Facts facts={view.facts} heading="Copy across" />
        </Step>

        <Step n={2} done={view.step !== "to-submit"} title={view.portal?.known ? `Apply in ${view.portal.name}` : "Apply with the network"}>
          {view.portal ? (
            <>
              <p className="text-xs text-muted">
                {view.portal.known
                  ? `It opens in its own window beside RENUABL: ${view.network?.name ?? "the network"} doesn't let its portal be shown inside another site. You sign in there yourself.`
                  : `We don't hold the address of ${view.network?.name ?? "this network"}'s portal yet, so this opens its website, which links to the application.`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={solid} onClick={() => openPortal(view.portal!.url)}>
                  Open {view.portal.known ? "the portal" : "the website"} <ArrowUpRight className="size-3.5" aria-hidden />
                </button>
                <Link href={`/design/deals/${encodeURIComponent(view.jobId)}`} className={quiet}>
                  Open the deal
                </Link>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted">
              {view.network
                ? `We don't hold ${view.network.name}'s portal. Apply on its own website.`
                : "Once the network is known, its portal opens from here."}
            </p>
          )}
        </Step>

        <Step n={3} done={view.step === "through"} title="Where it stands">
          {pendingWords && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sun px-3 py-2">
              <p className="text-xs text-sun-ink">From what you told Sol: {pendingWords}</p>
              <button type="button" className={solid} disabled={busy} onClick={() => void save(pending)}>
                Save
              </button>
            </div>
          )}
          {view.step === "to-submit" || view.step === "declined" ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-40 flex-1 text-[11px] text-muted">
                The network&apos;s reference (optional)
                <input className={clsx(field, "mt-1")} value={reference} onChange={(e) => setReference(e.target.value)} />
              </label>
              <button
                type="button"
                className={solid}
                disabled={busy}
                onClick={() => void save({ status: "Submitted", ...(reference.trim() ? { reference } : {}) })}
              >
                {view.step === "declined" ? "Submitted again" : "I've submitted it"}
              </button>
            </div>
          ) : view.step === "waiting" ? (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-ink-2">
                <input type="checkbox" checked={limited} onChange={(e) => setLimited(e.target.checked)} />
                Approved with an export limit
                {limited && (
                  <input
                    aria-label="Export limit in kW"
                    className={clsx(field, "ml-1 w-24")}
                    inputMode="decimal"
                    placeholder="kW"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={solid}
                  disabled={busy || (limited && !limit.trim())}
                  onClick={() => void save(limited ? { status: "Approved, export limited", exportLimit: limit } : { status: "Approved" })}
                >
                  Approved
                </button>
                <button type="button" className={quiet} disabled={busy} onClick={() => void save({ status: "Declined" })}>
                  Declined
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-2">
              Through.{" "}
              {view.status === "Approved, export limited" && view.exportLimit ? `Exports are limited to ${view.exportLimit} kW. ` : ""}
              The deal moves on to its next gate.
            </p>
          )}
        </Step>
      </div>
      {problem && (
        <p className="mt-3 text-xs text-danger" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}

/**
 * A network's portal under Sol's answer (sol-portal.ts). For a deal it is the whole pre-approval card; with no deal,
 * the button that opens the network's portal in its own window.
 */
export function SolPortalCard({ portal }: { portal: SolPortal }) {
  if (portal.jobId) return <PreApprovalCard jobId={portal.jobId} suggest={portal.suggest} />;
  const o = portalOf(portal.network);
  if (!o) return null;
  return (
    <div className="max-w-xl rounded-2xl bg-surface p-4 text-sm ring-1 ring-line" data-sol-portal={portal.network}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-sun-ink">
        <PanelRight className="size-3.5" aria-hidden /> {o.known ? "Pre-approval portal" : "Network website"}
      </p>
      <p className="mt-2 font-semibold text-ink">
        {o.network}
        {o.known ? ` · ${o.name}` : ""}
      </p>
      <p className="mt-1 text-xs text-muted">
        {o.known
          ? `It opens in its own window beside RENUABL: ${o.network} doesn't let its portal be shown inside another site. You sign in there yourself. Tell Sol which deal it's for and he'll line up its details to copy across.`
          : `We don't hold the address of ${o.network}'s portal yet, so this opens its website, which links to the application.`}
      </p>
      <button type="button" onClick={() => openPortal(o.url)} className={clsx(solid, "mt-3")}>
        Open {o.known ? "the portal" : "the website"} <ArrowUpRight className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
