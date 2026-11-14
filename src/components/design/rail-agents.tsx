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
  "relative grid size-12 place-items-center rounded-full shadow-[0_4px_14px_rgba(20,22,26,0.18)] ring-2 ring-transparent transition group-hover:ring-sun-line group-focus-visible:ring-sun-line";

/** An agent on the rail: its round, then its name and its job in two words, so nobody has to remember which is which. */
function AgentLabel({ name, kind }: { name: string; kind: AgentKind }) {
  return (
    // A little wider than the round's column, so the job reads whole; a longer one takes a second line.
    // On a soft plate of its own: the rounds float over the page now, with no bar behind them.
    <span className="-mx-2 mt-1 block w-[4.25rem] rounded-lg bg-surface/90 px-1 py-0.5 text-center leading-[1.15] shadow-[0_2px_8px_rgba(20,22,26,0.08)] ring-1 ring-line backdrop-blur">
      <span className="block truncate text-[11px] font-semibold text-ink">{name}</span>
      <span className="block text-[9.5px] text-muted">{AGENT_WORDS[kind].job}</span>
    </span>
  );
}

const SHELL = "group flex w-full flex-col items-center rounded-2xl px-0.5 pb-1 pt-0.5 outline-none";
const titleOf = (name: string, kind: AgentKind) => `${name}: ${AGENT_WORDS[kind].jobLine}`;

/**
 * The business's agents on the rail, each with its name and its job under it (14 Nov 2026, Martin: "because they
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
    <span className="flex w-full flex-col items-center gap-2">
      {caller.named && (
        <button type="button" onClick={() => openCoach(null)} title={titleOf(caller.name, "sales")} className={SHELL}>
          <span className={ROUND}>
            <CallerAvatar caller={caller} size={46} />
          </span>
          <AgentLabel name={caller.name} kind="sales" />
        </button>
      )}
      {/* Each call the sales assistant has under way, as a round of its own under its face. */}
      <RailCalls />
      {admin.named && (
        <Link href="/design/settings/calls?assistant=admin" title={titleOf(admin.name, "admin")} className={SHELL}>
          <span className={ROUND}>
            <CallerAvatar caller={admin} size={46} />
          </span>
          <AgentLabel name={admin.name} kind="admin" />
        </Link>
      )}
      {tim && (
        <button type="button" onClick={openColleague} title={titleOf(tim, "colleague")} className={SHELL}>
          <span className={`${ROUND} bg-colleague text-white`}>
            <MessageCircleQuestion className="size-[22px]" aria-hidden />
          </span>
          <AgentLabel name={colleague?.name || "Chief of staff"} kind="colleague" />
        </button>
      )}
      {/* Your agents, and adding one: it says first whether the new one needs the business's phone number. */}
      <AgentsButton />
    </span>
  );
}
