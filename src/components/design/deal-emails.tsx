"use client";

import clsx from "clsx";
import { ArrowUpRight, ChevronDown, Eye, Paperclip } from "lucide-react";
import { useState } from "react";
import type { Activity } from "@/lib/domain/design/crm";
import { readEmailRecord } from "@/lib/domain/design/deal-email";
import { NOT_TRACKED, openedWords } from "@/lib/domain/design/email-opens";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { ui } from "./design-shell";

export interface DealOpens {
  times: Record<string, string[]>;
  counts: Record<string, number>;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: LAUNCH_MARKET.timeZone,
  });

/**
 * Every email sent from the deal, under its composer (8 Nov 2026, Martin, as Primero's): the subject, who it went to,
 * whether the customer has opened it, and a line of it, newest first; each opens to the whole email. Read from the
 * deal's own record, so emails Sol sent are here too. Only the customer's opens count: the business's own people get
 * copies without the pixel, an email to one of them isn't tracked, and a member's browser loading it isn't counted.
 */
export function DealEmails({ activity, opens }: { activity: readonly Activity[]; opens: DealOpens | null }) {
  const emails = activity.filter((a) => a.kind === "email");
  if (!emails.length) return null;
  return (
    <section className={clsx(ui.card, "mt-4 p-4 sm:p-5")} aria-label="Emails sent from this deal">
      <p className={ui.eyebrow}>Emails · {emails.length}</p>
      <ul className="mt-3 overflow-hidden rounded-lg border border-line divide-y divide-line">
        {emails.map((a) => (
          <SentEmailRow key={a.id} a={a} opens={opens} />
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted">
        Opened means the customer&apos;s copy loaded its pictures: a guide, not proof. Apple Mail can open an email by itself, and opens by
        your own team are never counted.
      </p>
    </section>
  );
}

function SentEmailRow({ a, opens }: { a: Activity; opens: DealOpens | null }) {
  const [open, setOpen] = useState(false);
  const mail = readEmailRecord(a.text);
  const times = opens?.times[a.id];
  const opened = Boolean(times?.length);
  const status = !opens ? null : times ? openedWords(times, LAUNCH_MARKET.timeZone, new Date(), opens.counts[a.id]) : NOT_TRACKED;
  const sender = a.by === "sol" ? "Sol" : a.by.split("@")[0];
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-surface-2 sm:px-4"
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-white" aria-hidden>
          <ArrowUpRight className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[15px] font-medium text-ink">{mail.subject || "(no subject)"}</span>
            <time className="shrink-0 text-xs tabular-nums text-muted" dateTime={a.at}>
              {when(a.at)}
            </time>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
            {mail.to && (
              <span className="truncate">
                To {mail.to}
                {mail.cc.length > 0 && <span className="text-muted"> · Cc {mail.cc.join(", ")}</span>}
              </span>
            )}
            {status && (
              <span
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1",
                  opened ? "bg-positive-soft font-medium text-positive ring-positive/20" : "text-muted ring-line",
                )}
                title={
                  times
                    ? "Only the customer's copy is counted. Apple Mail can open an email by itself, so this is a guide."
                    : "Sent before tracking was set up, another way, or to your own team."
                }
              >
                <Eye className="size-3" aria-hidden /> {status}
              </span>
            )}
            {mail.files.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                <Paperclip className="size-3" aria-hidden /> {mail.files.length}
              </span>
            )}
          </span>
          {!open && mail.body && <span className="mt-1 block truncate text-[13px] text-muted">{mail.body.replace(/\s+/g, " ")}</span>}
        </span>
        <ChevronDown className={clsx("mt-1 size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="px-3 pb-4 pl-14 sm:px-4 sm:pl-15">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{mail.body || "(No words in this email.)"}</p>
          {mail.files.length > 0 && <p className="mt-2 text-xs text-muted">Attached: {mail.files.join(", ")} (kept in Attachments)</p>}
          <p className="mt-2 text-xs text-muted">Sent by {sender}</p>
        </div>
      )}
    </li>
  );
}
