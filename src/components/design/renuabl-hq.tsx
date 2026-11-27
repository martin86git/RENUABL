"use client";

import clsx from "clsx";
import { Building2, LifeBuoy, Mail, MonitorPlay, UserRoundSearch, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BUSINESS_KINDS, kindLabel } from "@/lib/domain/design/business-kind";
import {
  HQ_TABS,
  cleanHqTab,
  isDemoOwner,
  isMadeUpOwner,
  leadKinds,
  leadWords,
  recentLeads,
  type HqLead,
  type HqTab,
} from "@/lib/domain/design/hq";
import { STAFF_STATE_WORDS } from "@/lib/domain/design/support";
import { answerTicket, loadHq, type HqView } from "@/lib/services/hq";
import { useDesignAccount } from "./design-account";
import { PageHead, ui } from "./design-shell";
import { InboxPage } from "./inbox";
import { staffView } from "./staff-view-as";

/**
 * RENUABL admin (27 Nov 2026, Martin): what runs the platform business, inside the product: who asked for a demo or
 * to talk to sales, the support tickets businesses raised, the emails that came in to his own mailboxes, and the
 * businesses signed up. Staff only: anyone else sees that there's nothing here. The cog's switch flicks between this
 * and the demo account.
 */
const when = (at: string) =>
  new Date(at).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });

const TAB_ICONS: Record<HqTab, LucideIcon> = { enquiries: UserRoundSearch, tickets: LifeBuoy, emails: Mail, businesses: Building2 };

export function RenuablHq() {
  const [account] = useDesignAccount();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const tab = cleanHqTab(params.get("tab"));
  const [view, setView] = useState<HqView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const staff = !!account?.signedIn && !!account.staff;
  const viewing = account?.signedIn ? (account.staffViewing ?? null) : null;

  const load = useCallback(async () => {
    const res = await loadHq();
    if (res.ok) {
      setProblem(null);
      setView({ leads: res.leads, tickets: res.tickets, businesses: res.businesses });
    } else setProblem(res.message);
  }, []);
  useEffect(() => {
    if (!staff) return;
    let gone = false;
    void loadHq().then((res) => {
      if (gone) return;
      if (res.ok) setView({ leads: res.leads, tickets: res.tickets, businesses: res.businesses });
      else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, [staff]);

  if (!account?.signedIn) return null;
  if (!staff) return <p className="text-sm text-ink-2">There&apos;s nothing here.</p>;

  const toDemo = async () => {
    setBusy(true);
    const res = await staffView("retailer");
    if (!res.ok) {
      setBusy(false);
      return setProblem(res.message ?? null);
    }
    window.location.replace("/design");
  };
  const toOwn = async () => {
    setBusy(true);
    await staffView("own");
    window.location.reload();
  };

  const real = (view?.businesses ?? []).filter((b) => !isMadeUpOwner(b.owner));
  const demos = (view?.businesses ?? []).filter((b) => isDemoOwner(b.owner));
  const toAnswer = (view?.tickets ?? []).filter((t) => t.state === "open").length;
  const counts: Record<HqTab, number> = {
    enquiries: view ? recentLeads(view.leads, new Date()) : 0,
    tickets: toAnswer,
    emails: 0,
    businesses: 0,
  };

  return (
    <div className={ui.page} data-admin-skin>
      <PageHead title="RENUABL admin">
        <button type="button" onClick={() => void toDemo()} disabled={busy} className={ui.quiet}>
          <MonitorPlay className="size-4" aria-hidden /> {viewing === "retailer" ? "Back to the demo" : "Open the demo account"}
        </button>
      </PageHead>
      <p className="mt-1 text-sm text-ink-2">
        Running RENUABL: who has asked about it, who needs help, what has come in, and who has signed up.
      </p>

      {viewing && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-sun px-4 py-3 text-sm text-sun-ink">
          <span className="flex-1">You&apos;re in the demo account. Emails are your own account&apos;s: go back to it to read them.</span>
          <button type="button" onClick={() => void toOwn()} disabled={busy} className="font-semibold underline underline-offset-4">
            Back to my account
          </button>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Enquiries this week" n={view ? counts.enquiries : null} sub={view ? `${view.leads.length} in all` : ""} />
        <Tile
          label="Tickets to answer"
          n={view ? toAnswer : null}
          sub={view ? `${view.tickets.length} open or recent` : ""}
          hot={toAnswer > 0}
        />
        <Tile label="Businesses signed up" n={view ? real.length : null} sub={view ? kindsLine(real) : ""} />
        <Tile label="Demos open" n={view ? demos.length : null} sub="Cleared after 30 days" />
      </div>

      <div role="tablist" aria-label="RENUABL admin" className="mt-6 flex flex-wrap gap-1.5">
        {HQ_TABS.map((t) => {
          const Icon = TAB_ICONS[t.id];
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => router.replace(`${path}?tab=${t.id}`, { scroll: false })}
              className={clsx(
                "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium ring-1 ring-inset transition-colors",
                on ? "bg-primary text-primary-ink ring-primary" : "bg-surface text-ink-2 ring-line hover:text-ink",
              )}
            >
              <Icon className="size-4" aria-hidden /> {t.label}
              {counts[t.id] > 0 && (
                <span
                  className={clsx(
                    "rounded-full px-1.5 text-[11px] font-semibold leading-5",
                    on ? "bg-primary-ink/15 text-primary-ink" : "bg-sun-line text-white",
                  )}
                >
                  {counts[t.id]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {problem && <p className="mt-4 text-sm text-warning">{problem}</p>}
      <div className="mt-4">
        {tab === "emails" ? (
          viewing ? (
            <p className={clsx(ui.card, "px-5 py-4 text-sm text-ink-2")}>Emails are in your own account, not the demo.</p>
          ) : (
            <InboxPage />
          )
        ) : !view ? (
          !problem && <p className="animate-pulse text-sm text-muted">Looking…</p>
        ) : tab === "enquiries" ? (
          <Enquiries leads={view.leads} />
        ) : tab === "tickets" ? (
          <Tickets tickets={view.tickets} onChange={load} />
        ) : (
          <Businesses rows={real} demos={demos.length} />
        )}
      </div>
    </div>
  );
}

const kindsLine = (rows: HqView["businesses"]) =>
  BUSINESS_KINDS.map((k) => {
    const n = rows.filter((b) => b.kind === k.kind).length;
    return `${n} ${k.label.toLowerCase()}${n === 1 ? "" : "s"}`;
  }).join(" · ");

function Tile({ label, n, sub, hot }: { label: string; n: number | null; sub: string; hot?: boolean }) {
  return (
    <div className={clsx(ui.card, "px-4 py-3")}>
      <p className="text-[12px] text-muted">{label}</p>
      <p className={clsx("mt-1 text-[26px] font-semibold leading-none tabular-nums", hot ? "text-sun-line" : "text-ink")}>{n ?? "–"}</p>
      <p className="mt-1.5 min-h-4 truncate text-[12px] text-muted">{sub}</p>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: "hot" | "good" }) {
  return (
    <span
      className={clsx(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "hot" ? "bg-sun text-sun-ink" : tone === "good" ? "bg-sage text-positive" : "bg-surface-2 text-ink-2",
      )}
    >
      {children}
    </span>
  );
}

function Enquiries({ leads }: { leads: HqLead[] }) {
  const [kind, setKind] = useState<string | null>(null);
  const kinds = leadKinds(leads);
  const shown = kind ? leads.filter((l) => l.kind === kind) : leads;
  if (leads.length === 0)
    return (
      <p className={clsx(ui.card, "px-5 py-4 text-sm text-ink-2")}>
        Nobody has asked yet. People show here once they give their details in the demo, ask to talk to sales, or join the Marketplace list.
      </p>
    );
  const chip = (id: string | null, label: string, n: number) => (
    <button
      key={id ?? "all"}
      type="button"
      onClick={() => setKind(id)}
      aria-pressed={kind === id}
      className={clsx(
        "h-8 rounded-full px-3 text-[13px] font-medium ring-1 ring-inset",
        kind === id ? "bg-surface text-ink ring-ink" : "text-ink-2 ring-line hover:text-ink",
      )}
    >
      {label} · {n}
    </button>
  );
  return (
    <div>
      {kinds.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {chip(null, "All", leads.length)}
          {kinds.map((k) => chip(k, leadWords(k), leads.filter((l) => l.kind === k).length))}
        </div>
      )}
      <ul className={clsx(ui.card, "divide-y divide-line")}>
        {shown.map((l) => (
          <li key={l.id} className="px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">{l.name || l.business || l.email}</span>
              {l.name && l.business && <span className="text-sm text-ink-2">{l.business}</span>}
              <Pill tone={l.kind === "demo" ? "hot" : undefined}>{leadWords(l.kind)}</Pill>
              <span className="ml-auto text-[12px] tabular-nums text-muted">{when(l.at)}</span>
            </div>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <a href={`mailto:${l.email}`} className={ui.link}>
                {l.email}
              </a>
              {l.mobile && (
                <a href={`tel:${l.mobile}`} className={ui.link}>
                  {l.mobile}
                </a>
              )}
              {l.users ? <span className="text-ink-2">{l.users} users</span> : null}
            </p>
            {l.note && <p className="mt-1.5 whitespace-pre-line text-[13px] text-ink-2">{l.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tickets({ tickets, onChange }: { tickets: HqView["tickets"]; onChange: () => Promise<void> }) {
  if (tickets.length === 0) return <p className={clsx(ui.card, "px-5 py-4 text-sm text-ink-2")}>No business has raised a ticket.</p>;
  // What needs a reply first: urgent, then the longest waiting.
  const order = [...tickets].sort(
    (a, b) =>
      Number(b.state === "open") - Number(a.state === "open") ||
      Number(b.urgent) - Number(a.urgent) ||
      (a.state === "open" ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt)),
  );
  return (
    <ul className={clsx(ui.card, "divide-y divide-line")}>
      {order.map((t) => (
        <li key={t.id} className="px-5 py-4">
          <details open={t.state === "open"}>
            <summary className="cursor-pointer list-none">
              <span className="flex flex-wrap items-center gap-2">
                <Pill tone={t.state === "open" ? "hot" : t.state === "resolved" ? "good" : undefined}>{STAFF_STATE_WORDS[t.state]}</Pill>
                {t.urgent && t.state !== "resolved" && <Pill tone="hot">Urgent</Pill>}
                <span className="text-sm font-semibold text-ink">{t.subject}</span>
                <span className="ml-auto text-[12px] tabular-nums text-muted">{when(t.updatedAt)}</span>
              </span>
              <span className="mt-1 block text-[13px] text-muted">
                {t.ref} · {t.business} ({t.kind}) · {t.by} · {t.area}
              </span>
            </summary>
            <ol className="mt-3 space-y-2.5">
              {t.messages.map((m) => (
                <li key={m.id} className={clsx("border-l-2 pl-3", m.side === "renuabl" ? "border-line" : "border-ink")}>
                  <p className="text-[12px] text-muted">
                    {m.side === "renuabl" ? `RENUABL${m.by ? ` · ${m.by}` : ""}` : m.by} · {when(m.at)}
                  </p>
                  <p className="whitespace-pre-line text-sm text-ink">{m.text}</p>
                </li>
              ))}
            </ol>
            <Reply id={t.id} resolved={t.state === "resolved"} onChange={onChange} />
          </details>
        </li>
      ))}
    </ul>
  );
}

function Reply({ id, resolved, onChange }: { id: string; resolved: boolean; onChange: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const send = async (body: Parameters<typeof answerTicket>[0]) => {
    setBusy(true);
    const res = await answerTicket(body);
    if (!res.ok) {
      setBusy(false);
      return setSaid(res.message);
    }
    if (body.do === "reply") {
      setText("");
      setSaid(res.emailed ? "Sent, and emailed to them." : "Sent. Not emailed: they'll see it in RENUABL.");
    } else setSaid(null);
    await onChange();
    setBusy(false);
  };
  const small = "h-8 px-3 text-[13px]";
  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={4000}
        placeholder="Reply as RENUABL support"
        aria-label="Reply as RENUABL support"
        className={clsx(ui.input, "min-h-20 py-2")}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void send({ id, do: "reply", text })}
          className={clsx(ui.primary, small)}
        >
          Reply
        </button>
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void send({ id, do: "reply", text, resolve: true })}
          className={clsx(ui.quiet, small)}
        >
          Reply and resolve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void send({ id, do: resolved ? "reopen" : "resolve" })}
          className={clsx(ui.quiet, small)}
        >
          {resolved ? "Open again" : "Resolve"}
        </button>
        {said && <span className="text-[13px] text-muted">{said}</span>}
      </div>
    </div>
  );
}

function Businesses({ rows, demos }: { rows: HqView["businesses"]; demos: number }) {
  return (
    <div>
      {rows.length === 0 ? (
        <p className={clsx(ui.card, "px-5 py-4 text-sm text-ink-2")}>No business has signed up yet.</p>
      ) : (
        <ul className={clsx(ui.card, "divide-y divide-line")}>
          {rows.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <span className="min-w-0">
                <span className="text-sm font-semibold text-ink">{b.name}</span>
                <span className="block text-[13px] text-muted">
                  Joined{" "}
                  {new Date(`${b.createdAt}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                  {b.members} {b.members === 1 ? "person" : "people"}
                  {b.owner && (
                    <>
                      {" · "}
                      <a href={`mailto:${b.owner}`} className="underline underline-offset-4 hover:text-ink">
                        {b.owner}
                      </a>
                    </>
                  )}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {b.notBilled && <Pill tone="good">Not billed</Pill>}
                <Pill>{kindLabel(b.kind)}</Pill>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[13px] text-muted">
        {demos} {demos === 1 ? "demo" : "demos"} open and the sample businesses are left out. Plan codes, add-ons, billing switches and the
        homeowner side are on{" "}
        <Link href="/admin" className={ui.link}>
          the staff page
        </Link>
        .
      </p>
    </div>
  );
}
