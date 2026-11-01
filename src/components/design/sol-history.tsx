"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, MessageSquarePlus, Trash2 } from "lucide-react";
import type { SolTurn } from "@/lib/domain/design/sol";
import { pastGroup, pastWhen, type SolPast, type SolPastLine } from "@/lib/domain/design/sol-history";
import { forgetSolChat, listSolPast, openSolPast } from "@/lib/services/sol";
import { SolThinking } from "./sol-thinking";

/**
 * Sol's past conversations (1 Nov 2026, Martin: the clock-wind-back in the chat's corner). In place of the
 * conversation: Start a new chat, then the past ones grouped by day, newest first, each by its first question. Opening
 * one shows it as it was (`renderTurns`, the chat's own way of drawing messages) with Continue this conversation;
 * the bin forgets it.
 */
export function SolHistory(props: {
  /** Whether the current conversation has anything in it worth filing away. */
  current: boolean;
  onNew: () => void;
  onResume: (id: string) => void;
  onBack: () => void;
  renderTurns: (turns: SolTurn[]) => React.ReactNode;
  busy: boolean;
}) {
  const [list, setList] = useState<SolPastLine[] | null>(null);
  const [open, setOpen] = useState<SolPast | null>(null);
  const [problem, setProblem] = useState("");
  const [now] = useState(() => new Date());
  useEffect(() => {
    let live = true;
    void listSolPast().then((r) => {
      if (!live) return;
      if (r.ok) setList(r.past);
      else setProblem(r.message);
    });
    return () => {
      live = false;
    };
  }, []);

  if (open)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-5 py-2.5">
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label="Back to past conversations"
            className="inline-flex size-7 items-center justify-center rounded-full text-ink-2 hover:bg-canvas hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{open.title}</p>
          <span className="shrink-0 text-xs text-muted">{pastWhen(open.endedAt, now)}</span>
        </div>
        <div className="staff-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">{props.renderTurns(open.turns)}</div>
        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={() => props.onResume(open.id)}
            disabled={props.busy}
            className="w-full rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
          >
            Continue this conversation
          </button>
          {props.current && <p className="mt-1.5 text-center text-xs text-muted">Your current chat is kept here in its place.</p>}
        </div>
      </div>
    );

  const groups: { label: string; rows: SolPastLine[] }[] = [];
  for (const p of list ?? []) {
    const label = pastGroup(p.endedAt, now);
    const g = groups.find((x) => x.label === label);
    if (g) g.rows.push(p);
    else groups.push({ label, rows: [p] });
  }
  return (
    <div className="staff-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={props.onBack}
          aria-label="Back to the conversation"
          className="inline-flex size-7 items-center justify-center rounded-full text-ink-2 hover:bg-canvas hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Past conversations</p>
      </div>
      <button
        type="button"
        onClick={props.onNew}
        disabled={props.busy || !props.current}
        className="mt-3 flex w-full items-center gap-2.5 rounded-2xl bg-canvas px-3 py-2.5 text-left font-medium text-ink hover:bg-surface-2 disabled:text-muted"
      >
        <MessageSquarePlus className="size-4 text-sun-line" aria-hidden /> Start a new chat
      </button>
      {!list && !problem && <SolThinking say="Finding your past conversations…" />}
      {problem && <p className="mt-3 text-xs text-danger">{problem}</p>}
      {list && list.length === 0 && (
        <p className="mt-4 text-ink-2">
          No past conversations yet. When you start a new chat, the one before it is kept here, to read or pick up again.
        </p>
      )}
      {groups.map((g) => (
        <div key={g.label} className="mt-4">
          <p className="px-1 text-[11px] font-medium text-muted">{g.label}</p>
          <ul className="mt-1">
            {g.rows.map((p) => (
              <li key={p.id} className="group/past flex items-center gap-1 rounded-xl hover:bg-canvas">
                <button
                  type="button"
                  onClick={() => void openSolPast(p.id).then((r) => (r.ok ? setOpen(r.past) : setProblem(r.message)))}
                  className="min-w-0 flex-1 px-2 py-2 text-left"
                >
                  <span className="block truncate text-ink">{p.title}</span>
                  <span className="block text-xs text-muted">
                    {pastWhen(p.endedAt, now)} · {p.count} {p.count === 1 ? "message" : "messages"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.confirm("Forget this conversation? It can't be brought back.") &&
                    void forgetSolChat(p.id).then((r) => r.ok && setList(r.past))
                  }
                  aria-label={`Forget "${p.title}"`}
                  title="Forget it"
                  className="mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted opacity-0 transition hover:bg-surface hover:text-ink focus:opacity-100 group-hover/past:opacity-100"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
