"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  Mail,
  MessageCircle,
  PenTool,
  SquareKanban,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { nextHeadline, type NextItem } from "@/lib/domain/design/next-up";
import { pastWhen, type SolPastLine } from "@/lib/domain/design/sol-history";
import type { SolFile } from "@/lib/domain/design/sol";
import type { TodayView } from "@/lib/domain/design/today-view";
import { SOL_CHANGED, SOL_TOGGLE, listSolPast, resumeSolChat } from "@/lib/services/sol";
import { PATHS } from "./design-shell";
import { KIND_ICONS } from "./canvas-pad";
import { useSolOpen } from "./sol-dock";
import { SolBadge, SolMark, SolStars } from "./sol-icon";
import { SolBox } from "./today-pad";

/**
 * Today's Chat (20 Nov 2026, Martin: the first part of the old tour, Sol's greeting and his box, back "as a welcome
 * page after being inactive overnight", with a toggle to the feed; Sol larger and higher, the box twice as thick under
 * an actionable line in place of good morning or evening, then cards). Three cards under the box: **Needs you** (the
 * most pressing things from `nextUp`, the same list the feed's Needs you is built from), **Go to** (the places used
 * most, as app tiles in their own colours) and **Chats** (the member's past conversations with Sol, to pick one up in
 * his panel). Asking here starts the conversation on Today, as before.
 */
export function TodayChat(props: {
  name: string | null;
  items: NextItem[] | null;
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

      <div className="mt-10 grid w-full gap-4 text-left md:grid-cols-3">
        <NeedsYouCard items={props.items} onFeed={() => props.onView("feed")} />
        <GoToCard />
        <ChatsCard onAsk={(q) => props.onAsk(q, [])} />
      </div>
    </div>
  );
}

/** Things to ask in one press (each one Sol answer, as anything typed). */
const STARTERS = ["Who should I call first?", "Which proposals have gone quiet?"];

const CARD = "flex min-h-[17rem] flex-col rounded-[26px] bg-surface/90 p-5 shadow-[0_10px_32px_rgb(20_22_26_/_0.07)] ring-1 ring-line";

function CardHead({ title, count, onClick, href }: { title: string; count?: number; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      {title}
      {count ? <span className="text-ink-2"> · {count}</span> : null}
      <ChevronRight className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
    </>
  );
  const cls = "group inline-flex items-center gap-1 text-[16px] font-semibold tracking-[-0.01em] text-ink";
  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
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

/** A rounded square in a colour of its own, white mark inside, as an app's icon. */
function Tile({ tint, icon: Icon, size = "md" }: { tint: string; icon: LucideIcon; size?: "sm" | "md" }) {
  return (
    <span
      className={clsx(
        "grid shrink-0 place-items-center text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_0.35),0_4px_10px_rgb(20_22_26_/_0.14)]",
        size === "sm" ? "size-9 rounded-[11px]" : "size-14 rounded-[17px]",
      )}
      style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${tint} 70%, white), ${tint})` }}
      aria-hidden
    >
      <Icon className={size === "sm" ? "size-[18px]" : "size-7"} strokeWidth={1.9} />
    </span>
  );
}

/** The most pressing things, as the feed's Needs you starts. */
function NeedsYouCard({ items, onFeed }: { items: NextItem[] | null; onFeed: () => void }) {
  const shown = (items ?? []).slice(0, 4);
  return (
    <section className={CARD} aria-label="Needs you">
      <CardHead title="Needs you" count={items?.length} onClick={onFeed} />
      {items === null ? (
        <p className="mt-4 text-[13.5px] text-muted">Looking…</p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-[13.5px] text-ink-2">Nothing needs you right now.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {shown.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-canvas">
                <Tile tint={KIND_TINT[i.kind]} icon={KIND_ICONS[i.kind]} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-medium text-ink">{i.title}</span>
                  <span className="block truncate text-[12.5px] text-ink-2">{i.why}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items && items.length > shown.length && (
        <button type="button" onClick={onFeed} className="mt-auto pt-3 text-left text-[13px] font-medium text-ink-2 hover:text-ink">
          {items.length - shown.length} more in your feed
        </button>
      )}
    </section>
  );
}

/** The places used most, each its own colour. */
const PLACES: { label: string; href: string; icon: LucideIcon; tint: string }[] = [
  { label: "Designer", href: PATHS.designer, icon: PenTool, tint: "var(--sun-line)" },
  { label: "Deals", href: PATHS.deals, icon: SquareKanban, tint: "var(--kind-lead)" },
  { label: "Proposals", href: PATHS.proposalsSent, icon: FileText, tint: "var(--kind-follow-up)" },
  { label: "Inbox", href: PATHS.inbox, icon: Mail, tint: "var(--kind-message)" },
  { label: "Installs", href: PATHS.installations, icon: CalendarDays, tint: "var(--kind-install)" },
  { label: "Customers", href: PATHS.customers, icon: Users, tint: "var(--kind-order)" },
  { label: "Service", href: PATHS.service, icon: Wrench, tint: "var(--kind-date)" },
  { label: "Routines", href: "/design/routines", icon: Workflow, tint: "var(--kind-approvals)" },
];

function GoToCard() {
  return (
    <section className={clsx(CARD, "justify-center")} aria-label="Go to">
      <ul className="grid grid-cols-4 gap-x-2 gap-y-4">
        {PLACES.map((p) => (
          <li key={p.label}>
            <Link href={p.href} className="group flex flex-col items-center gap-1.5 rounded-xl py-1">
              <span className="transition-transform duration-200 group-hover:-translate-y-0.5">
                <Tile tint={p.tint} icon={p.icon} />
              </span>
              <span className="max-w-full truncate text-[12.5px] font-medium text-ink">{p.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The member's past conversations with Sol: one picks up in his panel. Nothing yet: things to ask. */
function ChatsCard({ onAsk }: { onAsk: (q: string) => void }) {
  const [past, setPast] = useState<SolPastLine[] | null>(null);
  const open = useSolOpen();
  useEffect(() => {
    let on = true;
    void listSolPast().then((r) => on && setPast(r.ok ? r.past : []));
    return () => {
      on = false;
    };
  }, []);
  const openPanel = () => {
    if (!open) window.dispatchEvent(new Event(SOL_TOGGLE));
  };
  const pickUp = async (id: string) => {
    const r = await resumeSolChat(id);
    if (r.ok) window.dispatchEvent(new CustomEvent(SOL_CHANGED, { detail: r.state }));
    openPanel();
  };
  const shown = (past ?? []).slice(0, 4);
  return (
    <section className={CARD} aria-label="Chats with Sol">
      <CardHead title="Chats" onClick={openPanel} />
      {past === null ? (
        <p className="mt-4 text-[13.5px] text-muted">Looking…</p>
      ) : shown.length === 0 ? (
        <>
          <p className="mt-3 text-[13px] text-ink-2">Your conversations with Sol will be here. To start:</p>
          <ul className="mt-2 space-y-0.5">
            {IDEAS.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => onAsk(q)}
                  className="-mx-2 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[14.5px] text-ink transition hover:bg-canvas"
                >
                  <MessageCircle className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="truncate">{q}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ul className="mt-3 space-y-0.5">
          {shown.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => void pickUp(c.id)}
                className="-mx-2 flex w-full items-baseline gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-canvas"
              >
                <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">{c.title}</span>
                <span className="shrink-0 text-[12px] text-muted">{pastWhen(c.endedAt, new Date())}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const IDEAS = ["What's due to install this week?", "Draft a follow-up for a quiet proposal", "How are sales tracking this month?"];

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
