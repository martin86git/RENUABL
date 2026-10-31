"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Mic, MicOff } from "lucide-react";
import { recognitionClass, useSpeechSupported, type Recognition } from "./speech";

/**
 * Speak instead of typing (as Primero's): a round microphone inside a message box. Pressed, it listens through the
 * browser's own speech recognition (Chrome and Edge; the browser sends the sound to Google or Microsoft to turn into
 * words) and hands each finished phrase to `onWords`; `onHearing` has the phrase as it comes. Pressed again, it stops.
 * Nothing is recorded or kept.
 */
export function DictateButton({
  onWords,
  onHearing,
  label = "Speak",
}: {
  onWords: (words: string) => void;
  onHearing?: (words: string) => void;
  label?: string;
}) {
  const supported = useSpeechSupported();
  const [on, setOn] = useState(false);
  const [problem, setProblem] = useState("");
  const rec = useRef<Recognition | null>(null);
  const words = useRef(onWords);
  const heard = useRef(onHearing);
  useEffect(() => {
    words.current = onWords;
    heard.current = onHearing;
  }, [onWords, onHearing]);
  // Leaving the page stops it.
  useEffect(() => () => rec.current?.stop(), []);

  const stop = () => {
    const r = rec.current;
    rec.current = null;
    r?.stop();
    setOn(false);
    heard.current?.("");
  };
  const start = () => {
    const R = recognitionClass();
    if (!R) return;
    setProblem("");
    const r = new R();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-AU";
    r.onresult = (e) => {
      let now = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const said = e.results[i][0].transcript.trim();
        if (!said) continue;
        if (e.results[i].isFinal) words.current(said);
        else now += `${said} `;
      }
      heard.current?.(now.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setProblem("The microphone isn't allowed for this site: allow it in the address bar.");
        stop();
      }
    };
    // Chrome stops after a quiet spell: carry on while it is switched on.
    r.onend = () => {
      if (rec.current !== r) return;
      try {
        r.start();
      } catch {
        /* already starting */
      }
    };
    rec.current = r;
    try {
      r.start();
      setOn(true);
    } catch {
      setProblem("The microphone couldn't be started.");
    }
  };

  return (
    <button
      type="button"
      disabled={!supported}
      onClick={() => (on ? stop() : start())}
      aria-pressed={on}
      aria-label={on ? "Stop listening" : label}
      title={problem || (supported ? (on ? "Listening: tap to stop" : "Speak instead of typing") : "Speaking works in Chrome or Edge.")}
      className={clsx(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full transition disabled:text-muted",
        on
          ? "animate-pulse bg-positive text-white ring-4 ring-positive/30"
          : problem
            ? "text-danger ring-1 ring-danger"
            : "text-ink-2 hover:bg-canvas hover:text-ink",
      )}
    >
      {supported ? <Mic className="size-4" aria-hidden /> : <MicOff className="size-4" aria-hidden />}
    </button>
  );
}

/** Adds spoken words where a box's words end, with a space between and a capital to start. */
export function withSpoken(text: string, words: string): string {
  const said = text.trim() ? words : words.charAt(0).toUpperCase() + words.slice(1);
  return text && !/\s$/.test(text) ? `${text} ${said}` : `${text}${said}`;
}
