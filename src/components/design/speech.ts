"use client";

import { useSyncExternalStore } from "react";

/** The browser's own speech recognition (Chrome and Edge; Safari's is patchy; Firefox has none). */
export interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  /** The microphone opened, any sound came in, a voice was made out: what tells "heard nothing" apart. */
  onaudiostart?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  start(): void;
  stop(): void;
}
export type RecognitionClass = new () => Recognition;

export const recognitionClass = (): RecognitionClass | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const noop = () => () => {};
/** Whether this browser can turn speech into words (true until the page is in the browser, so nothing flickers). */
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(
    noop,
    () => recognitionClass() !== null,
    () => true,
  );
}
