"use client";

import Link from "next/link";
import { openUsagePop, usagePopReady } from "./usage-pop";
import { useEffect, useState } from "react";
import { ChevronRight, KeyRound, Lock, Camera, Settings2 } from "lucide-react";
import { METER_WORDS, percentWords } from "@/lib/domain/design/usage";
import { loadUsageBrief, type MeterNow } from "@/lib/services/usage";
import { MemberAvatar } from "./member-avatar";

/**
 * The phone's More menu, its first two parts (23 Nov 2026, Martin: "It's a menu not a summary page. So the first thing
 * in there should be profile. And any settings to do with profile. Then below it should be usage").
 */

const ACCOUNT = "/design/account";

/** You: your photo, name and email, and the settings that are yours alone (all on Your account). */
export function MoreProfile({
  email,
  firstName,
  business,
  onGo,
}: {
  email: string;
  firstName?: string;
  business?: string;
  onGo: () => void;
}) {
  // A fresh look at the photo each time the menu opens, so one just changed shows.
  const [seen] = useState(() => Date.now());
  const rows = [
    { label: "Your photo", href: `${ACCOUNT}#your-photo`, icon: Camera },
    { label: "Password", href: `${ACCOUNT}#password`, icon: KeyRound },
    { label: "Screen lock and devices", href: `${ACCOUNT}#screen-lock`, icon: Lock },
  ];
  return (
    <section aria-label="Your profile" className="mt-3 rounded-2xl bg-canvas p-1.5">
      <Link href={ACCOUNT} onClick={onGo} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5">
        <MemberAvatar email={email} photo={seen} className="size-12 text-[15px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold text-ink">{firstName || email.split("@")[0]}</span>
          <span className="block truncate text-[13px] text-muted">{email}</span>
          {business && <span className="block truncate text-[13px] text-muted">{business}</span>}
        </span>
        <ChevronRight className="size-5 text-muted" aria-hidden />
      </Link>
      <div className="mx-2.5 border-t border-line" />
      {rows.map((r) => (
        <Link key={r.href} href={r.href} onClick={onGo} className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-[15px] text-ink">
          <r.icon className="size-[18px] text-muted" aria-hidden />
          <span className="flex-1">{r.label}</span>
        </Link>
      ))}
    </section>
  );
}

/** This month's allowances, as bars; only for those who may see them (the server answers null otherwise). */
export function MoreUsage({ billing, onGo }: { billing: boolean; onGo: () => void }) {
  const [meters, setMeters] = useState<MeterNow[] | null>(null);
  useEffect(() => {
    let gone = false;
    void loadUsageBrief().then((m) => !gone && setMeters(m));
    return () => {
      gone = true;
    };
  }, []);
  if (!meters) return null;
  return (
    <section aria-label="Usage this month" className="mt-2">
      <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Usage this month</p>
      <Link
        href="/design/settings/usage"
        onClick={(e) => {
          onGo();
          // The box with the top-ups when it can open here (usage-pop.tsx), else the Usage page.
          if (!usagePopReady()) return;
          e.preventDefault();
          openUsagePop();
        }}
        className="block rounded-2xl border border-line px-3.5 py-3"
      >
        {meters.map((m) => {
          const tone = m.percent >= 100 ? "bg-danger" : m.percent >= 80 ? "bg-sun-line" : "bg-ink";
          return (
            <span key={m.key} className="mb-3 block last:mb-0">
              <span className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="truncate text-ink">{METER_WORDS[m.key].label}</span>
                <span className="shrink-0 tabular-nums text-ink-2">{percentWords(m)}</span>
              </span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line">
                <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, m.percent))}%` }} />
              </span>
            </span>
          );
        })}
        {!meters.length && <span className="block text-[14px] text-muted">Sol, design credits and Calls &amp; Texts</span>}
        <span className="mt-2 flex items-center justify-end gap-1 text-[13px] font-medium text-ink-2">
          See all usage <ChevronRight className="size-4" aria-hidden />
        </span>
      </Link>
      {billing && (
        <Link href="/design/settings" onClick={onGo} className="mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] text-ink">
          <Settings2 className="size-[18px] text-muted" aria-hidden />
          <span className="flex-1">Business settings and billing</span>
        </Link>
      )}
    </section>
  );
}
