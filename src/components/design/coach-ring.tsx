"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, PhoneCall, X } from "lucide-react";
import { reachContacts, type ReachContact } from "@/lib/domain/design/contact-reach";
import { nameHints, type NameSpan } from "@/lib/domain/design/name-hint";
import type { CallerKey } from "@/lib/domain/install-call";
import { watchAssistantCall } from "@/lib/services/assistant-call";
import { askAssistantToCall } from "@/lib/services/caller";
import { listCustomers, listJobs, type CustomerLine, type JobLine } from "@/lib/services/crm";

export type Book = { customers: CustomerLine[]; jobs: JobLine[] };

/** The business's customers and deals, read once while the agent's chat is open, for names and calls asked for. */
export function useContactBook(on: boolean): Book | null {
  const [book, setBook] = useState<Book | null>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (!on || asked.current) return;
    asked.current = true;
    void Promise.all([listCustomers(), listJobs()]).then(([c, j]) => {
      if (c.ok && j.ok) setBook({ customers: c.customers, jobs: j.jobs });
      else asked.current = false;
    });
  }, [on]);
  return book;
}

/**
 * Customers' names as one is typed (name-hint.ts): a slim row of chips over the box. Tapping one puts the whole name in;
 * typing on, or the cross, leaves them (22 Nov 2026, Martin: "easily ignored if it's not the intended function").
 */
export function NameHints({
  book,
  span,
  onPick,
  onDismiss,
  agents = [],
  onAgent,
}: {
  book: Book | null;
  span: NameSpan | null;
  onPick: (name: string, customerId: string) => void;
  onDismiss: () => void;
  /** The business's own voice agents (26 Nov 2026, Martin): offered first, picked as who is meant, never a customer. */
  agents?: readonly { id: string; name: string; job: string }[];
  onAgent?: (name: string) => void;
}) {
  if (!span) return null;
  const mates = onAgent ? nameHints(agents, span.typed) : [];
  const found = book ? nameHints(book.customers, span.typed) : [];
  if (!found.length && !mates.length) return null;
  return (
    <div className="mb-2 flex items-center gap-1.5 overflow-x-auto" role="listbox" aria-label="Customers and agents">
      {mates.map((a) => (
        <button
          key={`agent-${a.id}`}
          type="button"
          role="option"
          aria-selected={false}
          title={a.job}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAgent?.(a.name)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-ink ring-1 ring-primary hover:ring-sun-line"
        >
          <AudioLines className="size-3.5 text-sun-line" aria-hidden />
          {a.name}
          <span className="text-[10px] font-normal opacity-70">{a.job}</span>
        </button>
      ))}
      {found.map((c) => (
        <button
          key={c.id}
          type="button"
          role="option"
          aria-selected={false}
          // Down, not click: the box keeps its focus, so the keyboard stays up on a phone.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(c.name, c.id)}
          className="shrink-0 rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink ring-1 ring-line hover:ring-sun-line"
        >
          {c.name}
        </button>
      ))}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onDismiss}
        aria-label="Not a customer"
        className="ml-auto grid size-6 shrink-0 place-items-center rounded-full text-muted hover:text-ink"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/**
 * The call the agent got ready when asked in its chat (coaching.ts `ring`): the customer found by the name said (or the
 * one tapped from the chips), what it's for, and **Ring** to hand it over, as Call → Hand it to <name> does. Nothing is
 * placed until it's pressed.
 */
export function RingCard({
  ring,
  book,
  picked,
  agent,
  agentName,
}: {
  ring: { customer: string; about: string };
  book: Book | null;
  picked: ReadonlyMap<string, string>;
  agent: CallerKey;
  agentName: string;
}) {
  const [about, setAbout] = useState(ring.about);
  const [chosen, setChosen] = useState<ReachContact | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [gone, setGone] = useState(false);
  if (gone) return null;
  if (!book) return <p className="mt-2 text-xs text-muted">Finding {ring.customer}…</p>;

  // A customer tapped from the chips whose name this is comes first; else the search's own matches by the name said.
  const said_ = ring.customer.toLowerCase();
  const pickedId = [...picked.entries()].find(([n]) => n.toLowerCase().includes(said_) || said_.includes(n.toLowerCase()))?.[1];
  const pool = pickedId ? book.customers.filter((c) => c.id === pickedId) : book.customers;
  const found = reachContacts(pool, book.jobs, pickedId ? "" : ring.customer);
  // Only someone the agent can ring: a deal to keep the call on and a number on their record.
  const options = [...new Map(found.filter((c) => c.job && c.phone.trim()).map((c) => [c.id, c])).values()];
  const who = chosen ?? (options.length === 1 ? options[0] : null);

  const ringNow = async () => {
    if (!who?.job) return;
    setBusy(true);
    const res = await askAssistantToCall(who.job.id, agent, about);
    setBusy(false);
    if (!res.ok) return setSaid({ ok: false, text: res.message });
    setSaid({ ok: true, text: res.message });
    watchAssistantCall({ jobId: who.job.id, name: who.name, message: res.message, role: agent });
  };

  return (
    <div className="mt-2 rounded-2xl bg-surface p-3 text-sm ring-1 ring-line">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        <PhoneCall className="size-3.5 text-sun-line" aria-hidden /> Call ready
      </p>
      {options.length === 0 ? (
        <p className="mt-1.5 text-ink-2">
          No customer called {ring.customer} with a deal and a phone number you can see. Check the name, or search a contact at the top.
        </p>
      ) : !who ? (
        <div className="mt-1.5">
          <p className="text-ink-2">Which {ring.customer}?</p>
          <ul className="mt-1 space-y-1">
            {options.slice(0, 5).map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setChosen(c)} className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-canvas">
                  <span className="font-medium text-ink">{c.name}</span>
                  <span className="text-muted"> · {c.job?.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-ink">
            {agentName} rings <span className="font-semibold">{who.name}</span>
            <span className="text-muted"> · {who.job?.title}</span>
          </p>
          <label className="mt-2 block text-xs font-medium text-muted">
            What it&apos;s about
            <input
              value={about}
              onChange={(e) => setAbout(e.target.value.slice(0, 300))}
              className="mt-1 block h-9 w-full rounded-lg bg-canvas px-2.5 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-sun-line"
            />
          </label>
          {said ? (
            <p className={said.ok ? "mt-2 text-xs text-ink-2" : "mt-2 text-xs text-danger"}>{said.text}</p>
          ) : (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void ringNow()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-ink disabled:bg-surface-2 disabled:text-muted"
              >
                <PhoneCall className="size-4" aria-hidden />
                {busy ? "Handing it over…" : `Ring ${who.name.split(" ")[0]}`}
              </button>
              <button type="button" onClick={() => setGone(true)} className="h-9 rounded-full px-3 text-sm text-muted hover:text-ink">
                Not now
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
