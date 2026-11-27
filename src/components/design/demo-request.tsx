"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { DEMO_REQUEST, SALES_HERO } from "@/lib/domain/design/sales-page";
import { requestDemo } from "@/lib/services/billing";

/** The address that opens the Book a demo box as the front page loads: old demo links and emails land on it. */
export const DEMO_QUERY = "demo";

/**
 * Book a demo (21 Nov 2026, Martin, as Request a demo: a white pill beside Get started, quieter so it doesn't compete
 * with it; since 27 Nov 2026 the only demo there is: nobody opens a demo account themselves, "you either have to sign
 * up, or book a demo in"). It opens a short form over the page; what is sent goes to RENUABL's staff
 * (`/api/design/demo-request`). Escape, the cross or a press outside closes it. "pill" is the white one beside Get
 * started, "main" the large orange one on a dark slide, "bar" the small outlined one in the top bar. `auto` (one button
 * a page) opens the box when the page was reached with ?demo=1.
 */
export function DemoRequestButton({
  look = "pill",
  label,
  auto = false,
}: {
  look?: "pill" | "main" | "bar";
  label?: string;
  auto?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!auto || !new URLSearchParams(window.location.search).has(DEMO_QUERY)) return;
    // After the page has painted, so the box opens over it instead of with it.
    const t = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(t);
  }, [auto]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          "inline-flex items-center justify-center whitespace-nowrap rounded-full font-semibold",
          look === "pill" && "h-12 bg-surface px-7 text-[16px] text-ink shadow-sm ring-1 ring-line hover:ring-ink/40",
          look === "main" && "h-14 bg-sun-line px-8 text-[17px] text-white shadow-sm hover:brightness-105",
          look === "bar" && "h-8 px-3 text-[12px] text-ink ring-1 ring-line-strong hover:bg-surface sm:h-9 sm:px-4 sm:text-[13px]",
        )}
      >
        {label ?? SALES_HERO.demo}
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="theme-studio contents">
            <DemoRequestWindow onClose={() => setOpen(false)} />
          </div>,
          document.body,
        )}
    </>
  );
}

const field =
  "h-11 w-full rounded-xl bg-surface px-3 text-[16px] text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-sun-line";

function DemoRequestWindow({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", business: "", email: "", mobile: "", time: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    // The link's tags (utm_source, utm_campaign) go with it, so a demo booked from a wholesaler's email says so.
    const tags = new URLSearchParams(window.location.search);
    const a = await requestDemo({ ...form, utm_source: tags.get("utm_source") ?? "", utm_campaign: tags.get("utm_campaign") ?? "" });
    setBusy(false);
    setState({ ok: a.ok, message: a.message ?? (a.ok ? "" : "Please try again.") });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-request-title"
        className="w-full max-w-md rounded-[28px] bg-surface p-6 text-ink shadow-lift sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="demo-request-title" className="text-[22px] font-semibold tracking-[-0.02em]">
            {DEMO_REQUEST.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={DEMO_REQUEST.close}
            className="tap-area -mr-1 rounded-full p-1 text-muted hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {state?.ok ? (
          <p className="mt-4 text-[15px] text-positive" role="status">
            {state.message}
          </p>
        ) : (
          <form onSubmit={(e) => void send(e)} className="mt-2 space-y-2.5">
            <p className="pb-2 text-[14px] leading-relaxed text-ink-2">{DEMO_REQUEST.sub}</p>
            <input
              className={field}
              placeholder={DEMO_REQUEST.name}
              autoComplete="name"
              required
              value={form.name}
              onChange={set("name")}
              autoFocus
            />
            <input
              className={field}
              placeholder={DEMO_REQUEST.business}
              autoComplete="organization"
              required
              value={form.business}
              onChange={set("business")}
            />
            <input
              className={field}
              placeholder={DEMO_REQUEST.email}
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={set("email")}
            />
            <input
              className={field}
              placeholder={DEMO_REQUEST.mobile}
              type="tel"
              autoComplete="tel"
              value={form.mobile}
              onChange={set("mobile")}
            />
            <input className={field} placeholder={DEMO_REQUEST.time} value={form.time} onChange={set("time")} maxLength={120} />
            <textarea className={`${field} h-20 py-2`} placeholder={DEMO_REQUEST.note} value={form.note} onChange={set("note")} />
            <p className="px-1 pb-1 text-[12.5px] leading-relaxed text-muted">
              {DEMO_REQUEST.consent}{" "}
              <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-ink">
                {DEMO_REQUEST.privacy}
              </Link>
            </p>
            <button
              disabled={busy}
              className="h-12 w-full rounded-full bg-sun-line text-[16px] font-semibold text-white hover:brightness-105 disabled:bg-surface-2 disabled:text-muted"
            >
              {busy ? DEMO_REQUEST.sending : DEMO_REQUEST.send}
            </button>
            {state && !state.ok && (
              <p className="text-[14px] text-danger" role="alert">
                {state.message}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
