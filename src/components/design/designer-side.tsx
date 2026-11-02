"use client";

import clsx from "clsx";
import { Mail, MessageSquare, Send, StickyNote } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Activity } from "@/lib/domain/design/crm";
import type { TimelineEvent } from "@/lib/domain/design/timeline";
import { addActivity, attachSiteAt, dollars, listJobs, loadCustomer, loadTimeline, type JobLine } from "@/lib/services/crm";
import { attachable } from "@/lib/domain/design/design-home";
import { UNREAD_CHANGED } from "@/lib/services/chat";
import { DealChat } from "./chat-panel";

/**
 * The design tool's column beside the picture, for a roof opened from a deal (1 Nov 2026, Martin: Primero's designer in
 * the frame, wave 6): the deal's notes in the Designer view, and the chat with the customer and the timeline of every
 * proposal sent in the Proposal view.
 */

const card = "rounded-lg border border-line bg-surface p-3";
const head = "text-[10px] font-medium uppercase tracking-[0.14em] text-muted";
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });
const who = (email: string | undefined) => (email ? (email.includes("@") ? email.split("@")[0] : email) : "");

/** The deal's notes and calls, newest first, with a box to add one (written on the deal's record like any note). */
export function DealNotes({ jobId, customerId }: { jobId: string; customerId: string }) {
  const [notes, setNotes] = useState<Activity[] | null>(null);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let gone = false;
    void loadCustomer(customerId).then((res) => {
      if (gone) return;
      if (res.ok) setNotes(res.activity.filter((a) => a.jobId === jobId && (a.kind === "note" || a.kind === "call")));
      else setNotes([]);
    });
    return () => {
      gone = true;
    };
  }, [jobId, customerId]);
  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const res = await addActivity(customerId, { kind: "note", text: text.trim(), jobId });
    setBusy(false);
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    setText("");
    setNotes([res.activity, ...(notes ?? [])]);
  };
  return (
    <section className={card} aria-label="The deal's notes">
      <div className="flex items-baseline justify-between">
        <p className={head}>Deal notes</p>
        <Link
          href={`/design/deals/${encodeURIComponent(jobId)}`}
          className="text-xs font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
        >
          Open the deal
        </Link>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void add();
        }}
        maxLength={4000}
        placeholder="A note on this deal: what the customer wants, what you found on the roof"
        className="mt-2 block min-h-16 w-full rounded-md border border-line bg-surface px-2.5 py-2 text-sm outline-none focus:border-forest"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {problem ? (
          <p className="text-xs text-danger" role="alert">
            {problem}
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy || !text.trim()}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
        >
          {busy ? "Adding…" : "Add note"}
        </button>
      </div>
      {notes === null ? (
        <p className="mt-2 text-xs text-muted">Loading the notes…</p>
      ) : notes.length ? (
        <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
          {notes.slice(0, 20).map((n) => (
            <li key={n.id} className="rounded-md bg-canvas px-2.5 py-2">
              <p className="whitespace-pre-line text-[13px] leading-snug text-ink">{n.text}</p>
              <p className="mt-1 text-[11px] text-muted">
                {n.kind === "call" ? "Call · " : ""}
                {who(n.by)} · {when(n.at)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted">No notes on this deal yet.</p>
      )}
    </section>
  );
}

const ICON: Record<TimelineEvent["kind"], typeof Mail> = {
  published: Send,
  proposal: StickyNote,
  customer: MessageSquare,
  reply: MessageSquare,
  email: Mail,
};

/**
 * Every proposal sent, newest first: each publish a large orange point with what went out, option by option, then the
 * smaller points (opened, signed, taken back, the deposit, the chat, the emails sent from the deal). Read again when
 * the chat changes or the design is published.
 */
export function ProposalTimeline({ jobId, refresh }: { jobId: string; refresh?: number }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [asks, setAsks] = useState(0);
  useEffect(() => {
    const again = () => setAsks((n) => n + 1);
    window.addEventListener(UNREAD_CHANGED, again);
    return () => window.removeEventListener(UNREAD_CHANGED, again);
  }, []);
  useEffect(() => {
    let gone = false;
    void loadTimeline(jobId).then((res) => !gone && setEvents(res.ok ? res.events : []));
    return () => {
      gone = true;
    };
  }, [jobId, asks, refresh]);
  return (
    <section className={card} aria-label="What has been sent">
      <p className={head}>Timeline</p>
      {events === null ? (
        <p className="mt-2 text-xs text-muted">Loading…</p>
      ) : !events.length ? (
        <p className="mt-2 text-xs text-muted">
          Nothing sent yet. Publish the design and it shows here, with the chat and emails after it.
        </p>
      ) : (
        <ol className="relative mt-3 space-y-3 before:absolute before:bottom-1 before:left-[7px] before:top-1 before:w-px before:bg-line">
          {events.map((e, i) => {
            const big = e.kind === "published";
            const Icon = ICON[e.kind];
            return (
              <li key={`${e.at}-${i}`} className="relative pl-6">
                <span
                  className={clsx(
                    "absolute left-0 top-1 rounded-full ring-4 ring-surface",
                    big
                      ? "size-[15px] bg-sun-line"
                      : e.kind === "customer"
                        ? "left-[3px] size-[9px] bg-ink"
                        : "left-[3px] size-[9px] bg-line-strong",
                  )}
                  aria-hidden
                />
                <p className={clsx("flex items-center gap-1.5 text-[13px] leading-snug", big ? "font-semibold text-ink" : "text-ink-2")}>
                  {!big && <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />}
                  {e.title}
                </p>
                {e.options?.length ? (
                  <ul className="mt-1 space-y-0.5">
                    {e.options.map((o, k) => (
                      <li key={k} className="flex justify-between gap-2 text-xs text-ink-2">
                        <span className="truncate">
                          {e.options!.length > 1 ? `${o.name}: ` : ""}
                          {o.system}
                        </span>
                        <span className="shrink-0 tabular-nums text-ink">{dollars(o.youPay)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {e.detail && <p className="mt-0.5 line-clamp-3 text-xs text-muted">{e.detail}</p>}
                <p className="mt-0.5 text-[11px] text-muted">
                  {when(e.at)}
                  {e.by && e.kind !== "customer" ? ` · ${who(e.by)}` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** The Proposal view's chat with the customer and its timeline. */
export function ProposalSide({ jobId, refresh }: { jobId: string; refresh?: number }) {
  return (
    <>
      <section className={card} aria-label="Conversation with the customer">
        <p className={head}>Chat with the customer</p>
        <div className="mt-2">
          <DealChat jobId={jobId} compact />
        </div>
      </section>
      <ProposalTimeline jobId={jobId} refresh={refresh} />
    </>
  );
}

/** The first part of an address, for matching a deal to a site: "8 Example Court". */
const streetOf = (address: string) => address.split(",")[0].trim().toLowerCase();

/**
 * Publish for a site with no deal (2 Nov 2026, from the same glitch found in Primero's): a proposal goes to a deal's
 * customer, so the panel says so and puts the design on a deal there and then (`attachable`: still being sold, no
 * design and no address of its own), a deal at this address first. A deal here that already has its own design is
 * named with the way to open that instead.
 */
export function PutOnDeal({
  place,
  onAttached,
}: {
  place: { lat: number; lng: number; address: string };
  onAttached: (jobId: string) => void;
}) {
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    void listJobs().then((res) => {
      if (!gone) setJobs(res.ok ? res.jobs : []);
    });
    return () => {
      gone = true;
    };
  }, []);
  const street = streetOf(place.address);
  const here = (j: JobLine) => Boolean(street) && streetOf(j.address) === street;
  const choices = jobs ? [...attachable(jobs)].sort((a, b) => Number(here(b)) - Number(here(a))) : [];
  const elsewhere = jobs?.find((j) => here(j) && !choices.includes(j) && j.stage !== "lost");
  const picked = to || (choices[0] && here(choices[0]) ? choices[0].id : "");
  const attach = async () => {
    if (!picked) return;
    setBusy(true);
    setProblem(null);
    const res = await attachSiteAt({ lat: place.lat, lng: place.lng }, picked);
    setBusy(false);
    if (res.ok) onAttached(picked);
    else setProblem(res.message);
  };
  return (
    <div>
      <p className="text-sm font-medium text-ink">Not on a deal yet: put it on a deal to publish it</p>
      <p className="mt-0.5 text-xs text-muted">
        A proposal goes to a deal&apos;s customer. The design is saved; choose the deal it&apos;s for and it opens there, ready to publish.
      </p>
      {elsewhere && (
        <p className="mt-3 rounded-md bg-surface-2 p-2.5 text-xs text-ink-2">
          {elsewhere.customerName}&apos;s deal ({elsewhere.title}) is at this address with a design of its own.{" "}
          <Link href={`/design/roof?job=${elsewhere.id}`} className="font-medium text-ink underline underline-offset-2">
            Open its design instead
          </Link>
        </p>
      )}
      {jobs === null ? (
        <p className="mt-3 text-xs text-muted">Finding your deals…</p>
      ) : choices.length ? (
        <div className="mt-3 flex gap-2">
          <select
            value={picked}
            onChange={(e) => setTo(e.target.value)}
            className="min-w-0 flex-1 rounded-md bg-surface px-2 py-2 text-sm text-ink ring-1 ring-line"
            aria-label="The deal to put this design on"
          >
            <option value="">Choose a deal…</option>
            {choices.map((j) => (
              <option key={j.id} value={j.id}>
                {j.customerName} · {j.title}
                {here(j) ? " (this address)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void attach()}
            disabled={!picked || busy}
            className="rounded-md bg-primary px-3 text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
          >
            {busy ? "Putting it on…" : "Put it on this deal"}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-2">
          No deal is waiting for a design.{" "}
          <Link href="/design/sales/pipelines" className="font-medium text-ink underline underline-offset-2">
            Make a new deal
          </Link>{" "}
          for this customer, then come back.
        </p>
      )}
      {problem && <p className="mt-2 text-xs text-danger">{problem}</p>}
    </div>
  );
}
