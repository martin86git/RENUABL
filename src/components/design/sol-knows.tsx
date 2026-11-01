"use client";

import { useEffect, useState } from "react";
import { BookMarked, X } from "lucide-react";
import { KNOWLEDGE_TOPICS, TOPIC_LABELS, isStale, keyWords, type KnowledgeEntry } from "@/lib/domain/design/sol-knowledge";
import { forgetSolKnowledge, listSolKnowledge } from "@/lib/services/sol";
import { SolSources } from "./sol-sources";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

/**
 * What Sol knows (1 Nov 2026, Martin: Sol stores what he finds in his memory): the answers he kept for the whole
 * business, by topic, each with its sources and when it was found, marked when it is old enough to check again; a search
 * over them; and Forget. Everyone in the business shares them.
 */
export function SolKnows() {
  const [all, setAll] = useState<KnowledgeEntry[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  useEffect(() => {
    let live = true;
    void listSolKnowledge().then((r) => live && r.ok && setAll(r.knowledge));
    return () => {
      live = false;
    };
  }, []);
  const words = keyWords(q);
  const shown = (all ?? []).filter((e) => {
    if (!words.length) return true;
    const hay = `${e.question} ${e.answer} ${TOPIC_LABELS[e.topic]}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        <BookMarked className="size-3.5" aria-hidden /> What Sol knows
      </p>
      <p className="mt-1 text-xs text-muted">Answers he found and kept for everyone here, each with its sources.</p>
      {all && all.length > 4 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search what he knows"
          aria-label="Search what Sol knows"
          className="mt-2 h-8 w-full rounded-md border border-line bg-canvas px-2.5 text-sm text-ink outline-none focus:border-forest"
        />
      )}
      {!all ? (
        <p className="mt-2 animate-pulse text-sm text-muted">Looking…</p>
      ) : !all.length ? (
        <p className="mt-2 text-sm text-muted">
          Nothing yet. Ask him about a network&apos;s export rules, a rebate or a wholesaler&apos;s branch, and he&apos;ll keep what he
          finds.
        </p>
      ) : (
        KNOWLEDGE_TOPICS.filter((t) => shown.some((e) => e.topic === t)).map((t) => (
          <div key={t} className="mt-3">
            <p className="text-[11px] font-medium text-muted">{TOPIC_LABELS[t]}</p>
            <ul className="mt-1 space-y-1.5 text-sm">
              {shown
                .filter((e) => e.topic === t)
                .map((e) => (
                  <li key={e.id} className="rounded-xl bg-canvas px-2.5 py-2">
                    <div className="flex items-start gap-2">
                      <button type="button" onClick={() => setOpen(open === e.id ? null : e.id)} className="min-w-0 flex-1 text-left">
                        <span className="block text-ink">{e.question}</span>
                        <span className="block text-[11px] text-muted">
                          Found {day(e.savedAt)}
                          {isStale(e, now) ? " · worth checking again" : ""}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          window.confirm("Forget this? Sol will look it up again next time.") &&
                          void forgetSolKnowledge(e.id).then((r) => r.ok && setAll(r.knowledge))
                        }
                        aria-label={`Forget: ${e.question}`}
                        title="Forget it"
                        className="text-muted hover:text-ink"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </div>
                    {open === e.id && (
                      <div className="mt-2 space-y-2">
                        <p className="whitespace-pre-wrap text-[13px] text-ink-2">{e.answer}</p>
                        <SolSources sources={e.sources} />
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
