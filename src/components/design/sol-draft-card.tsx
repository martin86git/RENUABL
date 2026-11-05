"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Check, Copy, Mail, Send } from "lucide-react";
import { MAX_BODY, MAX_CC, MAX_SUBJECT } from "@/lib/domain/design/deal-email";
import type { SolDraft } from "@/lib/domain/design/sol";
import { emailDeal } from "@/lib/services/crm";
import { EmailFileChips, EmailFormatBar, listKey, useEmailFiles } from "./email-compose";

/** What the card hands to the deal's Email tab: the draft as it now reads. */
export interface DraftAsEdited {
  jobId: string;
  subject: string;
  body: string;
  cc: string;
}

/**
 * An email Sol wrote on a deal, changed in place before it goes (5 Nov 2026, Martin: as Primero's): the subject, the
 * words with the email tools (lists, symbols, pictures and files), and anyone to copy in. **Send** sends it through the
 * deal's own email, to the customer's address as the server keeps it (never one from here), written on the deal's
 * record like any email from the deal; **Open in the deal's email** hands it to the deal's Email tab instead. Sol never
 * sends it: only this press does.
 */
export function SolDraftCard({ draft, onOpen }: { draft: SolDraft; onOpen: (edited: DraftAsEdited) => void }) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [cc, setCc] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const files = useEmailFiles();
  const send = async () => {
    setSending(true);
    const res = await emailDeal(draft.jobId, { subject, body, cc, toCustomer: true }, files.files);
    setSending(false);
    if (!res.ok) return setNote({ ok: false, text: res.message });
    setSent(true);
    setNote({ ok: true, text: res.message });
  };
  const ready = !sending && !sent && Boolean(draft.to) && Boolean(subject.trim()) && Boolean(body.trim()) && !files.busy && !files.problem;
  const field = "block w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-[var(--primary)]";
  return (
    <div className="rounded-2xl bg-surface p-4 text-sm ring-1 ring-line">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-sun-ink">
        <Mail className="size-3.5" aria-hidden /> {sent ? "Sent from the deal" : "Draft email · not sent"}
      </p>
      <p className="mt-2 text-xs text-muted">
        To {draft.customer}
        {draft.to ? ` <${draft.to}>` : " (no email address yet: add one on the deal first)"}
      </p>
      {sent ? (
        <>
          <p className="mt-2 font-semibold text-ink">{subject}</p>
          <p className="mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap text-ink-2">{body}</p>
        </>
      ) : (
        <div className="mt-2 space-y-2">
          <input
            aria-label="Cc"
            className={clsx(field, "h-9")}
            type="text"
            inputMode="email"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder={`Cc (optional, up to ${MAX_CC}, separated by commas)`}
          />
          <input
            aria-label="Subject"
            className={clsx(field, "h-9 font-semibold")}
            value={subject}
            maxLength={MAX_SUBJECT}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
          />
          <EmailFormatBar area={area} text={body} setText={setBody} files={files} disabled={sending} />
          <textarea
            ref={area}
            aria-label="Email"
            className={clsx(field, "min-h-40 resize-y py-2 leading-relaxed")}
            value={body}
            maxLength={MAX_BODY}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => listKey(e, setBody)}
            onPaste={files.onPaste}
            onDragOver={files.onDragOver}
            onDrop={files.onDrop}
          />
          <EmailFileChips files={files} />
        </div>
      )}
      {note && (
        <p className={clsx("mt-2 text-xs", note.ok ? "text-positive" : "text-danger")} role="status">
          {note.text}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!sent && (
          <button
            type="button"
            onClick={() => void send()}
            disabled={!ready}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-ink disabled:bg-surface-2 disabled:text-muted"
          >
            <Send className="size-3.5" aria-hidden /> {sending ? "Sending…" : "Send"}
          </button>
        )}
        {!sent && (
          <button
            type="button"
            onClick={() => onOpen({ jobId: draft.jobId, subject, body, cc })}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-ink ring-1 ring-line hover:ring-line-strong"
          >
            Open in the deal&apos;s email
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(`${subject}\n\n${body}`).then(() => setCopied(true));
          }}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-ink-2 ring-1 ring-line hover:text-ink"
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
