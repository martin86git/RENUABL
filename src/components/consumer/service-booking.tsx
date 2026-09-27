"use client";

import { ArrowRight, Camera, Check, Loader2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { RadioGroup } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { Button, ButtonLink, Card, StatRow, cn } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import { SERVICE_REASONS, SERVICE_WINDOWS, mayBeWarranty, type ServiceReasonId } from "@/lib/domain/service";
import type { DayAvailability } from "@/lib/domain/types";
import { requestService, type ServiceBooking as Booking } from "@/lib/services/home";

/** Post-purchase: book a service visit with the household's installer. */
export function ServiceBooking({ availability, installer }: { availability: DayAvailability[]; installer: string }) {
  const [reason, setReason] = useState<ServiceReasonId | null>(null);
  const [details, setDetails] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [windowId, setWindowId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const timesRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const dates = useMemo(() => availability.map((a) => a.date), [availability]);
  const day = availability.find((a) => a.date === date);
  const window = SERVICE_WINDOWS.find((w) => w.id === windowId && day?.windows.includes(w.id));
  const reasonLabel = SERVICE_REASONS.find((r) => r.id === reason)?.label;
  const ready = Boolean(reason && day && window && (reason !== "other" || details.trim()));

  function addPhotos(files: FileList) {
    const added = Array.from(files).map((f) => URL.createObjectURL(f));
    urls.current.push(...added);
    setPhotos((p) => [...p, ...added].slice(0, 6));
  }

  async function submit() {
    if (!reason || !date || !windowId) return;
    setBusy(true);
    setBooking(await requestService({ reason, details: details.trim(), photos: photos.length, date, windowId }));
    setBusy(false);
  }

  if (booking) {
    const w = SERVICE_WINDOWS.find((x) => x.id === booking.windowId);
    return (
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest text-white">
          <Check className="h-7 w-7" strokeWidth={2.2} />
        </span>
        <h1 className="mt-6 text-[32px] font-normal tracking-[-0.035em]">Service booked.</h1>
        <p className="mt-1 text-[15px] text-muted">Reference {booking.reference}</p>
        <Card className="mt-6 px-5 text-left">
          <div className="divide-y divide-line">
            <StatRow label="What" value={SERVICE_REASONS.find((r) => r.id === booking.reason)?.label} />
            <StatRow
              label="When"
              value={`${formatDate(booking.date, { weekday: "short", day: "numeric", month: "short" })} · ${w?.detail}`}
            />
            <StatRow label="Who" value={booking.installer} />
          </div>
        </Card>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          We&apos;ll text you the day before, and again when your technician is on the way. Need to change it? Just reply to the message.
        </p>
        <ButtonLink href="/my" size="lg" className="mt-6 w-full sm:w-auto">
          Back to My RENUABL <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </ButtonLink>
      </div>
    );
  }

  const summary = (
    <Card className="p-5">
      <p className="text-[15px] text-ink">Your service visit</p>
      <div className="mt-2 divide-y divide-line">
        <StatRow label="Installation partner" value={installer} />
        <StatRow label="Reason" value={reasonLabel ?? <span className="text-muted">Choose a reason</span>} />
        <StatRow
          label="When"
          value={
            day && window ? (
              `${formatDate(day.date, { weekday: "short", day: "numeric", month: "short" })} · ${window.detail}`
            ) : (
              <span className="text-muted">Pick a time</span>
            )
          }
        />
      </div>
      <p className="mt-3 rounded-xl bg-sage/50 px-3.5 py-2.5 text-[12.5px] leading-snug text-forest">
        {reason && !mayBeWarranty(reason)
          ? "Your health check price is confirmed with you before the visit is locked in."
          : "Warranty repairs are free. If it isn't a warranty issue, we'll confirm any call-out fee with you before the visit is locked in."}
      </p>
      <Button size="lg" className="mt-4 w-full" disabled={!ready || busy} onClick={() => void submit()}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Book service"}
      </Button>
      {!ready && <p className="mt-2 text-center text-[12px] text-muted">Choose a reason and a time to continue.</p>}
    </Card>
  );

  return (
    <div>
      <Link href="/my/support" className="tap-area mb-4 inline-flex items-center gap-2 text-[13px] text-ink-2 hover:text-ink lg:hidden">
        ← Support
      </Link>
      <p className="text-[13px] text-muted">Book a service</p>
      <h1 className="mt-2 text-[32px] font-normal tracking-[-0.035em] sm:text-[40px]">Let&apos;s get it sorted.</h1>
      <p className="mt-1 max-w-xl text-[15px] text-muted">Book {installer}, your installation partner, at a time that suits you.</p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-[15px] text-ink">What&apos;s happening?</p>
            <RadioGroup.Root
              aria-label="Reason for service"
              value={reason ?? ""}
              onValueChange={(v) => setReason(v as ServiceReasonId)}
              className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {SERVICE_REASONS.map((r) => (
                <RadioGroup.Item
                  key={r.id}
                  value={r.id}
                  className="rounded-2xl px-4 py-3 text-left ring-1 ring-line transition hover:ring-line-strong data-[state=checked]:ring-[1.5px] data-[state=checked]:ring-ink"
                >
                  <span className="block text-[14px] text-ink">{r.label}</span>
                  <span className="block text-[12px] text-muted">{r.hint}</span>
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
          </Card>

          <Card className="p-5">
            <label htmlFor="service-details" className="text-[15px] text-ink">
              Anything else we should know?
            </label>
            <p className="text-[12.5px] text-muted">
              {reason === "other" ? "Required — a sentence is plenty." : "Optional. Photos of any error codes help a lot."}
            </p>
            <textarea
              id="service-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="e.g. The inverter shows a red light since yesterday"
              className="mt-3 w-full resize-none rounded-xl bg-canvas px-4 py-3 text-[15px] outline-none ring-1 ring-line placeholder:text-muted/70 focus:ring-ink/40"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {photos.map((src, i) => (
                <span key={src} className="relative h-16 w-16 overflow-hidden rounded-lg ring-1 ring-line">
                  <Image src={src} fill sizes="64px" alt={`Photo ${i + 1}`} className="object-cover" unoptimized />
                  <button
                    type="button"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => setPhotos((p) => p.filter((x) => x !== src))}
                    className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {photos.length < 6 && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex h-16 items-center gap-2 rounded-lg border border-dashed border-line-strong px-4 text-[13px] text-ink-2 hover:text-ink"
                >
                  <Camera className="h-4 w-4" strokeWidth={1.6} /> Add photos
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-4 text-[15px] text-ink">Pick a time</p>
            <MonthCalendar
              available={dates}
              value={date}
              onChange={(d) => {
                setDate(d);
                const next = availability.find((a) => a.date === d);
                if (!next?.windows.includes(windowId ?? "")) setWindowId(null);
                if (typeof matchMedia !== "undefined" && !matchMedia("(min-width: 1024px)").matches) {
                  timesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }}
            />
            <div ref={timesRef} className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Visit window">
              {SERVICE_WINDOWS.map((w) => {
                const open = Boolean(day?.windows.includes(w.id));
                const selected = windowId === w.id && open;
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!open}
                    onClick={() => setWindowId(w.id)}
                    className={cn(
                      "rounded-2xl px-4 py-3 text-left transition",
                      selected ? "bg-primary text-primary-ink" : "bg-surface ring-1 ring-line hover:ring-line-strong",
                      !open && "opacity-35",
                    )}
                  >
                    <span className="block text-[14px]">{w.label}</span>
                    <span className={cn("block text-[12px]", selected ? "text-primary-ink/70" : "text-muted")}>
                      {open ? w.detail : "Unavailable"}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6">{summary}</div>
      </div>
    </div>
  );
}
