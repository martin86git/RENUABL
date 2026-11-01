"use client";

import clsx from "clsx";
import { CalendarDays, Camera, FileText, MapPin, Paperclip, Phone, Send, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isJobPicture, type JobDrawing, type JobNote } from "@/lib/domain/design/job-card";
import { ROOF_IMAGE } from "@/lib/domain/design/roof-design";
import {
  addNote,
  linkFileHref,
  linkRoofHref,
  loadInstallerCard,
  loadJobCard,
  sendJobCard,
  teamFileHref,
  type JobCardView,
} from "@/lib/services/job-card";

/**
 * The installation job card (1 Nov 2026, Martin: Primero's in place of ServiceM8, wave 7): the team's, opened over the
 * install calendar, and the installer's on their phone at /job/<token>. One card: the customer, the address, the day,
 * the system, the panel layout and string design over the roof, and one thread of notes and photos both sides add to.
 */

const head = "text-[10px] font-medium uppercase tracking-[0.14em] text-muted";
const dayWords = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "No date yet";
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });
const mapLink = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

function Drawing({ title, drawing, picture }: { title: string; drawing: JobDrawing; picture: string | null }) {
  return (
    <figure>
      <figcaption className={head}>{title}</figcaption>
      <svg viewBox={drawing.viewBox} className="mt-1.5 block h-auto w-full rounded-md bg-[#1f2937]" role="img" aria-label={title}>
        {picture && <image href={picture} x={0} y={0} width={ROOF_IMAGE.width} height={ROOF_IMAGE.height} />}
        {/* Made on the server from the design's numbers and fixed words only. */}
        <g dangerouslySetInnerHTML={{ __html: drawing.marks }} />
      </svg>
    </figure>
  );
}

/** The card itself: everything but who is looking and how a note is sent. */
function CardBody({
  card,
  picture,
  fileHref,
  composer,
  aside,
}: {
  card: JobCardView;
  picture: string | null;
  fileHref: (id: string) => string;
  composer: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-5">
        <section className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className={head}>Installation</p>
            <p className="mt-1 text-[15px] font-medium text-ink">{dayWords(card.job.installDate)}</p>
            <p className="text-xs text-muted">{card.job.stage}</p>
          </div>
          <div>
            <p className={head}>Address</p>
            <a
              href={mapLink(card.job.address)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex items-start gap-1.5 text-[15px] text-ink underline-offset-4 hover:underline"
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
              {card.job.address || "No address"}
            </a>
          </div>
          <div>
            <p className={head}>Customer</p>
            <p className="mt-1 text-[15px] text-ink">{card.customer.name}</p>
            {card.customer.phone && (
              <a
                href={`tel:${card.customer.phone.replace(/\s+/g, "")}`}
                className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
              >
                <Phone className="size-3.5" aria-hidden /> {card.customer.phone}
              </a>
            )}
            {card.customer.email && <p className="text-sm text-ink-2">{card.customer.email}</p>}
          </div>
          {aside}
        </section>

        {card.details.length > 0 && (
          <section>
            <p className={head}>System</p>
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {card.details.map((d) => (
                <div key={d.label} className="contents">
                  <dt className="text-muted">{d.label}</dt>
                  <dd className="text-ink">{d.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {card.layout || card.strings ? (
          <section className="grid gap-4 sm:grid-cols-2">
            {card.layout && <Drawing title="Panel layout" drawing={card.layout} picture={picture} />}
            {card.strings && <Drawing title="String design" drawing={card.strings} picture={picture} />}
            {card.stringWords.length > 0 && (
              <ul className="space-y-0.5 text-sm text-ink-2 sm:col-span-2">
                {card.stringWords.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <p className="rounded-md bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
            No roof design for this job yet, so there are no drawings.
          </p>
        )}
      </div>

      <section aria-label="Notes and photos" className="min-w-0">
        <p className={head}>Notes and photos</p>
        <div className="mt-2">{composer}</div>
        <Thread notes={card.notes} fileHref={fileHref} />
      </section>
    </div>
  );
}

function Thread({ notes, fileHref }: { notes: JobNote[]; fileHref: (id: string) => string }) {
  if (!notes.length)
    return <p className="mt-3 text-sm text-muted">Nothing yet. Notes and photos from the team and the installer show here.</p>;
  return (
    <ol className="mt-3 space-y-2.5">
      {notes.map((n) => (
        <li key={n.id} className={clsx("rounded-lg px-3 py-2.5", n.side === "installer" ? "bg-sun" : "bg-surface-2")}>
          {n.text && <p className="whitespace-pre-line text-[13.5px] leading-snug text-ink">{n.text}</p>}
          {n.files.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {n.files.map((f) =>
                isJobPicture(f.type) ? (
                  <a
                    key={f.id}
                    href={fileHref(f.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-md bg-surface"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileHref(f.id)} alt={f.name} className="aspect-square w-full object-cover" loading="lazy" />
                  </a>
                ) : (
                  <a
                    key={f.id}
                    href={fileHref(f.id)}
                    className="col-span-3 flex items-center gap-1.5 truncate rounded-md bg-surface px-2 py-1.5 text-xs text-ink"
                  >
                    <FileText className="size-3.5 shrink-0" aria-hidden /> {f.name}
                  </a>
                ),
              )}
            </div>
          )}
          <p className="mt-1 text-[11px] text-muted">
            {n.side === "installer" ? `${n.by} · installer` : n.by} · {when(n.at)}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** The box for a note: words and photos (the camera on a phone, or files), sent together. */
function Composer({ send, placeholder }: { send: (text: string, files: File[]) => Promise<string | null>; placeholder: string }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    const more = Array.from(e.target.files ?? []);
    e.target.value = "";
    setFiles((f) => [...f, ...more].slice(0, 6));
  };
  const go = async () => {
    if (!text.trim() && !files.length) return;
    setBusy(true);
    const wrong = await send(text.trim(), files);
    setBusy(false);
    setProblem(wrong);
    if (!wrong) {
      setText("");
      setFiles([]);
    }
  };
  return (
    <div className="rounded-lg border border-line bg-surface p-2.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={4000}
        placeholder={placeholder}
        className="block min-h-16 w-full resize-y bg-transparent px-1 py-1 text-sm text-ink outline-none"
      />
      {files.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-2.5 pr-1 text-xs text-ink-2">
              <span className="max-w-32 truncate">{f.name || "photo"}</span>
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, k) => k !== i))}
                aria-label={`Take off ${f.name}`}
                className="rounded-full p-0.5 hover:bg-surface"
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={() => camera.current?.click()}
          className="flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 lg:hidden"
          aria-label="Take a photo"
        >
          <Camera className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => picker.current?.click()}
          className="flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2"
          aria-label="Add photos or a PDF"
        >
          <Paperclip className="size-4" aria-hidden />
        </button>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={take} />
        <input ref={picker} type="file" accept="image/*,application/pdf" multiple hidden onChange={take} />
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => void go()}
          disabled={busy || (!text.trim() && !files.length)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
        >
          <Send className="size-3.5" aria-hidden /> {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {problem && (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}

/** The team's job card, in a window over the page: with Email the job card to an installer on file. */
export function JobCardDialog({ jobId, onClose, onEvent }: { jobId: string; onClose: () => void; onEvent?: () => void }) {
  const [card, setCard] = useState<JobCardView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => {
    let gone = false;
    void loadJobCard(jobId).then((res) => {
      if (gone) return;
      if (res.ok) setCard(res.card);
      else setProblem(res.message);
    });
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => {
      gone = true;
      window.removeEventListener("keydown", key);
    };
  }, [jobId, onClose]);
  const send = async () => {
    if (!to) return;
    setSending(true);
    const res = await sendJobCard(jobId, to);
    setSending(false);
    if (res.ok) {
      setCard(res.card);
      setSent({ ok: true, message: `Sent to ${res.to}, with the drawings and their link to the card.` });
    } else setSent({ ok: false, message: res.message });
  };
  const picture = card?.roof
    ? `/api/design/roof?lat=${card.roof.lat.toFixed(6)}&lng=${card.roof.lng.toFixed(6)}&size=${ROOF_IMAGE.width}x${ROOF_IMAGE.height}`
    : null;
  // Drawn on the page's body: a column it is opened from can carry a transform, which would trap a fixed window inside it.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="theme-studio fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/40 p-3 sm:p-8"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label="Job card" className="w-full max-w-5xl rounded-2xl bg-canvas p-5 shadow-lift sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={head}>Job card</p>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-ink">
              {card ? `${card.customer.name} · ${card.job.title}` : "Loading…"}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onEvent && (
              <button
                type="button"
                onClick={onEvent}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink hover:border-forest"
                title="The calendar event and the pickup list"
              >
                <CalendarDays className="size-4" aria-hidden /> Calendar event
              </button>
            )}
            <Link
              href={`/design/deals/${encodeURIComponent(jobId)}`}
              className="hidden h-9 items-center rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink hover:border-forest sm:inline-flex"
            >
              Open deal
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close the job card"
              className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        {problem && (
          <p className="mt-4 rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
            {problem}
          </p>
        )}
        {card && (
          <div className="mt-5">
            <CardBody
              card={card}
              picture={picture}
              fileHref={(id) => teamFileHref(jobId, id)}
              composer={
                <Composer
                  placeholder="A note for the installer, or what was found on site"
                  send={async (text, files) => {
                    const res = await addNote({ jobId }, text, files);
                    if (!res.ok) return res.message;
                    setCard({ ...card, notes: [res.note, ...card.notes] });
                    return null;
                  }}
                />
              }
              aside={
                <div>
                  <p className={head}>Email the job card</p>
                  {card.installers?.length ? (
                    <>
                      <div className="mt-1 flex gap-2">
                        <select
                          value={to}
                          onChange={(e) => setTo(e.target.value)}
                          aria-label="Installer"
                          className="min-h-9 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-sm"
                        >
                          <option value="">Choose an installer…</option>
                          {card.installers.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                              {i.sentAt ? ` (sent ${when(i.sentAt)})` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!to || sending}
                          onClick={() => void send()}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-ink hover:bg-forest disabled:bg-surface-2 disabled:text-muted"
                        >
                          <Send className="size-3.5" aria-hidden /> {sending ? "Sending…" : "Email"}
                        </button>
                      </div>
                      {sent && <p className={clsx("mt-1 text-xs", sent.ok ? "text-positive" : "text-warning")}>{sent.message}</p>}
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-ink-2">
                      No installers on file yet.{" "}
                      <Link href="/design/settings/installers" className="font-medium text-ink underline underline-offset-4">
                        Add them in Settings
                      </Link>
                      .
                    </p>
                  )}
                </div>
              }
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

const NAME_KEY = "renuabl.job.name";

/** The installer's job card, on their phone at /job/<token>: the same card without the customer's email. */
export function InstallerJobCard({ token }: { token: string }) {
  const [card, setCard] = useState<JobCardView | null>(null);
  const [installer, setInstaller] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [person, setPerson] = useState("");
  useEffect(() => {
    try {
      // The person's own name, given once on this phone.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPerson(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      // Storage is off: they can still type it.
    }
    let gone = false;
    void loadInstallerCard(token).then((res) => {
      if (gone) return;
      if (res.ok) {
        setCard(res.card);
        setInstaller(res.installer);
      } else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, [token]);
  const keepName = (name: string) => {
    setPerson(name);
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      // Kept for this visit only.
    }
  };
  if (problem)
    return (
      <main className="theme-studio mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-medium text-ink">This job card isn&apos;t available.</p>
        <p className="mt-2 text-sm text-ink-2">The link may have changed. Ask the business that sent it for a new one.</p>
      </main>
    );
  if (!card) return <main className="theme-studio min-h-dvh" aria-busy="true" />;
  return (
    <main className="theme-studio mx-auto min-h-dvh w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <p className={head}>
        Job card from {card.business} · for {installer}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{card.job.address.split(",")[0] || card.job.title}</h1>
      <div className="mt-5">
        <CardBody
          card={card}
          picture={card.roof ? linkRoofHref(token) : null}
          fileHref={(id) => linkFileHref(token, id)}
          composer={
            <div className="space-y-2">
              <input
                value={person}
                onChange={(e) => keepName(e.target.value.slice(0, 60))}
                placeholder="Your name"
                aria-label="Your name"
                className="block min-h-10 w-full rounded-md border border-line bg-surface px-3 text-sm outline-none focus:border-forest"
              />
              <Composer
                placeholder="A note or photos from site: before, arrays, inverter, switchboard, commissioning"
                send={async (text, files) => {
                  const res = await addNote({ token }, text, files, person);
                  if (!res.ok) return res.message;
                  setCard({ ...card, notes: [res.note, ...card.notes] });
                  return null;
                }}
              />
            </div>
          }
        />
      </div>
      <p className="mt-10 text-center text-xs text-muted">This link is for you: please don&apos;t pass it on.</p>
    </main>
  );
}
