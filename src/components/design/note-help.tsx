"use client";

/**
 * Help with the note published on a proposal (25 Nov 2026, Martin: "Add polish button here. Add sol draft pre written
 * message options"): Sol's ready-written drafts as chips, filled in for this customer, and Polish, which has Sol tidy
 * what is typed (the inbox's own polish, one Sol credit), with Undo. Nothing is published until Publish.
 */
import { useState } from "react";
import { Sparkles, Undo2 } from "lucide-react";
import clsx from "clsx";
import { SEND_TEMPLATES, fillTemplate, type SendTemplateId } from "@/lib/domain/design/send-message";
import { solOnNewEmail } from "@/lib/services/inbox";
import { shortDate } from "@/lib/services/crm";
import { SolIcon } from "./sol-icon";

const CHIP = "rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-ink hover:border-line-strong";

export function NoteHelp(props: {
  note: string;
  onNote: (note: string) => void;
  first: string;
  business: string;
  /** How many days the price stands from publishing: the drafts say until when. */
  validDays: number;
  start: SendTemplateId;
}) {
  const [busy, setBusy] = useState(false);
  const [before, setBefore] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  // The draft offered first leads; the rest follow in their usual order.
  const drafts = [...SEND_TEMPLATES].sort((a, b) => Number(b.id === props.start) - Number(a.id === props.start));

  const put = (text: string) => {
    setBefore(props.note);
    setSaid(null);
    props.onNote(text.slice(0, 1200));
  };

  const polish = async () => {
    if (!props.note.trim() || busy) return;
    setBusy(true);
    setSaid(null);
    try {
      const res = await solOnNewEmail({ mode: "polish", to: "", subject: "", body: props.note });
      if (res.ok && res.body.trim()) put(res.body.trim());
      else setSaid(res.ok ? "Sol couldn't polish it just now." : res.message);
    } catch (e) {
      setSaid(e instanceof Error ? e.message : "Sol couldn't polish it just now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={clsx(CHIP, "inline-flex items-center gap-1.5 bg-primary text-white", (!props.note.trim() || busy) && "opacity-60")}
          disabled={!props.note.trim() || busy}
          onClick={() => void polish()}
        >
          <Sparkles className="size-3.5" aria-hidden /> {busy ? "Polishing…" : "Polish"}
        </button>
        {before !== null && (
          <button
            type="button"
            className={clsx(CHIP, "inline-flex items-center gap-1.5")}
            onClick={() => {
              props.onNote(before);
              setBefore(null);
            }}
          >
            <Undo2 className="size-3.5" aria-hidden /> Undo
          </button>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-muted">
        <SolIcon className="size-3.5" aria-hidden /> Sol&apos;s drafts, filled in for this customer
      </p>
      <div className="flex flex-wrap gap-1.5">
        {drafts.map((t) => (
          <button
            key={t.id}
            type="button"
            className={CHIP}
            onClick={() =>
              put(
                fillTemplate(t.id, {
                  first: props.first,
                  business: props.business,
                  until: shortDate(new Date(Date.now() + props.validDays * 86_400_000).toISOString()),
                }),
              )
            }
          >
            {t.name}
          </button>
        ))}
      </div>
      {said && (
        <p className="text-[12px] text-warning" role="alert">
          {said}
        </p>
      )}
    </div>
  );
}
