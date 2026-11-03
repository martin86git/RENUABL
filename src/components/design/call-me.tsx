"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { askForCall } from "@/lib/services/proposals";

const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-ink disabled:bg-surface-2 disabled:text-muted";

/**
 * "Call me" on a customer's proposal: the business's automated assistant rings the mobile the business has for them,
 * to go through the proposal and answer their questions. It says plainly that it's automated, and when the call will
 * come (outside calling hours, the next morning they're open).
 */
export function CallMe({ token, assistant }: { token: string; assistant: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call() {
    setBusy(true);
    setError(null);
    const res = await askForCall(token);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setDone(res.when === "now" ? "Calling you now." : res.already ? "We'll call you soon." : `We'll call you ${res.when}.`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3" aria-live="polite">
      <p className="min-w-0 flex-1 text-[14px] text-ink">
        {done ?? (
          <>
            Questions? {assistant}, our automated assistant, can call you to go through it.
            <span className="block text-[12.5px] text-muted">On the mobile we have for you. Calls are recorded.</span>
          </>
        )}
        {error && <span className="block text-[13px] text-danger">{error}</span>}
      </p>
      {!done && (
        <button type="button" onClick={call} disabled={busy} className={button}>
          <Phone className="size-4" aria-hidden /> {busy ? "One moment…" : "Call me"}
        </button>
      )}
    </div>
  );
}
