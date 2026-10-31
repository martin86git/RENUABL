"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { BatteryCharging, PlugZap, Sun, X } from "lucide-react";
import { GROUP_EMAIL_MAX, groupRecipients, type CustomerHas } from "@/lib/domain/design/customers";
import { groupEmailStatus, sendGroupEmail, type CustomerLine } from "@/lib/services/crm";
import { ui } from "./design-shell";

/** What someone's jobs put in, as three small marks: lit when they have it. */
export function HasMarks({ has }: { has: CustomerHas }) {
  const mark = (on: boolean, Icon: typeof Sun, label: string) => (
    <span
      title={`${label}: ${on ? "yes" : "no"}`}
      aria-label={`${label}: ${on ? "yes" : "no"}`}
      className={clsx("grid size-6 place-items-center rounded-full", on ? "bg-sun text-sun-line" : "bg-surface-2 text-line")}
    >
      <Icon className="size-3.5" aria-hidden />
    </span>
  );
  return (
    <span className="inline-flex gap-1">
      {mark(has.solar, Sun, "Solar")}
      {mark(has.battery, BatteryCharging, "Battery")}
      {mark(has.ev, PlugZap, "EV charger")}
    </span>
  );
}

/**
 * One email to the people on show (as Primero's group email): those with an address who haven't unsubscribed, up to
 * the limit, each greeted by name with {firstName}, each with their own link to stop group emails. It says who is left
 * out and why before it goes.
 */
export function GroupEmail({ people, onClose }: { people: CustomerLine[]; onClose: () => void }) {
  const [status, setStatus] = useState<{ canSend: boolean; replyTo: string } | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("Hi {firstName},\n\n");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    void groupEmailStatus().then((r) => r.ok && setStatus({ canSend: r.canSend, replyTo: r.replyTo }));
  }, []);
  const r = groupRecipients(people);
  const send = async () => {
    if (!window.confirm(`Send this to ${r.to.length} ${r.to.length === 1 ? "person" : "people"}?`)) return;
    setSending(true);
    const res = await sendGroupEmail({ subject, body, ids: r.to.map((p) => p.id) });
    setSending(false);
    if (!res.ok) return setNote({ ok: false, text: res.message });
    setNote({
      ok: true,
      text: `Sent to ${res.sent}.${res.failed ? ` ${res.failed} couldn't be sent.` : ""} Each is written on their record.`,
    });
  };
  return (
    <section className={clsx(ui.card, "mt-4 p-5")} aria-label="Group email">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-ink">
            Email {r.to.length === 1 ? "1 person" : `${r.to.length} people`}
          </h2>
          <p className="mt-0.5 text-xs text-ink-2">
            Each gets their own copy, greeted by name, with a link to stop group emails. Replies go to {status?.replyTo || "you"}.
            {r.noEmail > 0 && ` ${r.noEmail} without an email address left out.`}
            {r.unsubscribed > 0 && ` ${r.unsubscribed} who asked for no group emails left out.`}
            {r.over > 0 && ` Only the first ${GROUP_EMAIL_MAX}: ${r.over} more left out.`}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-muted hover:bg-canvas hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {status && !status.canSend && (
        <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
          Email isn&apos;t set up on this site yet, so it can&apos;t be sent from here.
        </p>
      )}
      <label className="mt-4 block">
        <span className={ui.label}>Subject</span>
        <input className={clsx(ui.input, "mt-1")} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="mt-3 block">
        <span className={ui.label}>Email</span>
        <textarea
          className={clsx(ui.input, "mt-1 min-h-40 py-2")}
          value={body}
          maxLength={10_000}
          onChange={(e) => setBody(e.target.value)}
        />
        <span className="mt-1 block text-xs text-muted">{"{firstName}"} becomes each person&apos;s first name.</span>
      </label>
      {note && <p className={clsx("mt-3 text-sm", note.ok ? "text-positive" : "text-danger")}>{note.text}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className={ui.primary}
          disabled={sending || !status?.canSend || !r.to.length || !subject.trim() || !body.trim() || note?.ok}
          onClick={() => void send()}
        >
          {sending ? "Sending…" : `Send to ${r.to.length}`}
        </button>
        <button type="button" className={ui.quiet} onClick={onClose}>
          {note?.ok ? "Done" : "Cancel"}
        </button>
      </div>
    </section>
  );
}
