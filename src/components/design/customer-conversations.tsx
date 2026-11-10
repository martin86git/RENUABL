"use client";

import clsx from "clsx";
import { CheckCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ChatThread } from "@/lib/domain/design/chat";
import type { Notification } from "@/lib/server/design-notifications-repo";
import { loadNotifications, markNotificationsRead, shortDate } from "@/lib/services/crm";
import { lineTime, loadMessages } from "@/lib/services/chat";

/**
 * The customers' side of team chat (10 Nov 2026, Martin: the bell went; customer chat is a toggle inside team chat):
 * every conversation with a customer, those waiting on a reply first, each opening its deal's chat; then the times a
 * teammate mentioned this member on a deal.
 */
export function CustomerConversations({ deal, onOpen }: { deal: (id: string) => string; onOpen?: () => void }) {
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void loadMessages().then((res) => live && setThreads(res.ok ? res.threads : []));
    void loadNotifications().then((res) => live && (res.ok ? setItems(res.notifications) : setProblem(res.message)));
    return () => {
      live = false;
    };
  }, []);
  const read = async (which: { ids?: string[]; all?: boolean }) => {
    const res = await markNotificationsRead(which);
    if (!res.ok) return setProblem(res.message);
    setItems((all) => (all ?? []).map((n) => (which.all || which.ids?.includes(n.id) ? { ...n, read: true } : n)));
    window.dispatchEvent(new Event("renuabl:notifications"));
  };
  const waiting = threads ? [...threads.filter((t) => t.unread > 0), ...threads.filter((t) => !t.unread)] : null;
  const unreadMentions = (items ?? []).filter((n) => !n.read).length;
  return (
    <div className="staff-scroll min-h-0 flex-1 overflow-y-auto p-3">
      {problem && <p className="px-3 py-2 text-sm text-warning">{problem}</p>}
      <p className={heading}>Customers</p>
      {!waiting && <p className="animate-pulse px-3 py-3 text-sm text-muted">Looking…</p>}
      {waiting?.length === 0 && <p className="px-3 pb-3 pt-1 text-[13px] text-muted">No messages from customers yet.</p>}
      {waiting?.map((t) => (
        <Link
          key={t.jobId}
          href={`${deal(t.jobId)}?tab=chat`}
          onClick={onOpen}
          className={clsx("block rounded-xl px-3 py-2.5 hover:bg-canvas", t.unread > 0 && "bg-sun/60")}
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className={clsx("truncate text-[13px] text-ink", t.unread > 0 && "font-semibold")}>
              {t.customerName}
              {t.unread > 0 && <span className="ml-1.5 text-[11px] font-semibold text-sun-ink">{t.unread} new</span>}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted">{lineTime(t.at)}</span>
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-ink-2">{t.last}</span>
        </Link>
      ))}

      <p className={clsx(heading, "mt-3 flex items-baseline justify-between")}>
        Mentions
        {unreadMentions > 0 && (
          <button
            type="button"
            onClick={() => void read({ all: true })}
            className="inline-flex items-center gap-1 text-[11px] font-medium normal-case tracking-normal text-ink-2 hover:text-ink"
          >
            <CheckCheck className="size-3.5" aria-hidden /> Mark all read
          </button>
        )}
      </p>
      {!items && !problem && <p className="animate-pulse px-3 py-3 text-sm text-muted">Looking…</p>}
      {items?.length === 0 && <p className="px-3 pb-3 pt-1 text-[13px] text-muted">No one has mentioned you.</p>}
      {items?.map((n) => (
        <div key={n.id} className={clsx("rounded-xl px-3 py-2.5", !n.read && "bg-sun/60")}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13px] font-medium text-ink">
              {n.by.split("@")[0]} mentioned you · {n.customer}
            </p>
            <span className="shrink-0 text-[11px] text-muted">{shortDate(n.at)}</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2">{n.text}</p>
          <div className="mt-1.5 flex gap-3 text-xs font-medium">
            <Link href={deal(n.jobId)} onClick={onOpen} className="text-ink underline underline-offset-4">
              Open deal
            </Link>
            {!n.read && (
              <button type="button" onClick={() => void read({ ids: [n.id] })} className="text-ink-2 hover:text-ink">
                Mark as read
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const heading = "px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted";
