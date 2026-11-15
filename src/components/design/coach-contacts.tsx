"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowUp, MessageSquare, Phone, Search, X } from "lucide-react";
import { TEXT_MAX, TEXT_WORDS, reachContacts, textParts, type ReachContact } from "@/lib/domain/design/contact-reach";
import { STAGE_LABELS, type JobStage } from "@/lib/domain/design/crm";
import { PHONE_FROM, digitsOf, looksLikePhone } from "@/lib/domain/design/find";
import { TEXTS_COPY, signedText, type StrayText, type TextLine } from "@/lib/domain/design/texts";
import { loadDealTexts, loadStrayTexts, textCustomer, useCallerInfo } from "@/lib/services/caller";
import { useCoachCaller } from "@/lib/services/coaching";
import { listCustomers, listJobs, type CustomerLine, type JobLine } from "@/lib/services/crm";
import { CallChoices } from "./call-choice";

const ROUND = "grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-line transition-colors";

/**
 * Reach a contact from the phone assistant's window (13 Nov 2026, Martin: open the assistant, search a customer
 * contact, and call or text them). A search at the top of the window: a name, number, email or address finds the
 * business's contacts (`reachContacts`); each has **Call**, the same choices as Call on a deal (hand it to the
 * assistant, from this computer, on your phone), and **Text**, a short message to the mobile on their record, written
 * on their deal. While it is in use the list takes the chat's place (`onOpen`); the cross or Escape goes back.
 */
export function ContactReach(props: { open: boolean; onOpen: (open: boolean) => void }) {
  const { textsOn } = useCallerInfo();
  const caller = useCoachCaller();
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ customers: CustomerLine[]; jobs: JobLine[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [doing, setDoing] = useState<{ id: string; what: "call" | "text" } | null>(null);
  const [sent, setSent] = useState<{ id: string; message: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const asked = useRef(false);
  const [strays, setStrays] = useState<StrayText[]>([]);

  // Texts from numbers on no customer's record, read each time the contacts open, so none is lost.
  useEffect(() => {
    if (!props.open || !textsOn) return;
    let live = true;
    void loadStrayTexts().then((r) => live && r.ok && setStrays(r.texts));
    return () => {
      live = false;
    };
  }, [props.open, textsOn]);

  useEffect(() => {
    if (!props.open || asked.current) return;
    asked.current = true;
    void Promise.all([listCustomers(), listJobs()]).then(([c, j]) => {
      if (!c.ok || !j.ok) {
        asked.current = false;
        return setFailed(true);
      }
      setFailed(false);
      setData({ customers: c.customers, jobs: j.jobs });
    });
  }, [props.open]);

  const close = () => {
    setQ("");
    setDoing(null);
    setSent(null);
    input.current?.blur();
    props.onOpen(false);
  };

  const typed = q.trim();
  const phone = looksLikePhone(typed);
  const ready = !typed || (phone ? digitsOf(typed).length >= PHONE_FROM : typed.length >= 2);
  const found = data && ready ? reachContacts(data.customers, data.jobs, typed) : [];

  return (
    <>
      <label className="flex items-center gap-2.5 border-b border-line px-4">
        <Search className="size-4 shrink-0 text-muted" aria-hidden />
        <input
          ref={input}
          value={q}
          inputMode={phone ? "tel" : undefined}
          onFocus={() => props.onOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setDoing(null);
            props.onOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Escape" || !props.open) return;
            e.stopPropagation();
            close();
          }}
          placeholder="Search a contact to call or text"
          aria-label="Search a contact by name, number, email or address, to call or text them"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        {props.open && (
          <button
            type="button"
            onClick={close}
            aria-label={`Back to ${caller.name}'s chat`}
            title="Back to the chat"
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </label>

      {props.open && (
        <div className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Contacts found">
          {!typed && strays.length > 0 && (
            <section aria-label={TEXTS_COPY.strays} className="mb-2 rounded-xl bg-surface-2 p-2 ring-1 ring-line">
              <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{TEXTS_COPY.strays}</p>
              <ul className="space-y-1">
                {strays.map((t) => (
                  <li key={t.id} className="rounded-lg bg-surface px-2.5 py-1.5 text-sm text-ink ring-1 ring-line">
                    <span className="flex items-baseline justify-between gap-2 text-xs text-muted">
                      <a href={`tel:${t.from.replace(/\s/g, "")}`} className="font-medium tabular-nums text-ink hover:underline">
                        {t.from}
                      </a>
                      {textWhen(t.at)}
                    </span>
                    <span className="mt-0.5 block whitespace-pre-wrap break-words">{t.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!typed && found.length > 0 && (
            <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Latest contacts</p>
          )}
          {found.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted">
              {failed ? (
                "Your contacts couldn't be read just now. Close this and try again."
              ) : !data ? (
                <span className="animate-pulse">Looking up your contacts…</span>
              ) : !ready ? (
                phone ? (
                  "Keep typing the number: it starts matching from the fourth digit."
                ) : (
                  "Keep typing their name, number, email or address."
                )
              ) : typed ? (
                "No contact matches that."
              ) : (
                "No contact has a phone number yet."
              )}
            </p>
          )}
          <ul className="space-y-1">
            {found.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                assistant={caller.name}
                textsOn={textsOn}
                doing={doing?.id === c.id ? doing.what : null}
                sent={sent?.id === c.id ? sent.message : null}
                onDo={(what) => {
                  setSent(null);
                  setDoing(what ? { id: c.id, what } : null);
                }}
                onSent={(message) => {
                  setDoing(null);
                  setSent({ id: c.id, message });
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** When a text was sent or came in: "Sat 3:15 pm". */
const textWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { weekday: "short", hour: "numeric", minute: "2-digit" }).replace(",", "");

function ContactRow(props: {
  contact: ReachContact;
  assistant: string;
  textsOn: boolean;
  doing: "call" | "text" | null;
  sent: string | null;
  onDo: (what: "call" | "text" | null) => void;
  onSent: (message: string) => void;
}) {
  const c = props.contact;
  const who = c.firstName || "them";
  const dial = c.phone.replace(/\s/g, "");
  const noText = !c.job ? `${who} has no deal to keep a text on` : !c.mobile ? TEXT_WORDS.noMobile : null;
  const line = [c.phone || "No phone number", c.job && `${c.job.title} · ${STAGE_LABELS[c.job.stage as JobStage] ?? c.job.stage}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={clsx("rounded-xl", props.doing ? "bg-surface-2 ring-1 ring-line" : "hover:bg-surface-2")}>
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          {c.job ? (
            <Link
              href={`/design/deals/${encodeURIComponent(c.job.id)}`}
              className="block truncate text-sm font-medium text-ink hover:underline"
            >
              {c.name}
            </Link>
          ) : (
            <Link
              href={`/design/customers/${encodeURIComponent(c.id)}`}
              className="block truncate text-sm font-medium text-ink hover:underline"
            >
              {c.name}
            </Link>
          )}
          <p className="truncate text-xs tabular-nums text-muted">{line}</p>
        </div>
        {!dial ? null : c.job ? (
          <button
            type="button"
            onClick={() => props.onDo(props.doing === "call" ? null : "call")}
            aria-pressed={props.doing === "call"}
            aria-label={`Call ${c.name}`}
            title={`Call ${who}`}
            className={clsx(
              ROUND,
              props.doing === "call" ? "bg-primary text-white ring-primary" : "bg-surface text-ink hover:bg-primary hover:text-white",
            )}
          >
            <Phone className="size-4" aria-hidden />
          </button>
        ) : (
          // No deal to keep a call on: only their own phone can ring them.
          <a
            href={`tel:${dial}`}
            aria-label={`Call ${c.name} on your phone`}
            title={`Call ${who} on your phone`}
            className={clsx(ROUND, "bg-surface text-ink hover:bg-primary hover:text-white")}
          >
            <Phone className="size-4" aria-hidden />
          </a>
        )}
        {dial && (
          <button
            type="button"
            disabled={Boolean(noText)}
            onClick={() => props.onDo(props.doing === "text" ? null : "text")}
            aria-pressed={props.doing === "text"}
            aria-label={`Text ${c.name}`}
            title={noText ?? `Text ${who}`}
            className={clsx(
              ROUND,
              noText
                ? "bg-surface-2 text-muted"
                : props.doing === "text"
                  ? "bg-primary text-white ring-primary"
                  : "bg-surface text-ink hover:bg-primary hover:text-white",
            )}
          >
            <MessageSquare className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {props.sent && <p className="px-3 pb-2 text-xs text-positive">{props.sent}</p>}
      {props.doing === "call" && c.job && (
        <div className="border-t border-line p-2">
          <CallChoices jobId={c.job.id} phone={c.phone} name={c.firstName} onClose={() => props.onDo(null)} />
        </div>
      )}
      {props.doing === "text" && c.job && (
        <TextBox
          jobId={c.job.id}
          who={who}
          phone={c.phone}
          textsOn={props.textsOn}
          onSent={props.onSent}
          onClose={() => props.onDo(null)}
        />
      )}
    </li>
  );
}

/**
 * A text to one contact: the texts with them so far (theirs left, the business's right), the words, the sign-off they
 * go with, how many messages that comes to, and Send. Enter sends; Shift+Enter is a new line. While the box is open it
 * looks for a reply every 15 seconds.
 */
function TextBox(props: {
  jobId: string;
  who: string;
  phone: string;
  textsOn: boolean;
  onSent: (message: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => box.current?.focus(), []);
  const [thread, setThread] = useState<{ lines: TextLine[]; stopped: boolean; signOff: string } | null>(null);
  const end = useRef<HTMLLIElement>(null);
  const { jobId } = props;
  useEffect(() => {
    let live = true;
    const read = () => void loadDealTexts(jobId).then((r) => live && r.ok && setThread(r));
    read();
    const t = window.setInterval(() => !document.hidden && read(), 15_000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, [jobId]);
  const said = thread?.lines.length ?? 0;
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [said]);
  const signOff = thread?.signOff ?? "";
  const stopped = thread?.stopped === true;
  // What goes is the words with the sign-off, so that is what is counted.
  const parts = textParts(text.trim() ? signedText(text, signOff) : "");

  const send = async () => {
    if (!text.trim() || sending || !props.textsOn || stopped) return;
    setSending(true);
    setFailed(null);
    const res = await textCustomer(props.jobId, text);
    setSending(false);
    if (!res.ok) return setFailed(res.message);
    props.onSent(res.message);
  };
  const off = !props.textsOn || stopped;

  return (
    <div className="border-t border-line p-3">
      {!props.textsOn && (
        <p className="mb-2 text-xs text-muted">{`${TEXT_WORDS.off} Until then, text ${props.who} from your own phone.`}</p>
      )}
      {thread && thread.lines.length > 0 && (
        <ol aria-label={`Texts with ${props.who}`} className="mb-2 max-h-48 space-y-1 overflow-y-auto pr-1">
          {thread.lines.map((l, i) => (
            <li
              key={l.id}
              ref={i === thread.lines.length - 1 ? end : undefined}
              className={clsx("flex flex-col", l.direction === "out" ? "items-end" : "items-start")}
            >
              <span
                className={clsx(
                  "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-[13px]",
                  l.direction === "out" ? "bg-primary text-white" : "bg-surface text-ink ring-1 ring-line",
                )}
              >
                {l.text}
              </span>
              <span className="px-1 pt-0.5 text-[10px] text-muted">
                {l.direction === "out" ? "Sent" : props.who} · {textWhen(l.at)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {stopped && <p className="mb-2 text-xs text-danger">{TEXTS_COPY.stopped(props.who)}</p>}
      <div className="flex items-end gap-2">
        <textarea
          ref={box}
          value={text}
          disabled={off}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              props.onClose();
            } else if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={3}
          maxLength={TEXT_MAX}
          placeholder={`Text ${props.who} on ${props.phone}…`}
          aria-label={`Text to ${props.who}`}
          className="min-h-11 flex-1 resize-none rounded-2xl bg-canvas px-3 py-2 text-sm text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-sun-line disabled:text-muted"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!text.trim() || sending || off}
          aria-label={`Send the text to ${props.who}`}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white disabled:bg-line disabled:text-muted"
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </div>
      {failed && <p className="mt-1.5 text-xs text-danger">{failed}</p>}
      {props.textsOn && signOff && (
        <p className="mt-1.5 whitespace-pre-line text-[11px] text-muted" title="Added to the end of every text you send">
          Ends with: {signOff.replace("\n", " ")}
        </p>
      )}
      {props.textsOn && (
        <p className="mt-1.5 text-[11px] tabular-nums text-muted">
          {sending
            ? "Sending…"
            : `${text.trim().length} of ${TEXT_MAX}${parts > 1 ? ` · goes as ${parts} texts` : ""} · ${TEXT_WORDS.replies}`}
        </p>
      )}
    </div>
  );
}
