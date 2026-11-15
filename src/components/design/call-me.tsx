"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { askForCall } from "@/lib/services/proposals";

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

  // Floating on the right of the page, always in view (15 Nov 2026, Martin): the button in the business's colour,
  // with what it does beside it, and how it went once pressed.
  return (
    <div className="fixed right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col items-end gap-2 sm:right-5" aria-live="polite">
      {(done || error) && (
        <p className="max-w-[15rem] rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink shadow-[0_10px_30px_rgba(11,11,12,0.18)]">
          {done}
          {error && <span className="block text-danger">{error}</span>}
        </p>
      )}
      {!done && (
        <button
          type="button"
          onClick={call}
          disabled={busy}
          title={`Questions? ${assistant}, our automated assistant, can call you on the mobile we have for you to go through it.`}
          aria-label={`Call me: ${assistant}, our automated assistant, rings the mobile we have for you`}
          className="flex flex-col items-center gap-1 rounded-2xl bg-primary px-3 py-3 text-primary-ink shadow-[0_12px_32px_rgba(11,11,12,0.28)] transition hover:-translate-y-0.5 disabled:bg-surface-2 disabled:text-muted motion-reduce:transition-none"
        >
          <Phone className="size-5" aria-hidden />
          <span className="text-[12px] font-semibold leading-tight">{busy ? "One moment" : "Call me"}</span>
          <span className="max-w-[4.5rem] text-center text-[10.5px] leading-tight opacity-80">{assistant} answers your questions</span>
        </button>
      )}
    </div>
  );
}
