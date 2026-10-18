"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Mail, PenTool, Send, X } from "lucide-react";
import clsx from "clsx";
import type { Activity, Customer, Job } from "@/lib/domain/design/crm";
import { DEAL_EMAIL_TEMPLATES, MAX_BODY, MAX_SUBJECT, fillTemplate, senderName } from "@/lib/domain/design/deal-email";
import type { SectionLine } from "@/lib/domain/design/deal-sections";
import { dealEmailStatus, emailDeal } from "@/lib/services/crm";
import { PATHS, ui } from "./design-shell";

/**
 * The design tool as a drawer over the deal (Martin: not a new page; back and forth between the design and the deal's
 * notes). It covers the page but for a strip on the left, slides out of sight when folded and back with its tab, and
 * stays as it was while folded: the designer is the real page in a frame, kept loaded once opened. When the design is
 * saved or published the deal is told (`onSaved`) so its system details fill in from it there and then.
 */
export function DesignDrawer(props: { jobId: string; open: boolean; onOpen: () => void; onFold: () => void; onSaved: () => void }) {
  const { jobId, open, onOpen, onFold, onSaved } = props;
  // Loaded the first time it is opened, then kept: folding it never loses the work.
  const [loaded, setLoaded] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const saved = useRef(onSaved);
  useEffect(() => {
    saved.current = onSaved;
  }, [onSaved]);
  useEffect(() => {
    // Opening it is what loads it; from then on it stays.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setLoaded(true);
  }, [open]);
  useEffect(() => {
    const hear = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const news = (e.data as { renuablDesign?: { saved?: boolean; unsaved?: boolean } } | null)?.renuablDesign;
      if (!news) return;
      if (typeof news.unsaved === "boolean") setUnsaved(news.unsaved);
      if (news.saved) {
        setUnsaved(false);
        saved.current();
      }
    };
    window.addEventListener("message", hear);
    return () => window.removeEventListener("message", hear);
  }, []);
  useEffect(() => {
    if (!open) return;
    // The page under it doesn't scroll while the design is out; Escape folds it away.
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => e.key === "Escape" && onFold();
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", key);
    };
  }, [open, onFold]);
  useEffect(() => {
    if (!unsaved) return;
    const stay = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", stay);
    return () => window.removeEventListener("beforeunload", stay);
  }, [unsaved]);

  const src = `${PATHS.designer}?job=${encodeURIComponent(jobId)}&embed=1`;
  if (!loaded) return null;
  return (
    <>
      <div
        className={clsx("fixed inset-0 z-[59] bg-ink/25 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onFold}
        aria-hidden
      />
      <section
        aria-label="Design"
        aria-hidden={!open}
        className={clsx(
          "fixed inset-y-0 left-12 right-0 z-[60] flex flex-col bg-canvas shadow-[-12px_0_40px_rgba(0,0,0,0.18)] transition-transform duration-300 sm:left-16",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* The tab on the drawer's edge: folds it away, and when folded stays at the window's edge to bring it back. */}
        <button
          type="button"
          onClick={open ? onFold : onOpen}
          className={clsx(
            "absolute right-full top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-lg border border-r-0 border-line bg-surface px-1.5 py-3 text-[12px] font-medium text-ink shadow-[-4px_0_12px_rgba(0,0,0,0.08)] hover:bg-surface-2",
          )}
          aria-label={open ? "Fold the design away" : "Bring the design back"}
        >
          <PenTool className="size-4" aria-hidden />
          <span className="[writing-mode:vertical-rl]">{open ? "Back to the deal" : "Design"}</span>
          {unsaved && <span className="size-2 rounded-full bg-sun-line" title="Not saved yet" />}
        </button>
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4">
          <p className="text-sm font-medium text-ink">
            Design {unsaved && <span className="ml-2 text-xs font-normal text-sun-ink">Not saved yet</span>}
          </p>
          <div className="flex items-center gap-1">
            <a href={src.replace("&embed=1", "")} target="_blank" rel="noreferrer" className={clsx(ui.quiet, "h-8 text-xs")}>
              <ExternalLink className="size-3.5" aria-hidden /> Own tab
            </a>
            <button type="button" onClick={onFold} className={clsx(ui.quiet, "h-8 text-xs")} aria-label="Fold the design away">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <iframe src={src} title="Design tool" className="min-h-0 w-full flex-1 border-0" />
      </section>
    </>
  );
}

/**
 * Emailing the customer from their deal: to their address, a ready-written start to change (`DEAL_EMAIL_TEMPLATES`),
 * a subject and the words. Sent in the business's name with replies to the member, and written on the deal's record.
 */
export function DealEmail(props: { job: Job; customer: Customer; business: string; onSent: (a: Activity | null) => void }) {
  const { job, customer, business, onSent } = props;
  const [status, setStatus] = useState<{ canSend: boolean; replyTo: string } | null>(null);
  const [to, setTo] = useState(customer.email);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    void dealEmailStatus(job.id).then((res) => res.ok && setStatus({ canSend: res.canSend, replyTo: res.replyTo }));
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
    const res = await emailDeal(job.id, { to, subject, body });
    setSending(false);
    if (!res.ok) return setNote({ ok: false, text: res.message });
    setNote({ ok: true, text: res.message });
    setSubject("");
    setBody("");
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
      <input
        aria-label="Subject"
        className={clsx(ui.input, "mt-2")}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={MAX_SUBJECT}
        placeholder="Subject"
      />
      <textarea
        aria-label="Email"
        className={clsx(ui.input, "mt-2 min-h-40 py-2 leading-relaxed")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_BODY}
        placeholder={`Write to ${customer.firstName || "the customer"}…`}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className={clsx("text-xs", note ? (note.ok ? "text-positive" : "text-danger") : "text-muted")} role="status">
          {note?.text ?? (status ? `Sent as ${business}. Replies go to ${status.replyTo}.` : "")}
        </p>
        <button
          className={ui.primary}
          onClick={send}
          disabled={sending || !status?.canSend || !to.trim() || !subject.trim() || !body.trim()}
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
    "mt-0.5 block w-[calc(100%+1rem)] -mx-2 rounded-md border bg-transparent px-2 text-sm text-ink outline-none placeholder:text-muted focus:border-forest focus:bg-surface",
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
            className={clsx(box, "min-h-16 py-1.5 leading-relaxed")}
            value={text ?? stored}
            placeholder="--"
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onBlur={done}
          />
        ) : (
          <input
            className={clsx(box, "h-8", field.kind === "money" && "tabular-nums")}
            type={field.kind === "date" ? "date" : "text"}
            inputMode={field.kind === "money" ? "decimal" : undefined}
            value={text ?? (field.kind === "money" && !line.typed ? "" : stored)}
            placeholder={field.kind === "money" ? (line.filled ?? "$") : "--"}
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
          Typed in by hand: use the proposal&apos;s ({line.filled})
        </button>
      )}
    </div>
  );
}
