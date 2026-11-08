"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Mail, MapPin, Phone } from "lucide-react";
import { ROOF_IMAGE } from "@/lib/domain/design/roof-design";
import { STAGE_LABELS, type Customer, type Job } from "@/lib/domain/design/crm";
import type { JobDrawing } from "@/lib/domain/design/job-card";
import type { DealPulse } from "@/lib/domain/design/deal-heat";
import { loadJobCard } from "@/lib/services/job-card";
import { dollars } from "@/lib/services/crm";
import { DealPulseBadges } from "./deal-pulse";
import { SolBadge } from "./sol-icon";

/** The banner's shape, wide and low: width over height. */
const BANNER_ASPECT = 3.2;

/**
 * The part of the roof picture the banner shows: the drawing's own crop (close on the panels) widened to the banner's
 * shape with room round it, kept inside the photo. With no drawing, the middle of the photo, where the address is.
 */
export function bannerView(viewBox: string | null): string {
  const W = ROOF_IMAGE.width;
  const H = ROOF_IMAGE.height;
  let cx = W / 2;
  let cy = H / 2;
  let w = W * 0.66;
  let h = w / BANNER_ASPECT;
  if (viewBox) {
    const [x, y, vw, vh] = viewBox.split(" ").map(Number);
    if ([x, y, vw, vh].every(Number.isFinite) && vw > 0 && vh > 0) {
      cx = x + vw / 2;
      cy = y + vh / 2;
      // Room round the panels, then the banner's shape.
      w = Math.max(vw * 1.5, vh * 1.5 * BANNER_ASPECT);
      h = w / BANNER_ASPECT;
    }
  }
  // Never wider or taller than the photo.
  if (w > W) {
    w = W;
    h = w / BANNER_ASPECT;
  }
  if (h > H) {
    h = H;
    w = h * BANNER_ASPECT;
  }
  const x = Math.min(Math.max(cx - w / 2, 0), W - w);
  const y = Math.min(Math.max(cy - h / 2, 0), H - h);
  return [x, y, w, h].map((n) => Math.round(n * 10) / 10).join(" ");
}

/**
 * The top of a deal (8 Nov 2026, Martin: the deal as a picture, not a database record): the roof from above across the
 * column, with the design drawn on it when there is one, and over its foot the customer, where, the stage, the price,
 * the deal's clock and heat, and the ways to reach them. Pressing the picture opens the designer over the page.
 */
export function DealBanner({
  job,
  customer,
  designVersion = 0,
  pulse,
  onDesign,
  onEmail,
  onCall,
  onSol,
  onPlace,
  compact = false,
}: {
  job: Job;
  customer: Customer;
  /** Changes whenever the design is saved: the banner then draws it again. */
  designVersion?: number;
  pulse: DealPulse | null;
  onDesign: (() => void) | null;
  onEmail: () => void;
  /** On a computer, the call is made on the phone with the note-taker listening (8 Nov 2026, Martin). */
  onCall: () => void;
  onSol: () => void;
  onPlace: () => void;
  /** A slim strip (8 Nov 2026, Martin: on any tab but Overview the tab's own work, an email say, belongs in the first fold). */
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
  const phone = customer.phone.replace(/\s/g, "");
  const where = job.address || customer.address;

  return (
    <section className="relative overflow-hidden rounded-[24px] bg-[#1f2937] shadow-[0_8px_30px_rgba(11,11,12,0.10)]">
      <div
        className={clsx(
          "relative flex flex-col justify-end transition-[min-height] duration-300",
          compact ? "min-h-[7rem]" : "min-h-[15rem] sm:aspect-[4/1] sm:min-h-0",
        )}
      >
        {picture ? (
          <svg
            viewBox={bannerView(drawing?.viewBox ?? null)}
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
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#3a4656,#1f2937_70%)]" />
        )}
        {/* Pressing the picture opens the designer; the words and buttons over it sit above this. */}
        {onDesign && (
          <button
            type="button"
            onClick={onDesign}
            className="absolute inset-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sun-line"
            aria-label={job.projectId ? "Open the design" : "Design this roof"}
          />
        )}
        {/* A soft fade at the foot so the words read on any roof. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
        {/* And from the left, where the name and its details sit (Martin: clearly visible on a busy roof). The design itself
            is opened by the orange round under the banner, or by pressing the picture. */}
        {/* A soft blur and a deep shade behind the words, easing away to the right so the design stays clear. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-full backdrop-blur-md [mask-image:linear-gradient(to_right,black_35%,transparent_65%)] sm:w-3/4" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-black/90 via-black/70 via-35% to-transparent sm:w-3/4" />
        {!placed && !compact && (
          <button
            type="button"
            onClick={onPlace}
            className="absolute right-4 top-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3.5 text-[13px] font-medium text-ink shadow-sm hover:bg-white"
          >
            <MapPin className="size-3.5 text-sun-line" aria-hidden />
            Find the address to see the roof
          </button>
        )}

        <div
          className={clsx(
            "pointer-events-none relative flex flex-wrap items-end justify-between gap-4",
            compact ? "px-5 py-3.5 sm:px-6" : "p-5 pt-16 sm:p-6",
          )}
        >
          <div className="min-w-0 text-white">
            <h1 className={clsx("truncate leading-tight tracking-tight", compact ? "text-[22px]" : "text-[26px] sm:text-[30px]")}>
              {customer.name}
            </h1>
            <p className="mt-0.5 truncate text-sm text-white/80">
              {where || "No address yet"}
              {job.title ? ` · ${job.title}` : ""}
            </p>
            <div className={clsx("pointer-events-auto flex flex-wrap items-center gap-2", compact ? "mt-2" : "mt-3")}>
              <Chip>{STAGE_LABELS[job.stage]}</Chip>
              {job.value != null && <Chip>{dollars(job.value)}</Chip>}
              {job.kw ? <Chip>{job.kw} kW</Chip> : null}
              {pulse && (
                <span className="[&>*]:mt-0">
                  <DealPulseBadges clock={pulse.clock} heat={pulse.heat} />
                </span>
              )}
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <Round
              label={customer.email ? `Email ${customer.firstName || "them"}` : "No email on file"}
              onClick={onEmail}
              off={!customer.email}
            >
              <Mail className="size-[18px]" aria-hidden />
            </Round>
            <Round
              label={phone ? `Call ${customer.phone} with the note-taker listening` : "No phone on file"}
              off={!phone}
              onClick={() => {
                // A phone dials; a computer opens the note-taker, and the call is made on the phone beside it.
                if (window.matchMedia("(pointer: coarse)").matches) window.location.href = `tel:${phone}`;
                else onCall();
              }}
            >
              <Phone className="size-[18px]" aria-hidden />
            </Round>
            <Round label="Ask Sol about this deal" onClick={onSol} dark>
              <SolBadge className="size-5" />
            </Round>
          </div>
        </div>
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full bg-white/15 px-3 text-[13px] tabular-nums text-white ring-1 ring-white/20 backdrop-blur">
      {children}
    </span>
  );
}

function Round({
  label,
  onClick,
  off = false,
  dark = false,
  children,
}: {
  label: string;
  onClick?: () => void;
  off?: boolean;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={off}
      aria-label={label}
      title={label}
      className={clsx(
        "flex size-11 items-center justify-center rounded-full shadow-sm",
        off ? "bg-white/30 text-white/60" : dark ? "bg-primary text-white hover:bg-forest" : "bg-white/90 text-ink hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}
