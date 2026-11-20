"use client";

import { AGENT_WORDS, type AgentKind } from "@/lib/domain/design/agents";
import { useCallerInfo } from "@/lib/services/caller";
import { openCoach } from "@/lib/services/coaching";
import { AgentsButton } from "./agents-window";
import { RailCalls } from "./rail-calls";
import { CallerAvatar } from "./settings-caller";

const ROUND =
  "relative grid size-10 place-items-center rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-2 ring-transparent transition group-hover:-translate-y-0.5 group-hover:ring-sun-line group-focus-visible:ring-sun-line motion-reduce:transform-none";

const SHELL = "group flex flex-col items-center outline-none";
const titleOf = (name: string, kind: AgentKind) => `${name}: ${AGENT_WORDS[kind].jobLine}`;

/**
 * The business's agents on the bar, their names and jobs on hover (20 Nov 2026: no names under the rounds) (14 Nov 2026, Martin: "because they
 * aren't people, it's not easy to remember what each is for"; was Charlie for sales calls also the one who books
 * installs?). Two voice agents, alike (their own face or sound wave on graphite): **sales calls** and **post sale**
 * (14 Nov 2026, Martin: "tim should be a second voice agent. he would be for post sale. so he should have the same audio
 * icon"). The chief of staff, which only writes to the team, is off the bar: it is reached from the plus (Your agents).
 * Under the sales assistant, a round for each call it has under way. Then the plus, to add one.
 */
export function RailAgents() {
  const { caller, admin, more } = useCallerInfo();

  return (
    <span className="flex w-full flex-col items-center gap-2.5">
      {caller.named && (
        <button type="button" onClick={() => openCoach(null)} title={titleOf(caller.name, "sales")} className={SHELL}>
          <span className={ROUND}>
            <CallerAvatar caller={caller} size={40} />
          </span>
        </button>
      )}
      {/* Each call the sales assistant has under way, as a round of its own under its face. */}
      <RailCalls />
      {/* The sales agents past the first, each opening its own chat. */}
      {more
        .filter((m) => m.named)
        .map((m) => (
          <button key={m.role} type="button" onClick={() => openCoach(null, m.role)} title={titleOf(m.name, "sales")} className={SHELL}>
            <span className={ROUND}>
              <CallerAvatar caller={m} size={40} />
            </span>
          </button>
        ))}
      {admin.named && (
        <button type="button" onClick={() => openCoach(null, "admin")} title={titleOf(admin.name, "admin")} className={SHELL}>
          <span className={ROUND}>
            <CallerAvatar caller={admin} size={40} />
          </span>
        </button>
      )}
      {/* Your agents, and adding one, after a fine rule: it says first whether the new one needs the business's number. */}
      <span className="flex flex-col items-center gap-2.5 [&:not(:has(button))]:hidden">
        <span className="h-px w-6 bg-white/15" aria-hidden />
        <AgentsButton />
      </span>
    </span>
  );
}
