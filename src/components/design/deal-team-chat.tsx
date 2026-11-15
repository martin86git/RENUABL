"use client";

import { TEXT_MAX } from "@/lib/domain/design/contact-reach";
import { TEXTS_COPY } from "@/lib/domain/design/texts";
import { textCustomer } from "@/lib/services/caller";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Bell, Check, MessageSquare, PencilRuler, RotateCcw, SendHorizonal, Users } from "lucide-react";
import {
  ASK_TYPES,
  DEAL_TEAM_POLL_MS,
  askWords,
  CUSTOMER_WRITER,
  SOL_WRITER,
  boxGoesTo,
  briefHref,
  saidWhen,
  typingMention,
  writerName,
  type DealLine,
} from "@/lib/domain/design/deal-team";
import { handleOf, mentionText } from "@/lib/domain/design/mentions";
import { agoWords } from "@/lib/domain/design/deal-feed";
import { DEAL_TEAM_CHANGED, followDealChat, loadDealTeam, markAskDone, sayOnDeal, type DealTeamView } from "@/lib/services/deal-team";
import { openDesigner } from "./design-drawer";
import { SolIcon } from "./sol-icon";

type Person = { email: string; name: string };
const SOL_PERSON: Person = { email: SOL_WRITER, name: "Sol" };
/** How long to look for Sol's answer after he's tagged, and how often. */
const SOL_WAIT_MS = 90_000;
const SOL_LOOK_MS = 3_000;

/**
 * The team chat on a deal (deal-team.ts; 8 Nov 2026, Martin): the business's own people and Sol, never the customer.
 * `pad` is the small version beside a card on Today's deal feed (the latest lines and a box); otherwise the whole
 * conversation, as the deal's Team tab. Sol's requests show what he wants, the customer's words it rests on, one
 * button to act and Mark done.
 */
export function DealTeamChat(props: {
  jobId: string;
  pad?: boolean;
  /** Filling a window (the team chat window): the lines scroll, the box stays at the foot. */
  fill?: boolean;
  initial?: DealLine[];
  onChanged?: () => void;
  /** The pad as a glance (8 Nov 2026, Martin): pressing it or typing in its box opens the larger chat, with what was typed. */
  onOpen?: (typed: string) => void;
  /** Words to start the box with, and the box focused, for the larger chat opened from the pad. */
  startText?: string;
  autoFocus?: boolean;
  /** Lines the pad leaves out because its card already says them (Sol's open request, 10 Nov 2026). */
  hide?: readonly string[];
}) {
  const { jobId, pad, fill } = props;
  const [following, setFollowing] = useState<boolean | null>(null);
  const lastSeen = useRef(-1);
  const end = useRef<HTMLLIElement>(null);
  const [view, setView] = useState<DealTeamView | null>(null);
  const [lines, setLines] = useState<DealLine[]>(props.initial ?? []);
  const [problem, setProblem] = useState<string | null>(null);
  const [waitingOnSol, setWaitingOnSol] = useState<number | null>(null);
  const onChanged = useRef(props.onChanged);
  useEffect(() => {
    onChanged.current = props.onChanged;
  }, [props.onChanged]);

  const load = useCallback(async () => {
    // The whole chat on screen reads it; the pad does not.
    const r = await loadDealTeam(jobId, !pad);
    if (r.ok) {
      setView(r);
      setLines(r.lines);
      setFollowing(r.following);
      setProblem(null);
      // Read here is read everywhere: the team chat window and its count follow.
      if (!pad && r.lines.length !== lastSeen.current) {
        lastSeen.current = r.lines.length;
        window.dispatchEvent(new CustomEvent(DEAL_TEAM_CHANGED, { detail: { jobId } }));
      }
      return r.lines;
    }
    setProblem(r.message);
    return null;
  }, [jobId, pad]);

  // The full chat reads itself and keeps up; the pad reads itself only once it is used (the feed brings its lines).
  useEffect(() => {
    if (pad) return;
    const first = window.setTimeout(() => void load(), 0);
    const t = window.setInterval(() => document.visibilityState === "visible" && void load(), DEAL_TEAM_POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [pad, load]);
  // After @Sol, look for his answer for a while.
  useEffect(() => {
    if (waitingOnSol === null) return;
    const t = window.setInterval(async () => {
      const got = await load();
      const answered = got?.some((l) => l.by === SOL_WRITER && Date.parse(l.at) > waitingOnSol);
      if (answered || Date.now() - waitingOnSol > SOL_WAIT_MS) {
        setWaitingOnSol(null);
        onChanged.current?.();
      }
    }, SOL_LOOK_MS);
    return () => window.clearInterval(t);
  }, [waitingOnSol, load]);

  const changed = () => {
    window.dispatchEvent(new CustomEvent(DEAL_TEAM_CHANGED, { detail: { jobId } }));
    onChanged.current?.();
  };

  // Who the box writes to: the team (the chat), or the customer by text (15 Nov 2026, Martin: "I should also be able
  // to text back… make it jump to Text when the customer's line is latest"). It is Text while their text is the
  // latest line, else the team; a choice made by hand holds until the next line comes (`boxGoesTo`).
  const [chosen, setChosen] = useState<{ to: "team" | "text"; on: string } | null>(null);
  const texting = !pad ? (view?.texting ?? null) : null;
  const to = texting ? boxGoesTo(lines, chosen) : "team";
  const setTo = (next: "team" | "text") => setChosen({ to: next, on: lines.at(-1)?.id ?? "" });
  const byText = to === "text" && texting !== null && !texting.stopped;
  const firstName = writerName(CUSTOMER_WRITER, view?.customer);

  const send = async (text: string): Promise<boolean> => {
    if (byText) {
      const sent = await textCustomer(jobId, text);
      if (!sent.ok) {
        setProblem(sent.message);
        return false;
      }
      setProblem(null);
      await load();
      changed();
      return true;
    }
    const r = await sayOnDeal(jobId, text);
    if (!r.ok) {
      setProblem(r.message);
      return false;
    }
    setProblem(null);
    setLines((all) => [...all, r.line]);
    if (r.solAnswering) setWaitingOnSol(Date.now() - 2_000);
    await load();
    changed();
    return true;
  };

  const settle = async (lineId: string, done: boolean) => {
    const r = await markAskDone(jobId, lineId, done);
    if (!r.ok) setProblem(r.message);
    await load();
    changed();
  };

  // Once it has read the chat itself, the pad still takes the feed's lines when they are newer (written elsewhere since).
  const newest = (l: readonly DealLine[] | undefined) => l?.at(-1)?.at ?? "";
  const current = view && (!pad || newest(lines) >= newest(props.initial)) ? lines : (props.initial ?? lines);
  const shown = pad ? current.filter((l) => !props.hide?.includes(l.id)).slice(-4) : current;
  const people: Person[] = view?.members ?? [];
  useEffect(() => {
    if (fill) end.current?.scrollIntoView({ block: "end" });
  }, [fill, shown.length]);
  const toggleFollow = async () => {
    const next = !following;
    setFollowing(next);
    const r = await followDealChat(jobId, next);
    if (!r.ok) {
      setFollowing(!next);
      setProblem(r.message);
    } else changed();
  };

  return (
    <div className={clsx("flex min-w-0 flex-col", pad ? "gap-2" : "gap-3", fill && "h-full min-h-0")}>
      {!pad && (
        <div className="flex items-start gap-3">
          <p className="flex-1 text-[12.5px] text-muted">
            For your team and Sol only: the customer never sees this. Type @ to bring someone in, or @Sol to ask him.
          </p>
          {following !== null && (
            <button
              type="button"
              aria-pressed={following}
              title={following ? "It shows in your team chat and counts there. Press to stop." : "Show it in your team chat"}
              onClick={() => void toggleFollow()}
              className={clsx(
                "inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium ring-1 transition",
                following ? "bg-primary text-primary-ink ring-primary" : "bg-surface text-ink-2 ring-line hover:text-ink",
              )}
            >
              {following ? <Check className="size-3.5" /> : <Bell className="size-3.5" />}
              {following ? "Following" : "Follow"}
            </button>
          )}
        </div>
      )}
      <ul className={clsx("flex flex-col", pad ? "gap-1.5" : "gap-3", fill && "staff-scroll min-h-0 flex-1 overflow-y-auto pr-1")}>
        {shown.length === 0 && (
          <li className={clsx("text-muted", pad ? "text-[12px]" : "rounded-xl bg-surface-2 px-4 py-6 text-center text-[13.5px]")}>
            {pad ? "Nothing said here yet." : "Nothing said about this deal yet. Leave the team a note, or ask Sol."}
          </li>
        )}
        {pad && props.onOpen && shown.length > 0 && (
          <li className="sr-only">
            <button type="button" onClick={() => props.onOpen?.("")}>
              Open the chat on this deal
            </button>
          </li>
        )}
        {shown.map((l) =>
          l.kind === "ask" && l.ask ? (
            <AskCard key={l.id} line={l} jobId={jobId} pad={pad} onSettle={settle} />
          ) : (
            <Line
              key={l.id}
              line={l}
              pad={pad}
              customer={view?.customer}
              onReply={texting && !texting.stopped && l.by === CUSTOMER_WRITER ? () => setTo("text") : undefined}
            />
          ),
        )}
        {waitingOnSol !== null && (
          <li className="flex items-center gap-1.5 text-[12px] text-muted" role="status">
            <SolIcon className="size-3.5 text-sun-line" /> Sol is answering…
          </li>
        )}
        {fill && <li ref={end} aria-hidden />}
      </ul>
      {problem && (
        <p className="text-[12.5px] text-danger" role="alert">
          {problem}
        </p>
      )}
      {pad && props.onOpen ? (
        <OpenBox onOpen={props.onOpen} />
      ) : (
        <>
          {texting && (
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Who this goes to" className="inline-flex rounded-full bg-surface-2 p-0.5 ring-1 ring-line">
                {(["team", "text"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={to === k}
                    disabled={k === "text" && texting.stopped}
                    onClick={() => setTo(k)}
                    className={clsx(
                      "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors",
                      to === k ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink disabled:text-muted",
                    )}
                  >
                    {k === "team" ? <Users className="size-3.5" aria-hidden /> : <MessageSquare className="size-3.5" aria-hidden />}
                    {k === "team" ? "To the team" : `Text ${firstName}`}
                  </button>
                ))}
              </div>
              <p className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
                {texting.stopped
                  ? TEXTS_COPY.stopped(firstName)
                  : byText
                    ? `Goes to ${firstName} on ${texting.to}${texting.signOff ? ` · ends with ${texting.signOff.replace("\n", " ")}` : ""}`
                    : "Only your team sees this."}
              </p>
              <p className="sr-only" role="status">
                {byText ? `This will be texted to ${firstName}.` : "This goes to your team only."}
              </p>
            </div>
          )}
          <Composer
            pad={pad}
            text={byText ? { who: firstName } : undefined}
            people={people}
            onNeedPeople={() => !view && void load()}
            onSend={send}
            startText={props.startText}
            autoFocus={props.autoFocus}
          />
        </>
      )}
    </div>
  );
}

function Line({ line: l, pad, customer, onReply }: { line: DealLine; pad?: boolean; customer?: string; onReply?: () => void }) {
  const sol = l.by === SOL_WRITER;
  // The customer's own words, come in by text: theirs, in the signal orange with white words (15 Nov 2026, Martin:
  // "make customer texts appear in orange"), filled so no edge can be cut off by the list's scroll.
  const theirs = l.by === CUSTOMER_WRITER;
  // A text one of the team sent the customer: on the right in graphite, as a phone shows the sender's own.
  const sent = l.kind === "text" && !theirs;
  return (
    <li className={clsx("flex min-w-0", sent && "justify-end", pad ? "text-[12.5px] leading-snug" : "text-[13.5px] leading-relaxed")}>
      {/* A bubble is as wide as its words, never the whole chat (15 Nov 2026, Martin). */}
      <div
        className={clsx(
          "w-fit min-w-0 max-w-[85%] rounded-xl",
          pad ? "px-2.5 py-1.5" : "px-3 py-2",
          sol
            ? "bg-sun ring-1 ring-sun-line/25"
            : theirs
              ? "bg-sun-line text-white"
              : sent
                ? "bg-primary text-primary-ink"
                : "bg-surface-2",
        )}
      >
        <p className="flex items-baseline gap-1.5">
          {sol && <SolIcon className="size-3.5 shrink-0 self-center text-sun-ink" />}
          {(theirs || sent) && <MessageSquare className="size-3.5 shrink-0 self-center opacity-70" aria-hidden />}
          <span className={clsx("font-semibold", sol ? "text-sun-ink" : sent ? "text-primary-ink" : theirs ? "text-white" : "text-ink")}>
            {writerName(l.by, customer)}
          </span>
          {l.kind === "note" && <span className="text-[11px] text-sun-ink/80">note</span>}
          {theirs && <span className="text-[11px] text-white/85">customer · by text</span>}
          {sent && <span className="text-[11px] opacity-75">texted {writerName(CUSTOMER_WRITER, customer)}</span>}
          <span className={clsx("ml-auto shrink-0 pl-3 text-[11px]", sent ? "opacity-75" : theirs ? "text-white/85" : "text-muted")}>
            {agoWords(l.at)}
          </span>
        </p>
        <p
          className={clsx(
            "whitespace-pre-wrap break-words",
            sent ? "text-primary-ink" : theirs ? "font-medium text-white" : "text-ink",
            pad && "line-clamp-3",
          )}
        >
          {l.text}
        </p>
        {onReply && !pad && (
          <button
            type="button"
            onClick={onReply}
            className="mt-1 text-[12px] font-medium text-white underline underline-offset-2 hover:no-underline"
          >
            Reply by text
          </button>
        )}
      </div>
    </li>
  );
}

/** One of Sol's requests: what he wants, the customer's words, one button to act, and Mark done. */
function AskCard(props: { line: DealLine; jobId: string; pad?: boolean; onSettle: (id: string, done: boolean) => Promise<void> }) {
  const { line: l, jobId, pad } = props;
  const ask = l.ask!;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // What it rests on is a press away (12 Nov 2026, Martin: "its too much. just ask for whats needed").
  const [showWhy, setShowWhy] = useState(false);
  const type = ASK_TYPES[ask.type];
  const done = ask.done;
  const settle = async (to: boolean) => {
    setBusy(true);
    await props.onSettle(l.id, to);
    setBusy(false);
  };
  return (
    <li
      className={clsx(
        // A border, not a ring: a ring is drawn outside the card and the scrolling list cut it off (14 Nov 2026, Martin).
        "min-w-0 rounded-xl border",
        pad ? "p-2.5 text-[12.5px]" : "p-3.5 text-[13.5px]",
        done ? "border-line bg-surface-2" : "border-sun-line/60 bg-surface",
      )}
    >
      <p className="flex flex-wrap items-center gap-1.5">
        <SolIcon className="size-3.5 text-sun-line" />
        <span className="font-semibold text-ink">Sol needs</span>
        <span className="rounded-full bg-sun px-2 py-0.5 text-[11px] font-medium text-sun-ink">
          {type.label} · {type.forWho}
        </span>
        <span className="ml-auto text-[11px] text-muted">{agoWords(l.at)}</span>
      </p>
      <p className={clsx("mt-1.5 font-medium text-ink", done && "font-normal text-ink-2", pad && !done && "line-clamp-2")}>{askWords(l)}</p>
      {!pad && ask.why.length > 0 && showWhy && (
        <div className="mt-2">
          <ul className="space-y-1.5">
            {ask.why.map((q, i) => (
              <li key={i} className="border-l-2 border-sun-line/60 pl-2.5 text-ink-2">
                &ldquo;{q.text}&rdquo;{" "}
                <span className="text-[12px] text-muted">
                  ({q.where}, {saidWhen(q.at)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {done ? (
          <>
            <span className="inline-flex items-center gap-1 text-[12px] text-positive">
              <Check className="size-3.5" /> Done by {writerName(done.by)}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void settle(false)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-2 hover:text-ink"
            >
              <RotateCcw className="size-3" /> Open again
            </button>
          </>
        ) : (
          <>
            {ask.type === "design" && type.action && (
              <button
                type="button"
                onClick={() => openDesigner(briefHref(jobId, l.id), router)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[12.5px] font-medium text-primary-ink hover:brightness-110"
              >
                <PencilRuler className="size-3.5" /> {pad ? "Open the designer" : type.action}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void settle(true)}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-surface px-3 text-[12.5px] font-medium text-ink ring-1 ring-line hover:ring-ink-2 disabled:text-muted"
            >
              <Check className="size-3.5" /> Mark done
            </button>
          </>
        )}
        {!pad && ask.why.length > 0 && (
          <button
            type="button"
            onClick={() => setShowWhy((w) => !w)}
            aria-expanded={showWhy}
            className="ml-auto text-[12px] font-medium text-ink-2 hover:text-ink"
          >
            {showWhy ? "Hide why" : "Why"}
          </button>
        )}
      </div>
    </li>
  );
}

/** The pad's box when the pad is a glance: a press or the first key opens the deal's chat with it. */
function OpenBox({ onOpen }: { onOpen: (typed: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl bg-surface px-2.5 py-1.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-sun-line">
      <input
        aria-label="Write to the team on this deal"
        placeholder="Note to the team, or @Sol…"
        value=""
        onFocus={() => onOpen("")}
        onChange={(e) => onOpen(e.target.value)}
        className="min-h-[28px] flex-1 bg-transparent py-1 text-[13px] text-ink placeholder:text-muted focus:outline-none"
      />
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted" aria-hidden>
        <SendHorizonal className="size-4" />
      </span>
    </div>
  );
}

/** The box: Enter sends, Shift+Enter a new line; "@" offers the business's people and Sol. */
function Composer(props: {
  pad?: boolean;
  people: Person[];
  onNeedPeople: () => void;
  onSend: (text: string) => Promise<boolean>;
  startText?: string;
  autoFocus?: boolean;
  /** Set while the box texts the customer: no @ offers, and it says who it goes to. */
  text?: { who: string };
}) {
  const [text, setText] = useState(props.startText ?? "");
  const [busy, setBusy] = useState(false);
  const [caret, setCaret] = useState(0);
  const box = useRef<HTMLTextAreaElement>(null);
  const { autoFocus } = props;
  useLayoutEffect(() => {
    if (!autoFocus) return;
    // Focused as it appears, so keys typed straight after opening land in it; the caret after any words carried in.
    const end = box.current?.value.length ?? 0;
    box.current?.focus();
    box.current?.setSelectionRange(end, end);
  }, [autoFocus]);
  const tag = props.text ? null : typingMention(text, caret);
  const offered = tag
    ? [SOL_PERSON, ...props.people]
        .filter((p) => {
          const q = tag.query.toLowerCase();
          return (
            !q || handleOf(p.email).startsWith(q) || p.name.toLowerCase().startsWith(q) || (p.email === SOL_WRITER && "sol".startsWith(q))
          );
        })
        .slice(0, 6)
    : [];
  const pick = (p: Person) => {
    if (!tag) return;
    const put = p.email === SOL_WRITER ? "@Sol " : mentionText(p.email);
    const next = text.slice(0, tag.start) + put + text.slice(caret);
    setText(next);
    const at = tag.start + put.length;
    window.setTimeout(() => {
      box.current?.focus();
      box.current?.setSelectionRange(at, at);
      setCaret(at);
    }, 0);
  };
  const send = async () => {
    const words = text.trim();
    if (!words || busy) return;
    setBusy(true);
    const ok = await props.onSend(words);
    setBusy(false);
    if (ok) setText("");
  };
  return (
    <div className="relative">
      {offered.length > 0 && (
        <ul className="absolute bottom-full left-0 z-20 mb-1 w-56 overflow-hidden rounded-xl bg-surface py-1 shadow-lg ring-1 ring-line">
          {offered.map((p) => (
            <li key={p.email}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-ink hover:bg-surface-2"
              >
                {p.email === SOL_WRITER ? <SolIcon className="size-3.5 text-sun-line" /> : null}
                <span className="font-medium">{p.name}</span>
                {p.email !== SOL_WRITER && <span className="truncate text-[11.5px] text-muted">@{handleOf(p.email)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-1.5 rounded-2xl bg-surface px-2.5 py-1.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-sun-line">
        <textarea
          ref={box}
          rows={1}
          value={text}
          aria-label={props.text ? `A text to ${props.text.who}` : "Write to the team"}
          maxLength={props.text ? TEXT_MAX : undefined}
          placeholder={
            props.text
              ? `Text ${props.text.who}…`
              : props.pad
                ? "Note to the team, or @Sol…"
                : "Write to the team on this deal… (@ to bring someone in)"
          }
          onFocus={props.onNeedPeople}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (offered.length) pick(offered[0]);
              else void send();
            }
          }}
          className={clsx(
            "max-h-32 min-h-[28px] flex-1 resize-none bg-transparent py-1 text-ink placeholder:text-muted focus:outline-none",
            props.pad ? "text-[13px]" : "text-[14px]",
          )}
        />
        <button
          type="button"
          aria-label="Send"
          disabled={busy || !text.trim()}
          onClick={() => void send()}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-ink transition hover:brightness-110 disabled:bg-surface-2 disabled:text-muted"
        >
          <SendHorizonal className="size-4" />
        </button>
      </div>
    </div>
  );
}
