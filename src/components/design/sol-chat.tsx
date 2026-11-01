"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Bell, Copy, FileText, History, Mail, MessageSquarePlus, Plus, X, Pin } from "lucide-react";
import { STAGE_LABELS } from "@/lib/domain/design/crm";
import { matches } from "@/lib/domain/design/find";
import { MORE_DETAIL_ASK, offersMore } from "@/lib/domain/design/sol-charts";
import {
  MAX_FILE_CHARS,
  MAX_FILES,
  MAX_SAID,
  SOL_FILE_TYPES,
  WHEN_LABELS,
  dealMention,
  dueWords,
  typingDeal,
  whenChoices,
  type SolDraft,
  type SolFile,
  type SolReminderAsk,
  type SolState,
  type WhenChoice,
} from "@/lib/domain/design/sol";
import { listJobs, type JobLine } from "@/lib/services/crm";
import {
  DRAFT_KEY,
  SOL_CHANGED,
  askSol,
  clearSolChat,
  forgetPref,
  forgetReminder,
  loadSol,
  remindAt,
  solSeen,
  pinTurn,
  newSolChat,
  resumeSolChat,
} from "@/lib/services/sol";
import { askToStartAfresh, worthKeeping } from "@/lib/domain/design/sol-history";
import { DictateButton, withSpoken } from "./dictate";
import { SolHistory } from "./sol-history";
import { SolMark } from "./sol-icon";
import { SolThinking } from "./sol-thinking";
import { SolChartView, SolDiagramView } from "./sol-visuals";

/** The last message the member chose to carry on from after a while away (sessionStorage). */
const CARRIED_KEY = "renuabl.design.sol-carried";

const STARTERS = [
  "Which deals have sat at Proposal sent the longest?",
  "How are sales going this month?",
  "Write a friendly follow-up email to my newest lead.",
  "Remind me to call the bank at 3pm.",
];

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).replace(",", "");

function base64Of(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });
}

/** The member's conversation with Sol, read once and kept in step with every other place that shows it. */
function useSol() {
  const [state, setState] = useState<SolState | null>(null);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    let live = true;
    void loadSol().then((r) => {
      if (!live) return;
      if (r.ok) setState(r.state);
      else setProblem(r.message);
    });
    const changed = (e: Event) => {
      const next = (e as CustomEvent<SolState>).detail;
      if (next) setState(next);
    };
    window.addEventListener(SOL_CHANGED, changed);
    return () => {
      live = false;
      window.removeEventListener(SOL_CHANGED, changed);
    };
  }, []);
  /** A request that answers with the state: shown here and said to the rail and any other Sol on screen. */
  const run = async (go: Promise<{ ok: true; state: SolState } | { ok: false; message: string }>) => {
    const r = await go;
    if (!r.ok) {
      setProblem(r.message);
      return false;
    }
    setProblem("");
    setState(r.state);
    window.dispatchEvent(new CustomEvent(SOL_CHANGED, { detail: r.state }));
    return true;
  };
  return { state, problem, run };
}

/**
 * Sol's chat (31 Oct 2026, as Primero's Lance): the member's own conversation, on its own page (`/design/sol`, with
 * their reminders and preferences beside it) and in the panel down the right of every page (`side`). The box takes
 * words, dictation, a PDF or a picture (up to three), and "#" to pull in a deal. What he draws (charts, diagrams),
 * the emails he writes (as draft cards to send from the deal) and reminder times show under his answer. Whatever is
 * on screen counts as seen. `question` is one asked from elsewhere (the search's "Ask Sol"), asked here once.
 */
export function SolChat({
  side = false,
  onClose,
  question,
}: {
  side?: boolean;
  onClose?: () => void;
  question?: { id: number; text: string } | null;
}) {
  const router = useRouter();
  const { state, problem, run } = useSol();
  const [text, setText] = useState("");
  const [heard, setHeard] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileProblem, setFileProblem] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  // "#" finds a deal: the business's deals are read the first time, then matched here as each letter goes in.
  const [dealAt, setDealAt] = useState<{ start: number; query: string } | null>(null);
  const [jobs, setJobs] = useState<JobLine[] | null>(null);
  const [hi, setHi] = useState(0);
  const hits =
    dealAt && jobs && dealAt.query.trim().length >= 2
      ? jobs.filter((j) => matches({ words: [j.customerName, j.title, j.address] }, dealAt.query)).slice(0, 6)
      : [];

  const turns = state?.turns ?? [];
  const unread = state?.unread ?? 0;
  // Past conversations, and the question after a while away (sol-history.ts): asked once for the last message there
  // was, until it's answered (kept for the tab).
  const [history, setHistory] = useState(false);
  const [opened] = useState(() => new Date());
  const [carried, setCarried] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : sessionStorage.getItem(CARRIED_KEY);
    } catch {
      return null;
    }
  });
  const lastAt = turns[turns.length - 1]?.at ?? null;
  const carryOn = (at: string) => {
    setCarried(at);
    try {
      sessionStorage.setItem(CARRIED_KEY, at);
    } catch {
      // Storage refused: it is asked again next time the panel opens.
    }
  };
  // On screen, everything is seen; the rail's count follows.
  useEffect(() => {
    if (unread > 0) void run(solSeen());
  }, [unread]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
    const later = requestAnimationFrame(() => end.current?.scrollIntoView({ block: "end" }));
    return () => cancelAnimationFrame(later);
  }, [turns.length, pending]);
  useEffect(() => {
    if (dealAt && jobs === null) void listJobs().then((r) => setJobs(r.ok ? r.jobs : []));
  }, [dealAt, jobs]);

  const addFiles = (list: FileList | null) => {
    setFileProblem("");
    const picked = Array.from(list ?? []).filter((f) => (SOL_FILE_TYPES as readonly string[]).includes(f.type));
    if (list && picked.length < list.length) setFileProblem("Sol reads PDFs and pictures (PNG, JPG, WebP, GIF).");
    const next = [...files, ...picked].slice(0, MAX_FILES);
    if (next.reduce((n, f) => n + f.size, 0) * 1.37 > MAX_FILE_CHARS) setFileProblem("Those are too big together: send one at a time.");
    else setFiles(next);
    if (picker.current) picker.current.value = "";
  };

  const send = async (over?: string) => {
    const said = (over ?? text).trim();
    const sending = over ? [] : files;
    if ((!said && !sending.length) || busy) return;
    let encoded: SolFile[];
    try {
      encoded = await Promise.all(sending.map(async (f) => ({ name: f.name, type: f.type as SolFile["type"], data: await base64Of(f) })));
    } catch {
      setFileProblem("That file couldn't be read: try again.");
      return;
    }
    if (!over) {
      setText("");
      setFiles([]);
      setFileProblem("");
    }
    setDealAt(null);
    setBusy(true);
    setPending(said + (sending.length ? `${said ? "\n" : ""}(Attached: ${sending.map((f) => f.name).join(", ")})` : ""));
    const ok = await run(askSol(said, encoded));
    setPending(null);
    setBusy(false);
    if (ok) void run(solSeen());
    else if (!over) {
      setText(said);
      setFiles(sending);
    }
  };

  // A question from elsewhere is asked once, as soon as the panel is open (`asked` keeps a second render from asking again).
  const asked = useRef<number | null>(null);
  useEffect(() => {
    if (!question || asked.current === question.id) return;
    asked.current = question.id;
    void send(question.text);
  }, [question]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickDeal = (j: JobLine) => {
    if (!dealAt) return;
    const before = text.slice(0, dealAt.start);
    const after = text.slice(dealAt.start + 1 + dealAt.query.length);
    const put = dealMention(`${j.customerName} · ${j.title}`, j.id);
    setText((before + put + after).slice(0, MAX_SAID));
    setDealAt(null);
    requestAnimationFrame(() => {
      const at = before.length + put.length;
      box.current?.focus();
      box.current?.setSelectionRange(at, at);
    });
  };

  const openDraft = (d: SolDraft) => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ jobId: d.jobId, subject: d.subject, body: d.body }));
    } catch {
      // A private window: the deal's email opens empty, and the card can still be copied.
    }
    router.push(`/design/deals/${d.jobId}?tab=email`);
    onClose?.();
  };

  const chat = (
    <section
      className={clsx(
        "flex min-h-0 flex-col bg-surface",
        side ? "h-full" : "h-[calc(100dvh-13rem)] min-h-[28rem] rounded-2xl ring-1 ring-line",
      )}
    >
      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="sol-orb inline-flex size-8 items-center justify-center rounded-full">
            <SolMark className="size-5" glow={false} />
          </span>
          Sol {!side && <span className="font-normal text-muted">· your conversation is yours alone</span>}
        </p>
        <span className="ml-auto" />
        {/* Past conversations (1 Nov 2026, Martin): the clock wound back, on the right. */}
        <button
          type="button"
          onClick={() => setHistory(!history)}
          aria-pressed={history}
          aria-label="Past conversations"
          title="Past conversations"
          className={clsx(
            "inline-flex size-7 items-center justify-center rounded-full transition-colors",
            history ? "bg-ink text-sun-line" : "text-muted hover:bg-canvas hover:text-ink",
          )}
        >
          <History className="size-4" aria-hidden />
        </button>
        {side && (
          <a href="/design/sol" className="text-xs text-muted hover:text-ink">
            Full page
          </a>
        )}
        {turns.length > 0 && (
          <button
            type="button"
            onClick={() =>
              window.confirm("Clear your conversation with Sol? Your reminders and preferences stay.") && void run(clearSolChat())
            }
            className="text-xs text-muted hover:text-ink"
          >
            Clear
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Sol"
            title="Close Sol (Esc)"
            className="inline-flex size-7 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {history && (
        <SolHistory
          current={worthKeeping(turns)}
          busy={busy}
          onBack={() => setHistory(false)}
          onNew={() => void run(newSolChat()).then((ok) => ok && setHistory(false))}
          onResume={(id) => void run(resumeSolChat(id)).then((ok) => ok && setHistory(false))}
          renderTurns={(past) =>
            past.map((t, i) => (
              <div key={`${t.at}-${i}`} className="space-y-2">
                <Bubble you={t.role === "you"} text={t.text} at={t.at} />
                {t.charts?.map((c, k) => (
                  <SolChartView key={k} chart={c} />
                ))}
                {t.diagrams?.map((d, k) => (
                  <SolDiagramView key={k} diagram={d} />
                ))}
              </div>
            ))
          }
        />
      )}
      {/* Pinned messages (1 Nov 2026, Martin: as Primero's): a strip at the top; a press goes to the message, the cross unpins it. */}
      {!history && turns.some((t) => t.pinned) && (
        <div className="max-h-28 shrink-0 overflow-y-auto border-b border-line bg-sun/40 px-5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sun-ink">Pinned</p>
          <ul className="mt-1 space-y-1">
            {turns
              .filter((t) => t.pinned)
              .map((t) => (
                <li key={`pin-${t.role}-${t.at}`} className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => document.getElementById(turnId(t))?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    className="min-w-0 flex-1 truncate text-left text-ink hover:underline"
                  >
                    {t.text || "(a chart or drawing)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void run(pinTurn(t.at, t.role, false))}
                    aria-label="Unpin"
                    className="text-muted hover:text-ink"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
      <div className={clsx("staff-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm", history && "hidden")}>
        {!state && !problem && <SolThinking say="Opening your conversation…" />}
        {state && turns.length === 0 && !pending && (
          <div className="space-y-2 text-ink-2">
            <p>
              I&apos;m Sol. Ask me about your deals, what to say to a customer, or where something is. Type # to bring in a deal. For
              example:
            </p>
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setText(s);
                  box.current?.focus();
                }}
                className="block w-full rounded-2xl bg-canvas px-3 py-2 text-left text-ink hover:bg-surface-2"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={`${t.at}-${i}`} id={turnId(t)} className="group/turn space-y-2">
            <Bubble
              you={t.role === "you"}
              text={t.text}
              at={t.at}
              pinned={t.pinned}
              onPin={() => void run(pinTurn(t.at, t.role, !t.pinned))}
            />
            {t.charts?.map((c, k) => (
              <SolChartView key={k} chart={c} />
            ))}
            {t.diagrams?.map((d, k) => (
              <SolDiagramView key={k} diagram={d} />
            ))}
            {t.drafts?.map((d, k) => (
              <DraftCard key={k} draft={d} onOpen={() => openDraft(d)} />
            ))}
            {t.reminder && (
              <ReminderCard
                ask={t.reminder}
                busy={busy}
                choose={(c) => void run(remindAt(t.reminder!.id, c))}
                other={() => {
                  setText("Remind me ");
                  requestAnimationFrame(() => box.current?.focus());
                }}
              />
            )}
            {t.role === "sol" && i === turns.length - 1 && !pending && offersMore(t.text) && (
              <button
                type="button"
                onClick={() => void send(MORE_DETAIL_ASK)}
                disabled={busy}
                className="rounded-full border border-sun-line/60 px-3 py-1 text-xs font-medium text-sun-ink transition hover:bg-sun disabled:text-muted"
              >
                Yes, more detail
              </button>
            )}
          </div>
        ))}
        {pending !== null && (
          <>
            <Bubble you text={pending} at="" />
            <SolThinking />
          </>
        )}
        {problem && <p className="text-xs text-danger">{problem}</p>}
        <div ref={end} />
      </div>

      {/* Back after a while: carry on, or start a new chat with the one before kept in the past conversations. */}
      {!history && state && pending === null && lastAt && carried !== lastAt && askToStartAfresh(turns, opened) && (
        <div className="mx-3 mb-2 rounded-2xl bg-canvas p-3 text-sm ring-1 ring-line">
          <p className="text-ink">Welcome back. Pick up where you left off, or start a new chat?</p>
          <p className="mt-0.5 text-xs text-muted">This one stays in your past conversations either way.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void run(newSolChat())}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-medium text-primary-ink hover:bg-forest"
            >
              <MessageSquarePlus className="size-3.5" aria-hidden /> Start a new chat
            </button>
            <button
              type="button"
              onClick={() => carryOn(lastAt)}
              className="h-8 rounded-full px-3.5 text-xs font-medium text-ink-2 ring-1 ring-line hover:text-ink"
            >
              Carry on here
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className={clsx("border-t border-line p-3", history && "hidden")}
      >
        {(files.length > 0 || fileProblem) && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
            {files.map((f, i) => (
              <span
                key={i}
                className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full bg-canvas py-1 pl-2.5 pr-1 text-xs text-ink"
              >
                <FileText className="size-3.5 shrink-0 text-sun-line" aria-hidden />
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  aria-label={`Take off ${f.name}`}
                  className="inline-flex size-5 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
            {fileProblem && <span className="text-xs text-danger">{fileProblem}</span>}
          </div>
        )}
        <div className="relative">
          {dealAt && dealAt.query.trim().length >= 2 && (
            <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-2xl bg-surface text-sm text-ink shadow-[0_8px_30px_rgba(20,22,26,0.14)] ring-1 ring-line">
              <p className="border-b border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Deals</p>
              {jobs === null ? (
                <p className="px-3 py-2 text-muted">Searching…</p>
              ) : hits.length === 0 ? (
                <p className="px-3 py-2 text-muted">No deal found for “{dealAt.query.trim()}”.</p>
              ) : (
                hits.map((j, i) => (
                  <button
                    key={j.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickDeal(j)}
                    className={clsx("block w-full px-3 py-2 text-left", i === hi ? "bg-canvas" : "hover:bg-canvas")}
                  >
                    <span className="font-medium">
                      {j.customerName} · {j.title}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {[STAGE_LABELS[j.stage], j.address].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-2xl bg-canvas px-1.5 ring-1 ring-line focus-within:ring-sun-line">
            <input
              ref={picker}
              type="file"
              multiple
              accept={SOL_FILE_TYPES.join(",")}
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => picker.current?.click()}
              disabled={files.length >= MAX_FILES}
              aria-label="Add a PDF or a picture"
              title="Add a PDF (an electricity bill, a datasheet) or a picture"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-surface hover:text-ink disabled:text-muted"
            >
              <Plus className="size-4" aria-hidden />
            </button>
            <DictateButton label="Speak to Sol" onHearing={setHeard} onWords={(w) => setText((t) => withSpoken(t, w).slice(0, MAX_SAID))} />
            <textarea
              ref={box}
              value={heard ? withSpoken(text, heard) : text}
              onChange={(e) => {
                setHeard("");
                setText(e.target.value);
                setDealAt(typingDeal(e.target.value, e.target.selectionStart ?? e.target.value.length));
                setHi(0);
              }}
              onKeyDown={(e) => {
                if (dealAt && hits.length) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setHi((h) => (h + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    pickDeal(hits[hi] ?? hits[0]);
                    return;
                  }
                }
                if (dealAt && e.key === "Escape") {
                  e.stopPropagation();
                  setDealAt(null);
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              maxLength={MAX_SAID}
              placeholder="Message Sol… (# for a deal)"
              aria-label="Message Sol"
              className="min-h-[2.75rem] flex-1 resize-none bg-transparent px-1.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={busy || (!text.trim() && !files.length)}
              aria-label="Send to Sol"
              title="Send to Sol"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sun-line text-white transition hover:brightness-105 disabled:bg-surface-2 disabled:text-muted"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </section>
  );

  if (side) return chat;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      {chat}
      <aside className="space-y-4">
        <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            <Bell className="size-3.5" aria-hidden /> Your reminders
          </p>
          {!state?.reminders.length ? (
            <p className="mt-2 text-sm text-muted">None to come. Ask Sol to remind you of something.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {state.reminders.map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-ink">{r.what}</span>
                    <span className="block text-xs text-muted">{r.dueAt ? dueWords(r.dueAt) : "Waiting for a time"}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void run(forgetReminder(r.id))}
                    aria-label={`Take off: ${r.what}`}
                    className="text-muted hover:text-ink"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Your preferences</p>
          {!state?.prefs.length ? (
            <p className="mt-2 text-sm text-muted">None yet. Tell Sol how to sign off your emails, and he&apos;ll keep it.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {state.prefs.map((p) => (
                <li key={p.id} className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 text-ink">{p.text}</span>
                  <button
                    type="button"
                    onClick={() => void run(forgetPref(p.id))}
                    aria-label={`Take off: ${p.text}`}
                    className="text-muted hover:text-ink"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

const turnId = (t: { role: string; at: string }) => `sol-turn-${t.role}-${t.at.replace(/[^0-9a-z]/gi, "")}`;

/** One message, with Copy and Pin beside it (1 Nov 2026, Martin: as Primero's) once it has been said. */
function Bubble({ you, text, at, pinned, onPin }: { you: boolean; text: string; at: string; pinned?: boolean; onPin?: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <div className={clsx("flex flex-col", you ? "items-end" : "items-start")}>
      <div
        className={clsx(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2",
          you ? "bg-sun-line text-white" : "bg-canvas text-ink",
          pinned && "ring-2 ring-sun-line/50",
        )}
      >
        {text}
        {at && <span className={clsx("mt-1 block text-[10px]", you ? "text-white/70" : "text-muted")}>{when(at)}</span>}
      </div>
      {at && (
        <div
          className={clsx(
            "mt-0.5 flex gap-2 px-1 text-[11px] text-muted transition-opacity",
            pinned ? "opacity-100" : "opacity-0 group-hover/turn:opacity-100 focus-within:opacity-100",
          )}
        >
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(text).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="inline-flex items-center gap-1 hover:text-ink"
          >
            <Copy className="size-3" aria-hidden /> {copied ? "Copied" : "Copy"}
          </button>
          {onPin && (
            <button
              type="button"
              onClick={onPin}
              className={clsx("inline-flex items-center gap-1 hover:text-ink", pinned && "text-sun-ink")}
            >
              <Pin className="size-3" aria-hidden /> {pinned ? "Unpin" : "Pin"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** An email Sol wrote, to check and send from the deal: "Open in the deal's email" hands it to the deal's Email tab. */
function DraftCard({ draft, onOpen }: { draft: SolDraft; onOpen: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl bg-surface p-4 text-sm ring-1 ring-line">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-sun-ink">
        <Mail className="size-3.5" aria-hidden /> Draft email · not sent
      </p>
      <p className="mt-2 font-semibold text-ink">{draft.subject || "(no subject)"}</p>
      <p className="text-xs text-muted">
        To {draft.customer}
        {draft.to ? ` <${draft.to}>` : " (no email address yet)"}
      </p>
      <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-ink-2">{draft.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onOpen} className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-2">
          Open in the deal&apos;s email
        </button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(`${draft.subject}\n\n${draft.body}`).then(() => setCopied(true));
          }}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-ink-2 ring-1 ring-line hover:text-ink"
        >
          <Copy className="size-3.5" aria-hidden /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/** A reminder Sol has taken: until a time is chosen, the times on offer and "Another time"; then when it is due. */
function ReminderCard({
  ask,
  busy,
  choose,
  other,
}: {
  ask: SolReminderAsk;
  busy: boolean;
  choose: (c: WhenChoice) => void;
  other: () => void;
}) {
  return (
    <div className="rounded-2xl bg-sun px-4 py-3 text-xs ring-1 ring-sun-line/30">
      <p className="flex items-center gap-1.5 font-medium text-sun-ink">
        <Bell className="size-3.5" aria-hidden /> {ask.what}
      </p>
      {ask.dueAt ? (
        <p className="mt-1 text-ink-2">I&apos;ll remind you {dueWords(ask.dueAt)}.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {whenChoices().map((c) => (
            <button
              key={c}
              type="button"
              disabled={busy}
              onClick={() => choose(c)}
              className="rounded-full bg-surface px-3 py-1 font-medium text-ink ring-1 ring-line hover:ring-sun-line disabled:text-muted"
            >
              {WHEN_LABELS[c]}
            </button>
          ))}
          <button type="button" onClick={other} className="rounded-full px-3 py-1 text-ink-2 hover:text-ink">
            Another time
          </button>
        </div>
      )}
    </div>
  );
}
