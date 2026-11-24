/**
 * The order of the tabs in the tray under Sol's box on Today, as a person has dragged them (24 Nov 2026, Martin: "allow
 * a click and drag to reorder them"). Kept on the device, one order a set of tabs; a tab not in the kept order (one
 * added since) goes where it stands among the tabs as they come, and a kept key no longer offered is dropped.
 */

/** The tabs in the kept order: kept ones first in that order, each new one slotted in after the tab it follows as offered. */
export function orderTabs<K extends string>(offered: readonly K[], kept: readonly string[] | null | undefined): K[] {
  if (!kept?.length) return [...offered];
  const known = new Set<string>(offered);
  const out: K[] = kept.filter((k, i): k is K => known.has(k) && kept.indexOf(k) === i);
  offered.forEach((key, i) => {
    if (out.includes(key)) return;
    // After the nearest tab before it as offered that is already placed, else at the front.
    const before = offered
      .slice(0, i)
      .reverse()
      .find((k) => out.includes(k));
    out.splice(before ? out.indexOf(before) + 1 : 0, 0, key);
  });
  return out;
}

/** The order with `key` moved to place `to` (clamped), every other tab keeping its order. */
export function moveTab<K extends string>(order: readonly K[], key: K, to: number): K[] {
  const from = order.indexOf(key);
  if (from < 0) return [...order];
  const rest = order.filter((k) => k !== key);
  const at = Math.max(0, Math.min(rest.length, to));
  return [...rest.slice(0, at), key, ...rest.slice(at)];
}

/** A kept order read back from the device: plain short keys only, at most 20. */
export function cleanKeptOrder(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const keys = raw.filter((k): k is string => typeof k === "string" && /^[a-z-]{1,24}$/.test(k)).slice(0, 20);
  return keys.length ? keys : null;
}
