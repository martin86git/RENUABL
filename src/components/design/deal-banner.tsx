"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { MapPin } from "lucide-react";
import { ROOF_IMAGE } from "@/lib/domain/design/roof-design";
import { STAGE_LABELS, type Customer, type Job } from "@/lib/domain/design/crm";
import type { JobDrawing } from "@/lib/domain/design/job-card";
import type { DealPulse } from "@/lib/domain/design/deal-heat";
import type { BannerFigure } from "@/lib/domain/design/system-summary";
import { loadJobCard } from "@/lib/services/job-card";
import { dollars, shortDate } from "@/lib/services/crm";
import { DealPulseBadges } from "./deal-pulse";

/** The banner's shape, wide and low: width over height. */
const BANNER_ASPECT = 3.2;

/**
 * The part of the roof picture the banner shows: the drawing's own crop (close on the panels) widened to the banner's
 * shape with room round it, kept inside the photo. With no drawing, the middle of the photo, where the address is.
 */
export function bannerView(viewBox: string | null, aspect = BANNER_ASPECT, room = 1.5): string {
  const W = ROOF_IMAGE.width;
  const H = ROOF_IMAGE.height;
  let cx = W / 2;
  let cy = H / 2;
  let w = W * 0.66;
  let h = w / aspect;
  if (viewBox) {
    const [x, y, vw, vh] = viewBox.split(" ").map(Number);
    if ([x, y, vw, vh].every(Number.isFinite) && vw > 0 && vh > 0) {
      cx = x + vw / 2;
      cy = y + vh / 2;
      // Room round the panels, then the banner's shape.
      w = Math.max(vw * room, vh * room * aspect);
      h = w / aspect;
    }
  }
  // Never wider or taller than the photo.
  if (w > W) {
    w = W;
    h = w / aspect;
  }
  if (h > H) {
    h = H;
    w = h * aspect;
  }
  const x = Math.min(Math.max(cx - w / 2, 0), W - w);
  const y = Math.min(Math.max(cy - h / 2, 0), H - h);
  return [x, y, w, h].map((n) => Math.round(n * 10) / 10).join(" ");
}

/**
 * The top of a deal (10 Nov 2026, Martin: the picture across the whole column had stopped telling him anything; the
 * banner should say something useful, the system's size, panels and storage, with the roof as a third of it). Down the
 * left on graphite: who it's for, where, the stage, the price, the deal's clock and heat, then the system in figures
 * (`bannerFigures`). On the right, the roof from above with its design drawn on it, and when the design has a battery,
 * a wall with the battery on it and its kWh. Pressing the roof opens the designer over the page.
 */
export function DealBanner({
  job,
  customer,
  designVersion = 0,
  pulse,
  figures,
  onDesign,
  onPlace,
  compact = false,
}: {
  job: Job;
  customer: Customer;
  /** Changes whenever the design is saved: the banner then draws it again. */
  designVersion?: number;
  pulse: DealPulse | null;
  /** The system in figures, from the deal's system details. */
  figures: BannerFigure[];
  onDesign: (() => void) | null;
  onPlace: () => void;
  /** Slimmer, without the figures (8 Nov 2026, Martin: on any tab but the deal's own the tab's work belongs in the first fold). */
  compact?: boolean;
}) {
  const placed = job.lat !== null && job.lng !== null;
  const [drawing, setDrawing] = useState<JobDrawing | null>(null);
  useEffect(() => {
    if (!job.projectId) return;
    let gone = false;
    void loadJobCard(job.id).then((r) => {
      if (!gone && r.ok) setDrawing(r.card.layout ?? null);
    });
    return () => {
      gone = true;
    };
  }, [job.id, job.projectId, designVersion]);

  const picture = placed
    ? `/api/design/roof?lat=${job.lat!.toFixed(6)}&lng=${job.lng!.toFixed(6)}&size=${ROOF_IMAGE.width}x${ROOF_IMAGE.height}`
    : null;
  const where = job.address || customer.address;
  const battery = figures.find((f) => f.label === "Battery");

  return (
    <section className="overflow-hidden rounded-[24px] bg-primary text-white shadow-[0_8px_30px_rgba(11,11,12,0.10)]">
      <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,34%)]">
        <div className={clsx("flex min-w-0 flex-col justify-between gap-4", compact ? "px-5 py-4 sm:px-6" : "p-5 sm:p-6")}>
          <div className="min-w-0">
            <h1 className={clsx("truncate leading-tight tracking-tight", compact ? "text-[21px]" : "text-[26px] sm:text-[28px]")}>
              {customer.name}
            </h1>
            <p className="mt-0.5 truncate text-sm text-white/75">
              {where || "No address yet"}
              {job.title ? ` · ${job.title}` : ""}
            </p>
            <div className={clsx("flex flex-wrap items-center gap-2", compact ? "mt-2" : "mt-3")}>
              <Chip>{STAGE_LABELS[job.stage]}</Chip>
              {job.value != null && <Chip>{dollars(job.value)}</Chip>}
              {job.installDate && <Chip>Installing {shortDate(job.installDate)}</Chip>}
              {compact && figures[0] && <Chip>{figures[0].value}</Chip>}
              {pulse && (
                <span className="[&>*]:mt-0">
                  <DealPulseBadges clock={pulse.clock} heat={pulse.heat} />
                </span>
              )}
            </div>
          </div>
          {!compact &&
            (figures.length ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-white/10 pt-4 sm:grid-cols-4">
                {figures.map((f) => (
                  <div key={f.label} className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/55">{f.label}</dt>
                    <dd className="mt-1 text-[20px] leading-none tabular-nums tracking-tight text-sun-line">{f.value}</dd>
                    {f.note && (
                      <dd className="mt-1 truncate text-xs text-white/65" title={f.note}>
                        {f.note}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            ) : (
              <p className="border-t border-white/10 pt-4 text-sm text-white/65">
                No system yet. {onDesign ? "Design the roof and its figures show here." : "Give the deal an address to design it."}
              </p>
            ))}
        </div>

        {/* The roof, a third of the banner: the design on it, and the battery on its wall when there is one. */}
        <div className={clsx("relative bg-black/20", compact ? "min-h-[6.5rem]" : "min-h-[11rem]")}>
          {picture ? (
            <svg
              viewBox={bannerView(drawing?.viewBox ?? null, 1.5, 1.25)}
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 h-full w-full"
              role="img"
              aria-label={drawing ? "The roof with its design" : "The roof from above"}
            >
              <image href={picture} x={0} y={0} width={ROOF_IMAGE.width} height={ROOF_IMAGE.height} />
              {/* Made on the server from the design's numbers and fixed words only (jobDrawing). */}
              {drawing && <g dangerouslySetInnerHTML={{ __html: drawing.marks }} />}
            </svg>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <button
                type="button"
                onClick={onPlace}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3.5 text-[13px] font-medium text-ink shadow-sm hover:bg-white"
              >
                <MapPin className="size-3.5 text-sun-line" aria-hidden />
                Find the address to see the roof
              </button>
            </div>
          )}
          {picture && onDesign && (
            <button
              type="button"
              onClick={onDesign}
              title={job.projectId ? "Open the design" : "Design this roof"}
              className="absolute inset-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sun-line"
              aria-label={job.projectId ? "Open the design" : "Design this roof"}
            />
          )}
          {battery && !compact && <BatteryWall kwh={battery.value} />}
        </div>
      </div>
    </section>
  );
}

/** A wall with the battery on it, as the house would have it, and its storage: shown over the roof when there is one. */
function BatteryWall({ kwh }: { kwh: string }) {
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2.5 rounded-2xl bg-black/60 py-2 pl-2 pr-3.5 ring-1 ring-white/15 backdrop-blur">
      <svg viewBox="0 0 34 44" className="h-11 w-[34px]" aria-hidden>
        {/* The wall: a few courses of render. */}
        <rect x="0" y="0" width="34" height="44" rx="4" fill="rgb(255 255 255 / 0.10)" />
        <path d="M0 11h34M0 22h34M0 33h34" stroke="rgb(255 255 255 / 0.10)" strokeWidth="1" />
        {/* The battery on it, its charge in the signal orange. */}
        <rect x="9" y="7" width="16" height="30" rx="3" fill="#f4f4f5" />
        <rect x="12" y="20" width="10" height="14" rx="1.5" fill="var(--sun-line)" />
        <rect x="12" y="10" width="10" height="2" rx="1" fill="rgb(11 11 12 / 0.25)" />
      </svg>
      <div>
        <p className="text-[15px] leading-none tabular-nums text-white">{kwh}</p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/60">On the wall</p>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full bg-white/10 px-3 text-[13px] tabular-nums text-white ring-1 ring-white/15">
      {children}
    </span>
  );
}
