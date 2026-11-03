"use client";

import clsx from "clsx";
import { Check, ImageIcon, X } from "lucide-react";
import { useState } from "react";
import { capturedWords, offersOf } from "@/lib/domain/design/nearmap";
import { chooseImagery, fetchNearmap, loadImagery, type NearmapSurvey, type RoofImagery } from "@/lib/services/nearmap";

/**
 * The roof picture's menu in the designer (3 Nov 2026, as Primero's "Change picture"): Google's picture, any Nearmap
 * capture the business has fetched for this roof, and Nearmap's other captures here, each fetched on a press (about
 * thirty tiles of the plan) and kept, so switching between kept pictures costs nothing. It also says what this Nearmap
 * plan reaches at the roof (heights, true ortho, 3D, obliques): the test of whether a bigger package is needed.
 */
export function PictureMenu({
  lat,
  lng,
  imagery,
  onChange,
}: {
  lat: number;
  lng: number;
  imagery: RoofImagery;
  onChange: (next: RoofImagery) => void;
}) {
  const [open, setOpen] = useState(false);
  const [surveys, setSurveys] = useState<NearmapSurvey[] | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const inUse = imagery.kept.find((k) => k.survey === imagery.use);
  const label = inUse ? `Nearmap · ${capturedWords(inUse.captured)}` : "Google";

  const show = async () => {
    setOpen(!open);
    if (open || !imagery.ready || surveys !== undefined) return;
    const res = await loadImagery(lat, lng, true);
    setSurveys(res.ok ? (res.surveys ?? null) : null);
  };
  const fetchOne = async (survey?: string) => {
    setBusy(survey ?? "newest");
    setProblem(null);
    const res = await fetchNearmap(lat, lng, survey);
    setBusy(null);
    if (res.ok) onChange({ ...imagery, use: res.use, kept: res.kept });
    else setProblem(res.message);
  };
  const choose = async (use: string) => {
    if (use === imagery.use) return;
    setBusy(use);
    const res = await chooseImagery(lat, lng, use);
    setBusy(null);
    if (res.ok) onChange({ ...imagery, use: res.use, kept: res.kept });
    else setProblem(res.message);
  };
  const newest = surveys?.[0];
  const offers = newest ? offersOf(newest.resources) : null;
  const row = "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-surface-2";

  return (
    <div className="relative">
      {/* Which picture is under the design, and the button that calls on Nearmap where Google's isn't good enough. */}
      <div className="flex items-center gap-1 rounded-full bg-surface/90 p-1 shadow-lift ring-1 ring-line backdrop-blur-md">
        <button
          type="button"
          onClick={() => void choose("google")}
          title={inUse ? "Go back to Google's picture" : "Google's picture is in use"}
          className={clsx("h-7 rounded-full px-2.5 text-xs", inUse ? "text-ink-2 hover:text-ink" : "bg-surface-2 font-medium text-ink")}
        >
          Google
        </button>
        <button
          type="button"
          onClick={() => void show()}
          aria-expanded={open}
          title="Pick a Nearmap picture from the last two years"
          className={clsx(
            "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
            inUse ? "bg-primary text-primary-ink" : "bg-primary/90 text-primary-ink hover:bg-primary",
          )}
        >
          <ImageIcon className="size-3.5" aria-hidden /> {inUse ? label : "Nearmap"}
        </button>
      </div>
      {open && (
        <div className="absolute bottom-11 right-0 w-[min(20rem,calc(100vw-2rem))] rounded-lg bg-surface p-2 shadow-[var(--shadow-lift)] ring-1 ring-line">
          <div className="flex items-center justify-between px-2.5 pb-1 pt-1">
            <p className="text-sm font-medium text-ink">Nearmap pictures</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-ink">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <p className="px-2.5 pb-1.5 text-xs text-muted">
            The last two years of this roof. A picture is fetched once and kept, so going back to it costs nothing.
          </p>
          {imagery.kept
            .filter((k) => !surveys?.some((s) => s.id === k.survey))
            .map((k) => (
              <button key={k.survey} type="button" className={row} onClick={() => void choose(k.survey)}>
                <span>{capturedWords(k.captured)}</span>
                {imagery.use === k.survey ? (
                  <Check className="size-3.5 text-sun-line" aria-label="in use" />
                ) : (
                  <span className="text-muted">Kept</span>
                )}
              </button>
            ))}
          {!imagery.ready ? (
            <p className="px-2.5 py-2 text-xs text-muted">Nearmap isn&apos;t connected to RENUABL yet.</p>
          ) : surveys === undefined ? (
            <p className="px-2.5 py-2 text-xs text-muted">Asking Nearmap what it has here…</p>
          ) : surveys === null ? (
            <p className="px-2.5 py-2 text-xs text-muted">Nearmap couldn&apos;t be reached. Try again shortly.</p>
          ) : !surveys.length ? (
            <p className="px-2.5 py-2 text-xs text-muted">Nearmap has no picture of this roof from the last two years.</p>
          ) : (
            <>
              <div className="max-h-56 overflow-y-auto">
                {surveys.map((s) => {
                  const kept = imagery.kept.some((k) => k.survey === s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={row}
                      disabled={busy !== null}
                      onClick={() => void (kept ? choose(s.id) : fetchOne(s.id))}
                    >
                      <span>{capturedWords(s.captured)}</span>
                      {imagery.use === s.id ? (
                        <Check className="size-3.5 text-sun-line" aria-label="in use" />
                      ) : (
                        <span className="text-muted">{busy === s.id ? "Fetching…" : kept ? "Kept" : "Fetch"}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {offers && (
                <div className="mt-1 border-t border-line px-2.5 pt-2 text-xs">
                  <p className="text-ink-2">What your Nearmap plan reaches here ({capturedWords(newest!.captured)}):</p>
                  <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {(
                      [
                        ["Roof heights", offers.heights],
                        ["True ortho", offers.trueOrtho],
                        ["3D mesh", offers.mesh],
                        ["Side views", offers.obliques],
                      ] as const
                    ).map(([name, yes]) => (
                      <li key={name} className={yes ? "text-ink" : "text-muted"}>
                        {yes ? "✓" : "–"} {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {problem && <p className="px-2.5 pt-1.5 text-xs text-danger">{problem}</p>}
        </div>
      )}
    </div>
  );
}
