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
  // Safari turned dictation down on this device: the next tap opens the keyboard instead, whose own microphone works.
  const [refused, setRefused] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);
  const rec = useRef<Recognition | null>(null);
  const words = useRef(onWords);
  const heard = useRef(onHearing);
  useEffect(() => {
    words.current = onWords;
    heard.current = onHearing;
  }, [onWords, onHearing]);
  // Leaving the page stops it.
  useEffect(() => () => rec.current?.stop(), []);
  // A problem is said beside the button (a title never shows on a phone), then goes.
  useEffect(() => {
    if (!problem) return;
    const t = window.setTimeout(() => setProblem(""), 7000);
    return () => window.clearTimeout(t);
  }, [problem]);

  const stop = () => {
    const r = rec.current;
    rec.current = null;
    r?.stop();
    setOn(false);
  };
  const start = (lang = "en-AU") => {
    const R = recognitionClass();
    if (!R) {
      setProblem(NO_DICTATION);
      return;
    }
    setProblem("");
    // On a phone (21 Nov 2026, Martin: dictation didn't work on mobile): Android's Chrome repeats words in continuous
    // mode and beeps on every restart, and iPhone's Safari won't start again without a tap. So a phone listens for one
    // go and stops by itself after a pause; a tap listens again.
    const phone = dictationOnPhone();
    const r = new R();
    r.continuous = !phone;
    r.interimResults = true;
    r.lang = lang;
    // What is being said and not yet final: kept so a stop that never gets a final result (Safari) doesn't lose it.
    let pending = "";
    let gotWords = false;
    r.onresult = (e) => {
      let now = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const said = e.results[i][0].transcript.trim();
        if (!said) continue;
        gotWords = true;
        if (e.results[i].isFinal) {
          words.current(said);
          pending = "";
        } else now += `${said} `;
      }
      pending = now.trim();
      heard.current?.(pending);
    };
    r.onerror = (e) => {
      const why = DICTATION_ERRORS[e.error];
      if (e.error === "language-not-supported" && lang === "en-AU") {
        rec.current = null;
        r.onend = null;
        start(typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US");
        return;
      }
      if (why) {
        if (e.error === "service-not-allowed") setRefused(true);
        setProblem(why);
        stop();
      }
    };
    r.onend = () => {
      if (pending) {
        words.current(pending);
        pending = "";
      }
      heard.current?.("");
      if (rec.current !== r) return;
      if (phone) {
        rec.current = null;
        setOn(false);
        if (!gotWords) setProblem(DICTATION_ERRORS["no-speech"]);
        return;
      }
      // Chrome on a computer stops after a quiet spell: carry on while it is switched on.
      try {
        r.start();
      } catch {
        rec.current = null;
        setOn(false);
      }
    };
    rec.current = r;
    try {
      r.start();
      setOn(true);
    } catch {
      rec.current = null;
      setProblem("The microphone couldn't be started. Tap again, or use the microphone on your keyboard.");
    }
  };

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        ref={button}
        onClick={() => {
          if (on) return stop();
          if (refused) return openKeyboard(button.current, () => setProblem(KEYBOARD_NOW));
          start();
        }}
        aria-pressed={on}
        aria-label={on ? "Stop listening" : label}
        title={problem || (supported ? (on ? "Listening: tap to stop" : "Speak instead of typing") : NO_DICTATION)}
        className={clsx(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full transition",
          on
            ? "animate-pulse bg-positive text-white ring-4 ring-positive/30"
            : problem
              ? "text-danger ring-1 ring-danger"
              : supported
                ? "text-ink-2 hover:bg-canvas hover:text-ink"
                : "text-muted",
        )}
      >
        {supported ? <Mic className="size-4" aria-hidden /> : <MicOff className="size-4" aria-hidden />}
      </button>
      {problem ? (
        <span
          role="status"
          className="absolute bottom-full right-0 z-30 mb-2 w-60 rounded-xl bg-primary px-3 py-2 text-left text-[12.5px] leading-snug text-primary-ink shadow-lg"
        >
          {problem}
        </span>
      ) : null}
    </span>
  );
}

const NO_DICTATION = "This browser can't turn speech into words. Use the microphone on your keyboard instead.";

/** What each of the browser's errors means for the person tapping the microphone. "aborted" is our own stop. */
const DICTATION_ERRORS: Record<string, string> = {
  "not-allowed": "The microphone isn't allowed for this site. Allow it in your browser's site settings, then tap again.",
  // Safari's dictation for web pages runs through Siri, so it can be refused while the keyboard's own microphone works
  // (22 Nov 2026, Martin: "How come I can use the microphone dictation elsewhere but not here?").
  "service-not-allowed":
    "Safari won't let web pages take dictation on this phone (it needs Siri switched on: Settings, Siri). Tap the microphone again to open your keyboard, and use its microphone.",
  "audio-capture": "No sound came through from the microphone. Check another app isn't using it, then tap again.",
  network: "Speech to text needs a connection and couldn't reach it. Tap again, or use the microphone on your keyboard.",
  "no-speech": "Didn't hear anything. Tap and speak straight away.",
  "language-not-supported": "This browser can't take dictation in English here. Use the microphone on your keyboard.",
};

const KEYBOARD_NOW = "Your keyboard is open: tap the microphone on it to speak.";

/**
 * Puts the cursor in the message box the button sits in, at the end of its words, so the phone's keyboard opens with
 * its own microphone. Must be called from the tap itself (Safari opens the keyboard only for a person's tap).
 */
function openKeyboard(from: HTMLElement | null, then: () => void) {
  let box: HTMLTextAreaElement | HTMLInputElement | null = null;
  for (let at = from?.parentElement ?? null, up = 0; at && up < 6 && !box; at = at.parentElement, up++)
    box = at.querySelector("textarea, input[type=text], input:not([type])");
  if (!box) return;
  box.focus();
  const end = box.value.length;
  try {
    box.setSelectionRange(end, end);
  } catch {
    // Some inputs don't take a selection.
  }
  then();
}

/** A touch screen with no fine pointer: a phone or tablet. */
function dictationOnPhone(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return coarse || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Adds spoken words where a box's words end, with a space between and a capital to start. */
export function withSpoken(text: string, words: string): string {
  const said = text.trim() ? words : words.charAt(0).toUpperCase() + words.slice(1);
  return text && !/\s$/.test(text) ? `${text} ${said}` : `${text}${said}`;
}
