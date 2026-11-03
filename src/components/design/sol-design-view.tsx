"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowUpRight, Maximize2, PencilRuler, X } from "lucide-react";
import { ROOF_IMAGE } from "@/lib/domain/design/roof-design";
import type { JobDrawing } from "@/lib/domain/design/job-card";
import { designHref, type SolDesignShown } from "@/lib/domain/design/sol-designs";
import { loadJobCard, type JobCardView } from "@/lib/services/job-card";

type Mode = "layout" | "strings";
type Loaded = { card: JobCardView } | { problem: string } | null;

/** The system lines worth a glance in the chat, in this order, each as it reads in a line. */
const GLANCE: [label: string, say: (v: string) => string][] = [
  ["System size", (v) => v],
  ["Panel qty", (v) => (/^\d+$/.test(v) ? `${v} panels` : v)],
  ["Inverter", (v) => v],
  ["Battery storage", (v) => `${v} battery`],
];

/**
 * A roof design Sol shows in his chat (3 Nov 2026, Martin): the deal's panel layout, or its strings, drawn over the roof
 * photo as on the job card, read fresh from the job card (so only for someone who may see the deal, and as the design
 * is now), with the system in a line and **Open the design**. Pressed, the drawing opens full size.
 */
export function SolDesignView({ shown }: { shown: SolDesignShown }) {
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [mode, setMode] = useState<Mode>("layout");
  const [big, setBig] = useState(false);
  useEffect(() => {
    let live = true;
    void loadJobCard(shown.jobId).then((r) => {
      if (live) setLoaded(r.ok ? { card: r.card } : { problem: r.message });
    });
    return () => {
      live = false;
    };
  }, [shown.jobId]);
  useEffect(() => {
    if (!big) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setBig(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [big]);

  const card = loaded && "card" in loaded ? loaded.card : null;
  const drawing = card ? (mode === "strings" && card.strings ? card.strings : card.layout) : null;
  const picture = card?.roof
    ? `/api/design/roof?lat=${card.roof.lat.toFixed(6)}&lng=${card.roof.lng.toFixed(6)}&size=${ROOF_IMAGE.width}x${ROOF_IMAGE.height}`
    : null;
  const glance = card
    ? GLANCE.flatMap(([label, say]) => {
        const v = card.details.find((d) => d.label === label)?.value;
        return v ? [say(v)] : [];
      })
    : [];

  return (
    <figure className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <figcaption className="min-w-0">
          <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-muted">Roof design</span>
          <span className="block truncate text-sm font-medium text-ink">{shown.title}</span>
        </figcaption>
        {card?.strings && (
          <div className="inline-flex shrink-0 rounded-full bg-canvas p-0.5 text-[11px] ring-1 ring-line">
            {(["layout", "strings"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={clsx("rounded-full px-2.5 py-1", mode === m ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink")}
              >
                {m === "layout" ? "Layout" : "Strings"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="px-2 pb-2 pt-2">
        {!loaded ? (
          <div
            className="aspect-[16/10] w-full animate-pulse rounded-xl bg-canvas motion-reduce:animate-none"
            aria-label="Drawing the design"
          />
        ) : !drawing ? (
          "problem" in loaded ? (
            <p className="rounded-xl bg-canvas px-3 py-6 text-center text-xs text-muted">{loaded.problem}</p>
          ) : (
            // No design yet (3 Nov 2026, Martin): the way to start one, in one press.
            <div className="flex flex-col items-center gap-3 rounded-xl bg-canvas px-4 py-7 text-center">
              <p className="text-sm text-ink-2">No roof design yet.</p>
              <Link
                href={designHref(loaded.card.job.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-sun-line px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                <PencilRuler className="size-4" aria-hidden />
                Start the design
              </Link>
            </div>
          )
        ) : (
          <button
            type="button"
            onClick={() => setBig(true)}
            aria-label="Open the drawing full size"
            className="group relative block w-full cursor-zoom-in"
          >
            <DesignDrawing drawing={drawing} picture={picture} title={shown.title} small />
            <span className="absolute right-2 top-2 rounded-full bg-surface/90 p-1 text-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
              <Maximize2 className="size-3.5" aria-hidden />
            </span>
          </button>
        )}
      </div>
      {card && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-2.5">
          <p className="min-w-0 text-xs text-ink-2">
            {glance.length ? glance.join(" · ") : card.job.stage}
            {card.job.installDate && <span className="text-muted"> · installs {dayWords(card.job.installDate)}</span>}
          </p>
          {drawing && (
            <Link
              href={designHref(card.job.id)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-ink hover:opacity-90"
            >
              Open the design
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      )}
      {big && drawing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={shown.title}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/60 p-4 sm:p-10"
          onClick={() => setBig(false)}
        >
          <div
            className="relative max-h-full w-full max-w-5xl overflow-auto rounded-2xl bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              autoFocus
              onClick={() => setBig(false)}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-1.5 text-muted hover:bg-canvas"
            >
              <X className="size-4" aria-hidden />
            </button>
            <p className="pr-10 text-sm font-semibold text-ink">
              {shown.title} · {mode === "strings" ? "Strings" : "Panel layout"}
            </p>
            <div className="mt-3">
              <DesignDrawing drawing={drawing} picture={picture} title={shown.title} />
            </div>
            {mode === "strings" && card?.stringWords.length ? (
              <p className="mt-3 text-xs text-muted">{card.stringWords.join(" · ")}</p>
            ) : null}
          </div>
        </div>
      )}
    </figure>
  );
}

/** "Wed 4 Nov" for an ISO day, read as the day itself (no time zone shift). */
const dayWords = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function DesignDrawing({
  drawing,
  picture,
  title,
  small = false,
}: {
  drawing: JobDrawing;
  picture: string | null;
  title: string;
  small?: boolean;
}) {
  return (
    <svg
      viewBox={drawing.viewBox}
      className={clsx("block h-auto w-full rounded-xl bg-[#1f2937]", small && "max-h-72")}
      role="img"
      aria-label={`${title}: roof design`}
    >
      {picture && <image href={picture} x={0} y={0} width={ROOF_IMAGE.width} height={ROOF_IMAGE.height} />}
      {/* Made on the server from the design's numbers and fixed words only (jobDrawing). */}
      <g dangerouslySetInnerHTML={{ __html: drawing.marks }} />
    </svg>
  );
}
