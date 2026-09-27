"use client";

import { CalendarPlus } from "lucide-react";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/domain/calendar";

const link =
  "inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-[12.5px] text-ink-2 ring-1 ring-line hover:ring-line-strong";

/** "Add to calendar": an .ics download (Apple, Outlook) and a Google Calendar link. */
export function AddToCalendar({ event, filename }: { event: CalendarEvent; filename: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([buildIcs([event])], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      <button type="button" onClick={download} className={link}>
        <CalendarPlus className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden /> Apple / Outlook
      </button>
      <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className={link}>
        <CalendarPlus className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden /> Google Calendar
      </a>
    </div>
  );
}
