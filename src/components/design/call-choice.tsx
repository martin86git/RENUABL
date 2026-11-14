"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import { CalendarCheck, Headset, MailQuestion, NotebookPen, Phone, PhoneForwarded, Settings, X } from "lucide-react";
import { askAssistantToBook, askAssistantToCall, askByEmailFirst, useCallerInfo } from "@/lib/services/caller";
import { watchAssistantCall } from "@/lib/services/assistant-call";
import { callFromComputer, useComputerCall, useComputerCallsOn } from "@/lib/services/computer-call";
import { CallerAvatar } from "./settings-caller";

const ROW = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface-2";
const SETTINGS = "/design/settings/calls";

/**
 * Who makes the call (12 Nov 2026, Martin: Call anywhere on a deal or Today's feed lets me choose the caller; handing it
 * to the assistant should feel like assigning it to Charlie, his picture and all). The business's phone assistant comes
 * first, by its name and face: handing it the call opens the window that shows the call as it happens
 * (`AssistantCallWindow`). Then you yourself: from this computer (where it is set up, `services/computer-call.ts`), on
 * your own phone, or with the note-taker. While the assistant isn't set up, an admin (who may change settings) is sent
 * to set it up; anyone else is told to ask one.
 *
 * A deal that is sold with no installation day (`toBook`) offers the **admin** assistant above it (13 Nov 2026, Martin:
 * one assistant for sales, one for admin): it rings to book the installation and pencils the day in on the calendar.
 */
export function CallChoices(props: {
  jobId: string;
  phone: string;
  /** The customer's first name. */
  name: string;
  /** Opens the note-taker for this deal; left out where there is none. */
  onNotes?: () => void;
  /** The deal is sold and has no installation day: the admin assistant can ring to book it. */
  toBook?: boolean;
  onClose: () => void;
}) {
  const { caller, admin, callsOn, mayChange, ready } = useCallerInfo();
  const [booking, setBooking] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState<string | null>(null);
  const fromComputer = useComputerCallsOn();
  const onCall = useComputerCall();
  const busy = !!onCall && onCall.phase !== "ended" && onCall.phase !== "failed";
  const dial = props.phone.replace(/s/g, "");
  const who = props.name || "them";
  const canHand = callsOn && Boolean(dial);

  const handOver = async () => {
    setSending(true);
    setFailed(null);
    const res = await askAssistantToCall(props.jobId);
    setSending(false);
    if (!res.ok) return setFailed(res.message);
    watchAssistantCall({ jobId: props.jobId, name: props.name, message: res.message });
    props.onClose();
  };

  // Ask by email first (domain/design/call-consent.ts): the assistant rings once they say yes.
  const askFirst = async () => {
    setAsking(true);
    setFailed(null);
    const res = await askByEmailFirst(props.jobId);
    setAsking(false);
    if (!res.ok) return setFailed(res.message);
    setAsked(res.message);
  };

  const book = async () => {
    setBooking(true);
    setFailed(null);
    const res = await askAssistantToBook(props.jobId);
    setBooking(false);
    if (!res.ok) return setFailed(res.message);
    watchAssistantCall({ jobId: props.jobId, name: props.name, message: res.message, role: "admin" });
    props.onClose();
  };

  return (
    <div>
      {ready && props.toBook && admin.named && (
        <button
          role="menuitem"
          type="button"
          disabled={!canHand || booking}
          onClick={() => void book()}
          className={clsx(
            "group mb-1.5 flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition-colors",
            canHand ? "bg-surface-2 ring-line hover:bg-primary hover:text-white hover:ring-primary" : "ring-line",
          )}
        >
          <CallerAvatar caller={admin} size={44} />
          <span className={clsx("min-w-0 flex-1", !canHand && "text-muted")}>
            <span className="block text-[15px] font-semibold">Have {admin.name} book the install</span>
            <span className={clsx("block text-xs", canHand ? "text-muted group-hover:text-white/70" : "text-muted")}>
              {!callsOn
                ? "Calls aren't switched on for your business yet"
                : !dial
                  ? "There's no mobile on this customer's record"
                  : booking
                    ? "Lining up the call…"
                    : `${admin.name} rings ${who}, offers your free days and pencils one in`}
            </span>
          </span>
          {canHand && <CalendarCheck className="size-4 shrink-0 opacity-60" aria-hidden />}
        </button>
      )}
      {ready && props.toBook && !admin.named && mayChange && (
        <Link role="menuitem" href={`${SETTINGS}?assistant=admin`} onClick={props.onClose} className={ROW}>
          <CalendarCheck className="size-4 text-ink-2" aria-hidden />
          <span>
            Set up your post-sale assistant
            <span className="block text-xs text-muted">It can ring {who} to book the installation for you</span>
          </span>
        </Link>
      )}
      {!ready ? (
        <p className="px-3 py-3 text-xs text-muted">Looking up your phone assistant…</p>
      ) : !caller.named ? (
        mayChange ? (
          <Link role="menuitem" href={SETTINGS} onClick={props.onClose} className={ROW}>
            <Settings className="size-4 text-ink-2" aria-hidden />
            <span>
              Set up your phone assistant
              <span className="block text-xs text-muted">Give it a name, a face and a voice, and it can ring {who} for you</span>
            </span>
          </Link>
        ) : (
          <p className="px-3 py-2 text-xs leading-relaxed text-muted">
            {"Your phone assistant isn't set up yet. An admin can set it up in Settings, then it can ring customers for you."}
          </p>
        )
      ) : (
        <button
          role="menuitem"
          type="button"
          disabled={!canHand || sending}
          onClick={() => void handOver()}
          className={clsx(
            "group flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition-colors",
            canHand ? "bg-surface-2 ring-line hover:bg-primary hover:text-white hover:ring-primary" : "ring-line",
          )}
        >
          <CallerAvatar caller={caller} size={44} />
          <span className={clsx("min-w-0 flex-1", !canHand && "text-muted")}>
            <span className="block text-[15px] font-semibold">Hand it to {caller.name}</span>
            <span className={clsx("block text-xs", canHand ? "text-muted group-hover:text-white/70" : "text-muted")}>
              {!callsOn
                ? "Calls aren't switched on for your business yet"
                : !dial
                  ? "There's no mobile on this customer's record"
                  : sending
                    ? "Lining up the call…"
                    : `${caller.name} rings ${who} and you watch the call here`}
            </span>
          </span>
          {canHand && <PhoneForwarded className="size-4 shrink-0 opacity-60" aria-hidden />}
        </button>
      )}
      {ready && caller.named && canHand && (
        <button
          role="menuitem"
          type="button"
          disabled={asking || Boolean(asked)}
          onClick={() => void askFirst()}
          className={clsx(ROW, "mt-1")}
        >
          <MailQuestion className="size-4 text-ink-2" aria-hidden />
          <span>
            Ask {who} by email first
            <span className="block text-xs text-muted">
              {asked ?? (asking ? "Sending…" : `They choose yes or no; ${caller.name} rings only after a yes`)}
            </span>
          </span>
        </button>
      )}
      {failed && <p className="px-3 pt-1.5 text-xs text-danger">{failed}</p>}

      <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Or call {who} yourself</p>
      {dial && fromComputer && (
        <button
          role="menuitem"
          type="button"
          disabled={busy}
          onClick={() => {
            props.onClose();
            void callFromComputer(props.jobId, props.name);
          }}
          className={clsx(ROW, "disabled:hover:bg-transparent")}
        >
          <Headset className="size-4 text-ink-2" aria-hidden />
          <span className={busy ? "text-muted" : ""}>
            From this computer
            <span className="block text-xs text-muted">
              {busy ? "You're on a call already" : "Through your headset or the computer's microphone"}
            </span>
          </span>
        </button>
      )}
      {dial ? (
        <a role="menuitem" href={`tel:${dial}`} onClick={props.onClose} className={ROW}>
          <Phone className="size-4 text-ink-2" aria-hidden />
          <span>
            On your phone
            <span className="block text-xs tabular-nums text-muted">{props.phone}</span>
          </span>
        </a>
      ) : (
        <p className="px-3 py-2 text-sm text-muted">{"There's no phone number on this customer's record."}</p>
      )}
      {props.onNotes && dial && (
        <button
          role="menuitem"
          type="button"
          onClick={() => {
            props.onClose();
            props.onNotes?.();
          }}
          className={ROW}
        >
          <NotebookPen className="size-4 text-ink-2" aria-hidden />
          <span>
            With the note-taker
            <span className="block text-xs text-muted">Ring on your phone, notes typed up here</span>
          </span>
        </button>
      )}
    </div>
  );
}

/** The same choices in a small window over the page, for a Call button with nowhere to hang a menu (Today's cards). */
export function CallChooser(props: {
  jobId: string;
  phone: string;
  name: string;
  onNotes?: () => void;
  toBook?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [props]);
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/30 p-4" onPointerDown={props.onClose}>
      <div
        role="menu"
        aria-label={`Call ${props.name || "them"}`}
        className="relative w-full max-w-xs rounded-2xl bg-surface p-2 shadow-lift ring-1 ring-line"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close"
          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
        <CallChoices {...props} />
      </div>
    </div>,
    document.body,
  );
}
