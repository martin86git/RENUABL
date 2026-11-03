"use client";

import { useEffect, useRef, useState } from "react";
import { dealTag, dealThread } from "@/lib/domain/design/sol-chat-work";
import type { SolTurn } from "@/lib/domain/design/sol";
import { SOL_CHANGED, SOL_TOGGLE, askSol, loadSol } from "@/lib/services/sol";
import { DictateButton, withSpoken } from "./dictate";
import { SolBadge } from "./sol-icon";
import { SolSources } from "./sol-sources";
import { SolChartView, SolDiagramView } from "./sol-visuals";

/** What the empty thread offers to ask, all answered from this deal. */
const STARTERS = [
  "Where is this deal up to, and what's the next step?",
  "What has the customer asked for so far?",
  "Draft a follow-up email for this customer.",
];

/**
 * Sol's thread on one deal (sol-chat-work.ts): the member's questions asked from this deal and his answers, kept
 * together here. Each question carries the deal's tag, so he reads this deal first (its notes, emails, the customer's
 * messages and the design) before answering. It is the member's own conversation with him, the same one as his panel,
 * shown for this deal only.
 */
export function DealSol({ jobId, name }: { jobId: string; name: string }) {
  const [turns, setTurns] = useState<SolTurn[] | null>(null);
  const [text, setText] = useState("");
  const [heard, setHeard] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let gone = false;
    void loadSol().then((r) => !gone && (r.ok ? setTurns(r.state.turns) : setProblem(r.message)));
    const changed = (e: Event) => {
      const state = (e as CustomEvent<{ turns?: SolTurn[] }>).detail;
      if (state?.turns) setTurns(state.turns);
    };
    window.addEventListener(SOL_CHANGED, changed);
    return () => {
      gone = true;
      window.removeEventListener(SOL_CHANGED, changed);
    };
  }, []);

  const thread = turns ? dealThread(turns, jobId) : [];
  // Braces: in newer browsers scrollIntoView returns a promise, which an effect must not return.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [thread.length]);

  const send = async (words: string) => {
    const q = words.trim();
    if (!q || busy) return;
    setBusy(true);
    setProblem("");
    const r = await askSol(`${dealTag({ id: jobId, name })}\n${q}`, []);
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    setText("");
    setTurns(r.state.turns);
    window.dispatchEvent(new CustomEvent(SOL_CHANGED, { detail: r.state }));
  };

  return (
    <section className="flex h-[min(70dvh,40rem)] min-h-[24rem] flex-col rounded-2xl bg-surface ring-1 ring-line">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <SolBadge className="size-5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Sol on this deal</p>
          <p className="truncate text-[11px] text-muted">
            He reads this deal first: its notes, emails, the customer&apos;s messages and the design.
          </p>
        </div>
      </header>
      <div className="staff-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
        {turns === null && !problem && <p className="text-muted">Opening…</p>}
        {turns && thread.length === 0 && (
          <div className="space-y-2">
            <p className="text-ink-2">Ask Sol anything about {name.split(" · ")[0]}&apos;s deal.</p>
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="block w-full rounded-2xl bg-canvas px-3 py-2 text-left text-ink hover:bg-surface-2"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {thread.map((t, i) => (
          <div key={`${t.at}-${i}`} className={t.role === "you" ? "flex justify-end" : "space-y-2"}>
            <p
              className={
                t.role === "you"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-sun-line px-3 py-2 text-white"
                  : "max-w-[90%] whitespace-pre-wrap rounded-2xl bg-canvas px-3 py-2 text-ink [overflow-wrap:anywhere]"
              }
            >
              {t.text}
            </p>
            {t.role === "sol" && (
              <>
                {t.diagrams?.map((d, k) => (
                  <SolDiagramView key={`d${k}`} diagram={d} />
                ))}
                {t.charts?.map((c, k) => (
                  <SolChartView key={`c${k}`} chart={c} />
                ))}
                {t.sources?.length ? <SolSources sources={t.sources} remembered={t.remembered} /> : null}
                {t.drafts?.length ? (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent(SOL_TOGGLE, { detail: true }))}
                    className="text-xs font-medium text-sun-line hover:underline"
                  >
                    The email he wrote is in his panel, to check and send →
                  </button>
                ) : null}
              </>
            )}
          </div>
        ))}
        {busy && <p className="text-xs text-muted">Sol is reading the deal…</p>}
        <div ref={end} />
      </div>
      {problem && <p className="px-4 pb-1 text-xs text-danger">{problem}</p>}
      <form
        className="flex items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <textarea
          value={heard ? withSpoken(text, heard) : text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          rows={1}
          placeholder={`Ask Sol about this deal…`}
          className="max-h-32 min-h-9 flex-1 resize-none rounded-2xl bg-canvas px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-sun-line"
        />
        <DictateButton onWords={(w) => setText((t) => (t ? `${t} ${w}` : w))} onHearing={setHeard} />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="h-9 rounded-full bg-sun-line px-4 text-sm font-semibold text-white disabled:bg-surface-2 disabled:text-muted"
        >
          Ask
        </button>
      </form>
    </section>
  );
}
