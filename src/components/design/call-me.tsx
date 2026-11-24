"use client";

import { useEffect, useState } from "react";
import { Bot, Phone, X } from "lucide-react";
import { askForCall, askedCall, callMeNow, cancelCall } from "@/lib/services/proposals";

/**
 * "Call me" on a customer's proposal: the business's AI assistant rings the mobile the business has for them, to go
 * through the proposal and answer their questions. It says plainly that it's an AI assistant, not a person, and when
 * the call will come (outside calling hours, the next morning they're open).
 *
 * A call that is waiting can be changed (19 Nov 2026, Martin: "allow the call request to be cancelled. also upon being
 * clicked on allow it to call now - the customer should know they'll be speaking with an ai assistant"): pressing
 * "We'll call you Friday at 9am." opens who will ring, Call me now and Cancel the call. The page asks the server
 * whether a call is waiting as it opens, so the line is still there after a reload.
 */
export function CallMe({ token, assistant }: { token: string; assistant: string }) {
  const [busy, setBusy] = useState<"ask" | "now" | "cancel" | null>(null);
  /** When the waiting call comes ("Friday at 9am", "now", "soon"), or null with none waiting. */
  const [when, setWhen] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let gone = false;
    void askedCall(token).then((r) => {
      if (!gone && r.ok && r.when) setWhen(r.when);
    });
    return () => {
      gone = true;
    };
  }, [token]);

  async function call() {
    setBusy("ask");
    setError(null);
    setSaid(null);
    const res = await askForCall(token);
    setBusy(null);
    if (!res.ok) return setError(res.message);
    setWhen(res.when);
  }

  async function now() {
    setBusy("now");
    setError(null);
    const res = await callMeNow(token);
    setBusy(null);
    if (!res.ok) return setError(res.message);
    setOpen(false);
    setWhen("now");
  }

  async function cancel() {
    setBusy("cancel");
    setError(null);
    const res = await cancelCall(token);
    setBusy(null);
    if (!res.ok) return setError(res.message);
    setOpen(false);
    setWhen(null);
    setSaid("Your call is cancelled.");
  }

  const ringing = when === "now";
  const line = ringing ? "Calling you now." : when === "soon" ? "We'll call you soon." : `We'll call you ${when}.`;
  const who = `${assistant} is our AI assistant, not a person.`;

  // Floating on the right of the page, always in view (15 Nov 2026, Martin): the button in the business's colour,
  // with what it does beside it, and how it went once pressed. On a phone it is a slim tab tucked against the screen's
  // right edge (24 Nov 2026, Martin: it covered "I'd like to go ahead"), saying only Call me and AI assistant.
  return (
    <div
      className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-end gap-2 sm:right-5 max-sm:[&>*:not(:last-child)]:mr-3"
      aria-live="polite"
    >
      {when && !open && (
        <button
          type="button"
          onClick={() => !ringing && setOpen(true)}
          disabled={ringing}
          title={ringing ? who : "Call me now, or cancel the call"}
          className="max-w-[15rem] rounded-xl border border-line bg-surface px-3 py-2 text-left text-[13px] text-ink shadow-[0_10px_30px_rgba(11,11,12,0.18)] transition enabled:hover:border-line-strong"
        >
          <span className="block">{line}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted">
            <Bot className="size-3.5 shrink-0" aria-hidden />
            {ringing ? `You'll be speaking with ${assistant}, our AI assistant.` : `With ${assistant}, our AI assistant · Change`}
          </span>
        </button>
      )}

      {when && open && (
        <div
          role="dialog"
          aria-label="Your call"
          className="w-[16.5rem] rounded-2xl border border-line bg-surface p-3.5 text-[13px] text-ink shadow-[0_14px_40px_rgba(11,11,12,0.22)]"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{line}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <p className="mt-1.5 flex items-start gap-1.5 leading-snug text-muted">
            <Bot className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {who} It rings the mobile we have for you, goes through your proposal and answers your questions. Our team reads every call.
            </span>
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={now}
              disabled={busy !== null}
              className="flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-[13px] font-semibold text-primary-ink disabled:bg-surface-2 disabled:text-muted"
            >
              <Phone className="size-4" aria-hidden />
              {busy === "now" ? "Ringing…" : `Call me now`}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy !== null}
              className="h-10 rounded-xl border border-line px-3 text-[13px] font-medium text-ink hover:border-line-strong disabled:text-muted"
            >
              {busy === "cancel" ? "Cancelling…" : "Cancel the call"}
            </button>
          </div>
          {error && <p className="mt-2 text-danger">{error}</p>}
        </div>
      )}

      {!when && (said || error) && (
        <p className="max-w-[15rem] rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink shadow-[0_10px_30px_rgba(11,11,12,0.18)]">
          {said}
          {error && <span className="block text-danger">{error}</span>}
        </p>
      )}

      {!when && (
        <button
          type="button"
          onClick={call}
          disabled={busy !== null}
          title={`Questions? ${assistant}, our AI assistant, can call you on the mobile we have for you to go through it.`}
          aria-label={`Call me: ${assistant}, our AI assistant, rings the mobile we have for you`}
          className="flex flex-col items-center gap-1 rounded-2xl bg-primary px-3 py-3 text-primary-ink shadow-[0_12px_32px_rgba(11,11,12,0.28)] transition hover:-translate-y-0.5 disabled:bg-surface-2 disabled:text-muted motion-reduce:transition-none max-sm:gap-0.5 max-sm:rounded-r-none max-sm:rounded-l-xl max-sm:px-1.5 max-sm:py-2 max-sm:shadow-[0_6px_18px_rgba(11,11,12,0.25)] max-sm:hover:translate-y-0"
        >
          <Phone className="size-5 max-sm:size-4" aria-hidden />
          <span className="text-[12px] font-semibold leading-tight max-sm:text-[10.5px]">{busy === "ask" ? "One moment" : "Call me"}</span>
          <span className="max-w-[4.5rem] text-center text-[10.5px] leading-tight opacity-80 max-sm:hidden">
            {assistant}, our AI assistant, answers your questions
          </span>
          <span className="text-[9px] leading-tight opacity-80 sm:hidden">AI assistant</span>
        </button>
      )}
    </div>
  );
}
