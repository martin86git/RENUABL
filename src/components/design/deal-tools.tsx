"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Send } from "lucide-react";
import clsx from "clsx";
import type { Activity, Customer, Job } from "@/lib/domain/design/crm";
import { DEAL_EMAIL_TEMPLATES, MAX_BODY, MAX_CC, MAX_SUBJECT, fillTemplate, senderName } from "@/lib/domain/design/deal-email";
import type { SectionLine } from "@/lib/domain/design/deal-sections";
import { dealEmailStatus, emailDeal } from "@/lib/services/crm";
import { ui } from "./design-shell";
import { DRAFT_KEY } from "@/lib/services/sol";
import { EmailFileChips, EmailFormatBar, listKey, useEmailFiles } from "./email-compose";

/**
 * Emailing the customer from their deal: to their address, a ready-written start to change (`DEAL_EMAIL_TEMPLATES`),
 * a subject and the words, with lists, symbols, pictures (inside the email) and files. Sent in the business's name with
 * replies to the member, and written on the deal's record; what went with it is kept in the deal's Attachments.
 */
export function DealEmail(props: { job: Job; customer: Customer; business: string; onSent: (a: Activity | null) => void }) {
  const { job, customer, business, onSent } = props;
  const [status, setStatus] = useState<{ canSend: boolean; replyTo: string } | null>(null);
  const [to, setTo] = useState(customer.email);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const files = useEmailFiles();
  useEffect(() => {
    void dealEmailStatus(job.id).then((res) => res.ok && setStatus({ canSend: res.canSend, replyTo: res.replyTo }));
  }, [job.id]);
  // A draft Sol wrote for this deal ("Open in the deal's email") is put in the box once, to check and send.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      const d = raw ? (JSON.parse(raw) as { jobId?: string; subject?: string; body?: string; cc?: string }) : null;
      if (d?.jobId !== job.id) return;
      sessionStorage.removeItem(DRAFT_KEY);
      queueMicrotask(() => {
        setSubject(String(d.subject ?? "").slice(0, 200));
        setBody(String(d.body ?? "").slice(0, 6000));
        setCc(String(d.cc ?? "").slice(0, 600));
      });
    } catch {
      // Nothing handed over, or storage refused.
    }
  }, [job.id]);

  const use = (id: string) => {
    const t = DEAL_EMAIL_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    if ((subject.trim() || body.trim()) && !window.confirm("Replace what you've written with this template?")) return;
    const ctx = {
      firstName: customer.firstName,
      lastName: customer.lastName,
      address: job.address || customer.address,
      business,
      sender: senderName(status?.replyTo ?? ""),
    };
    setSubject(fillTemplate(t.subject, ctx));
    setBody(fillTemplate(t.body, ctx));
  };
  const send = async () => {
    setSending(true);
    const res = await emailDeal(job.id, { to, cc, subject, body }, files.files);
    setSending(false);
    if (!res.ok) return setNote({ ok: false, text: res.message });
    setNote({ ok: true, text: res.message });
    setSubject("");
    setBody("");
    setCc("");
    files.clear();
    onSent(res.activity);
  };

  return (
    <div className={clsx(ui.card, "p-4")}>
      {status && !status.canSend && (
        <p className="mb-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
          Email isn&apos;t set up on this site yet, so it can&apos;t be sent from here. You can still log an email you sent elsewhere as a
          note.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <label className="flex items-center gap-2 text-xs text-muted">
          To
          <input
            className={clsx(ui.input, "h-9 min-h-9")}
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@example.com"
          />
        </label>
        <select
          aria-label="Use a template"
          className={clsx(ui.input, "h-9 min-h-9 appearance-auto")}
          value=""
          onChange={(e) => use(e.target.value)}
        >
          <option value="">Use a template…</option>
          {DEAL_EMAIL_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-muted">
        Cc
        <input
          className={clsx(ui.input, "h-9 min-h-9")}
          type="text"
          inputMode="email"
          value={cc}
          onChange={(e) => setCc(e.target.value)}
          placeholder={`Optional: up to ${MAX_CC} addresses, separated by commas`}
        />
      </label>
      <input
        aria-label="Subject"
        className={clsx(ui.input, "mt-2")}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={MAX_SUBJECT}
        placeholder="Subject"
      />
      {/* The words with their tools along the box's foot (8 Nov 2026, Martin: under the words, as in Gmail). */}
      <div className="mt-2 rounded-md border border-line bg-surface focus-within:border-forest">
        <textarea
          ref={area}
          aria-label="Email"
          className="block min-h-40 w-full resize-y rounded-t-md bg-transparent px-3 py-2 text-sm leading-relaxed text-ink outline-none placeholder:text-muted"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => listKey(e, setBody)}
          onPaste={files.onPaste}
          onDragOver={files.onDragOver}
          onDrop={files.onDrop}
          maxLength={MAX_BODY}
          placeholder={`Write to ${customer.firstName || "the customer"}…`}
        />
        <EmailFormatBar className="border-t border-line px-1.5 py-1" area={area} text={body} setText={setBody} files={files} />
      </div>
      <EmailFileChips files={files} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className={clsx("text-xs", note ? (note.ok ? "text-positive" : "text-danger") : "text-muted")} role="status">
          {note?.text ?? (status ? `Sent as ${business}. Replies go to ${status.replyTo}.` : "")}
        </p>
        <button
          className={ui.primary}
          onClick={send}
          disabled={sending || !status?.canSend || !to.trim() || !subject.trim() || !body.trim() || files.busy || Boolean(files.problem)}
        >
          <Send className="size-4" aria-hidden /> {sending ? "Sending…" : "Send email"}
        </button>
      </div>
    </div>
  );
}

/** Quick ways to reach the customer, beside their name. */
export function ContactActions({ customer, onEmail }: { customer: Customer; onEmail: () => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {customer.email && (
        <button type="button" onClick={onEmail} className={clsx(ui.quiet, "h-8 text-xs")}>
          <Mail className="size-3.5" aria-hidden /> Email
        </button>
      )}
      {customer.phone && (
        <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className={clsx(ui.quiet, "h-8 text-xs")}>
          Call {customer.phone}
        </a>
      )}
    </div>
  );
}

/**
 * One line of the Installation, Network or Financials tab. A line known elsewhere (the install date, the signed
 * proposal's price) is shown as it is; a field is typed into in place, as its kind asks (words, notes, a date, a choice
 * or dollars), and leaving it saves it. Typed over a figure from the proposal, it is marked so, with the way back.
 */
export function SectionFieldLine({ line, onSave }: { line: SectionLine; onSave: (value: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  const field = line.field;
  if (!field)
    return (
      <div>
        <p className="text-xs text-muted">{line.label}</p>
        <p className={clsx("mt-0.5 text-sm", line.value ? "text-ink" : "text-muted")}>{line.value ?? "--"}</p>
      </div>
    );
  // What the box holds: dollars without their sign, as typed.
  const stored = line.typed ? (line.value ?? "").replace(/[$,]/g, "") : "";
  const done = () => {
    if (text !== null && text.trim() !== stored) onSave(text.trim());
    setText(null);
  };
  const box = clsx(
    "mt-0.5 block w-[calc(100%+1rem)] -mx-2 rounded-md border bg-transparent px-2 text-sm text-ink outline-none focus:border-forest focus:bg-surface",
    line.typed && line.filled ? "border-sun-line" : "border-transparent hover:border-line",
  );
  return (
    <div>
      <label className="block text-xs text-muted">
        {line.label}
        {field.kind === "select" ? (
          <select className={clsx(box, "h-8 appearance-auto")} value={stored} onChange={(e) => onSave(e.target.value)}>
            <option value="">--</option>
            {field.options!.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : field.kind === "long" ? (
          <textarea
            className={clsx(box, "min-h-16 py-1.5 leading-relaxed placeholder:text-muted")}
            value={text ?? stored}
            placeholder="--"
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onBlur={done}
          />
        ) : (
          <input
            className={clsx(
              box,
              "h-8",
              field.kind === "money" && "tabular-nums",
              field.kind === "text" && line.filled ? "placeholder:text-ink" : "placeholder:text-muted",
            )}
            type={field.kind === "date" ? "date" : "text"}
            inputMode={field.kind === "money" ? "decimal" : undefined}
            value={text ?? (field.kind === "money" && !line.typed ? "" : stored)}
            // A value worked out for the deal (the proposal's dollars, the distributor from the address) shows until one is typed.
            placeholder={field.kind === "money" ? (line.filled ?? "$") : (line.filled ?? "--")}
            maxLength={120}
            onChange={(e) => (field.kind === "date" ? onSave(e.target.value) : setText(e.target.value))}
            onBlur={field.kind === "date" ? undefined : done}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setText(null);
            }}
          />
        )}
      </label>
      {line.typed && line.filled && (
        <button className="mt-1 text-[11px] text-sun-ink underline underline-offset-2" onClick={() => onSave("")}>
          {field.key === "distributor"
            ? `Typed in by hand: use the one worked out (${line.filled})`
            : `Typed in by hand: use the proposal's (${line.filled})`}
        </button>
      )}
    </div>
  );
}
