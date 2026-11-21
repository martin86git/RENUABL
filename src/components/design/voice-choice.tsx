"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Play, Square, VolumeX, X } from "lucide-react";
import {
  CALLER_VOICES,
  NO_SAMPLE,
  voiceAccent,
  voiceKey,
  voiceSampleUrl,
  voicesShown,
  type CallerVoice,
  type VoiceChoice as Voice,
} from "@/lib/domain/design/caller";
import { loadHiddenVoices } from "@/lib/services/caller";

/** The one sample clip playing, wherever the picker is shown: starting another stops it. */
let sampleNow: HTMLAudioElement | null = null;
export function stopSample() {
  sampleNow?.pause();
  sampleNow = null;
}
export function startSample(url: string, over: () => void, failed: () => void) {
  const clip = new Audio(url);
  sampleNow = clip;
  clip.onended = over;
  clip.onerror = failed;
  void clip.play().catch(over);
}

/**
 * Choosing a new agent's voice (21 Nov 2026, Martin: the browser's own dropdown wasn't RENUABL's look, and there was no
 * way to hear a voice before choosing it). A field like the others that opens a list in place, grouped by accent, each
 * voice with a round to hear its maker's sample (no call); the voices the business removed stay off it. `value` is the
 * voice's key ("11labs:…"), "" for Choose later.
 *
 * Settings → Phone assistants uses the same picker (21 Nov 2026, Martin): it passes its own options in place of Choose
 * later (`others`: Default, Another voice), the business's removed voices (`hidden`, so its list and the picker agree)
 * and `onRemove`, which puts a cross on each voice but the one picked.
 */
export type OtherChoice = { key: string; label: string; words: string };

export function VoiceChoice({
  value,
  onChange,
  others = [{ key: "", label: "Choose later", words: "" }],
  hidden: given,
  onRemove,
  disabled = false,
}: {
  value: string;
  onChange: (key: string) => void;
  others?: OtherChoice[];
  hidden?: string[];
  onRemove?: (key: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<string[]>([]);
  const hidden = given ?? loaded;
  const [playing, setPlaying] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    if (!given) void loadHiddenVoices().then((h) => live && setLoaded(h));
    return () => {
      live = false;
      stopSample();
    };
    // Read once; a picker given its list never asks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A press outside or Escape folds the list.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setOpen(false));
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);

  // The voice picked stays on the list even when removed elsewhere.
  const inUse = CALLER_VOICES.find((v) => voiceKey(v) === value) ?? null;
  const voices = useMemo(() => voicesShown(hidden, inUse), [hidden, inUse]);
  const other = others.find((o) => o.key === value) ?? null;
  const groups = useMemo(() => {
    const by = new Map<string, typeof voices>();
    for (const v of voices) by.set(voiceAccent(v), [...(by.get(voiceAccent(v)) ?? []), v]);
    return [...by];
  }, [voices]);
  const picked = voices.find((v) => voiceKey(v) === value) ?? null;

  const play = (v: CallerVoice) => {
    const key = voiceKey(v);
    stopSample();
    setNote(null);
    if (playing === key) return setPlaying(null);
    const url = voiceSampleUrl(v);
    if (!url) return setNote(NO_SAMPLE);
    setPlaying(key);
    const over = () => setPlaying((now) => (now === key ? null : now));
    startSample(url, over, () => {
      over();
      setNote(NO_SAMPLE);
    });
  };

  const sample = (v: Voice) => {
    const on = playing === voiceKey(v);
    if (!voiceSampleUrl(v))
      return (
        <span className="grid size-8 shrink-0 place-items-center text-muted" title="No sample: hear it on a test call">
          <VolumeX className="size-3.5" aria-hidden />
          <span className="sr-only">No sample to play</span>
        </span>
      );
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          play(v);
        }}
        aria-label={on ? `Stop ${v.label}'s sample` : `Hear ${v.label}`}
        title={on ? "Stop" : `Hear ${v.label}: a sample of the voice, no call`}
        className={clsx(
          "grid size-8 shrink-0 place-items-center rounded-full ring-1 transition-colors",
          on ? "bg-sun-line text-white ring-sun-line" : "bg-surface text-ink ring-line hover:ring-ink-2",
        )}
      >
        {on ? <Square className="size-3" aria-hidden /> : <Play className="size-3 translate-x-px" aria-hidden />}
      </button>
    );
  };

  return (
    <div ref={box} className="mt-1.5">
      <div
        className={clsx(
          "flex items-center gap-2 rounded-xl bg-surface py-1.5 pr-2 pl-3 ring-1 transition-shadow",
          open ? "ring-2 ring-sun-line" : "ring-line",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left font-normal outline-none"
        >
          <span className="min-w-0 flex-1 truncate text-sm">
            {picked ? (
              <>
                <span className="font-semibold text-ink">{picked.label}</span>
                <span className="text-muted"> · {picked.words}</span>
              </>
            ) : other ? (
              <>
                <span className={clsx(other.words ? "font-semibold text-ink" : "text-muted")}>{other.label}</span>
                {other.words && <span className="text-muted"> · {other.words}</span>}
              </>
            ) : (
              <span className="text-muted">Choose a voice</span>
            )}
          </span>
          <ChevronDown className={clsx("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {picked && sample(picked)}
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Voices"
          className="mt-1.5 max-h-80 overflow-y-auto rounded-xl bg-surface p-1 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)] ring-1 ring-line"
        >
          {others.map((o) => (
            <Option key={o.key || "later"} on={value === o.key} onPick={() => (onChange(o.key), setOpen(false))}>
              <span className={clsx("block truncate text-sm text-ink", o.words && "font-semibold")}>{o.label}</span>
              {o.words && <span className="block truncate text-xs text-muted">{o.words}</span>}
            </Option>
          ))}
          {groups.map(([accent, list]) => (
            <div key={accent} role="group" aria-label={accent} className="mt-1">
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{accent}</p>
              {list.map((v) => (
                <Option
                  key={voiceKey(v)}
                  on={voiceKey(v) === value}
                  onPick={() => (onChange(voiceKey(v)), setOpen(false))}
                  after={
                    <>
                      {sample(v)}
                      {onRemove && voiceKey(v) !== value && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove(voiceKey(v));
                          }}
                          aria-label={`Remove ${v.label} from the list`}
                          title="Remove from the list, for everyone in your business"
                          className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </>
                  }
                >
                  <span className="block truncate text-sm font-semibold text-ink">{v.label}</span>
                  {accentless(v.words) && <span className="block truncate text-xs text-muted">{accentless(v.words)}</span>}
                </Option>
              ))}
            </div>
          ))}
        </div>
      )}
      {note && <p className="mt-1 px-1 text-xs font-normal text-muted">{note}</p>}
    </div>
  );
}

/** A voice's words under its accent's heading, without the accent again ("Australian, relaxed" → "relaxed"). */
const accentless = (words: string) => words.replace(/^[A-Za-z]+\s*[,·]?\s*/, "");

function Option({ on, onPick, after, children }: { on: boolean; onPick: () => void; after?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={clsx("flex items-center gap-2 rounded-lg pr-1.5", on ? "bg-sun/60" : "hover:bg-surface-2")}>
      <button
        type="button"
        role="option"
        aria-selected={on}
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 text-left font-normal"
      >
        <span className="min-w-0 flex-1">{children}</span>
        {on && <Check className="size-4 shrink-0 text-sun-line" aria-hidden />}
      </button>
      {after}
    </div>
  );
}
