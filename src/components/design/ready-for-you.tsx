"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Pencil, Send } from "lucide-react";
import { firstNameOf, type PreparedItem } from "@/lib/domain/design/prepared";
import { PREPARED_CHANGED, dismissPrepared, loadPrepared, sendPrepared } from "@/lib/services/prepared";
import { SolMark } from "./sol-icon";

/** While something is still being written, the tray looks again this often, for at most this long. */
const LOOK_EVERY_MS = 4_000;
const LOOK_FOR_MS = 60_000;

/** The work Sol prepared on the member's deals, kept fresh: read on opening, again while drafts are being written. */
export function usePrepared(jobId?: string) {
  const [items, setItems] = useState<PreparedItem[] | null>(null);
  const read = useCallback(async () => {
    const r = await loadPrepared();
    if (r.ok) setItems(jobId ? r.items.filter((i) => i.jobId === jobId) : r.items);
    return r.ok ? r.items : [];
  }, [jobId]);
  useEffect(() => {
    let gone = false;
    const started = Date.now();
    let timer = 0;
    const look = async () => {
      const got = await read();
      if (gone) return;
      if (got.some((i) => i.status === "preparing") && Date.now() - started < LOOK_FOR_MS)
        timer = window.setTimeout(() => void look(), LOOK_EVERY_MS);
    };
    void look();
    const again = () => void look();
    window.addEventListener(PREPARED_CHANGED, again);
    return () => {
      gone = true;
      window.clearTimeout(timer);
      window.removeEventListener(PREPARED_CHANGED, again);
    };
  }, [read]);
  const drop = (id: string) => setItems((all) => all?.filter((i) => i.id !== id) ?? null);
  return { items, drop };
}

/**
 * Ready for you (1 Nov 2026, Martin: Sol takes work off people in a way that delights them): what Sol prepared,
 * each a press from done. A follow-up drafted when it fell due, a call's recap: Send (the member's press sends it, from
 * the deal's own email), Edit first, or Not now; "Why this?" shows what he based it on. Nothing shows when nothing waits.
 */
export function ReadyForYou({ jobId, compact = false }: { jobId?: string; compact?: boolean }) {
  const { items, drop } = usePrepared(jobId);
  if (!items?.length) return null;
  const ready = items.filter((i) => i.status === "ready").length;
  const writing = items.length - ready;
  return (
    <section aria-label="Ready for you" className={clsx("rounded-3xl bg-surface ring-1 ring-line", compact ? "p-4" : "mt-6 p-5 sm:p-6")}>
      <div className="flex items-center gap-2.5">
        <span className="sol-orb inline-flex size-7 shrink-0 items-center justify-center rounded-full">
          <SolMark className="size-4" glow={false} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Ready for you</p>
          <p className="text-[13px] text-ink-2">
            {ready ? `Sol prepared ${ready === 1 ? "one thing" : `${ready} things`}: check, then send.` : ""}
            {writing ? `${ready ? " " : ""}Writing ${writing === 1 ? "one more" : `${writing} more`}…` : ""}
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((i) => (
          <li key={i.id}>
            <PreparedCard item={i} onGone={() => drop(i.id)} showDeal={!jobId} />
          </li>
        ))}
      </ul>
    </section>
  );
}

type CardProps = { item: PreparedItem; onGone: (sent: boolean) => void; showDeal: boolean };

/**
 * One prepared item, to read, change, send or put aside; `onGone` once it has left the tray. While Sol is still
 * writing it, a quiet line; once written, the card starts afresh from his words.
 */
export function PreparedCard(props: CardProps) {
  if (props.item.status === "preparing")
    return (
      <div className="rounded-2xl bg-canvas p-4">
        <p className="text-[13px] font-medium text-ink">{props.item.customer}</p>
        <p className="text-[12px] text-muted">{props.item.why}</p>
        <p className="mt-2 animate-pulse text-[13px] text-ink-2">Sol is writing this…</p>
      </div>
    );
  return <ReadyCard key={`${props.item.by}:${props.item.subject}`} {...props} />;
}

function ReadyCard({ item, onGone, showDeal }: CardProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [why, setWhy] = useState(false);
  const [subject, setSubject] = useState(item.subject);
  const [body, setBody] = useState(item.body);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    setBusy(true);
    setSaid(null);
    const r = await sendPrepared(item, { subject: subject.trim(), body: body.trim() });
    setBusy(false);
    if (!r.ok) return setSaid({ ok: false, text: r.message });
    setSaid({ ok: true, text: `Sent to ${firstNameOf(item.customer) || item.to}.` });
    window.setTimeout(() => onGone(true), 1_400);
  };
  const notNow = async () => {
    setBusy(true);
    await dismissPrepared(item.id);
    onGone(false);
  };

  return (
    <div className="rounded-2xl bg-canvas p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink">
            {item.kind === "recap" ? "Recap email" : item.kind === "install-day" ? "Install day email" : "Follow-up email"} ·{" "}
            {item.customer}
            {showDeal && <span className="font-normal text-muted"> · {item.title}</span>}
          </p>
          <p className="text-[12px] text-muted">{item.why}</p>
        </div>
        <Link href={`/design/deals/${item.jobId}`} className="tap-area text-[12px] font-medium text-ink-2 hover:text-ink">
          Open deal
        </Link>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Subject"
            className="block h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-forest"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Email"
            rows={9}
            className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-forest"
          />
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(!open)} className="mt-3 block w-full text-left">
          <p className="text-[14px] font-medium text-ink">{subject}</p>
          <p className={clsx("mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink-2", !open && "line-clamp-2")}>
            {/* Folded, the first words after the greeting, so the two lines say something. */}
            {open ? body : body.replace(/^Hi[^\n]*\n+/, "")}
          </p>
          <span className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted">
            {open ? "Less" : "Read it all"} <ChevronDown className={clsx("size-3.5 transition", open && "rotate-180")} aria-hidden />
          </span>
        </button>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || !item.to || !subject.trim() || !body.trim() || said?.ok}
          title={item.to ? `Send to ${item.to}, from the deal's email` : "There's no email for this customer: add one on their page"}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
        >
          {said?.ok ? <Check className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {said?.ok ? "Sent" : busy ? "Sending…" : "Send"}
        </button>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setOpen(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink hover:border-forest"
          >
            <Pencil className="size-3.5" aria-hidden /> Edit first
          </button>
        )}
        <button
          type="button"
          onClick={() => void notNow()}
          disabled={busy}
          className="h-9 rounded-md px-3 text-sm text-ink-2 hover:bg-surface hover:text-ink"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => setWhy(!why)}
          aria-expanded={why}
          className="tap-area ml-auto text-[12px] text-muted hover:text-ink"
        >
          Why this?
        </button>
      </div>
      {!item.to && (
        <p className="mt-2 text-[12px] text-ink-2">There&apos;s no email on file for {item.customer}: add one on their page to send it.</p>
      )}
      {why && (
        <ul className="mt-2 space-y-0.5 border-t border-line pt-2 text-[12px] text-ink-2">
          {item.basis.map((b) => (
            <li key={b}>· {b}</li>
          ))}
          <li className="text-muted">
            {item.by === "sol" ? "Written by Sol. Check it before it goes." : "In Sol's plain words: Claude wasn't available to write it."}
          </li>
        </ul>
      )}
      {said && (
        <p role="status" className={clsx("mt-2 text-[12px]", said.ok ? "text-positive" : "text-sun-ink")}>
          {said.text}
        </p>
      )}
    </div>
  );
}
