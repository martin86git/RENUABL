"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";
import { itemPath, loadThreads, type ThreadLine } from "@/lib/services/trade";
import { PageHead, ui } from "./design-shell";

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "Australia/Melbourne" });

/** The Marketplace's Messages (2 Nov 2026, Martin): every conversation this business is in, as seller or buyer, newest first. */
export function MarketplaceMessagesPage() {
  const [threads, setThreads] = useState<ThreadLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void loadThreads().then((res) => (res.ok ? setThreads(res.threads) : setProblem(res.message)));
  }, []);
  return (
    <div className={clsx(ui.page, "space-y-5")}>
      <PageHead title="Messages" />
      <p className="-mt-2 text-sm text-ink-2">Your conversations with other businesses on the Marketplace, newest first.</p>
      {problem && <p className="text-sm text-warning">{problem}</p>}
      {!threads ? (
        !problem && <p className="text-sm text-muted">Loading…</p>
      ) : !threads.length ? (
        <p className={clsx(ui.card, "p-6 text-sm text-ink-2")}>
          No messages yet. Ask a seller about their equipment and the conversation shows here.
        </p>
      ) : (
        <ul className={clsx(ui.card, "divide-y divide-line")}>
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={itemPath(t.itemId)} className="flex items-center gap-3 px-5 py-3.5 hover:bg-canvas">
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={clsx("truncate text-[15px] text-ink", t.unread > 0 && "font-semibold")}>{t.with}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {t.side === "selling" ? "asking about your" : "about their"} {t.item}
                    </span>
                  </span>
                  <span className="block truncate text-sm text-ink-2">{t.last}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{when(t.lastAt)}</span>
                {t.unread > 0 && (
                  <span className="rounded-full bg-sun-line px-1.5 text-[11px] font-semibold leading-5 text-white">{t.unread}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
