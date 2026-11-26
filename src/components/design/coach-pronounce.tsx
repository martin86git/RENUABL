"use client";

/**
 * How words are said (domain/design/pronounce.ts, 26 Nov 2026, Martin: "how can i adjust the voice agents way of
 * pronouncing something?"): the business's one list for every voice agent, a word and how to write it so the voice
 * says it right. Saved whole on each change; only someone who may change settings changes it.
 */
import { useEffect, useState } from "react";
import { ArrowRight, Plus, X } from "lucide-react";
import { pronounceProblem, PRONOUNCE_LIMITS, type Pronunciation } from "@/lib/domain/design/pronounce";
import { loadPronunciations, savePronunciations } from "@/lib/services/caller";

/** The card's line under its title. */
export const pronounceSummary = (list: readonly Pronunciation[] | null) =>
  !list
    ? "Every agent"
    : list.length === 0
      ? "No words set · every agent"
      : `${list.length} ${list.length === 1 ? "word" : "words"} · every agent`;

export function PronounceSettings(props: { editable: boolean; onList?: (list: Pronunciation[]) => void }) {
  const [list, setList] = useState<Pronunciation[] | null>(null);
  const [word, setWord] = useState("");
  const [say, setSay] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { onList } = props;

  useEffect(() => {
    let live = true;
    void loadPronunciations().then((l) => {
      if (!live) return;
      setList(l);
      onList?.(l);
    });
    return () => {
      live = false;
    };
  }, [onList]);

  const save = async (next: Pronunciation[]) => {
    setSaving(true);
    const r = await savePronunciations(next);
    setSaving(false);
    if (!r.ok) return setProblem(r.message);
    setList(r.pronounce);
    onList?.(r.pronounce);
    return true;
  };

  const add = async () => {
    const why = pronounceProblem({ word, say }, list ?? []);
    if (why) return setProblem(why);
    setProblem(null);
    if (await save([...(list ?? []), { word, say }])) {
      setWord("");
      setSay("");
    }
  };

  const field =
    "h-9 min-w-[7rem] flex-1 rounded-lg bg-canvas px-2.5 text-sm text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-sun-line";

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">
        A voice says what it reads, so a note in the script can&apos;t change how a word sounds. Write each word the way it should sound,
        and every one of your agents says it that way on calls. Try it with a test call.
      </p>
      {list === null ? (
        <p className="text-xs text-muted">Reading the list…</p>
      ) : (
        list.length > 0 && (
          <ul className="space-y-1">
            {list.map((p) => (
              <li key={p.word} className="flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-1.5 text-sm">
                <span className="min-w-0 truncate font-medium text-ink">{p.word}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ink-2">&ldquo;{p.say}&rdquo;</span>
                {props.editable && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void save(list.filter((x) => x.word !== p.word))}
                    aria-label={`Take ${p.word} off the list`}
                    className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-danger"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )
      )}
      {props.editable ? (
        list !== null &&
        list.length < PRONOUNCE_LIMITS.words && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
            className="space-y-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                maxLength={PRONOUNCE_LIMITS.word}
                placeholder="Word, e.g. Solar"
                aria-label="The word as it is spelled"
                className={field}
              />
              <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden />
              <input
                value={say}
                onChange={(e) => setSay(e.target.value)}
                maxLength={PRONOUNCE_LIMITS.say}
                placeholder="Said as, e.g. Sola"
                aria-label="How it should sound"
                className={field}
              />
            </div>
            <button
              type="submit"
              disabled={saving || !word.trim() || !say.trim()}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-medium text-primary-ink disabled:bg-surface-2 disabled:text-muted"
            >
              <Plus className="size-3.5" aria-hidden /> Add the word
            </button>
          </form>
        )
      ) : (
        <p className="text-xs text-muted">Only an admin can change how words are said.</p>
      )}
      {problem && <p className="text-xs text-danger">{problem}</p>}
    </div>
  );
}
