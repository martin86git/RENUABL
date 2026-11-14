"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import { AGENT_WORDS, type AgentKind } from "@/lib/domain/design/agents";
import { COLLEAGUE_ROLE } from "@/lib/domain/design/colleague";
import { useCallerInfo } from "@/lib/services/caller";
import { openCoach } from "@/lib/services/coaching";
import { loadColleague, openColleague, type ColleagueState } from "@/lib/services/colleague";
import { AgentsButton } from "./agents-window";
import { RailCalls } from "./rail-calls";
import { CallerAvatar } from "./settings-caller";

const ROUND =
  "relative grid size-11 place-items-center rounded-full shadow-[0_2px_8px_rgba(20,22,26,0.14)] ring-2 ring-transparent transition group-hover:-translate-y-0.5 group-hover:ring-sun-line group-focus-visible:ring-sun-line motion-reduce:transform-none";

/**
 * An agent on the bar: its round, then its name, nothing more (14 Nov 2026, Martin: the job in small words under each
 * name "doesn't fit well… when users name their agents I'm sure they'll remember their function by the name"). What it
 * does is still said when the pointer rests on it.
 */
function AgentLabel({ name }: { name: string }) {
  return (
    <span className="mt-1 block w-full truncate text-center text-[11px] font-medium leading-tight text-ink-2 transition-colors group-hover:text-ink">
      {name}
    </span>
  );
}

const SHELL = "group flex w-full flex-col items-center outline-none";
const titleOf = (name: string, kind: AgentKind) => `${name}: ${AGENT_WORDS[kind].jobLine}`;

/**
 * The business's agents on the bar, each with its name under it (its job says itself on hover) (14 Nov 2026, Martin: "because they
 * aren't people, it's not easy to remember what each is for"; was Charlie for sales calls also the one who books
 * installs?). The two that ring customers look alike (their own face or sound wave on graphite): **sales calls** and
 * **books installs**. The one that only writes to the team is its own teal with a question bubble: **answers you**.
 * Under the sales assistant, a round for each call it has under way. Then the plus, to add one.
 */
export function RailAgents() {
  const { caller, admin } = useCallerInfo();
  const [colleague, setColleague] = useState<ColleagueState | null>(null);
  useEffect(() => {
    let live = true;
    void loadColleague().then((r) => live && r.ok && setColleague(r));
    return () => {
      live = false;
    };
  }, []);
  const tim = colleague?.ready.on ? colleague.name || COLLEAGUE_ROLE : null;

  return (
    <span className="flex w-full flex-col items-center gap-2.5">
      {caller.named && (
        <button type="button" onClick={() => openCoach(null)} title={titleOf(caller.name, "sales")} className={SHELL}>
          <span className={ROUND}>
            <CallerAvatar caller={caller} size={44} />
          </span>
          <AgentLabel name={caller.name} />
        </button>
      )}
      {/* Each call the sales assistant has under way, as a round of its own under its face. */}
      <RailCalls />
      {admin.named && (
        <Link href="/design/settings/calls?assistant=admin" title={titleOf(admin.name, "admin")} className={SHELL}>
          <span className={ROUND}>
            <CallerAvatar caller={admin} size={44} />
          </span>
          <AgentLabel name={admin.name} />
        </Link>
      )}
      {tim && (
        <button type="button" onClick={openColleague} title={titleOf(tim, "colleague")} className={SHELL}>
          <span className={`${ROUND} bg-colleague text-white`}>
            <MessageCircleQuestion className="size-5" aria-hidden />
          </span>
          <AgentLabel name={colleague?.name || "Chief"} />
        </button>
      )}
      {/* Your agents, and adding one, after a fine rule: it says first whether the new one needs the business's number. */}
      <span className="flex flex-col items-center gap-2.5 [&:not(:has(button))]:hidden">
        <span className="h-px w-7 bg-line" aria-hidden />
        <AgentsButton />
      </span>
    </span>
  );
}
