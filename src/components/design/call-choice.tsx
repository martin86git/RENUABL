"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, CalendarCheck, Headset, MailQuestion, NotebookPen, Phone, PhoneForwarded, Send, Settings, X } from "lucide-react";
import { askAssistantToBook, askAssistantToCall, askByEmailFirst, loadAskDraft, useCallerInfo } from "@/lib/services/caller";
import { ASK_LIMITS, type AskDraft } from "@/lib/domain/design/call-consent";
import type { CallerKey } from "@/lib/domain/install-call";
import { watchAssistantCall } from "@/lib/services/assistant-call";
import { callFromComputer, useComputerCall, useComputerCallsOn } from "@/lib/services/computer-call";
import { VOICE_STANDING_WORDS } from "@/lib/domain/design/add-ons";
import { useAddOns } from "@/lib/services/addons";
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
  /** What the call is about, to start the note an agent is handed (a call back they asked for, say). */
  reason?: string;
  onClose: () => void;
}) {
  const { caller, admin, more, callsOn, mayChange, ready } = useCallerInfo();
  const [about, setAbout] = useState(props.reason ?? "");
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
  // Why calls are off (add-ons.ts): most often the voice add-on not on the plan yet, or no number of its own.
  const [addOns] = useAddOns();
  const callsOffWords =
    addOns && addOns.voice !== "on" ? VOICE_STANDING_WORDS[addOns.voice] : "Calls aren't switched on for your business yet";

  const handOver = async (agent: CallerKey = "sales") => {
    setSending(true);
    setFailed(null);
    const res = await askAssistantToCall(props.jobId, agent, about);
    setSending(false);
    if (!res.ok) return setFailed(res.message);
    watchAssistantCall({ jobId: props.jobId, name: props.name, message: res.message, role: agent });
    props.onClose();
  };

  // Ask by email first (domain/design/call-consent.ts): the assistant rings once they say yes. Pressing it opens the
  // email as a draft to read and change (20 Nov 2026, Martin: it "just told me an email was sent. i have no
  // visibility"); nothing goes until Send is pressed there.
  const [draft, setDraft] = useState<{ to: string; business: string; fixed: AskDraft } | null>(null);
  const [subject, setSubject] = useState("");
  const [opening, setOpening] = useState("");
  const askFirst = async () => {
    setAsking(true);
    setFailed(null);
    const res = await loadAskDraft(props.jobId);
    setAsking(false);
    if (!res.ok) return setFailed(res.message);
    setSubject(res.draft.subject);
    setOpening(res.draft.opening);
    setDraft({ to: res.to, business: res.business, fixed: res.draft });
  };
  const sendAsk = async () => {
    setAsking(true);
    setFailed(null);
    const res = await askByEmailFirst(props.jobId, { subject, opening });
    setAsking(false);
    if (!res.ok) return setFailed(res.message);
    setDraft(null);
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

  if (draft)
    return (
      <div data-ask-draft className="p-1.5">
        <div className="flex items-center gap-1 pr-8">
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setFailed(null);
            }}
            aria-label="Back to the call choices"
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <p className="min-w-0 truncate text-[15px] font-semibold text-ink">Email to {who}</p>
          <span className="ml-1 shrink-0 whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
            Draft · not sent
          </span>
        </div>
        <dl className="mt-2.5 space-y-1.5 px-1 text-[13px]">
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-muted">To</dt>
            <dd className="min-w-0 break-all text-ink">{draft.to}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-muted">From</dt>
            <dd className="min-w-0 text-ink">
              {draft.business || "Your business"}
              <span className="block text-xs text-muted">Replies come to you</span>
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="w-14 shrink-0 text-muted">
              <label htmlFor="ask-subject">Subject</label>
            </dt>
            <dd className="min-w-0 flex-1">
              <input
                id="ask-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, ASK_LIMITS.subject))}
                className="block w-full rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-ink"
              />
            </dd>
          </div>
        </dl>
        <textarea
          aria-label={`Your words to ${who}`}
          value={opening}
          onChange={(e) => setOpening(e.target.value.slice(0, ASK_LIMITS.opening))}
          rows={6}
          className="mt-2.5 block w-full resize-y rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />
        {/* What always goes, as the customer reads it: who would call, the one link, what a no means. */}
        <div className="mt-2 rounded-lg px-3 py-2.5 text-[13px] leading-relaxed text-ink-2 ring-1 ring-line">
          <p>{draft.fixed.fixed}</p>
          <p className="my-2.5">
            <span className="inline-block rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white">{draft.fixed.button}</span>
          </p>
          <p>{draft.fixed.after}</p>
          <p className="mt-2">{draft.fixed.signOff}</p>
        </div>
        <p className="mt-1.5 px-1 text-xs leading-snug text-muted">
          The lines in the box always go as written, so {who} knows the caller is an AI assistant and how to answer. The button is their own
          private link.
        </p>
        {failed && <p className="px-1 pt-1.5 text-xs text-danger">{failed}</p>}
        <div className="mt-2.5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="h-9 rounded-full px-3.5 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            {"Don't send"}
          </button>
          <button
            type="button"
            disabled={asking}
            onClick={() => void sendAsk()}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-ink"
          >
            <Send className="size-3.5" aria-hidden /> {asking ? "Sending…" : "Send email"}
          </button>
        </div>
      </div>
    );

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
                ? callsOffWords
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
      {/* Why the agent is calling (19 Nov 2026, Martin: "if i select an agent the agent needs a way of knowing why its
          calling"): it goes with the call as the team's note, and is written on the deal. */}
      {ready && caller.named && canHand && (
        <label className="mb-1.5 block px-1">
          <span className="block px-2 pb-1 pr-8 pt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            What the call is about
          </span>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value.slice(0, 300))}
            rows={2}
            placeholder={`Tell your agent why it's ringing ${who}`}
            className="block w-full resize-none rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-snug text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </label>
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
                ? callsOffWords
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
      {/* The business's other sales agents (14 Nov 2026, Martin: more than one): the call can be handed to any of them. */}
      {ready &&
        caller.named &&
        more
          .filter((m) => m.named)
          .map((m) => (
            <button
              key={m.role}
              role="menuitem"
              type="button"
              disabled={!canHand || sending}
              onClick={() => void handOver(m.role)}
              className={clsx(ROW, "mt-1", !canHand && "text-muted")}
            >
              <CallerAvatar caller={m} size={28} />
              <span>
                Hand it to {m.name}
                <span className="block text-xs text-muted">{`${m.name} rings ${who} and you watch the call here`}</span>
              </span>
            </button>
          ))}
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
              {asked ?? (asking ? "Opening the email…" : `Read the email before it goes; ${caller.name} rings only after a yes`)}
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
            <span className="block text-xs text-muted">Ring on your phone; it listens to your side and writes the notes up</span>
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
  reason?: string;
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
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-xs overflow-y-auto rounded-2xl bg-surface p-2 shadow-lift ring-1 ring-line has-[[data-ask-draft]]:max-w-md"
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
