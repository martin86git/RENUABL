"use client";

/**
 * Sol on a deal, as a live terminal (18 Nov 2026, Martin: "I almost missed that Sol was there"; it blended in, read as
 * someone reporting what Sol had done, and took too much room). His sun turns in a ring to show he's there; he puts
 * the next step to you in the first person ("I've drafted an email to Roberto. Want me to send it?"), typed out as he
 * says it, with **Yes / No / Something else**; his draft is already open under it to change; and a violet **Context**
 * line says in one go what lies behind it. Rules in domain/design/sol-on-deal.ts; the deal's card from the deal feed.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { ArrowUp, Handshake, Loader2 } from "lucide-react";
import type { FeedDeal, MoveKind } from "@/lib/domain/design/deal-feed";
import { boxMove } from "@/lib/domain/design/deal-box";
import { callBackAsked } from "@/lib/domain/design/deal-feed";
import { dealContext, solProposes } from "@/lib/domain/design/sol-on-deal";
import { countdownWords } from "@/lib/domain/design/sol-agents";
import { actOnOutbox, editOutbox, putOffOutbox } from "@/lib/services/sol-agents";
import { loadFeedDeal, writeWithSol } from "@/lib/services/deal-feed";
import { dealEmailStatus, emailDeal } from "@/lib/services/crm";
import { markPreparedSent } from "@/lib/services/prepared";
import { sendReply } from "@/lib/services/chat";
import { WRITE_ASK_MAX } from "@/lib/domain/design/deal-write";
import { leadPageFor } from "@/lib/services/hello";
import { askSolInPanel } from "@/lib/services/sol";
import { ContextLine } from "./context-line";
import { DictateButton, withSpoken } from "./dictate";
import { SolMark } from "./sol-icon";
import { CallChooser } from "./call-choice";

const REFRESH_MS = 60_000;
const TYPE_MS = 14;

export function SolOnDealCard(props: {
  jobId: string;
  phone: string | null;
  /** Changes when something happens on the page (a note added, a design saved), so Sol's line is read again. */
  refresh: number;
  /** The deal page acts on a move it has a place for: the chat, the designer, the proposal, the details. */
  onMove: (kind: Exclude<MoveKind, "review" | "call"> | "email") => void;
  /** Starts the note-taker for this deal, for a call made on your own phone. */
  onNotes?: () => void;
}) {
  const [deal, setDeal] = useState<FeedDeal | null>(null);
  const [now, setNow] = useState(() => new Date());

  const read = useCallback(async () => {
    const r = await loadFeedDeal(props.jobId);
    if (r.ok) setDeal(r.deal);
  }, [props.jobId]);

  useEffect(() => {
    let gone = false;
    void loadFeedDeal(props.jobId).then((r) => {
      if (!gone && r.ok) setDeal(r.deal);
    });
    return () => {
      gone = true;
    };
  }, [props.jobId, props.refresh]);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    const again = window.setInterval(() => {
      if (document.visibilityState === "visible") void read();
    }, REFRESH_MS);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(again);
    };
  }, [read]);

  if (!deal) return null;
  // Keyed by what Sol is putting to you (not the clock), so a new proposal starts afresh: typed again, its draft read again.
  const key = `${solProposes(deal, now).yes?.kind ?? "none"}|${deal.sol?.id ?? ""}|${deal.sol?.subject ?? ""}`;
  return <SolTerminal key={key} {...props} deal={deal} now={now} onRead={() => void read()} />;
}

export function SolTerminal(props: {
  jobId: string;
  phone: string | null;
  deal: FeedDeal;
  now: Date;
  onRead: () => void;
  onMove: (kind: Exclude<MoveKind, "review" | "call"> | "email") => void;
  /** Inside a card on Today (18 Nov 2026, Martin: Needs you as Sol's panel too): the card says the context and has the page. */
  inCard?: boolean;
  /** The deal's page: Open deal at the right of Sol's yes and no (19 Nov 2026, Martin: "the open the deal button as the far right option under sols drafted email"). */
  openDeal?: string;
  /** Starts the note-taker for this deal, for a call made on your own phone. */
  onNotes?: () => void;
}) {
  const { deal, now } = props;
  // Who makes the call (19 Nov 2026, Martin: "clicking call michelle back isnt giving me the options of selecting a
  // voice agent"): a voice agent with what the call is about, you, or you with the note-taker.
  const [calling, setCalling] = useState(false);
  const p = solProposes(deal, now);
  const name = deal.customer.split(/\s+/)[0] || "them";
  const sol = deal.sol;
  const [subject, setSubject] = useState(sol?.subject ?? "");
  const [body, setBody] = useState(sol?.body ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [other, setOther] = useState(false);
  const [ask, setAsk] = useState("");
  // What the microphone is hearing, shown in the box as it comes.
  const [heard, setHeard] = useState("");
  const box = useRef<HTMLInputElement>(null);
  const [leftIt, setLeftIt] = useState(false);

  // The customer is waiting on an answer (18 Nov 2026, Martin: "sol should already be proposing the response to Priya,
  // i should be able to approve or provide feedback"): Sol drafts it as the card opens, in their chat when they have a
  // proposal to read it on, else by email; Yes sends it, and the box under it tells him what to change. One draft a
  // message, kept for the tab, so reading the page again spends nothing.
  const waiting =
    !leftIt && (p.yes?.kind === "reply" || p.yes?.kind === "email") ? deal.events.find((e) => e.kind === "message") : undefined;
  const byChat = Boolean(deal.proposal);
  // The draft as an email composer (19 Nov 2026, Martin: "to: cc: and send from: and subject line… assurance of whos on
  // the email, whos sending etc and the ability to add a cc"): who it goes to and from is read once from the server.
  const [mail, setMail] = useState<{ canSend: boolean; replyTo: string; to: string; business: string; from: string[] } | null>(null);
  const [cc, setCc] = useState("");
  const [from, setFrom] = useState("");
  const wantsMail = Boolean(sol || waiting);
  useEffect(() => {
    if (!wantsMail) return;
    let live = true;
    void dealEmailStatus(props.jobId).then((r) => {
      if (live && r.ok) setMail({ canSend: r.canSend, replyTo: r.replyTo, to: r.to, business: r.business, from: r.from });
    });
    return () => {
      live = false;
    };
  }, [wantsMail, props.jobId]);
  // A reply to someone with a proposal goes as an email too when they can be emailed, and is kept in their chat.
  const asEmail = !byChat || Boolean(mail?.to && (mail.canSend || mail.from.length));
  const keepKey = waiting ? `renuabl.design.sol-reply.${props.jobId}.${waiting.at}` : null;
  const [answer, setAnswer] = useState<{ subject: string; body: string } | null>(() => {
    try {
      return keepKey ? (JSON.parse(sessionStorage.getItem(keepKey) ?? "null") as { subject: string; body: string } | null) : null;
    } catch {
      return null;
    }
  });
  const [writing, setWriting] = useState(false);
  const [unwritten, setUnwritten] = useState<string | null>(null);
  const keep = (a: { subject: string; body: string } | null) => {
    setAnswer(a);
    try {
      if (keepKey) {
        if (a) sessionStorage.setItem(keepKey, JSON.stringify(a));
        else sessionStorage.removeItem(keepKey);
      }
    } catch {
      // Private window: kept for this look only.
    }
  };
  const writeAnswer = async (words: string) => {
    setWriting(true);
    setUnwritten(null);
    const r = await writeWithSol(props.jobId, words.slice(0, WRITE_ASK_MAX));
    setWriting(false);
    if (r.ok) keep({ subject: r.subject, body: r.body });
    else setUnwritten(r.message);
  };
  const asked = useRef(false);
  useEffect(() => {
    if (!waiting || answer || asked.current) return;
    asked.current = true;
    void writeAnswer(
      `Answer ${name}'s latest message (${byChat ? "a reply in their proposal's chat" : "by email"}). Answer what they asked from what the record says and what you know about installing solar and batteries: give the usual figures and what they depend on, and say the installer confirms it on site. Only where neither covers it, tell them we'll check and come back to them.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, as the card opens on a message waiting
  }, [waiting?.at]);
  const asking = waiting ? `${name} asked: “${waiting.text.length > 90 ? `${waiting.text.slice(0, 89).trimEnd()}…` : waiting.text}”` : "";
  const sayNow = !waiting
    ? p.say
    : answer
      ? `${asking} I've drafted a reply${byChat ? " for their chat" : " by email"}. Want me to send it?`
      : unwritten && !writing
        ? `${asking} I couldn't write a reply just now (${unwritten.replace(/\.$/, "")}).`
        : `${asking} I'm writing a reply…`;
  const sendAnswer = async () => {
    if (!answer) return;
    setBusy("yes");
    setSaid(null);
    const r = asEmail
      ? await emailDeal(props.jobId, { subject: answer.subject, body: answer.body, toCustomer: true, cc, from })
      : await sendReply(props.jobId, answer.body);
    // The same words in their proposal's chat, with no second email.
    if (r.ok && asEmail && byChat) await sendReply(props.jobId, answer.body, [], true);
    setBusy(null);
    if (!r.ok) return setSaid(r.message);
    keep(null);
    props.onRead();
  };

  const typed = useTyped(leftIt ? "Okay, I'll leave that for now." : sayNow);
  const changed = Boolean(sol) && (subject !== (sol?.subject ?? "") || body !== (sol?.body ?? ""));

  // Words changed in the draft go with whatever is pressed next.
  const run = async (key: string, fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(key);
    setSaid(null);
    if (changed && sol?.id) {
      const saved = await editOutbox(sol.id, { subject, body });
      if (!saved.ok) {
        setBusy(null);
        return setSaid("message" in saved && typeof saved.message === "string" ? saved.message : "It couldn't be saved. Try again.");
      }
    }
    const r = await fn();
    setBusy(null);
    if (!r.ok) return setSaid(r.message ?? "That couldn't be done. Try again.");
    props.onRead();
  };

  const yes = () => {
    if (!p.yes) return;
    if (p.yes.kind === "send") {
      // With a Cc, or from their own Gmail, it goes through the deal's own email, and the draft is marked sent.
      if (sol?.id)
        void run("yes", async () => {
          if (!cc.trim() && !from) return actOnOutbox(sol.id!, "send");
          const r = await emailDeal(props.jobId, { subject, body, toCustomer: true, cc, from });
          if (r.ok) await markPreparedSent(sol.id!);
          return r;
        });
      return;
    }
    if (p.yes.kind === "call") {
      if (props.phone) setCalling(true);
      return;
    }
    if (p.yes.kind !== "review") props.onMove(p.yes.kind);
  };
  const state = sol ? (sol.state ?? (sol.held ? "held" : "counting")) : null;
  const no = () => {
    if (p.draft && sol?.id) return void run("no", () => actOnOutbox(sol.id!, state === "counting" ? "hold" : "skip"));
    setLeftIt(true);
  };
  const tellSol = () => {
    const t = ask.trim();
    if (!t) return;
    // A plain wish for one of the deal's tools opens it here and now (18 Nov 2026, Martin: "lets start the design" sent
    // him to Sol's panel to say it again); anything with more to it goes to Sol.
    const move = boxMove(t, name);
    if (move) {
      setAsk("");
      setHeard("");
      setOther(false);
      return props.onMove(move);
    }
    if (waiting && answer) {
      setAsk("");
      setHeard("");
      return void writeAnswer(
        `Write the reply to ${name} again: ${t}. The last draft began: "${answer.body.replace(/\s+/g, " ").slice(0, 220)}"`,
      );
    }
    askSolInPanel({ text: `On ${deal.customer}'s deal (#${props.jobId}): ${t}`, shown: t });
    setAsk("");
    setHeard("");
    setOther(false);
  };

  const quiet =
    "inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-surface-2 disabled:text-muted";

  const openDealLink = props.openDeal ? (
    <Link
      href={props.openDeal}
      title={`${deal.customer}'s deal`}
      className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-ink ring-1 ring-line transition-colors hover:bg-surface-2"
    >
      Open deal
      <Handshake className="size-4" aria-hidden />
    </Link>
  ) : null;

  // His drafts, as an email composer under his line: who it is from and to, anyone copied in, the subject, the words.
  const fields = (to: string | null, subjectValue: string, onSubject: (v: string) => void) => (
    <ComposeFields
      mail={mail}
      to={to}
      name={name}
      from={from}
      onFrom={setFrom}
      cc={cc}
      onCc={setCc}
      subject={subjectValue}
      onSubject={onSubject}
    />
  );
  const hasDraft = Boolean((!leftIt && p.draft && sol) || (waiting && answer));
  const words = "block w-full resize-y bg-surface px-3 py-2.5 text-[13.5px] leading-relaxed text-ink focus:outline-none";
  const drafts = (
    <>
      {!leftIt && p.draft && sol && (
        <div className="mt-3.5 overflow-hidden rounded-xl bg-canvas ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-x-2 border-b border-line px-3 py-2 text-[12px] text-muted">
            <span>Email to {name}</span>
            {state === "counting" && <span className="text-sun-ink">· goes {countdownWords(sol.firesAt, now)}</span>}
            {state === "held" && <span>· held</span>}
          </div>
          {fields(sol.to ?? null, subject, setSubject)}
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} aria-label="The email" className={words} />
        </div>
      )}

      {waiting && answer && (
        <div className="mt-3.5 overflow-hidden rounded-xl bg-canvas ring-1 ring-line">
          <div className="border-b border-line px-3 py-2 text-[12px] text-muted">
            {!byChat ? `Email to ${name}` : asEmail ? `Email to ${name} · also kept in their proposal's chat` : `Reply in ${name}'s chat`}
            {writing && <span className="text-sun-ink"> · writing it again…</span>}
          </div>
          {asEmail && fields(mail?.to || null, answer.subject, (v) => keep({ ...answer, subject: v }))}
          <textarea
            value={answer.body}
            onChange={(e) => keep({ ...answer, body: e.target.value })}
            rows={7}
            aria-label={`The reply to ${name}`}
            className={words}
          />
        </div>
      )}
    </>
  );

  return (
    <section
      aria-label="Sol"
      className="@container overflow-hidden rounded-2xl bg-surface shadow-[0_14px_36px_-16px_rgba(255,90,31,0.55)] ring-2 ring-sun-line/70"
    >
      {calling && (
        <CallChooser
          jobId={props.jobId}
          phone={props.phone ?? ""}
          name={deal.customer.trim().split(/\s+/)[0] ?? ""}
          reason={callBackAsked(deal)?.about ?? ""}
          onNotes={props.onNotes}
          onClose={() => setCalling(false)}
        />
      )}
      <div className="flex gap-3 p-3.5 sm:gap-3.5 sm:p-4">
        <SolLive />
        {/* Compact on the deal page too (19 Nov 2026, Martin: "sol is taking up too much space. make smarter design. reduce
            text size"): smaller words, and his draft beside his line and buttons wherever the card is wide enough. */}
        <div
          className={clsx(
            "min-w-0 flex-1",
            hasDraft && "@3xl:grid @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] @3xl:items-start @3xl:gap-5",
          )}
        >
          <div>
            <div>
              <p className="min-h-[1.5em] text-[13.5px] font-medium leading-snug text-ink" aria-live="polite">
                {typed.text}
                <span className="sol-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-sun-line" aria-hidden />
              </p>
              {!props.inCard && <ContextLine text={dealContext(deal, now)} className="mt-1.5" />}

              {!leftIt && typed.done && waiting && (answer || unwritten) && (
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {answer && (
                    <button
                      type="button"
                      onClick={() => void sendAnswer()}
                      disabled={busy !== null || writing}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sun-line px-4 text-[13px] font-semibold text-white hover:brightness-105 disabled:bg-surface-2 disabled:text-muted"
                    >
                      {busy === "yes" && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                      Yes, send it
                    </button>
                  )}
                  <button type="button" onClick={() => setLeftIt(true)} disabled={busy !== null} className={quiet}>
                    Not now
                  </button>
                  {p.yes && (
                    <button type="button" onClick={yes} disabled={busy !== null} className={quiet}>
                      {byChat ? "Write it myself" : `Email ${name} myself`}
                    </button>
                  )}
                  {openDealLink}
                </div>
              )}

              {!leftIt && typed.done && !waiting && (
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {p.yes && !(p.yes.kind === "call" && !props.phone) && (
                    <button
                      type="button"
                      onClick={yes}
                      disabled={busy !== null || (p.yes.kind === "send" && !sol?.to)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sun-line px-4 text-[13px] font-semibold text-white hover:brightness-105 disabled:bg-surface-2 disabled:text-muted"
                    >
                      {busy === "yes" && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                      {p.yes.label}
                    </button>
                  )}
                  {p.no && (
                    <button type="button" onClick={no} disabled={busy !== null} className={quiet}>
                      {busy === "no" && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />}
                      {p.no}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOther((o) => !o);
                      box.current?.focus();
                    }}
                    aria-expanded={other}
                    className={clsx(quiet, other && "bg-surface-2")}
                  >
                    Something else
                  </button>
                  {changed && <span className="text-[12px] text-muted">Your changes go with it.</span>}
                  {openDealLink}
                </div>
              )}
              {props.openDeal && (leftIt || !typed.done) && <div className="mt-3.5 flex">{openDealLink}</div>}

              {other && !leftIt && p.draft && sol?.id && (
                <div className="mt-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={busy !== null}
                      className={quiet}
                      onClick={() => void run("hour", () => putOffOutbox(sol.id!, "hour"))}
                    >
                      Send it in an hour
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      className={quiet}
                      onClick={() => void run("tomorrow", () => putOffOutbox(sol.id!, "tomorrow"))}
                    >
                      Tomorrow at 9
                    </button>
                    {changed && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        className={quiet}
                        onClick={() => void run("save", async () => ({ ok: true }))}
                      >
                        Keep my changes
                      </button>
                    )}
                  </div>
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  tellSol();
                }}
                // Squarer, smaller and a little lower, like a terminal prompt (18 Nov 2026, Martin: "more like claude code's").
                className="mt-3.5 flex items-center gap-1 rounded-lg bg-canvas py-0.5 pl-3 pr-0.5 ring-1 ring-line focus-within:ring-sun-line"
              >
                <span className="font-mono text-[12px] text-sun-line" aria-hidden>
                  {">"}
                </span>
                <input
                  ref={box}
                  value={heard ? withSpoken(ask, heard) : ask}
                  onChange={(e) => {
                    setHeard("");
                    setAsk(e.target.value);
                  }}
                  placeholder={
                    waiting && answer
                      ? "Tell Sol what to change in the reply…"
                      : p.yes
                        ? `Or tell Sol what to do for ${name}…`
                        : `Tell Sol what to do for ${name}…`
                  }
                  aria-label={`Tell Sol what to do for ${name}`}
                  className="min-w-0 flex-1 bg-transparent py-1 text-[12.5px] text-ink outline-none placeholder:text-muted"
                />
                <DictateButton
                  label={`Speak to Sol about ${name}`}
                  onHearing={setHeard}
                  onWords={(w) => setAsk((was) => withSpoken(was, w).slice(0, 2000))}
                />
                <button
                  type="submit"
                  disabled={!ask.trim()}
                  aria-label="Send to Sol"
                  className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-white disabled:bg-surface-2 disabled:text-muted"
                >
                  <ArrowUp className="size-3.5" aria-hidden />
                </button>
              </form>
              {said && <p className="mt-2 text-[12.5px] text-warning">{said}</p>}
            </div>
          </div>
          <div className="@3xl:[&>div:first-child]:mt-0">{drafts}</div>
        </div>
      </div>
      {!props.inCard && (deal.stage === "lead" || deal.stage === "designed") && <LeadPage jobId={props.jobId} name={name} />}
    </section>
  );
}

/** Sol's sun with a thin ring turning round it: he's here, and on it. */
export function SolLive() {
  return (
    <span className="relative grid size-11 shrink-0 place-items-center" aria-hidden>
      <svg viewBox="0 0 44 44" className="sol-live-ring absolute inset-0 size-11">
        <circle
          cx="22"
          cy="22"
          r="20.5"
          fill="none"
          stroke="var(--sun-line)"
          strokeOpacity="0.85"
          strokeWidth="1.5"
          strokeDasharray="22 10 4 10"
          strokeLinecap="round"
        />
      </svg>
      <SolMark className="size-8" glow={false} />
    </span>
  );
}

/** Words typed out as Sol says them, as a terminal would (all at once with reduced motion). */
export function useTyped(text: string): { text: string; done: boolean } {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    /* eslint-disable react-hooks/set-state-in-effect -- the words start again when they change */
    if (still) {
      setShown(text.length);
      return;
    }
    setShown(0);
    /* eslint-enable react-hooks/set-state-in-effect */
    // How far along is worked out from the time since it started, and the ticking stops only once the line is whole
    // (18 Nov 2026, Martin: lines stopped part way). It used to count one letter a tick and stop on a timer, so a page
    // whose ticks ran late (busy, or behind another tab) was cut off before the end.
    const started = performance.now();
    const t = window.setInterval(() => {
      const n = Math.min(text.length, Math.floor((performance.now() - started) / TYPE_MS));
      setShown(n);
      if (n >= text.length) window.clearInterval(t);
    }, TYPE_MS);
    return () => window.clearInterval(t);
  }, [text]);
  return { text: text.slice(0, shown), done: shown >= text.length };
}

/**
 * The lead's own page (domain/design/first-contact.ts): their home from above with the design on it, "Is this your
 * home?" and a chat Sol answers. Made on the first press; Copy the link to send it, or Open to see it as they will.
 */
function LeadPage({ jobId, name }: { jobId: string; name: string }) {
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const get = async (): Promise<string | null> => {
    setBusy(true);
    const r = await leadPageFor(jobId);
    setBusy(false);
    if (!r.ok) {
      setSaid(r.message);
      return null;
    }
    return `${window.location.origin}${r.path}`;
  };
  const link = "font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink disabled:text-muted";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line bg-canvas/60 px-4 py-2 text-[12.5px] sm:px-5">
      <span className="text-muted">{name}&apos;s page: their home, the design and a chat with Sol</span>
      <span className="ml-auto flex gap-3">
        <button
          type="button"
          disabled={busy}
          className={link}
          onClick={async () => {
            const url = await get();
            if (!url) return;
            await navigator.clipboard.writeText(url).then(
              () => setSaid("Link copied. Send it to " + name + "."),
              () => setSaid(url),
            );
          }}
        >
          Copy link
        </button>
        <button
          type="button"
          disabled={busy}
          className={link}
          onClick={async () => {
            const tab = window.open("", "_blank");
            const url = await get();
            if (url && tab) tab.location.href = url;
            else tab?.close();
          }}
        >
          Open
        </button>
      </span>
      {said && <p className="w-full break-all text-ink-2">{said}</p>}
    </div>
  );
}

/**
 * The top of an email composer on Sol's draft (19 Nov 2026, Martin): Send from (the business's name through RENUABL's
 * sender, replies to you; or one of your own Gmail addresses), To (the customer's address as kept on the deal, never
 * typed here), Cc and the subject.
 */
function ComposeFields(props: {
  mail: { canSend: boolean; replyTo: string; to: string; business: string; from: string[] } | null;
  to: string | null;
  name: string;
  from: string;
  onFrom: (v: string) => void;
  cc: string;
  onCc: (v: string) => void;
  subject: string;
  onSubject: (v: string) => void;
}) {
  const { mail } = props;
  const row = "flex items-center gap-2 border-b border-line bg-surface px-3 py-1.5 text-[13px]";
  const label = "w-[4.5rem] shrink-0 text-[12px] text-muted";
  const box = "min-w-0 flex-1 bg-transparent py-0.5 text-[13px] text-ink outline-none placeholder:text-muted";
  return (
    <div>
      <label className={row}>
        <span className={label}>Send from</span>
        <select value={props.from} onChange={(e) => props.onFrom(e.target.value)} className={clsx(box, "cursor-pointer")}>
          <option value="">{mail ? `${mail.business} · replies come to ${mail.replyTo}` : "Your business"}</option>
          {(mail?.from ?? []).map((a) => (
            <option key={a} value={a}>
              {a} · your Gmail
            </option>
          ))}
        </select>
        {mail && mail.from.length === 0 && (
          <Link
            href="/design/inbox"
            className="shrink-0 text-[12px] text-muted underline hover:text-ink"
            title="Connect your Gmail to send from your own address"
          >
            Use my address
          </Link>
        )}
      </label>
      <div className={row}>
        <span className={label}>To</span>
        <span className={clsx("min-w-0 flex-1 truncate py-0.5", props.to ? "text-ink" : "text-warning")}>
          {props.to ?? `${props.name} has no email on file`}
        </span>
      </div>
      <label className={row}>
        <span className={label}>Cc</span>
        <input
          value={props.cc}
          onChange={(e) => props.onCc(e.target.value)}
          placeholder="Add an address, or several with commas"
          inputMode="email"
          autoComplete="off"
          className={box}
        />
      </label>
      <label className={row}>
        <span className={label}>Subject</span>
        <input value={props.subject} onChange={(e) => props.onSubject(e.target.value)} className={clsx(box, "font-semibold")} />
      </label>
    </div>
  );
}
