"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlignLeft, CalendarPlus, Camera, ClipboardList, Download, ExternalLink, FileText, Images, LayoutGrid, MapPin, X } from "lucide-react";
import clsx from "clsx";
import { ROOF_IMAGE } from "@/lib/domain/design/roof-design";
import { loadInstallEvent, type InstallEvent } from "@/lib/services/after-sale";
import { dealFileHref, listDealFiles, uploadDealFiles, type DealFile } from "@/lib/services/deal-pulse";
import { loadJobCard, type JobCardView } from "@/lib/services/job-card";
import { Drawing } from "./job-card";
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

  // The panel layout and the deal's photos (24 Nov 2026, Martin: the event should carry the design, and the switchboard,
  // battery spot and the like that were kept on the deal).
  const [card, setCard] = useState<JobCardView | null>(null);
  const [files, setFiles] = useState<DealFile[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let gone = false;
    void loadJobCard(jobId).then((res) => !gone && res.ok && setCard(res.card));
    void listDealFiles(jobId).then((res) => !gone && setFiles(res.ok ? res.files : []));
    return () => {
      gone = true;
    };
  }, [jobId]);
  const addFiles = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    setAdding(true);
    setFileProblem(null);
    const res = await uploadDealFiles(jobId, picked);
    setAdding(false);
    if (res.ok) setFiles((had) => [...res.files, ...(had ?? []).filter((f) => !res.files.some((n) => n.id === f.id))]);
    else setFileProblem(res.message);
    if (picker.current) picker.current.value = "";
  };
  const picture = card?.roof
    ? `/api/design/roof?lat=${card.roof.lat.toFixed(6)}&lng=${card.roof.lng.toFixed(6)}&size=${ROOF_IMAGE.width}x${ROOF_IMAGE.height}`
    : null;
  const photos = (files ?? []).filter((f) => f.type.startsWith("image/"));
  const papers = (files ?? []).filter((f) => !f.type.startsWith("image/"));

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
              {/* What the installer shows at each wholesaler's counter: our PO, their SO and what was ordered. */}
              {data.event.slip && (
                <a href={data.event.slip} target="_blank" rel="noreferrer" className={clsx(ui.quiet, "h-9")}>
                  <ClipboardList className="size-4" aria-hidden /> Pickup slip
                </a>
              )}
            </div>

            <div className="border-t border-line py-2">
              <div className={row}>
                <MapPin className={icon} aria-hidden />
                {/* Who to see, then where: the customer's name above the site address. */}
                <div className="text-[13.5px]">
                  <p className="font-medium text-ink">{data.customer.name}</p>
                  {data.customer.phone && (
                    <a href={`tel:${data.customer.phone.replace(/\s/g, "")}`} className="block text-ink-2 hover:text-ink">
                      {data.customer.phone}
                    </a>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.event.location)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-ink underline-offset-4 hover:underline"
                  >
                    {data.event.location}
                  </a>
                </div>
              </div>
              <div className={row}>
                <LayoutGrid className={icon} aria-hidden />
                <div className="min-w-0 flex-1 text-[13px]">
                  {card?.layout ? (
                    <Drawing title="Panel layout" drawing={card.layout} picture={picture} />
                  ) : (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Panel layout</p>
                      <p className="mt-1 text-muted">{card ? "No roof design for this job yet." : "Loading…"}</p>
                    </>
                  )}
                </div>
              </div>
              <div className={row}>
                <Images className={icon} aria-hidden />
                <div className="min-w-0 flex-1 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Photos and files from the deal</p>
                    <button
                      type="button"
                      onClick={() => picker.current?.click()}
                      disabled={adding}
                      className={clsx(ui.quiet, "h-8 shrink-0 px-3 text-[12.5px]")}
                    >
                      <Camera className="size-3.5" aria-hidden /> {adding ? "Adding…" : "Add"}
                    </button>
                    <input
                      ref={picker}
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => void addFiles(e.target.files)}
                    />
                  </div>
                  {files === null ? (
                    <p className="mt-1 text-muted">Loading…</p>
                  ) : files.length === 0 ? (
                    <p className="mt-1 text-muted">
                      Nothing kept on the deal yet. Add photos of the switchboard, where the battery goes, the meter, access.
                    </p>
                  ) : (
                    <>
                      {photos.length > 0 && (
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          {photos.map((f) => (
                            <a
                              key={f.id}
                              href={dealFileHref(jobId, f.id)}
                              target="_blank"
                              rel="noreferrer"
                              title={f.name}
                              className="block aspect-square overflow-hidden rounded-md bg-surface-2 ring-1 ring-line"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- a member's own file, served signed in */}
                              <img src={dealFileHref(jobId, f.id)} alt={f.name} className="size-full object-cover" loading="lazy" />
                            </a>
                          ))}
                        </div>
                      )}
                      {papers.map((f) => (
                        <a
                          key={f.id}
                          href={dealFileHref(jobId, f.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 flex items-center gap-2 text-ink underline-offset-4 hover:underline"
                        >
                          <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                          <span className="truncate">{f.name}</span>
                        </a>
                      ))}
                    </>
                  )}
                  {fileProblem && <p className="mt-1.5 text-[12px] text-warning">{fileProblem}</p>}
                  <p className="mt-1.5 text-[11.5px] text-muted">Kept on the deal&apos;s Files. A calendar can&apos;t carry photos: open them here.</p>
                </div>
              </div>
              <div className={row}>
                <AlignLeft className={icon} aria-hidden />
                <div className="min-w-0 flex-1 space-y-5 text-[13px] leading-relaxed text-ink">
                  {data.event.sections.map((s) => (
                    <div key={s.heading}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{s.heading}</p>
                      <div className="mt-1.5 space-y-3">
                        {s.groups
                          .filter((g) => !(s.heading === "On site" && g.title === "Customer"))
                          .map((g, i) => (
                            <div key={i}>
                              <p className="font-semibold text-ink">{g.title}</p>
                              {g.note && (
                                <p className={clsx("text-[12px]", g.note.startsWith("SO ") ? "font-mono text-ink" : "text-sun-ink")}>
                                  {g.note}
                                </p>
                              )}
                              {g.lines.map((l) => (
                                <p key={l}>{l}</p>
                              ))}

                              {g.items?.map((it, k) => (
                                <p key={k} className="flex flex-wrap items-baseline justify-between gap-x-3">
                                  <span className="font-medium">{it.text}</span>
                                  <span className={clsx("text-[11.5px]", it.from === "No supplier set" ? "text-sun-ink" : "text-muted")}>
                                    {it.from}
                                  </span>
                                </p>
                              ))}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                  {!data.event.sections.some((s) => s.heading === "Collect from") && (
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
