"use client";
/**
 * The business's add-ons (domain/design/add-ons.ts) for the screens: where each stands, adding one, the business's own
 * number. One shared read, refreshed when anything changes (`ADD_ONS_CHANGED`), so every place offering an add-on agrees.
 */
import { useCallback, useEffect, useState } from "react";
import type { AddOnKey, AddOnStanding, VoiceStanding } from "@/lib/domain/design/add-ons";

export interface AddOnsView {
  addOns: { key: AddOnKey; standing: AddOnStanding; cents: number | null; endsAt?: string | null }[];
  number: { e164: string; renuabl: boolean } | null;
  voice: VoiceStanding;
  canBuyNumber: boolean;
  /** The plan's next bill day, when it has a live plan. */
  nextBill?: string | null;
  mayAdd: boolean;
  /** This month's Calls & Texts minutes and texts. */
  usage?: { minutes: number; texts: number };
  /** The spending cap beyond the free allowance, in cents. */
  capCents?: number | null;
}

export const ADD_ONS_CHANGED = "renuabl:addons";

type Sent = { ok: boolean; message?: string; requested?: boolean; number?: string; numberPending?: boolean; endsAt?: string | null };

async function send(body: unknown): Promise<Sent> {
  try {
    const res = await fetch("/api/design/addons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Partial<Sent>;
    if (json.ok) window.dispatchEvent(new Event(ADD_ONS_CHANGED));
    return {
      ok: json.ok === true,
      message: json.message,
      requested: json.requested,
      number: json.number,
      numberPending: json.numberPending,
      endsAt: json.endsAt,
    };
  } catch {
    return { ok: false, message: "Couldn't reach RENUABL. Try again." };
  }
}

export const addAddOn = (key: AddOnKey) => send({ do: "add", key });
export const removeAddOn = (key: AddOnKey) => send({ do: "remove", key });
export const keepAddOn = (key: AddOnKey) => send({ do: "keep", key });
export const getBusinessNumber = () => send({ do: "number" });
export const setSpendingCap = (dollars: string) => send({ do: "cap", dollars });

let shared: Promise<AddOnsView | null> | null = null;

function load(fresh = false): Promise<AddOnsView | null> {
  if (!shared || fresh)
    shared = fetch("/api/design/addons", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as AddOnsView) : null))
      .catch(() => null);
  return shared;
}

/** The business's add-ons, kept in step across the page. Null while loading or signed out. */
export function useAddOns(): [AddOnsView | null, () => void] {
  const [view, setView] = useState<AddOnsView | null>(null);
  const refresh = useCallback(() => void load(true).then(setView), []);
  useEffect(() => {
    let live = true;
    void load().then((v) => live && setView(v));
    const again = () => void load(true).then((v) => live && setView(v));
    window.addEventListener(ADD_ONS_CHANGED, again);
    return () => {
      live = false;
      window.removeEventListener(ADD_ONS_CHANGED, again);
    };
  }, []);
  return [view, refresh];
}

/** Staff on /admin (the server checks the staff session). */
async function staff(body: unknown): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch("/api/admin/addons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    return { ok: json.ok === true, message: json.message };
  } catch {
    return { ok: false, message: "No answer." };
  }
}

export const staffSwitchOn = (businessId: string, key: AddOnKey) => staff({ businessId, key, do: "on" });
export const staffEnd = (businessId: string, key: AddOnKey) => staff({ businessId, key, do: "end" });
export const staffAttachNumber = (businessId: string, e164: string, vapiId: string) => staff({ businessId, do: "number", e164, vapiId });
