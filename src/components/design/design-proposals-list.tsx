"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BatteryCharging, Bell, Check, Download, Eye, Mail, PenTool, Phone, Plug, Send, Sun } from "lucide-react";
import clsx from "clsx";
import {
  FOLLOW_UP_WORDS,
  byMonthAndWeek,
  byName,
  dueFollowUp,
  followUpLine,
  sentOrder,
  sentStamp,
  systemWords,
  wholeDollars,
  type FollowUpDue,
} from "@/lib/domain/design/proposal-lists";
import { listProposals, markFollowUp, type ProposalLine } from "@/lib/services/after-sale";
import type { PreparedItem } from "@/lib/domain/design/prepared";
import { PATHS, PageHead, ui } from "./design-shell";
import { PreparedCard, usePrepared } from "./ready-for-you";
import { SolIcon } from "./sol-icon";

/**
 * /design/sales/proposals and /design/sales/signed, laid out as Primero's are (Martin, 18 Oct 2026). Sent: each
 * deal's proposal out with its customer, those due a follow-up first, with what was sold as marks, the system, price and
 * who sent it, where it stands, the follow-up due (marked called or emailed) with what the customer has had so far, and
 * when it went out. Signed: by month and week with their totals, each with its signed PDF.
 */
export function ProposalsPage({ signed }: { signed: boolean }) {
  const [rows, setRows] = useState<ProposalLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Read once on the client, so "today" and "3 days ago" are the viewer's now.
  const [now] = useState(() => new Date());
  useEffect(() => {
    let gone = false;
    void listProposals().then((res) => {
      if (gone) return;
      if (res.ok) setRows(res.proposals);
      else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, []);

  return (
    <div className={ui.page}>
      <PageHead eyebrow="Sales" title={signed ? "Proposals Signed" : "Proposals Sent"} />
      {problem && (
        <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {!rows && !problem && <p className="mt-6 text-sm text-muted">Loading…</p>}
      {rows && (signed ? <SignedList rows={rows} now={now} /> : <SentList rows={rows} now={now} />)}
    </div>
  );
}

/** What was sold, as three marks: solar, battery and EV charger, lit with their sizes when on the system. */
function Sold({ kw, batteryKwh }: { kw: number; batteryKwh: number }) {
  const marks = [
    { label: "Solar", Icon: Sun, on: kw > 0, size: kw ? `${kw.toFixed(1)} kW` : "" },
    { label: "Battery", Icon: BatteryCharging, on: batteryKwh > 0, size: batteryKwh ? `${Math.round(batteryKwh * 10) / 10} kWh` : "" },
    { label: "EV charger", Icon: Plug, on: false, size: "" },
  ];
  return (
    <div className="flex gap-1.5">
      {marks.map(({ label, Icon, on, size }) => (
        <div key={label} className="flex w-11 flex-col items-center gap-1" title={on ? label : `No ${label.toLowerCase()}`}>
          <span
            className={clsx(
              "flex size-9 items-center justify-center rounded-md",
              on ? "bg-ink text-sun-line" : "border border-line text-line",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="h-3 whitespace-nowrap text-[10px] tabular-nums text-muted">{size}</span>
        </div>
      ))}
    </div>
  );
}

/** When it went out: a small card with the day large. */
function SentOn({ at, now }: { at: string; now: Date }) {
  const s = sentStamp(at, now);
  return (
    <div className="w-24 shrink-0 rounded-md bg-sun px-3 py-2 text-sun-ink" title={`Sent ${s.full}`}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em]">Sent</p>
      <p className="text-[17px] leading-tight tracking-tight">{s.day}</p>
      <p className="text-[11px] tabular-nums">
        {s.time} · {s.ago}
      </p>
    </div>
  );
}

type SentLine = ProposalLine & { at: string; due: FollowUpDue | null };

function SentList({ rows, now }: { rows: ProposalLine[]; now: Date }) {
  const [list, setList] = useState(rows);
  const lines: SentLine[] = sentOrder(
    list.map((r) => ({
      ...r,
      at: r.publishedAt,
      due:
        r.state === "live"
          ? dueFollowUp({ sentAt: r.publishedAt, now, done: r.followUps.map((f) => f.day), lastWord: r.lastWord, lastTouch: r.lastTouch })
          : null,
    })),
  );
  const toFollow = lines.filter((l) => l.due).length;
  const out = lines.filter((l) => l.state !== "withdrawn").length;
  const marked = (jobId: string, day: number, how: "call" | "email") =>
    setList((all) =>
      all.map((r) => (r.jobId === jobId ? { ...r, followUps: [...r.followUps, { day, how, at: new Date().toISOString() }] } : r)),
    );
  // The follow-ups Sol has drafted (Ready for you), offered in each one's box.
  const { items: drafts, drop } = usePrepared();

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] tracking-tight text-ink">Proposals recently sent</h2>
        {lines.length > 0 && (
          <div className="flex items-center gap-3 text-[13px] text-ink-2">
            {toFollow > 0 && <span className="rounded-full bg-sun px-2.5 py-1 font-medium text-sun-ink">{toFollow} to follow up</span>}
            <span>{out} in front of customers</span>
          </div>
        )}
      </div>
      {lines.length === 0 ? (
        <p className={clsx(ui.card, "mt-4 p-5 text-sm text-ink-2")}>
          None yet. When a proposal is published from the design tool it appears here.
        </p>
      ) : (
        <ul className={clsx(ui.card, "mt-4 divide-y divide-line")}>
          {lines.map((r) => (
            <li key={r.jobId} className="grid gap-4 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
              <Sold kw={r.kw} batteryKwh={r.batteryKwh} />
              <div className="min-w-0">
                <p className="truncate text-sm">
                  <span className="font-semibold text-ink">{r.customer}</span>
                  <span className="text-muted"> · {r.address || r.title}</span>
                </p>
                <p className="mt-0.5 text-[13px] text-ink-2">
                  {r.options > 1 && `${r.options} options · first: `}
                  {systemWords(r.kw, r.batteryKwh)} · <span className="font-semibold text-ink">{wholeDollars(r.youPay)}</span> · sent by{" "}
                  {byName(r.by)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Status state={r.state} />
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <Eye className="size-3.5" aria-hidden /> {r.openedAt ? `Opened ${sentStamp(r.openedAt, now).day}` : "Not opened yet"}
                  </span>
                </div>
                {r.due && (
                  <FollowUpBox
                    line={r}
                    due={r.due}
                    onDone={(how) => marked(r.jobId, r.due!.day, how)}
                    draft={drafts?.find((d) => d.kind === "follow-up" && d.jobId === r.jobId && d.day === r.due!.day) ?? null}
                    onDraftGone={drop}
                  />
                )}
                {!r.due && r.followUps.length > 0 && <Touches line={r} now={now} />}
              </div>
              <div className="flex items-start gap-3 sm:flex-col sm:items-end">
                <SentOn at={r.publishedAt} now={now} />
                <Link href={`${PATHS.deals}/${r.jobId}?design=1`} className={clsx(ui.quiet, "h-8 rounded-full px-3 text-xs")}>
                  <PenTool className="size-3.5" aria-hidden /> Open the design
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Status({ state }: { state: ProposalLine["state"] }) {
  const [words, tone] =
    state === "withdrawn"
      ? ["Taken back", "bg-canvas text-muted"]
      : state === "accepted"
        ? ["Signed", "bg-positive-soft text-positive"]
        : state === "lapsed"
          ? ["Price lapsed", "bg-canvas text-muted"]
          : ["Waiting on the customer", "bg-sun text-sun-ink"];
  return <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>{words}</span>;
}

/**
 * The follow-up due, marked called or emailed here, with what the customer has had so far beneath it; and when Sol has
 * drafted it (Ready for you), "Sol drafted it" opens his draft to check and send.
 */
function FollowUpBox({
  line,
  due,
  onDone,
  draft,
  onDraftGone,
}: {
  line: SentLine;
  due: FollowUpDue;
  onDone: (how: "call" | "email") => void;
  draft: PreparedItem | null;
  onDraftGone: (id: string) => void;
}) {
  const [state, setState] = useState<"idle" | "saving" | "error" | { how: "call" | "email" }>("idle");
  const [reading, setReading] = useState(false);
  const mark = async (how: "call" | "email") => {
    setState("saving");
    const res = await markFollowUp(line.jobId, due.day, how);
    if (!res.ok) return setState("error");
    setState({ how });
    onDone(how);
  };
  const word = FOLLOW_UP_WORDS[due.step - 1];
  return (
    <div className="mt-3 rounded-md border border-sun-line/50 bg-sun/40 px-3 py-2.5">
      {typeof state === "object" ? (
        <p className="flex items-center gap-1.5 text-[13px] text-positive">
          <Check className="size-4" aria-hidden /> {word} follow-up done: {state.how === "call" ? "called" : "emailed"}
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-sun-ink">
            <Bell className="size-4" aria-hidden /> {followUpLine(due)}
          </p>
          <div className="flex gap-1.5">
            {draft && draft.status === "ready" && (
              <button className={clsx(ui.primary, "h-7 px-2.5 text-xs")} onClick={() => setReading(!reading)} aria-expanded={reading}>
                <SolIcon className="size-3.5" aria-hidden /> Sol drafted it
              </button>
            )}
            <button className={clsx(ui.quiet, "h-7 bg-surface px-2.5 text-xs")} onClick={() => mark("call")} disabled={state === "saving"}>
              <Phone className="size-3.5" aria-hidden /> Called
            </button>
            <button className={clsx(ui.quiet, "h-7 bg-surface px-2.5 text-xs")} onClick={() => mark("email")} disabled={state === "saving"}>
              <Send className="size-3.5" aria-hidden /> Emailed
            </button>
          </div>
        </div>
      )}
      {state === "error" && <p className="mt-1 text-xs text-danger">Couldn&apos;t be saved. Try again.</p>}
      {draft && reading && typeof state !== "object" && (
        <div className="mt-2">
          <PreparedCard
            item={draft}
            showDeal={false}
            onGone={(sent) => {
              onDraftGone(draft.id);
              if (sent) {
                setState({ how: "email" });
                onDone("email");
              }
            }}
          />
        </div>
      )}
      <Touches line={line} now={new Date()} />
    </div>
  );
}

/** What the customer has had so far, oldest first: the proposal sent, opened, and each follow-up, with dates. */
function Touches({ line, now }: { line: ProposalLine; now: Date }) {
  const touches = [
    { label: "Proposal sent", at: line.publishedAt, Icon: Send },
    ...(line.openedAt ? [{ label: "Opened the proposal", at: line.openedAt, Icon: Eye }] : []),
    ...line.followUps.map((f) => ({
      label: `${FOLLOW_UP_WORDS[[2, 7, 14].indexOf(f.day)] ?? "A"} follow-up: ${f.how === "call" ? "called" : "emailed"}`,
      at: f.at,
      Icon: f.how === "call" ? Phone : Mail,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ol className="mt-2 flex flex-wrap gap-3">
      {touches.map((t, i) => {
        const s = sentStamp(t.at, now);
        return (
          <li key={i} className="flex flex-col items-center gap-0.5" title={`${t.label} · ${s.full}`}>
            <span className="flex size-6 items-center justify-center rounded-full bg-surface text-ink-2 ring-1 ring-line">
              <t.Icon className="size-3" aria-hidden />
            </span>
            <span className="text-[10px] tabular-nums text-muted">{s.day}</span>
          </li>
        );
      })}
    </ol>
  );
}

function SignedList({ rows, now }: { rows: ProposalLine[]; now: Date }) {
  const signed = rows.filter((r) => r.state === "accepted" && r.acceptedAt).map((r) => ({ ...r, signedAt: r.acceptedAt! }));
  const months = byMonthAndWeek(signed);
  const total = signed.reduce((n, r) => n + r.youPay, 0);
  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] tracking-tight text-ink">Signed proposals</h2>
        {signed.length > 0 && (
          <p className="text-[13px] text-ink-2">
            {signed.length} signed · <span className="font-semibold text-ink">{wholeDollars(total)}</span> in all
          </p>
        )}
      </div>
      {signed.length === 0 && (
        <p className={clsx(ui.card, "mt-4 p-5 text-sm text-ink-2")}>
          None yet. When a customer signs their proposal on its page, it appears here with the signed PDF.
        </p>
      )}
      {months.map((m) => (
        <div key={m.label} className="mt-6">
          <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-1.5">
            <h3 className="text-[15px] font-medium text-ink">{m.label}</h3>
            <p className="text-[13px] text-ink-2">
              {m.count} signed · <span className="font-semibold text-ink">{wholeDollars(m.total)}</span>
            </p>
          </div>
          {m.weeks.map((w) => (
            <div key={w.label} className="mt-3">
              <div className="flex items-baseline justify-between gap-3 px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                <span>{w.label}</span>
                <span className="tabular-nums">
                  {w.rows.length} · {wholeDollars(w.total)}
                </span>
              </div>
              <ul className={clsx(ui.card, "mt-1.5 divide-y divide-line")}>
                {w.rows.map((r) => {
                  const s = sentStamp(r.signedAt, now);
                  return (
                    <li key={r.jobId} className="grid gap-4 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                      <Sold kw={r.kw} batteryKwh={r.batteryKwh} />
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          <Link href={`${PATHS.deals}/${r.jobId}`} className="font-semibold text-ink hover:underline">
                            {r.customer || r.acceptedName}
                          </Link>
                          <span className="text-muted"> · {r.address || r.title}</span>
                        </p>
                        <p className="mt-0.5 text-[13px] text-ink-2">
                          {systemWords(r.kw, r.batteryKwh)} · <span className="font-semibold text-ink">{wholeDollars(r.youPay)}</span> ·
                          signed {s.full}
                          {r.acceptedName && r.acceptedName.toLowerCase() !== r.customer.toLowerCase() && ` as ${r.acceptedName}`}
                        </p>
                        {(r.depositReceived > 0 || r.depositSaid) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {r.depositReceived > 0 ? (
                              <span className="rounded-full bg-positive-soft px-2.5 py-0.5 text-xs font-medium text-positive">
                                Deposit received: ${r.depositReceived.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="rounded-full bg-sun px-2.5 py-0.5 text-xs font-medium text-sun-ink">
                                The customer says the deposit is paid: check your account
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <a href={r.pdf} className={clsx(ui.primary, "h-8 rounded-full px-3 text-xs")}>
                          <Download className="size-3.5" aria-hidden /> Signed PDF
                        </a>
                        <Link href={`${PATHS.deals}/${r.jobId}?design=1`} className={clsx(ui.quiet, "h-8 rounded-full px-3 text-xs")}>
                          <PenTool className="size-3.5" aria-hidden /> Open the design
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

/** A figure on a tile, as the after-sale screens show their totals. */
export function Tile({ label, value, tone }: { label: string; value: string; tone?: "over" | "under" }) {
  return (
    <div className={clsx(ui.card, "px-5 py-4")}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p
        className={clsx(
          "mt-1.5 text-[24px] tabular-nums tracking-tight",
          tone === "over" ? "text-danger" : tone === "under" ? "text-positive" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}
