"use client";

import { Loader2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, cn } from "@/components/ui/primitives";
import { CONSENT_KINDS, CONSENT_WORDS, type ConsentKind } from "@/lib/domain/marketing/contacts";
import { importCrm, loadCrmCount } from "@/lib/services/marketing";
import { field } from "./edm-builder";

/**
 * Brings the business's own CRM customers into its marketing contacts: one per email, only blanks filled for anyone
 * already there, and anyone unsubscribed from its group emails stays unsubscribed. Consent is the business's to say;
 * an existing customer relationship usually counts as inferred consent (Spam Act Schedule 2), so that is offered first.
 */
export function CrmImport({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState<{ withEmail: number; unsubscribed: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState<ConsentKind>("inferred");
  const [note, setNote] = useState("Existing customers of the business");
  const [list, setList] = useState("Customers");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    loadCrmCount().then((r) => r.ok && setCount(r));
  }, []);

  async function run() {
    setBusy(true);
    const r = await importCrm({ consent, note, list });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setMsg({ ok: true, text: `Brought in: ${r.added} new, ${r.updated} already here. Nobody was emailed.` });
    setOpen(false);
    onDone();
  }

  return (
    <div className="mt-6 rounded-2xl bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 size-5 text-muted" />
          <div>
            <h2 className="text-[15px] font-semibold">Your customers</h2>
            <p className="text-[13px] text-muted">
              {count === null
                ? "Bring in the customers from your CRM."
                : `${count.withEmail} of your customers have an email${count.unsubscribed ? `, ${count.unsubscribed} of them unsubscribed from your group emails (they stay unsubscribed)` : ""}.`}
            </p>
          </div>
        </div>
        {!open && (
          <Button size="sm" variant="secondary" disabled={!count?.withEmail} onClick={() => setOpen(true)}>
            Bring them in
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {CONSENT_KINDS.map((k) => (
              <label
                key={k}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-3",
                  consent === k ? "border-ink" : "border-line hover:border-ink/40",
                )}
              >
                <input type="radio" name="crm-consent" checked={consent === k} onChange={() => setConsent(k)} className="mt-1" />
                <span>
                  <span className="text-[13px] font-medium">{CONSENT_WORDS[k].label}</span>
                  <span className="block text-[12px] text-muted">{CONSENT_WORDS[k].help}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(consent === "express" || consent === "inferred") && (
              <label className="text-[12px] text-muted">
                How they consented
                <input value={note} onChange={(e) => setNote(e.target.value)} className={cn(field, "mt-1")} />
              </label>
            )}
            <label className="text-[12px] text-muted">
              Add them to a list (optional)
              <input value={list} onChange={(e) => setList(e.target.value)} className={cn(field, "mt-1")} />
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} Bring in {count?.withEmail ?? ""} customers
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {msg && <p className={cn("mt-3 text-[13px]", msg.ok ? "text-positive" : "text-danger")}>{msg.text}</p>}
    </div>
  );
}
