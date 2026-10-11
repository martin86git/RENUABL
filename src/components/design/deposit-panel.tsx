"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import clsx from "clsx";
import { shownBsb } from "@/lib/domain/design/brand";
import {
  WAY_WORDS,
  cardNote,
  customerStandingWords,
  depositBasis,
  money,
  noWayToPay,
  standingWords,
  waysToPay,
  type DepositStatus,
  type PaidWay,
  type PublicDeposit,
} from "@/lib/domain/design/deposit";
import { BANK_NOTE, type ProposalView } from "@/lib/domain/design/proposal";
import { shortDate } from "@/lib/services/crm";
import { markDeposit } from "@/lib/services/proposals";
import type { ProposalStatus } from "@/lib/domain/design/proposal";
import { ui } from "./design-shell";

/** "3 November 2026", in the market's own time. */
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" });

const fine = "text-[12.5px] leading-relaxed text-muted";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-ink disabled:bg-surface-2 disabled:text-muted";
const quiet =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-surface px-5 text-sm font-medium text-ink disabled:bg-surface-2 disabled:text-muted";

/** One thing to copy into a bank's own form: its name, the value, and a button that copies exactly the value. */
function CopyRow({ label, value, copy }: { label: string; value: string; copy?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[12px] text-muted">{label}</p>
        <p className="break-words text-[15px] font-medium tabular-nums text-ink">{value}</p>
      </div>
      <button
        type="button"
        aria-label={`Copy the ${label.toLowerCase()}`}
        className="tap-area inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 text-[12.5px] font-medium text-ink"
        onClick={() => {
          void navigator.clipboard?.writeText(copy ?? value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/**
 * "Pay your deposit", on the customer's own proposal once they have accepted
 * it, until the business marks the deposit received. The customer pays the
 * business directly: by bank transfer into the account the proposal was sent
 * with, quoting a reference of their own, or by card on the business's own
 * payment page, which opens in a new tab. No card is taken and no money
 * passes through this page. "I've made the transfer" and "I've paid by card"
 * tell the business so; they are kept as what the customer said, and the
 * business confirms once it has the money.
 */
export function PayDeposit(props: {
  view: ProposalView;
  deposit: PublicDeposit;
  /** Tells the business the customer has paid, and how. Answers with what went wrong, or null. Left out in a preview. */
  onPaid?: (way: PaidWay) => Promise<string | null>;
}) {
  const { view, deposit } = props;
  const business = view.business.name;
  const [busy, setBusy] = useState<PaidWay | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const ways = waysToPay(view);
  const bank = view.terms?.bank ?? null;
  const payLink = view.terms?.payLink ?? null;
  const said = customerStandingWords(deposit, business, day);

  const tell = async (way: PaidWay) => {
    if (!props.onPaid) return;
    setBusy(way);
    setProblem(await props.onPaid(way));
    setBusy(null);
  };

  if (deposit.standing !== "due")
    return (
      <div id="deposit" className="rounded-xl border border-line bg-surface p-5 sm:p-7" role="status">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          {deposit.standing === "received" ? "Deposit paid" : "Deposit"}
        </p>
        <p className="mt-2 text-[16px] leading-relaxed text-ink">{said}</p>
        {deposit.standing === "said" && deposit.reference && <p className={clsx(fine, "mt-2")}>Your reference is {deposit.reference}.</p>}
      </div>
    );

  return (
    <div id="deposit" className="rounded-xl border border-line bg-surface p-5 sm:p-7">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Next step</p>
      <h3 className="mt-2 text-[20px] leading-tight text-ink">Pay your deposit of {money(deposit.amount)}</h3>
      <p className={clsx(fine, "mt-2")}>
        {depositBasis(view)} You pay {business} directly: nothing is charged through this page.
      </p>

      {ways.length === 0 && <p className="mt-4 text-[15px] text-ink">{noWayToPay(business)}</p>}

      {bank && (
        <section className="mt-5 rounded-lg border border-line p-4" aria-labelledby="pay-by-bank">
          <h4 id="pay-by-bank" className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
            Pay by bank transfer
          </h4>
          <div className="mt-2">
            <CopyRow label="Account name" value={bank.name} />
            <CopyRow label="BSB" value={shownBsb(bank.bsb)} copy={bank.bsb} />
            <CopyRow label="Account number" value={bank.number} copy={bank.number.replace(/\s/g, "")} />
            <CopyRow label="Amount" value={money(deposit.amount)} copy={deposit.amount.toFixed(2)} />
            {deposit.reference && <CopyRow label="Reference" value={deposit.reference} />}
          </div>
          <p className={clsx(fine, "mt-3")}>
            {deposit.reference ? `Put the reference on your payment so ${business} can match it to you. ` : ""}
            {BANK_NOTE}
          </p>
          <button
            type="button"
            className={clsx(button, "mt-4 w-full")}
            disabled={busy !== null || !props.onPaid}
            onClick={() => void tell("bank")}
          >
            {busy === "bank" ? "Telling them…" : "I've made the transfer"}
          </button>
        </section>
      )}

      {payLink && (
        <section className="mt-4 rounded-lg border border-line p-4" aria-labelledby="pay-by-card">
          <h4 id="pay-by-card" className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
            Pay by card
          </h4>
          <p className={clsx(fine, "mt-2")}>{cardNote(business)}</p>
          <a href={payLink} target="_blank" rel="noopener noreferrer" className={clsx(button, "mt-3 w-full")}>
            <ExternalLink className="size-4" aria-hidden /> Pay by card
          </a>
          <button
            type="button"
            className={clsx(quiet, "mt-2 w-full")}
            disabled={busy !== null || !props.onPaid}
            onClick={() => void tell("card")}
          >
            {busy === "card" ? "Telling them…" : "I've paid by card"}
          </button>
        </section>
      )}

      {problem && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      {ways.length > 0 && (
        <p className={clsx(fine, "mt-3")}>Telling {business} you have paid lets them look for it. They confirm once they have it.</p>
      )}
    </div>
  );
}

/**
 * Where a deal's deposit stands, for the business: due, said by the customer
 * to be paid (how and when: not confirmed), or received. A member who may
 * publish proposals marks it received once they have seen it in their own
 * account, or not received, which makes it due again. Nothing here takes or
 * checks a payment.
 */
export function DepositLine(props: {
  jobId: string;
  deposit: DepositStatus;
  mayMark: boolean;
  onChange: (versions: ProposalStatus[]) => void;
}) {
  const { deposit } = props;
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const mark = async (received: boolean) => {
    setBusy(true);
    const res = await markDeposit(props.jobId, received);
    setBusy(false);
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    props.onChange(res.versions);
  };
  return (
    <div className="mt-3 rounded-md border border-line bg-surface-2 px-3 py-2.5">
      <p className={ui.eyebrow}>Deposit</p>
      <p className={clsx("mt-1 text-[13px] leading-snug", deposit.standing === "received" ? "text-positive" : "text-ink")}>
        {standingWords(deposit, shortDate)}
      </p>
      <p className="mt-0.5 text-xs text-muted">
        {deposit.reference ? `Reference ${deposit.reference}` : "No reference yet"}
        {deposit.standing === "received" && deposit.way ? ` · the customer said ${WAY_WORDS[deposit.way]}` : ""}
        {deposit.standing === "received" && deposit.receivedBy ? ` · marked by ${deposit.receivedBy}` : ""}
      </p>
      {props.mayMark && (
        <div className="mt-2 flex flex-wrap gap-2">
          {deposit.standing !== "received" && (
            <button type="button" className={clsx(ui.quiet, "min-h-9 px-3 text-xs")} disabled={busy} onClick={() => void mark(true)}>
              Mark deposit received
            </button>
          )}
          {deposit.standing !== "due" && (
            <button type="button" className={clsx(ui.quiet, "min-h-9 px-3 text-xs")} disabled={busy} onClick={() => void mark(false)}>
              Not received
            </button>
          )}
        </div>
      )}
      {problem && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
