/**
 * Undo and redo for the email editor (21 Nov 2026, Martin: "undo should undo anything a user would want to undo"). Every
 * change to the email is a step: a block added, moved, removed or changed, a picture, Sol's writing, the subject. Typing
 * into one field is one step while it carries on (a pause of `TYPING_PAUSE_MS` or another field starts the next), so undo
 * takes back a word or a sentence, not a letter.
 */

export const HISTORY_MAX = 100;
export const TYPING_PAUSE_MS = 1000;

export interface History<T> {
  past: T[];
  future: T[];
  /** The field last typed into, and when: typing on in it adds to the same step. */
  key: string | null;
  at: number;
}

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [], key: null, at: 0 });

/** Before a change lands: keeps what was there as a step, unless it is more typing in the same field. Redo is cleared. */
export function record<T>(h: History<T>, before: T, key: string | null, now: number): History<T> {
  const typingOn = key !== null && key === h.key && now - h.at < TYPING_PAUSE_MS && h.past.length > 0;
  const past = typingOn ? h.past : [...h.past, before].slice(-HISTORY_MAX);
  return { past, future: [], key, at: now };
}

/** Takes back the last step: what to show, and the history after it. Null when there is nothing to undo. */
export function undo<T>(h: History<T>, current: T): { value: T; history: History<T> } | null {
  if (!h.past.length) return null;
  const value = h.past[h.past.length - 1];
  return { value, history: { past: h.past.slice(0, -1), future: [current, ...h.future], key: null, at: 0 } };
}

/** Puts back the last step undone. Null when there is nothing to redo. */
export function redo<T>(h: History<T>, current: T): { value: T; history: History<T> } | null {
  if (!h.future.length) return null;
  const [value, ...future] = h.future;
  return { value, history: { past: [...h.past, current].slice(-HISTORY_MAX), future, key: null, at: 0 } };
}
