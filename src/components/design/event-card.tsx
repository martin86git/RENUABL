"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlignLeft, CalendarPlus, Download, ExternalLink, MapPin, X } from "lucide-react";
import clsx from "clsx";
import { loadInstallEvent, type InstallEvent } from "@/lib/services/after-sale";
import { PATHS, ui } from "./design-shell";

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const time = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
};

/**
 * A booked installation's event card for the installer, laid out like a Google Calendar event: the title, the day and
 * hours, where it is, and the job sheet under its headings (what to collect from which wholesaler and its SO number,
 * the system to be installed, who to see on site). Never for the customer, and it invites no one. From it the business puts the
 * event in its own calendar: a pre-filled Google Calendar event, or an .ics file for Outlook or Apple Calendar.
 * RENUABL can't see the business's Google Calendar, so the button is always offered.
 */
export function EventCard({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [data, setData] = useState<{ event: InstallEvent; customer: { name: string; phone: string } } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    void loadInstallEvent(jobId).then((res) => {
      if (gone) return;
      if (res.ok) setData(res);
      else setProblem(res.message);
    });
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      gone = true;
      window.removeEventListener("keydown", esc);
    };
  }, [jobId, onClose]);

  const download = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([data.event.ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `install-${data.event.date}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const row = "flex gap-4 px-5 py-2.5";
  const icon = "mt-0.5 size-[18px] shrink-0 text-muted";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 p-4 sm:p-10" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={data?.event.title ?? "Installation"}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.4)] ring-1 ring-line"
      >
        <div className="flex justify-end gap-1 px-3 pt-3">
          <Link
            href={`${PATHS.deals}/${jobId}`}
            className="inline-flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
            title="Open the deal"
          >
            <ExternalLink className="size-[18px]" />
            <span className="sr-only">Open the deal</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
            title="Close"
          >
            <X className="size-[18px]" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        {problem && <p className="px-5 pb-5 text-sm text-warning">{problem}</p>}
        {!data && !problem && <p className="px-5 pb-5 text-sm text-muted">Loading…</p>}
        {data && (
          <>
            <div className="flex gap-4 px-5 pb-3">
              <span className="mt-1.5 size-3.5 shrink-0 rounded-[3px] bg-sun-line" aria-hidden />
              <div>
                <h2 className="text-[19px] leading-snug tracking-tight text-ink">{data.event.title}</h2>
                <p className="mt-1 text-[13.5px] text-ink-2">
                  {longDate(data.event.date)} · {time(data.event.start)} – {time(data.event.end)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 px-5 pb-4 pl-[3.25rem]">
              <a href={data.event.googleUrl} target="_blank" rel="noreferrer" className={clsx(ui.primary, "h-9")}>
                <CalendarPlus className="size-4" aria-hidden /> Add to Google Calendar
              </a>
              <button type="button" onClick={download} className={clsx(ui.quiet, "h-9")}>
                <Download className="size-4" aria-hidden /> .ics file
              </button>
            </div>

            <div className="border-t border-line py-2">
              <div className={row}>
                <MapPin className={icon} aria-hidden />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.event.location)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13.5px] text-ink underline-offset-4 hover:underline"
                >
                  {data.event.location}
                </a>
              </div>
              <div className={row}>
                <AlignLeft className={icon} aria-hidden />
                <div className="min-w-0 flex-1 space-y-5 text-[13px] leading-relaxed text-ink">
                  {data.event.sections.map((s) => (
                    <div key={s.heading}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{s.heading}</p>
                      <div className="mt-1.5 space-y-3">
                        {s.groups.map((g, i) => (
                          <div key={i} className={clsx(g.supplier && "border-t border-line pt-3 first:border-0 first:pt-0")}>
                            <p className={g.supplier ? "text-[14px] font-semibold text-ink" : "font-medium text-ink-2"}>{g.title}</p>
                            {g.note && (
                              <p className={clsx("text-[12px]", g.note.startsWith("SO ") ? "font-mono text-ink" : "text-sun-ink")}>
                                {g.note}
                              </p>
                            )}
                            {g.lines.map((l) => (
                              <p key={l}>{l}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!data.event.sections.some((s) => s.heading === "Materials") && (
                    <p className="text-muted">No order yet: the materials appear here once the customer has signed.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
