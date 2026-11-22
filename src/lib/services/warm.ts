/**
 * Answers kept warm for the page (22 Nov 2026, Martin: Today's tray tabs should open at once). Today asks for each
 * tab's answer as it opens; a tab then starts from the last answer kept and refreshes behind it. Kept in memory only, so
 * a reload or signing out starts afresh.
 */
const kept = new Map<string, unknown>();
const flying = new Map<string, Promise<unknown>>();

/** Asks once at a time for this key (a second ask while one is out shares it) and keeps an answer that came back ok. */
export function warm<T extends { ok: boolean }>(key: string, load: () => Promise<T>): Promise<T> {
  const out = flying.get(key);
  if (out) return out as Promise<T>;
  const p = load()
    .then((r) => {
      if (r.ok) kept.set(key, r);
      return r;
    })
    .finally(() => flying.delete(key));
  flying.set(key, p);
  return p;
}

/** Asks afresh (after a change), still keeping the answer. */
export function fresh<T extends { ok: boolean }>(key: string, load: () => Promise<T>): Promise<T> {
  const p = load().then((r) => {
    if (r.ok) kept.set(key, r);
    return r;
  });
  flying.set(key, p);
  void p.finally(() => flying.get(key) === p && flying.delete(key));
  return p;
}

/** The last answer kept for this key, if any. */
export const warmed = <T>(key: string): T | undefined => kept.get(key) as T | undefined;
