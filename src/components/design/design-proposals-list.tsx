"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BatteryCharging,
  Bell,
  Check,
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  PenTool,
  Phone,
  Plug,
  Send,
  Sun,
} from "lucide-react";
import { writeWithSol } from "@/lib/services/deal-feed";
import { emailDeal } from "@/lib/services/crm";
import { dismissPrepared, sendPrepared } from "@/lib/services/prepared";
import { WRITE_ASK_MAX } from "@/lib/domain/design/deal-write";
import { ContextLine } from "./context-line";
import { DictateButton, withSpoken } from "./dictate";
import { SolLive, useTyped } from "./sol-on-deal";
import { askSolInPanel } from "@/lib/services/sol";
import { CallChooser } from "./call-choice";
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
import { usePrepared } from "./ready-for-you";
import { SolIcon } from "./sol-icon";

/**
 * /design/sales/proposals and /design/sales/signed, laid out as Primero's are (Martin, 18 Oct 2026). Sent: each
 * deal's proposal out with its customer, those due a follow-up first, with what was sold as marks, the system, price and
 * who sent it, where it stands, the follow-up due (marked called or emailed) with what the customer has had so far, and
 * when it went out. Signed: by month and week with their totals, each with its signed PDF.
 */
export function ProposalsPage({ signed, bare = false }: { signed: boolean; bare?: boolean }) {
  const [rows, setRows] = useState<ProposalLine[] | null>(null);
  // The business's own follow-up days (its Routines).
  const [days, setDays] = useState<number[] | undefined>(undefined);
  const [problem, setProblem] = useState<string | null>(null);
  // Read once on the client, so "today" and "3 days ago" are the viewer's now.
  const [now] = useState(() => new Date());
  useEffect(() => {
    let gone = false;
    void listProposals().then((res) => {
      if (gone) return;
      if (res.ok) {
        setRows(res.proposals);
        setDays(res.followUpDays);
      } else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, []);

  return (
    <div className={bare ? undefined : ui.page}>
      {!bare && <PageHead eyebrow="Sales" title={signed ? "Proposals Signed" : "Proposals Sent"} />}
      {problem && (
        <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {!rows && !problem && <p className="mt-6 text-sm text-muted">Loading…</p>}
      {rows && (signed ? <SignedList rows={rows} now={now} /> : <SentList rows={rows} now={now} days={days} />)}
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
    <div className="w-24 shrink-0 rounded-md bg-canvas px-3 py-2 text-ink-2 ring-1 ring-line" title={`Sent ${s.full}`}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em]">Sent</p>
      <p className="text-[17px] leading-tight tracking-tight">{s.day}</p>
      <p className="text-[11px] tabular-nums">
        {s.time} · {s.ago}
      </p>
    </div>
  );
}

type SentLine = ProposalLine & { at: string; due: FollowUpDue | null };

function SentList({ rows, now, days }: { rows: ProposalLine[]; now: Date; days?: number[] }) {
  const [list, setList] = useState(rows);
  const lines: SentLine[] = sentOrder(
    list.map((r) => ({
      ...r,
      at: r.publishedAt,
      due:
        r.state === "live"
          ? dueFollowUp({
              sentAt: r.publishedAt,
              now,
              done: r.followUps.map((f) => f.day),
              lastWord: r.lastWord,
              lastTouch: r.lastTouch,
              days,
            })
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
                <ReachOut line={r} />
              </div>
              <div className="flex items-start gap-3 sm:flex-col sm:items-end">
                <SentOn at={r.publishedAt} now={now} />
                <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                  <ProposalLink line={r} />
                  <Link href={`${PATHS.deals}/${r.jobId}?design=1`} className={clsx(ui.quiet, "h-8 rounded-full px-3 text-xs")}>
                    <PenTool className="size-3.5" aria-hidden /> Open the design
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The proposal exactly as the customer has it (17 Nov 2026, Martin: "I should see the exact proposal sent"): their own
 * link, in a new tab. Opened by someone of the business, it isn't counted as the customer opening it.
 */
function ProposalLink({ line }: { line: ProposalLine }) {
  return (
    <a href={line.path} target="_blank" rel="noopener noreferrer" className={clsx(ui.quiet, "h-8 rounded-full px-3 text-xs")}>
      <FileText className="size-3.5" aria-hidden /> View proposal
    </a>
  );
}

/**
 * Get in touch from the list (17 Nov 2026, Martin: "buttons to action an email or call or text, using Sol or any other
 * agent"): Email and Text open the deal where each is written (Text sits in its team chat's To the team | Text switch),
 * Call offers the business's phone agents and calling yourself, and Sol drafts the follow-up email in his panel.
 */
function ReachOut({ line }: { line: ProposalLine }) {
  const [calling, setCalling] = useState(false);
  const first = line.customer.split(" ")[0] || line.customer;
  const deal = `${PATHS.deals}/${line.jobId}`;
  const round = "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-ink ring-1 ring-line hover:ring-ink-2";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={`Get in touch with ${first}`}>
      <button
        type="button"
        className={round}
        onClick={() =>
          askSolInPanel({
            text: `Draft a follow-up email to ${line.customer} about the proposal we sent them (deal ${line.jobId}). Read the deal first and keep it short.`,
            shown: `Write a follow-up to ${first}`,
          })
        }
        title={`Sol drafts an email to ${first} from the deal, for you to check and send`}
      >
        <SolIcon className="size-3.5" /> Sol writes it
      </button>
      <Link href={`${deal}?tab=email`} className={round}>
        <Mail className="size-3.5" aria-hidden /> Email
      </Link>
      <button
        type="button"
        className={clsx(round, !line.phone && "pointer-events-none opacity-50")}
        disabled={!line.phone}
        onClick={() => setCalling(true)}
        title={line.phone ? `Call ${first}: yourself, or hand it to your phone agent` : "No phone on their record"}
      >
        <Phone className="size-3.5" aria-hidden /> Call
      </button>
      <Link href={`${deal}?tab=team`} className={clsx(round, !line.phone && "pointer-events-none opacity-50")}>
        <MessageSquare className="size-3.5" aria-hidden /> Text
      </Link>
      {calling && <CallChooser jobId={line.jobId} phone={line.phone} name={first} onClose={() => setCalling(false)} />}
    </div>
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
          : ["Waiting on the customer", "bg-canvas text-ink-2"];
  return <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>{words}</span>;
}

/**
 * The follow-up due, as Sol putting it to you (18 Nov 2026, Martin: "do the same for proposals sent that need a follow
 * up", as Sol's card on a deal): his line typed out, the violet Context, his follow-up email already written and open to
 * change, then **Yes, send it** / **Not now**, and a box (with the microphone) to tell him what to change, which he
 * writes again. His draft is the one he prepared (Ready for you), else he writes one as the row opens, at most
 * `AUTO_WRITES` on a page so a long list doesn't run up credits. Not now leaves the old way: mark it Called or Emailed.
 */
const AUTO_WRITES = 3;
let autoWritten = 0;

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
  const first = line.customer.split(" ")[0] || line.customer;
  const word = FOLLOW_UP_WORDS[due.step - 1];
  const now = new Date();
  const [state, setState] = useState<"idle" | "saving" | "error" | { how: "call" | "email" }>("idle");
  const [mine, setMine] = useState<{ subject: string; body: string } | null>(null);
  const prepared = draft && draft.status === "ready" ? draft : null;
  const preparing = draft?.status === "preparing";
  const [subject, setSubject] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const shown = mine ?? (prepared ? { subject: prepared.subject, body: prepared.body } : null);
  const words = shown ? { subject: subject ?? shown.subject, body: body ?? shown.body } : null;
  const [writing, setWriting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [later, setLater] = useState(false);
  const [ask, setAsk] = useState("");
  const [heard, setHeard] = useState("");

  const write = async (asked: string) => {
    setWriting(true);
    setProblem(null);
    const r = await writeWithSol(line.jobId, asked.slice(0, WRITE_ASK_MAX));
    setWriting(false);
    if (!r.ok) return setProblem(r.message);
    setMine({ subject: r.subject, body: r.body });
    setSubject(null);
    setBody(null);
  };
  const started = useRef(false);
  useEffect(() => {
    if (started.current || draft || mine) return;
    if (autoWritten >= AUTO_WRITES) return;
    started.current = true;
    autoWritten += 1;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Sol writes it once as the row opens
    void write(
      `The ${word.toLowerCase()} follow-up on the proposal we sent ${first} ${due.age} days ago${line.openedAt ? " (they've opened it)" : " (not opened yet)"}. Short and warm, one easy next step.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, as the row opens with nothing drafted
  }, [draft?.id]);

  const mark = async (how: "call" | "email") => {
    setState("saving");
    const res = await markFollowUp(line.jobId, due.day, how);
    if (!res.ok) return setState("error");
    setState({ how });
    onDone(how);
  };
  const send = async () => {
    if (!words) return;
    setState("saving");
    setProblem(null);
    if (prepared && !mine) {
      const r = await sendPrepared(prepared, words);
      if (!r.ok) {
        setState("idle");
        return setProblem(r.message);
      }
      onDraftGone(prepared.id);
    } else {
      const r = await emailDeal(line.jobId, { ...words, toCustomer: true });
      if (!r.ok) {
        setState("idle");
        return setProblem(r.message);
      }
      await markFollowUp(line.jobId, due.day, "email");
      // Sol's own prepared one, if he had one, isn't needed now.
      if (prepared) {
        void dismissPrepared(prepared.id);
        onDraftGone(prepared.id);
      }
    }
    setState({ how: "email" });
    onDone("email");
  };
  const tell = () => {
    const t = ask.trim();
    if (!t || !words) return;
    setAsk("");
    setHeard("");
    void write(
      `Write the ${word.toLowerCase()} follow-up to ${first} again: ${t}. The last draft began: "${words.body.replace(/\s+/g, " ").slice(0, 220)}"`,
    );
  };

  const opened = line.openedAt ? `opened ${sentStamp(line.openedAt, now).day}` : "not opened yet";
  const say = words
    ? `It's ${due.age} days since ${first} had the proposal, and it's ${opened}. I've written the ${word.toLowerCase()} follow-up. Want me to send it?`
    : writing || preparing
      ? `It's ${due.age} days since ${first} had the proposal. I'm writing the ${word.toLowerCase()} follow-up…`
      : problem
        ? `I couldn't write the ${word.toLowerCase()} follow-up just now (${problem.replace(/\.$/, "")}).`
        : `It's ${due.age} days since ${first} had the proposal. Want me to write the ${word.toLowerCase()} follow-up?`;
  const typed = useTyped(say);
  const quiet = "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-ink ring-1 ring-line hover:bg-surface-2";

  if (typeof state === "object")
    return (
      <p className="mt-3 flex items-center gap-1.5 text-[13px] text-positive">
        <Check className="size-4" aria-hidden /> {word} follow-up done: {state.how === "call" ? "called" : "emailed"}
      </p>
    );

  if (later)
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-sun-line/50 bg-sun/40 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-sun-ink">
          <Bell className="size-4" aria-hidden /> {followUpLine(due)}
        </p>
        <div className="flex gap-1.5">
          <button className={clsx(ui.quiet, "h-7 bg-surface px-2.5 text-xs")} onClick={() => setLater(false)}>
            <SolIcon className="size-3.5" aria-hidden /> Sol&apos;s draft
          </button>
          <button className={clsx(ui.quiet, "h-7 bg-surface px-2.5 text-xs")} onClick={() => mark("call")} disabled={state === "saving"}>
            <Phone className="size-3.5" aria-hidden /> Called
          </button>
          <button className={clsx(ui.quiet, "h-7 bg-surface px-2.5 text-xs")} onClick={() => mark("email")} disabled={state === "saving"}>
            <Send className="size-3.5" aria-hidden /> Emailed
          </button>
        </div>
        {state === "error" && <p className="w-full text-xs text-danger">Couldn&apos;t be saved. Try again.</p>}
      </div>
    );

  return (
    <div className="sol-say mt-3 rounded-2xl p-3.5">
      <div className="flex gap-3">
        <SolLive />
        <div className="min-w-0 flex-1">
          <p className="min-h-[1.4em] text-[14.5px] font-medium leading-snug text-ink" aria-live="polite">
            {typed.text}
            <span className="sol-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-sun-line" aria-hidden />
          </p>
          <ContextLine
            className="mt-1.5"
            text={`${followUpLine(due)} · sent ${sentStamp(line.publishedAt, now).day} · ${opened}${line.followUps.length ? ` · ${line.followUps.length} follow-up${line.followUps.length === 1 ? "" : "s"} so far` : ""}`}
          />
          {words && (
            <div className="mt-3 overflow-hidden rounded-xl bg-canvas ring-1 ring-line">
              <div className="border-b border-line px-3 py-1.5 text-[11.5px] text-muted">
                Email to {first}
                {writing && <span className="text-sun-ink"> · writing it again…</span>}
              </div>
              <input
                value={words.subject}
                onChange={(e) => setSubject(e.target.value)}
                aria-label="Subject"
                className="w-full border-b border-line bg-surface px-3 py-1.5 text-[13.5px] font-semibold text-ink focus:outline-none"
              />
              <textarea
                value={words.body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                aria-label={`The follow-up to ${first}`}
                className="block w-full resize-y bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink focus:outline-none"
              />
            </div>
          )}
          {typed.done && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {words ? (
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={state === "saving" || writing}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sun-line px-3.5 text-xs font-semibold text-white hover:brightness-105 disabled:bg-surface-2 disabled:text-muted"
                >
                  {state === "saving" && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                  Yes, send it
                </button>
              ) : (
                !writing &&
                !preparing && (
                  <button
                    type="button"
                    onClick={() =>
                      void write(
                        `The ${word.toLowerCase()} follow-up on the proposal we sent ${first} ${due.age} days ago. Short and warm, one easy next step.`,
                      )
                    }
                    className="inline-flex h-8 items-center rounded-full bg-sun-line px-3.5 text-xs font-semibold text-white hover:brightness-105"
                  >
                    Yes, write it
                  </button>
                )
              )}
              <button type="button" onClick={() => setLater(true)} className={quiet}>
                Not now
              </button>
              <button type="button" onClick={() => void mark("call")} disabled={state === "saving"} className={quiet}>
                <Phone className="size-3.5" aria-hidden /> I called instead
              </button>
            </div>
          )}
          {problem && words && <p className="mt-2 text-xs text-warning">{problem}</p>}
          {state === "error" && <p className="mt-2 text-xs text-danger">Couldn&apos;t be saved. Try again.</p>}
          {words && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                tell();
              }}
              className="mt-3 flex items-center gap-1 rounded-lg bg-canvas py-0.5 pl-3 pr-0.5 ring-1 ring-line focus-within:ring-sun-line"
            >
              <span className="font-mono text-[12px] text-sun-line" aria-hidden>
                {">"}
              </span>
              <input
                value={heard ? withSpoken(ask, heard) : ask}
                onChange={(e) => {
                  setHeard("");
                  setAsk(e.target.value);
                }}
                placeholder="Tell Sol what to change…"
                aria-label={`Tell Sol what to change in the follow-up to ${first}`}
                className="min-w-0 flex-1 bg-transparent py-1 text-[12.5px] text-ink outline-none placeholder:text-muted"
              />
              <DictateButton
                label={`Speak to Sol about the follow-up to ${first}`}
                onHearing={setHeard}
                onWords={(w) => setAsk((was) => withSpoken(was, w).slice(0, 2000))}
              />
              <button
                type="submit"
                disabled={!ask.trim() || writing}
                aria-label="Send to Sol"
                className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-white disabled:bg-surface-2 disabled:text-muted"
              >
                <ArrowUp className="size-3.5" aria-hidden />
              </button>
            </form>
          )}
          <Touches line={line} now={now} />
        </div>
      </div>
    </div>
  );
}

/** What the customer has had so far, oldest first: the proposal sent, opened, and each follow-up, with dates. */
function Touches({ line, now }: { line: ProposalLine; now: Date }) {
  const touches = [
    { label: "Proposal sent", at: line.publishedAt, Icon: Send },
    ...(line.openedAt ? [{ label: "Opened the proposal", at: line.openedAt, Icon: Eye }] : []),
    ...[...line.followUps]
      .sort((a, b) => a.day - b.day)
      .map((f, i) => ({
        label: `${FOLLOW_UP_WORDS[i] ?? "A"} follow-up: ${f.how === "call" ? "called" : "emailed"}`,
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
                        <ProposalLink line={r} />
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
