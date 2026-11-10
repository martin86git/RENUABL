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

  return (
    <section className="overflow-hidden rounded-[24px] bg-primary text-white shadow-[0_8px_30px_rgba(11,11,12,0.10)]">
      <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,34%)]">
        <div
          className={clsx(
            "flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-4",
            compact ? "px-5 py-4 sm:px-6" : "p-5 sm:p-6",
          )}
        >
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
              {pulse && (
                <span className="[&>*]:mt-0">
                  <DealPulseBadges clock={pulse.clock} heat={pulse.heat} />
                </span>
              )}
            </div>
          </div>
          <Kit figures={figures} compact={compact} />
        </div>

        {/* The roof, a third of the banner: the design on it, and the battery on its wall when there is one. */}
        <div className={clsx("relative bg-black/20", compact ? "min-h-[6.5rem]" : "min-h-[8.5rem]")}>
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
        </div>
      </div>
    </section>
  );
}

/**
 * The system as its kit (10 Nov 2026, Martin: a house didn't say at a glance what he needed; the panels and the battery
 * do): each part the deal knows, as its icon in the signal orange with its size and a few words under it.
 */
function Kit({ figures, compact }: { figures: BannerFigure[]; compact: boolean }) {
  if (!figures.length) return <p className="text-[13px] text-white/60">No system designed yet</p>;
  return (
    <dl className={clsx("flex flex-wrap", compact ? "gap-x-5 gap-y-2" : "gap-x-6 gap-y-3")}>
      {figures.map((f) => {
        const Icon = KIT_ICONS[f.label] ?? PanelIcon;
        return (
          <div key={f.label} className="flex min-w-0 items-center gap-2.5">
            <span
              className={clsx(
                "flex shrink-0 items-center justify-center rounded-full bg-white/10 text-sun-line ring-1 ring-white/15",
                compact ? "size-8" : "size-10",
              )}
              aria-hidden
            >
              <Icon className={compact ? "size-[18px]" : "size-[22px]"} />
            </span>
            <div className="min-w-0">
              <dt className="sr-only">{f.label}</dt>
              <dd className={clsx("tabular-nums leading-tight text-white", compact ? "text-[14px]" : "text-[16px]")}>
                {f.label === "EV charger" ? "EV charger" : f.value}
              </dd>
              {f.note && !compact && <dd className="max-w-[10rem] truncate text-[12px] text-white/60">{f.note}</dd>}
            </div>
          </div>
        );
      })}
    </dl>
  );
}

type IconProps = { className?: string };
const LINE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** The kit's icons, in the brand's line (a 24 box, 2-unit round-capped strokes, as the Marketplace's mark). */
function PanelIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...LINE} className={className}>
      <path d="M5 4h14l2 12H3z" />
      <path d="M4 10h16M9.7 4 9 16M14.3 4l.7 12" strokeWidth={1.5} />
      <path d="M12 16v4M8 20h8" />
    </svg>
  );
}
function BatteryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...LINE} className={className}>
      <rect x="6" y="4" width="12" height="17" rx="2.5" />
      <path d="M10 2h4" />
      <path d="M9 17h6M9 13.5h6" strokeWidth={2.4} />
    </svg>
  );
}
function InverterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...LINE} className={className}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="m13 7-3 5h4l-3 5" />
    </svg>
  );
}
function ChargerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...LINE} className={className}>
      <path d="M9 3v4M15 3v4" />
      <path d="M6 7h12v3a6 6 0 0 1-12 0z" />
      <path d="M12 16v5" />
    </svg>
  );
}
const KIT_ICONS: Record<string, (p: IconProps) => React.ReactNode> = {
  Solar: PanelIcon,
  Battery: BatteryIcon,
  Inverter: InverterIcon,
  "EV charger": ChargerIcon,
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full bg-white/10 px-3 text-[13px] tabular-nums text-white ring-1 ring-white/15">
      {children}
    </span>
  );
}
