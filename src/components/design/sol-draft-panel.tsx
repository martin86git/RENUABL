"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, ChevronLeft, RotateCcw } from "lucide-react";
import type { FeedDeal } from "@/lib/domain/design/deal-feed";
import { emailDeal } from "@/lib/services/crm";
import { writeWithSol } from "@/lib/services/deal-feed";
import { SolIcon } from "./sol-icon";
import { SolThinking } from "./sol-thinking";

/**
 * Sol's email for a deal, written when a suggestion in the Deals list is pressed, in the feed's place (16 Nov 2026,
 * Martin, as Primero's: the draft comes up on the left in place of the feed; once actioned the feed comes back).
 * Sol writes from the deal's record (/write, one customer-tier credit); the member changes it, asks Sol to change it,
 * and sends it through the deal's own email to the address on the customer's record. Nothing goes without Send.
 */
export function SolDraftPanel(props: { deal: FeedDeal; label: string; ask: string; onClose: () => void; onSent: () => void }) {
  const { deal: d } = props;
  const name = d.customer.split(/\s+/)[0] || "them";
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [writing, setWriting] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [change, setChange] = useState("");
  const asked = useRef("");

  const write = async (ask: string) => {
    setWriting(true);
    setNote(null);
    const r = await writeWithSol(d.jobId, ask);
    setWriting(false);
    if (!r.ok) return setNote(r.message ?? "Sol couldn't write it just now. Try again.");
    setSubject(r.subject);
    setBody(r.body);
  };
  useEffect(() => {
    // Once for the suggestion pressed (a fresh panel for each, keyed by its parent).
    if (asked.current === props.ask) return;
    asked.current = props.ask;
    void write(props.ask);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once a suggestion
  }, [props.ask]);

  const rewrite = () => {
    const what = change.trim();
    if (!what) return;
    setChange("");
    void write(`${props.ask} Change it like this: ${what}. Here is the draft so far, subject "${subject}": ${body}`.slice(0, 3_900));
  };
  const send = async () => {
    setSending(true);
    setNote(null);
    const r = await emailDeal(d.jobId, { subject, body, toCustomer: true });
    setSending(false);
    if (!r.ok) return setNote(r.message ?? "It couldn't be sent. Try again.");
    setSent(true);
    // The feed comes back once it has gone.
    window.setTimeout(props.onSent, 1_400);
  };

  return (
    <div className="mt-9">
      <button
        type="button"
        onClick={props.onClose}
        className="mb-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-surface pl-2.5 pr-4 text-[13px] font-medium text-ink-2 ring-1 ring-line transition hover:text-ink hover:ring-ink-2"
      >
        <ChevronLeft className="size-4" aria-hidden /> Back to your day
      </button>
      <section className="max-w-[44rem] rounded-2xl bg-surface p-5 ring-1 ring-line" aria-label={`Sol's email to ${name}`}>
        <header className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary">
            <SolIcon className="size-5 text-sun-line" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted">Sol · {props.label}</p>
            <h2 className="text-[17px] font-semibold text-ink">
              Email to {d.customer}
              <span className="font-normal text-muted"> · {d.title}</span>
            </h2>
          </div>
        </header>

        {sent ? (
          <p
            className="mt-5 flex items-center gap-2 rounded-xl bg-positive-soft px-4 py-3 text-[14px] font-medium text-positive"
            role="status"
          >
            <Check className="size-4" aria-hidden /> Sent to {name}. It&apos;s on the deal&apos;s record.
          </p>
        ) : writing ? (
          <div className="mt-5">
            <SolThinking say={`Writing to ${name} from what's on the deal…`} />
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-label="Subject"
              placeholder="Subject"
              className="w-full rounded-xl bg-canvas px-3.5 py-2.5 text-[14px] font-medium text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-sun-line"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={11}
              aria-label="The email"
              className="w-full resize-y rounded-xl bg-canvas px-3.5 py-3 text-[14px] leading-relaxed text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-sun-line"
            />
            <div className="flex items-center gap-2 rounded-xl bg-canvas px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-sun-line">
              <SolIcon className="size-4 shrink-0 text-muted" />
              <input
                value={change}
                onChange={(e) => setChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rewrite()}
                placeholder="Tell Sol what to change"
                aria-label="Tell Sol what to change"
                className="h-10 min-w-0 flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-muted focus:outline-none"
              />
              <button
                type="button"
                onClick={rewrite}
                disabled={!change.trim()}
                className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-medium text-ink-2 hover:text-ink disabled:text-muted"
              >
                <RotateCcw className="size-3.5" aria-hidden /> Rewrite
              </button>
            </div>
          </div>
        )}

        {note && <p className="mt-3 text-[13px] text-warning">{note}</p>}

        {!sent && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={writing || sending || !subject.trim() || !body.trim()}
              onClick={() => void send()}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-5 text-[13.5px] font-semibold text-primary-ink transition hover:brightness-110 disabled:bg-surface-2 disabled:text-muted"
            >
              <ArrowUp className="size-4" aria-hidden /> {sending ? "Sending…" : `Send to ${name}`}
            </button>
            <button
              type="button"
              disabled={writing}
              onClick={() => void write(props.ask)}
              className="inline-flex h-10 items-center rounded-full px-4 text-[13.5px] font-medium text-ink-2 ring-1 ring-line hover:text-ink disabled:text-muted"
            >
              Write it again
            </button>
            <button type="button" onClick={props.onClose} className="ml-auto h-10 px-3 text-[13.5px] font-medium text-muted hover:text-ink">
              Not now
            </button>
          </div>
        )}
        <p className="mt-3 text-[12px] text-muted">
          Sent from your business through the deal&apos;s email, to the address on {name}&apos;s record.
        </p>
      </section>
    </div>
  );
}
