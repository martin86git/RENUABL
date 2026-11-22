"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { AudioLines, Plus } from "lucide-react";
import { AGENT_WORDS } from "@/lib/domain/design/agents";
import { useLiveCallsNow } from "@/lib/services/assistant-call";
import { useCallerInfo } from "@/lib/services/caller";
import { openAgents } from "@/lib/services/agents";
import { openCoach } from "@/lib/services/coaching";
import { CallerAvatar } from "./settings-caller";

/**
 * Voice on the phone's foot bar (22 Nov 2026, Martin: "replace the today icon out with voice agent, tapping it opens up a
 * dock to select an agent if you have more than 1"). One voice agent: its chat opens. More than one: a dock rises over
 * the foot bar with each agent (its face, name and job), each opening its chat. None yet: Your agents, to add one. A
 * count on it while calls are under way.
 */
export function PhoneVoiceTab({ onOpen }: { onOpen: () => void }) {
  const { caller, admin, more, mayChange, ready } = useCallerInfo();
  const live = useLiveCallsNow().length;
  const [dock, setDock] = useState(false);
  const agents = [
    ...(caller.named ? [{ key: "sales" as const, who: caller, kind: "sales" as const }] : []),
    ...more.filter((m) => m.named).map((m) => ({ key: m.role, who: m, kind: "sales" as const })),
    ...(admin.named ? [{ key: "admin" as const, who: admin, kind: "admin" as const }] : []),
  ];

  useEffect(() => {
    if (!dock) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setDock(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [dock]);

  const press = () => {
    onOpen();
    if (agents.length === 1) return openCoach(null, agents[0].key);
    if (agents.length === 0) return openAgents();
    setDock(!dock);
  };

  return (
    <>
      <button
        type="button"
        onClick={press}
        aria-expanded={agents.length > 1 ? dock : undefined}
        disabled={!ready}
        className={clsx(
          "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
          dock ? "text-ink" : "text-muted",
        )}
      >
        <span className={clsx("relative flex h-9 w-14 items-center justify-center rounded-full", dock && "bg-sun")}>
          <AudioLines className="size-[22px]" aria-hidden />
          {live > 0 && (
            <span className="absolute -top-0.5 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-sun-line px-1 text-[9px] font-semibold text-white">
              {live}
            </span>
          )}
        </span>
        Voice
      </button>
      {dock && (
        <div className="fixed inset-0 z-[45] lg:hidden" role="dialog" aria-label="Your voice agents">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/30" onClick={() => setDock(false)} />
          <div className="absolute inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] rounded-2xl bg-surface p-2 shadow-[0_-6px_30px_rgba(11,11,12,0.22)] ring-1 ring-line">
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Your voice agents</p>
            <ul>
              {agents.map((a) => (
                <li key={a.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setDock(false);
                      openCoach(null, a.key);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-canvas"
                  >
                    <CallerAvatar caller={a.who} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{a.who.name}</span>
                      <span className="block truncate text-[12px] text-muted">{AGENT_WORDS[a.kind].jobLine}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {mayChange && (
              <button
                type="button"
                onClick={() => {
                  setDock(false);
                  openAgents();
                }}
                className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-line px-2 pb-1 pt-2.5 text-left text-[14px] font-medium text-ink-2 hover:text-ink"
              >
                <span className="grid size-10 place-items-center rounded-full border border-dashed border-muted text-muted">
                  <Plus className="size-4" aria-hidden />
                </span>
                Your agents · add one
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
