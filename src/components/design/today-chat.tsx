"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronRight, PenTool } from "lucide-react";
import { nextHeadline, type NextItem } from "@/lib/domain/design/next-up";
import { OPEN_STAGES } from "@/lib/domain/design/crm";
import { ROOF_IMAGE } from "@/lib/domain/design/roof-design";
import type { SolFile } from "@/lib/domain/design/sol";
import type { TodayView } from "@/lib/domain/design/today-view";
import type { Address } from "@/lib/domain/types";
import type { JobLine } from "@/lib/services/crm";
import { AddressEntry } from "@/components/consumer/address-entry";
import { PATHS } from "./design-shell";
import { designHref, openDesigner } from "./design-drawer";
import { KIND_ICONS } from "./canvas-pad";
import { useOutbox } from "./sol-agents";
import { SolBadge, SolMark, SolStars } from "./sol-icon";
import { SolBox } from "./today-pad";

/**
 * Today's Chat (20 Nov 2026, Martin: the first part of the old tour, Sol's greeting and his box, back "as a welcome
 * page after being inactive overnight", with a toggle to the feed; Sol larger and higher, the box twice as thick under
 * an actionable line in place of good morning or evening, then cards). Three short cards under the box, the same day's
 * three questions as the rest of RENUABL Business (LIVE_SOFTWARE.md): **Since yesterday** (what Sol did while nobody
 * was in: emails sent, emails lined up, new leads), **Needs you** (the three most pressing things from `nextUp`) and a
 * mini **designer** (the newest deal waiting for a design on its own roof, one press from the designer, or any address
 * typed in). Asking here starts the conversation on Today, as before.
 */
export function TodayChat(props: {
  name: string | null;
  items: NextItem[] | null;
  jobs: JobLine[] | null;
  asking: boolean;
  hidden: boolean;
  onDay: () => void;
  onAsk: (q: string, files: SolFile[]) => void;
  onView: (v: TodayView) => void;
}) {
  const hour = Number(new Date().toLocaleString("en-AU", { hour: "numeric", hourCycle: "h23", timeZone: "Australia/Melbourne" }));
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-1 pb-10 pt-2 text-center" inert={props.hidden}>
      <span className="relative">
        <span className="sol-orb sol-breathe inline-flex size-24 items-center justify-center rounded-full">
          <SolMark className="size-[4.75rem]" />
        </span>
        <SolStars className="absolute -right-4 -top-3 size-8" />
      </span>
      <h1 className="mt-5 text-[clamp(24px,2.9vw,32px)] font-normal leading-[1.1] tracking-[-0.02em] text-ink">
        What&rsquo;s next{props.name ? `, ${props.name}` : ""}?
      </h1>
      <p className="mt-1.5 text-[14.5px] text-ink-2">
        {props.items === null ? "Looking at your day…" : nextHeadline(props.items.length, hour)}
      </p>

      <div data-tour="today-sol" className="mt-6 w-full max-w-[46rem]">
        <SolBox onAsk={props.onAsk} asking={props.asking} tall placeholder="Ask Sol, or tell him what to do" />
        <div className="mt-3.5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={props.onDay}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-primary pl-1.5 pr-4 text-[13.5px] font-medium text-primary-ink shadow-[0_4px_14px_rgb(20_22_26_/_0.16)] transition hover:shadow-[0_4px_18px_rgb(255_90_31_/_0.35)]"
          >
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-white/10">
              <SolBadge className="size-4" />
            </span>
            Show me my day
          </button>
          {STARTERS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={props.asking}
              onClick={() => props.onAsk(q, [])}
              className="inline-flex h-9 items-center rounded-full bg-surface px-4 text-[13.5px] font-medium text-ink shadow-[0_2px_8px_rgb(20_22_26_/_0.06)] ring-1 ring-line transition hover:ring-sun-line disabled:text-muted"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 grid w-full max-w-5xl gap-3 text-left md:grid-cols-3">
        <AwayCard jobs={props.jobs} onFeed={() => props.onView("feed")} />
        <NeedsYouCard items={props.items} onFeed={() => props.onView("feed")} />
        <DesignCard jobs={props.jobs} />
      </div>
    </div>
  );
}

/** Things to ask in one press (each one Sol answer, as anything typed). */
const STARTERS = ["Who should I call first?", "Which proposals have gone quiet?"];

/** A short card: a quiet label, then one thing to take in. */
const CARD = "flex h-[11.5rem] flex-col rounded-[22px] bg-surface/80 p-4 ring-1 ring-line/70";
const LABEL = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted";
const DAY_MS = 86_400_000;

/**
 * What Sol did since this time yesterday, the proof the software works while nobody is in it: emails he sent, emails
 * he has lined up to send, and new leads that came in.
 */
function AwayCard({ jobs, onFeed }: { jobs: JobLine[] | null; onFeed: () => void }) {
  const { box, now } = useOutbox();
  const since = (at: string) => now.getTime() - Date.parse(at) < DAY_MS;
  const sent = box ? box.sent.filter((x) => since(x.at)).length : null;
  const lined = box ? box.entries.filter((e) => !e.held).length : null;
  const leads = jobs ? jobs.filter((j) => since(j.createdAt)).length : null;
  const figures: [number | null, string][] = [
    [sent, sent === 1 ? "email Sol sent" : "emails Sol sent"],
    [lined, "lined up to send"],
    [leads, leads === 1 ? "new lead" : "new leads"],
  ];
  return (
    <button type="button" onClick={onFeed} className={clsx(CARD, "text-left transition hover:ring-line")}>
      <span className={clsx(LABEL, "flex items-center gap-1.5")}>
        <SolBadge className="size-3.5" /> Since yesterday
      </span>
      <span className="mt-auto grid grid-cols-3 gap-2">
        {figures.map(([n, words]) => (
          <span key={words} className="min-w-0">
            <span className="block font-mono text-[26px] leading-none tracking-[-0.02em] text-ink">{n ?? "–"}</span>
            <span className="mt-1.5 block text-[12px] leading-snug text-ink-2">{words}</span>
          </span>
        ))}
      </span>
    </button>
  );
}

const KIND_TINT: Record<NextItem["kind"], string> = {
  install: "var(--kind-install)",
  message: "var(--kind-message)",
  lead: "var(--kind-lead)",
  "follow-up": "var(--kind-follow-up)",
  order: "var(--kind-order)",
  date: "var(--kind-date)",
  approvals: "var(--kind-approvals)",
};

/** The three most pressing things, a line each. */
function NeedsYouCard({ items, onFeed }: { items: NextItem[] | null; onFeed: () => void }) {
  const shown = (items ?? []).slice(0, 3);
  return (
    <section className={CARD} aria-label="Needs you">
      <button type="button" onClick={onFeed} className={clsx(LABEL, "group flex items-center gap-1 text-left hover:text-ink")}>
        Needs you{items?.length ? ` · ${items.length}` : ""}
        <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden />
      </button>
      {items === null ? (
        <p className="mt-3 text-[13px] text-muted">Looking…</p>
      ) : shown.length === 0 ? (
        <p className="mt-auto text-[14px] text-ink-2">Nothing needs you right now.</p>
      ) : (
        <ul className="mt-auto space-y-0.5">
          {shown.map((i) => {
            const Icon = KIND_ICONS[i.kind];
            return (
              <li key={i.key}>
                <Link href={i.href} className="-mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition hover:bg-canvas">
                  <Icon className="size-4 shrink-0" style={{ color: KIND_TINT[i.kind] }} aria-hidden />
                  <span className="min-w-0 truncate text-[13.5px] text-ink">{i.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * A designer in a card: the newest deal waiting for a design, on its own roof, one press from the designer; or any
 * address typed in. Both open the designer over Today.
 */
function DesignCard({ jobs }: { jobs: JobLine[] | null }) {
  const router = useRouter();
  const next =
    jobs
      ?.filter((j) => OPEN_STAGES.includes(j.stage) && !j.projectId && j.lat !== null && j.lng !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  const open = (a: Address) => {
    if (a.lat === undefined || a.lng === undefined) return;
    const words = [a.line, a.suburb, a.state, a.postcode].filter(Boolean).join(" ");
    openDesigner(`${PATHS.designer}?at=${a.lat},${a.lng}&address=${encodeURIComponent(words)}`, router);
  };
  return (
    <section className={clsx(CARD, "overflow-hidden p-0")} aria-label="Design">
      {next ? (
        <button
          type="button"
          onClick={() => openDesigner(designHref(next.id), router)}
          className="group relative block min-h-0 flex-1 text-left"
          title={`Design ${next.customerName}'s roof`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/design/roof?lat=${next.lat!.toFixed(6)}&lng=${next.lng!.toFixed(6)}&size=${ROOF_IMAGE.width}x${ROOF_IMAGE.height}`}
            alt=""
            className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" aria-hidden />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/90 backdrop-blur-sm">
            <PenTool className="size-3" aria-hidden /> Next to design
          </span>
          <span className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-medium text-white">{next.customerName}</span>
              <span className="block truncate text-[12px] text-white/75">{next.address}</span>
            </span>
            <span className="shrink-0 rounded-full bg-sun-line px-3 py-1 text-[12.5px] font-medium text-white">Design it</span>
          </span>
        </button>
      ) : (
        <span className="flex flex-1 flex-col justify-center px-4">
          <span className={clsx(LABEL, "flex items-center gap-1.5")}>
            <PenTool className="size-3.5" aria-hidden /> Design
          </span>
          <span className="mt-1.5 text-[13.5px] text-ink-2">Every deal has a design. Draw another roof:</span>
        </span>
      )}
      <div className="border-t border-line/70 bg-surface p-2">
        <AddressEntry compact placeholder="Design any address" onPick={open} />
      </div>
    </section>
  );
}

/** Chat | Feed, at the top of Today. */
export function TodaySwitch({ view, onView }: { view: TodayView; onView: (v: TodayView) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Today"
      className="inline-flex rounded-full bg-surface p-1 shadow-[0_2px_10px_rgb(20_22_26_/_0.06)] ring-1 ring-line"
    >
      {(
        [
          ["chat", "Chat"],
          ["feed", "Feed"],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={view === v}
          onClick={() => onView(v)}
          className={clsx(
            "h-8 rounded-full px-4 text-[13px] font-medium transition",
            view === v ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
