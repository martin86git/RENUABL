"use client";

import clsx from "clsx";
import { useState } from "react";
import { SAMPLE_BUSINESSES } from "@/lib/domain/design/staff-view";
import { BUSINESS_KINDS } from "@/lib/domain/design/business-kind";
import { useDesignAccount } from "./design-account";

/**
 * Settings → RENUABL staff → View as (3 Nov 2026, Martin): look through RENUABL as a solar retailer, an installer or an
 * electrical inspector, each a sample business with work in it; the staff member's own sign-in is kept to come back
 * to. Staff only: anyone else sees that there's nothing here.
 */
export async function staffView(kind: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch("/api/design/staff-view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    return res.ok && data.ok ? { ok: true } : { ok: false, message: data.message ?? "That didn't work. Try again." };
  } catch {
    return { ok: false, message: "You seem to be offline." };
  }
}

export function StaffViewAs() {
  const [account] = useDesignAccount();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  if (!account?.signedIn || !account.staff) return <p className="text-sm text-ink-2">There&apos;s nothing here.</p>;
  const viewing = account.staffViewing ?? null;

  const go = async (kind: string) => {
    setBusy(kind);
    setProblem(null);
    const res = await staffView(kind);
    if (!res.ok) {
      setBusy(null);
      return setProblem(res.message ?? null);
    }
    window.location.replace("/design");
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-[20px] font-semibold tracking-tight text-ink">View as</h1>
      <p className="mt-1 text-sm text-ink-2">
        See RENUABL as each kind of business sees it. Each is a sample business with work in it, connected to the others, so every page has
        something to show. Your own sign-in is kept: an orange bar takes you back.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {SAMPLE_BUSINESSES.map((s) => {
          const label = BUSINESS_KINDS.find((k) => k.kind === s.kind)?.label ?? s.kind;
          const on = viewing === s.kind;
          return (
            <div key={s.kind} className={clsx("flex flex-col rounded-lg bg-surface p-4 ring-1", on ? "ring-sun-line" : "ring-line")}>
              <p className="text-sm font-semibold text-ink">{label}</p>
              <p className="mt-0.5 text-xs text-muted">{s.name}</p>
              <p className="mt-2 flex-1 text-sm text-ink-2">{s.about}</p>
              <button
                type="button"
                disabled={on || busy !== null}
                onClick={() => void go(s.kind)}
                className="mt-4 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
              >
                {on ? "Viewing now" : busy === s.kind ? "Opening…" : `View as ${label.toLowerCase()}`}
              </button>
            </div>
          );
        })}
      </div>
      {viewing && (
        <button
          type="button"
          onClick={() => void go("own")}
          disabled={busy !== null}
          className="mt-4 rounded-md px-3 py-2 text-sm font-medium text-ink ring-1 ring-line hover:bg-surface-2"
        >
          Back to my account
        </button>
      )}
      {problem && <p className="mt-3 text-sm text-danger">{problem}</p>}
    </div>
  );
}
