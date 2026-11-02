"use client";

import clsx from "clsx";
import { Check, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { LIVE_NOTE, LIVE_POLL_MS, isLiveToken, type LiveDesign } from "@/lib/domain/design/live";
import { ROOF_IMAGE } from "@/lib/domain/design/roof-design";
import { chooseLive, liveRoofHref, watchLive, type LiveForCustomer } from "@/lib/services/live";

/**
 * The customer's side of live co-design (2 Nov 2026, Martin): their roof as the business draws it, the designs side by
 * side to switch between, the live figures, and "I'd like this one". It asks for the design every `LIVE_POLL_MS`
 * while the page is in view. Nothing here can change the design: only the customer's choice goes back.
 */

const money = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const head = "text-[10px] font-medium uppercase tracking-[0.14em] text-muted";

/**
 * The part of the picture to show: every design's panels with room around them (so switching designs doesn't move
 * the view), at the picture's own shape and never smaller than `MIN_VIEW` pixels across, kept inside the picture.
 */
const MIN_VIEW = 200;
function viewOf(designs: LiveDesign[]): { x: number; y: number; w: number; h: number } {
  const all = designs.flatMap((d) => d.outlines.flat());
  const { width: W, height: H } = ROOF_IMAGE;
  if (!all.length) return { x: 0, y: 0, w: W, h: H };
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const w = Math.min(W, Math.max(MIN_VIEW, (Math.max(...xs) - Math.min(...xs)) * 1.8, ((Math.max(...ys) - Math.min(...ys)) * 1.8 * W) / H));
  const h = (w * H) / W;
  return { x: Math.min(W - w, Math.max(0, cx - w / 2)), y: Math.min(H - h, Math.max(0, cy - h / 2)), w, h };
}

function Roof({ token, design, designs }: { token: string; design: LiveDesign | undefined; designs: LiveDesign[] }) {
  const [broken, setBroken] = useState(false);
  const v = viewOf(designs);
  // Lines stay the same weight on screen however close the view is.
  const line = (0.8 * v.w) / ROOF_IMAGE.width;
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-surface-2"
      style={{ aspectRatio: `${ROOF_IMAGE.width} / ${ROOF_IMAGE.height}` }}
    >
      <svg
        viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}
        className="absolute inset-0 size-full"
        role="img"
        aria-label="Your roof from above, with the panels"
      >
        {!broken && (
          <image
            href={liveRoofHref(token)}
            x={0}
            y={0}
            width={ROOF_IMAGE.width}
            height={ROOF_IMAGE.height}
            onError={() => setBroken(true)}
          />
        )}
        {design?.outlines.map((o, i) => (
          <polygon
            key={i}
            points={o.map((p) => p.join(",")).join(" ")}
            fill="rgba(20,24,32,0.85)"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth={Math.max(0.25, line)}
          />
        ))}
      </svg>
      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
        <Radio className="size-3 animate-pulse text-sun-line" aria-hidden /> Live
      </span>
    </div>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className={head}>{label}</p>
      <p className={clsx("mt-1 tabular-nums", strong ? "text-2xl font-semibold text-ink" : "text-lg text-ink")}>{value}</p>
    </div>
  );
}

export function LiveView({ token }: { token: string }) {
  const [live, setLive] = useState<LiveForCustomer | null>(null);
  const [missing, setMissing] = useState(!isLiveToken(token));
  const [looking, setLooking] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!isLiveToken(token)) return;
    let gone = false;
    const ask = (first = false) => {
      if (!first && document.visibilityState !== "visible") return;
      void watchLive(token).then((res) => {
        if (gone) return;
        if (res.ok) setLive(res);
        // A link that was never there; a dropped connection mid-call just tries again.
        else if (first) setMissing(true);
      });
    };
    ask(true);
    const timer = window.setInterval(() => ask(), LIVE_POLL_MS);
    const back = () => ask();
    document.addEventListener("visibilitychange", back);
    return () => {
      gone = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", back);
    };
  }, [token]);

  if (missing)
    return (
      <main className="theme-studio mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center bg-canvas px-6 text-center">
        <p className="text-lg font-medium text-ink">This live design isn&apos;t available.</p>
        <p className="mt-2 text-sm text-ink-2">The link may have ended. Ask the business you&apos;re speaking with for a new one.</p>
      </main>
    );
  if (!live)
    return (
      <main className="theme-studio flex min-h-dvh items-center justify-center bg-canvas">
        <p className="text-sm text-muted">Opening your design…</p>
      </main>
    );

  const designs = live.snapshot?.designs ?? [];
  // The design the customer is looking at: their own pick while they look, else the one the business has open.
  const shownAt = looking !== null && designs.some((d) => d.at === looking) ? looking : (live.snapshot?.active ?? designs[0]?.at);
  const shown = designs.find((d) => d.at === shownAt);
  const chosen = designs.find((d) => d.at === live.choice);

  const choose = async (at: number) => {
    setSending(true);
    setProblem(null);
    const res = await chooseLive(token, at);
    setSending(false);
    if (res.ok) setLive({ ...live, choice: res.choice });
    else setProblem(res.message);
  };

  return (
    <main className="theme-studio min-h-dvh bg-canvas">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <p className={head}>{live.business}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Your design, live.</h1>
        <p className="mt-1 text-sm text-ink-2">
          {live.open ? "We're drawing it now. It changes here as we go." : "This live session has ended. Your proposal will follow."}
        </p>

        <div className="mt-5">
          {designs.length ? (
            <Roof token={token} design={shown} designs={designs} />
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-surface-2 text-sm text-muted">
              Waiting for the first design…
            </div>
          )}
        </div>

        {designs.length > 1 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Designs">
            {designs.map((d) => (
              <button
                key={d.at}
                role="tab"
                aria-selected={d.at === shownAt}
                onClick={() => setLooking(d.at)}
                className={clsx(
                  "tap-area shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
                  d.at === shownAt ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-ink hover:border-ink-2",
                )}
              >
                {d.name}
                {d.at === live.choice && <Check className="ml-1.5 inline size-3.5" aria-label="your choice" />}
              </button>
            ))}
          </div>
        )}

        {shown && (
          <section className="mt-5 rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm text-ink-2">
              {shown.kw.toFixed(2)} kW · {shown.panels} panels{shown.panelName ? ` · ${shown.panelName}` : ""}
              {shown.batteryKwh > 0 ? ` · ${shown.batteryKwh} kWh battery` : ""}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-5 empty:hidden sm:grid-cols-4">
              {shown.youPay !== null && <Figure label="You pay, after STCs" value={money(shown.youPay)} strong />}
              {shown.saving !== null && shown.saving > 0 && (
                <Figure label="Saves about, a year" value={money(Math.floor(shown.saving / 50) * 50)} strong={shown.youPay === null} />
              )}
              {shown.payback !== null && shown.payback > 0 && (
                <Figure label="Pays for itself in" value={`about ${shown.payback.toFixed(1)} years`} />
              )}
              {shown.billNow !== null && shown.billAfter !== null && (
                <Figure label="Bill a year" value={`${money(shown.billNow)} → ${money(Math.max(0, shown.billAfter))}`} />
              )}
            </div>
            {live.open && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {live.choice === shown.at ? (
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-ink">
                    <Check className="size-4 text-sun-line" aria-hidden /> You&apos;d like this one. We&apos;ll send your proposal to
                    confirm it.
                  </p>
                ) : (
                  <button
                    onClick={() => void choose(shown.at)}
                    disabled={sending}
                    className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white disabled:bg-surface-2 disabled:text-muted"
                  >
                    {sending ? "Sending…" : "I'd like this one"}
                  </button>
                )}
                {chosen && chosen.at !== shown.at && <p className="text-xs text-muted">Your choice so far: {chosen.name}</p>}
              </div>
            )}
            {problem && <p className="mt-2 text-sm text-danger">{problem}</p>}
          </section>
        )}

        <p className="mt-5 text-xs leading-relaxed text-muted">{LIVE_NOTE}</p>
      </div>
    </main>
  );
}
