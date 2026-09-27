"use client";

import { CalendarPlus } from "lucide-react";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/domain/calendar";

const pill = "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-medium transition";

/** A calendar in Google's four colours (our own drawing, not Google's logo). */
function GoogleColoursCalendar() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden>
      <path d="M3 5.5V4a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 15 4v1.5z" fill="#4285F4" />
      <path d="M3 5.5h2v8a1 1 0 0 0 1 1h-1.5A1.5 1.5 0 0 1 3 13z" fill="#34A853" />
      <path d="M13 5.5h2V13a1.5 1.5 0 0 1-1.5 1.5H12a1 1 0 0 0 1-1z" fill="#FBBC05" />
      <rect x="5" y="13" width="8" height="1.5" fill="#EA4335" />
      <rect x="6" y="1" width="1.5" height="3" rx=".75" fill="#4285F4" />
      <rect x="10.5" y="1" width="1.5" height="3" rx=".75" fill="#4285F4" />
      <path d="M9 7.5v4M7 9.5h4" stroke="#1A1A1A" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

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
      {/* Apple's black (a fixed brand colour, the same in both themes). */}
      <button type="button" onClick={download} className={`${pill} bg-[#000] text-white hover:bg-[#1d1d1f]`}>
        <CalendarPlus className="h-4 w-4" strokeWidth={1.7} aria-hidden /> Apple / Outlook
      </button>
      <a
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${pill} bg-white text-[#1f1f1f] ring-1 ring-[#dadce0] hover:bg-[#f8f9fa]`}
      >
        <GoogleColoursCalendar /> Google Calendar
      </a>
    </div>
  );
}
