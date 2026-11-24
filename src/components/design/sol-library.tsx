"use client";

/**
 * The library under Sol's Technical tile (24 Nov 2026, Martin: "an accruing knowledge library building… sol could
 * bookmark this into the library for future fast retrieval"). Everything Sol keeps for the business (his sourced
 * answers and the tips people bookmark), technical first; a title opens its answer in place, with no Sol credit and no
 * wait. "Bookmark a tip" keeps one by hand; asking Sol to save or bookmark something in the chat does the same.
 */

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Bookmark, BookmarkPlus, ChevronDown, Globe } from "lucide-react";
import { isTip, libraryFor, TIP_LIMITS, type KnowledgeEntry } from "@/lib/domain/design/sol-knowledge";
import { bookmarkTip, listSolKnowledge } from "@/lib/services/sol";

export function SolLibrary() {
  const [all, setAll] = useState<KnowledgeEntry[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [tip, setTip] = useState("");
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let gone = false;
    void listSolKnowledge().then((r) => !gone && setAll(r.ok ? r.knowledge : []));
    return () => {
      gone = true;
    };
  }, []);
  const save = async () => {
    setSaving(true);
    setProblem("");
    const r = await bookmarkTip({ title, tip });
    setSaving(false);
    if (!r.ok) return setProblem(r.message || "Not saved. Try again.");
    setAll(r.knowledge);
    setTitle("");
    setTip("");
    setAdding(false);
  };
  const shown = all ? libraryFor(all) : [];
  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="mb-1.5 flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] text-muted">
        <Bookmark className="size-3.5" aria-hidden />
        Library{all ? ` · ${all.length}` : ""}
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-normal normal-case tracking-normal text-ink-2 hover:bg-ink/5 hover:text-ink"
        >
          <BookmarkPlus className="size-3.5" aria-hidden />
          Bookmark a tip
        </button>
      </div>
      {adding && (
        <div className="mb-2 space-y-2 rounded-xl bg-canvas p-2.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TIP_LIMITS.title}
            placeholder="Title, e.g. Inverter to gas meter clearance"
            aria-label="Tip title"
            className="w-full rounded-lg bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none ring-1 ring-line focus:ring-line-strong"
          />
          <textarea
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            maxLength={TIP_LIMITS.tip}
            rows={2}
            placeholder="The tip, e.g. 1,500 mm in the direction the vent blows, 1,000 mm elsewhere"
            aria-label="The tip"
            className="w-full resize-none rounded-lg bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none ring-1 ring-line focus:ring-line-strong"
          />
          {problem && <p className="text-[12px] text-sun-ink">{problem}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-full px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || title.trim().length < 3 || !tip.trim()}
              className="rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white disabled:bg-surface-2 disabled:text-muted"
            >
              {saving ? "Saving…" : "Save to the library"}
            </button>
          </div>
        </div>
      )}
      {all === null ? (
        <p className="py-1 text-[13px] text-muted">Opening the library…</p>
      ) : shown.length === 0 ? (
        <p className="py-1 text-[13px] text-muted">Nothing kept yet. Ask Sol to bookmark an answer, or bookmark a tip yourself.</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto">
          {shown.map((e) => {
            const on = open === e.id;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setOpen(on ? null : e.id)}
                  aria-expanded={on}
                  className="flex w-full items-start gap-2.5 py-1.5 text-left text-[13.5px] text-ink-2 hover:text-ink"
                >
                  {isTip(e) ? (
                    <Bookmark className="mt-0.5 size-4 shrink-0 text-sun-line" strokeWidth={1.7} aria-hidden />
                  ) : (
                    <Globe className="mt-0.5 size-4 shrink-0 text-sun-line" strokeWidth={1.7} aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">{e.question}</span>
                  <ChevronDown className={clsx("mt-0.5 size-4 shrink-0 text-muted transition-transform", on && "rotate-180")} aria-hidden />
                </button>
                {on && (
                  <div className="mb-2 ml-[1.625rem] rounded-xl bg-canvas px-3 py-2 text-[13px] leading-relaxed text-ink">
                    <p className="whitespace-pre-wrap">{e.answer}</p>
                    <p className="mt-1.5 text-[11.5px] text-muted">
                      {isTip(e)
                        ? `Bookmarked by ${e.savedBy.split("@")[0]}`
                        : `From ${e.sources.length} page${e.sources.length === 1 ? "" : "s"}`}{" "}
                      · {new Date(e.savedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
