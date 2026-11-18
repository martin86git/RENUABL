"use client";

/**
 * A voice agent's scripts, in the settings beside its chat (18 Nov 2026, Martin: "we need to be able to create new
 * scripts and select which one to use"): each by name, the one in use marked, Use on the others, a pencil to rename,
 * a cross to remove one not in use, and New script (blank, or a copy of the one in use). Choosing one swaps the
 * script shown under it and who it rings; calls take it from the next one. Rules in domain/design/call-scripts.ts.
 */
import { useState } from "react";
import clsx from "clsx";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { SCRIPTS_COPY as COPY, SCRIPT_NAME_MAX, namedForColdCalls, scriptWords, type ScriptLine } from "@/lib/domain/design/call-scripts";
import { CALL_AUDIENCES, CALL_SETUP_COPY, type CallAudience } from "@/lib/domain/design/call-setup";
import type { CallSetup } from "@/lib/domain/design/call-setup";
import type { CoachNote } from "@/lib/domain/design/coaching";
import { changeScript } from "@/lib/services/coaching";

type Changed = { notes: CoachNote[]; setup: CallSetup; scripts: ScriptLine[] };
const KEY_OF = (s: ScriptLine) => s.id ?? "live";
const input =
  "min-w-0 flex-1 rounded-lg bg-surface px-2.5 py-1.5 text-[13px] text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-sun-line";
const round = "grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-100";

export function ScriptPicker(props: {
  name: string;
  sales: boolean;
  scripts: ScriptLine[];
  editable: boolean;
  onChanged: (r: Changed) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [copy, setCopy] = useState(false);
  // Who a blank script rings: chosen here, else read from its name ("Cold calls").
  const [picked, setPicked] = useState<CallAudience | null>(null);
  const audience: CallAudience = picked ?? (namedForColdCalls(newName) ? "cold" : "enquired");
  const [renaming, setRenaming] = useState<{ key: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const run = async (key: string, change: Parameters<typeof changeScript>[0], after?: () => void) => {
    setBusy(key);
    setSaid(null);
    const res = await changeScript(change);
    setBusy(null);
    if (!res.ok) return setSaid(res.message);
    after?.();
    props.onChanged(res);
  };

  return (
    <div className="rounded-xl bg-canvas p-2">
      <ul className="space-y-1">
        {props.scripts.map((s) => {
          const key = KEY_OF(s);
          const live = s.id === null;
          const edit = renaming?.key === key ? renaming : null;
          return (
            <li
              key={key}
              className={clsx(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5",
                live ? "bg-surface ring-1 ring-sun-line" : "bg-surface ring-1 ring-line",
              )}
            >
              {edit ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (edit.name.trim()) void run(key, { do: "rename", id: s.id, name: edit.name }, () => setRenaming(null));
                  }}
                >
                  <input
                    autoFocus
                    value={edit.name}
                    maxLength={SCRIPT_NAME_MAX}
                    onChange={(e) => setRenaming({ key, name: e.target.value })}
                    onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                    aria-label="Script name"
                    className={input}
                  />
                  <button type="submit" className={round} aria-label="Save the name" disabled={busy === key}>
                    {busy === key ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
                  </button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{s.name}</span>
                    <span className="block truncate text-[11px] text-muted">{scriptWords(s, props.sales)}</span>
                  </span>
                  {live ? (
                    <span className="shrink-0 rounded-full bg-sun px-2 py-0.5 text-[11px] font-semibold text-sun-ink">{COPY.inUse}</span>
                  ) : (
                    props.editable && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void run(key, { do: "use", id: s.id as string })}
                        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-primary px-3 text-[11.5px] font-semibold text-white disabled:bg-surface-2 disabled:text-muted"
                      >
                        {busy === key && <Loader2 className="size-3 animate-spin" aria-hidden />}
                        {COPY.use}
                      </button>
                    )
                  )}
                  {props.editable && (
                    <button
                      type="button"
                      className={round}
                      aria-label={`Rename ${s.name}`}
                      title="Rename"
                      onClick={() => {
                        setRemoving(null);
                        setRenaming({ key, name: s.name });
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </button>
                  )}
                  {props.editable &&
                    !live &&
                    (removing === key ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void run(key, { do: "forget", id: s.id as string }, () => setRemoving(null))}
                        className="h-7 shrink-0 rounded-full bg-danger px-2.5 text-[11.5px] font-semibold text-white"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={round}
                        aria-label={`Remove ${s.name}`}
                        title="Remove"
                        onClick={() => setRemoving(key)}
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    ))}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {props.editable &&
        (adding ? (
          <form
            className="mt-2 space-y-2 rounded-lg bg-surface p-2.5 ring-1 ring-line"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim())
                void run("new", { do: "new", name: newName, copy, audience }, () => {
                  setAdding(false);
                  setNewName("");
                  setCopy(false);
                  setPicked(null);
                });
            }}
          >
            <input
              autoFocus
              value={newName}
              maxLength={SCRIPT_NAME_MAX}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
              placeholder={COPY.namePlaceholder}
              aria-label="The new script's name"
              className={clsx(input, "w-full")}
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full bg-surface-2 p-0.5">
                {[false, true].map((c) => (
                  <button
                    key={String(c)}
                    type="button"
                    aria-pressed={copy === c}
                    onClick={() => setCopy(c)}
                    className={clsx(
                      "rounded-full px-2.5 py-1 text-[11.5px] font-medium",
                      copy === c ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {c ? COPY.copy : COPY.blank}
                  </button>
                ))}
              </div>
              {props.sales && !copy && (
                <div className="inline-flex rounded-full bg-surface-2 p-0.5" role="group" aria-label={CALL_SETUP_COPY.audience}>
                  {CALL_AUDIENCES.map((a) => (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={audience === a}
                      onClick={() => setPicked(a)}
                      className={clsx(
                        "rounded-full px-2.5 py-1 text-[11.5px] font-medium",
                        audience === a ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:text-ink",
                      )}
                    >
                      {CALL_SETUP_COPY.audiences[a][0]}
                    </button>
                  ))}
                </div>
              )}
              <span className="flex-1" />
              <button type="button" onClick={() => setAdding(false)} className="text-[11.5px] font-medium text-ink-2 hover:text-ink">
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy !== null || !newName.trim()}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-[11.5px] font-semibold text-white disabled:bg-surface-2 disabled:text-muted"
              >
                {busy === "new" && <Loader2 className="size-3 animate-spin" aria-hidden />}
                Create and use
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setSaid(null);
              setAdding(true);
            }}
            className="mt-2 inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold text-ink ring-1 ring-line hover:bg-surface"
          >
            <Plus className="size-3.5" aria-hidden /> {COPY.add}
          </button>
        ))}
      {said && <p className="mt-2 text-xs text-danger">{said}</p>}
      <p className="mt-2 px-0.5 text-[11px] leading-snug text-muted">{COPY.note(props.name)}</p>
    </div>
  );
}
