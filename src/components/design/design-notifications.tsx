"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AtSign, CheckCheck } from "lucide-react";
import clsx from "clsx";
import { handleOf } from "@/lib/domain/design/mentions";
import { loadNotifications, markNotificationsRead, shortDate } from "@/lib/services/crm";
import type { Notification } from "@/lib/server/design-notifications-repo";
import { PATHS, PageHead, ui } from "./design-shell";

const told = () => window.dispatchEvent(new Event("renuabl:notifications"));

/**
 * /design/notifications: the signed-in member's own inbox (as Primero's): each time someone @mentioned them in a deal's
 * note, newest first, unread ones marked, each opening its deal (which reads it). "Mark all read" clears the count.
 */
export function NotificationsPage() {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void loadNotifications().then((res) => (res.ok ? setItems(res.notifications) : setProblem(res.message)));
  }, []);
  const unread = (items ?? []).filter((n) => !n.read).length;
  const markAll = async () => {
    const res = await markNotificationsRead({ all: true });
    if (!res.ok) return setProblem(res.message);
    setItems((all) => (all ?? []).map((n) => ({ ...n, read: true })));
    told();
  };

  return (
    <div className={clsx(ui.page, "max-w-3xl")}>
      <PageHead eyebrow="Inbox" title="Notifications">
        {unread > 0 && (
          <button className={ui.quiet} onClick={() => void markAll()}>
            <CheckCheck className="size-4" aria-hidden /> Mark all read
          </button>
        )}
      </PageHead>
      <p className="mt-2 text-sm text-ink-2">
        When someone mentions you in a deal&apos;s note (type @ and their name), it lands here, and by email when email is set up.
      </p>
      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {!items && !problem && <p className="mt-6 text-sm text-muted">Loading…</p>}
      {items && items.length === 0 && (
        <p className={clsx(ui.card, "mt-6 p-5 text-sm text-ink-2")}>Nothing yet. No one has mentioned you.</p>
      )}
      <ul className="mt-6 space-y-2.5">
        {(items ?? []).map((n) => (
          <li key={n.id}>
            <Link
              href={`${PATHS.deals}/${n.jobId}`}
              className={clsx(ui.card, "block px-5 py-4 hover:ring-forest", !n.read && "border-l-[3px] border-sun-line")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-ink">
                  <AtSign className="mr-1 inline size-3.5 text-muted" aria-hidden />
                  <strong className="font-semibold">{handleOf(n.by)}</strong> mentioned you on{" "}
                  <strong className="font-semibold">{n.customer}</strong> <span className="text-ink-2">· {n.title}</span>
                </p>
                <span className="shrink-0 text-xs tabular-nums text-muted">{shortDate(n.at)}</span>
              </div>
              <p className={clsx("mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm", n.read ? "text-ink-2" : "text-ink")}>{n.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
