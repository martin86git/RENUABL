"use client";

import clsx from "clsx";
import { ArrowRight, BookOpen, ClipboardCheck, PenTool, Store, Users, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { kindLabel, type BusinessKind } from "@/lib/domain/design/business-kind";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";
import { incomingRequests } from "@/lib/services/connections";
import { nominatedInspections } from "@/lib/services/inspections";
import { waitingJobs } from "@/lib/services/job-shares";
import { PageHead, PATHS, ui } from "./design-shell";

/** What waits on an installer or inspector now, for its Today: jobs to answer, inspections to book, requests to connect. */
function useWaiting(kind: Exclude<BusinessKind, "retailer">) {
  const [waiting, setWaiting] = useState<{ work: number; requests: number }>({ work: 0, requests: 0 });
  useEffect(() => {
    let gone = false;
    void Promise.all([kind === "installer" ? waitingJobs() : nominatedInspections(), incomingRequests()]).then(([work, asked]) => {
      if (gone) return;
      setWaiting({
        work: work.ok ? ("waiting" in work ? work.waiting : work.nominated) : 0,
        requests: asked.ok ? asked.incoming : 0,
      });
    });
    return () => {
      gone = true;
    };
  }, [kind]);
  return waiting;
}

/**
 * An installer's and an inspector's Today (1 Nov 2026, Martin: their login holds no CRM or procurement). What their
 * account is for, in the order they will use it, each a way into the page that does it. Jobs from retailers,
 * inspections from installers and connections come in the next steps; until then each says plainly what will appear.
 */
export function KindToday({ kind, business }: { kind: Exclude<BusinessKind, "retailer">; business: string }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const waiting = useWaiting(kind);
  const tiles: Tile[] =
    kind === "installer"
      ? [
          {
            icon: Wrench,
            title: "Jobs",
            body: "The jobs retailers send you, each with its design, strings, the day and who to call on site.",
            href: "/design/jobs",
            count: waiting.work,
            countWords: "waiting for your answer",
          },
          {
            icon: Store,
            title: "Marketplace",
            body: marketplaceOpen()
              ? "Bid on jobs near you: a bid chosen lands in your Jobs as its job card. Buy and sell spare equipment too."
              : "Coming soon: bid on jobs near you, and buy and sell spare equipment. Save your place.",
            href: "/design/marketplace",
          },
          {
            icon: PenTool,
            title: "Design tool",
            body: "Design a roof, string it and price it. $3 a design job, bought in packs under Settings, Billing.",
            href: PATHS.designer,
            lit: true,
          },
          {
            icon: Users,
            title: "Connections",
            body: "The retailers you install for and the inspectors you use. Connect once, then jobs pass between you.",
            href: "/design/connections",
            count: waiting.requests,
            countWords: "asking to connect",
          },
        ]
      : [
          {
            icon: ClipboardCheck,
            title: "Inspections",
            body: "The jobs installers send you to inspect, with the design, the string drawing and their installation photos.",
            href: "/design/inspections",
            count: waiting.work,
            countWords: "to book",
          },
          {
            icon: Users,
            title: "Connections",
            body: "The installers you inspect for. Connect once, then they can send you their jobs.",
            href: "/design/connections",
            count: waiting.requests,
            countWords: "asking to connect",
          },
          {
            icon: Store,
            title: "Marketplace",
            body: marketplaceOpen()
              ? "Buy and sell test equipment and spares with other businesses near you."
              : "Coming soon: the industry connected in one place, from job listings to spare equipment. Save your place.",
            href: marketplaceOpen() ? "/design/marketplace/equipment" : "/design/marketplace",
          },
          {
            icon: BookOpen,
            title: "Standards library",
            body: "Keep your licensed copies of AS/NZS 3000, 4777, 5033, 5139 and the rest where your team can open them.",
            href: "/design/settings/standards",
          },
        ];
  return (
    <div className={clsx(ui.page, "space-y-8")}>
      <div>
        <p className="text-sm text-muted">
          {business} · {kindLabel(kind)}
        </p>
        <h1 className="mt-1 text-[clamp(28px,4vw,40px)] font-light leading-tight tracking-[-0.03em] text-ink">{greeting}.</h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-2">
          {kind === "installer"
            ? "Your RENUABL is free: your jobs, the Marketplace and the businesses you work with. Pay only for design jobs, if you use the design tool."
            : "Your RENUABL is free: the inspections installers send you, with everything you need to see before you go."}
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.title}>
            <Link href={t.href} className={clsx(ui.card, "group flex h-full flex-col p-6 transition hover:ring-ink-2")}>
              <span
                className={clsx(
                  "flex size-10 items-center justify-center rounded-full",
                  t.lit ? "bg-sun-line text-white" : "bg-surface-2 text-ink",
                )}
              >
                <t.icon className="size-[18px]" aria-hidden />
              </span>
              <span className="mt-4 flex flex-wrap items-baseline gap-x-2.5 text-lg font-semibold tracking-tight text-ink">
                {t.title}
                {t.count ? (
                  <span className="text-[13px] font-medium tracking-normal text-sun-line">
                    {t.count} {t.countWords}
                  </span>
                ) : null}
              </span>
              <span className="mt-1.5 flex-1 text-[14.5px] leading-relaxed text-ink-2">{t.body}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-ink">
                Open <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Tile = { icon: LucideIcon; title: string; body: string; href: string; lit?: boolean; count?: number; countWords?: string };

/** A page whose working half comes in the next step: what will be here, said plainly, and nothing pretending to work. */
export function ComingNext({ title, lead, points }: { title: string; lead: string; points: string[] }) {
  return (
    <div className={clsx(ui.page, "space-y-5")}>
      <PageHead title={title} />
      <div className={clsx(ui.card, "max-w-2xl p-6")}>
        <p className="inline-flex rounded-full bg-sun px-2.5 py-0.5 text-[11px] font-medium text-sun-ink">Coming next</p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink">{lead}</p>
        <ul className="mt-4 space-y-2">
          {points.map((p) => (
            <li key={p} className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-sun-line" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
