"use client";

import clsx from "clsx";
import { ArrowLeft, Bot, Copy, ExternalLink, Lock, Paperclip, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { INBOX_FILTERS, NOTE_MAX, dayGroup, filterInbox, type InboxEmail, type InboxFilter } from "@/lib/domain/design/inbox";
import {
  CONNECT_GMAIL,
  disconnectGmail,
  emailFileHref,
  loadInbox,
  noteOnEmail,
  openInboxEmail,
  solOnEmail,
  type InboxAnswer,
  type OpenedEmail,
} from "@/lib/services/inbox";
import { useDesignAccount } from "./design-account";
import { PATHS, PageHead, ui } from "./design-shell";
import { SolIcon } from "./sol-icon";

const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString("en-AU", {
    ...(today ? { hour: "numeric", minute: "2-digit" } : { day: "numeric", month: "short" }),
    timeZone: "Australia/Melbourne",
  });
};
const handle = (email: string) => email.split("@")[0];
const GMAIL_SAYS: Record<string, string> = {
  connected: "Gmail is connected.",
  failed: "Gmail couldn't be connected. Try again, and allow RENUABL to read your email when Google asks.",
  off: "Connecting Gmail isn't set up here yet.",
  "signed-out": "Sign in to your business first.",
};

/**
 * Email (1 Nov 2026, Martin: Primero's copied across, wave 7): this member's own Gmail inbox, read only. The newest
 * emails by day, customers' with their deal, machines' quieter; an email opens over the list as sent, with private
 * notes beside it (tag someone to share that one email with them), and Sol to sum it up or draft a reply.
 */
export function InboxPage() {
  const [data, setData] = useState<InboxAnswer | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [asks, setAsks] = useState(0);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<{ id: string; owner?: string } | null>(null);
  const said = useSearchParams().get("gmail");
  useEffect(() => {
    let gone = false;
    void loadInbox().then((res) => {
      if (gone) return;
      if (res.ok) {
        setData(res);
        setProblem(null);
      } else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, [asks]);
  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = data ? filterInbox(data.emails, filter, search) : [];
  const groups: { day: string; emails: InboxEmail[] }[] = [];
  for (const e of shown) {
    const day = dayGroup(e.at, now);
    if (groups.at(-1)?.day === day) groups.at(-1)!.emails.push(e);
    else groups.push({ day, emails: [e] });
  }

  if (open) return <EmailView id={open.id} owner={open.owner} onBack={() => setOpen(null)} />;
  return (
    <div className={clsx(ui.page, "space-y-4")}>
      <PageHead title="Email">
        {data?.connected && (
          <>
            <span className="text-sm text-muted">{data.address}</span>
            <button type="button" className={clsx(ui.quiet, "h-9 px-3")} onClick={() => setAsks((n) => n + 1)}>
              <RefreshCw className="size-4" aria-hidden /> Refresh
            </button>
            <button
              type="button"
              className="text-xs text-muted underline underline-offset-4 hover:text-ink"
              onClick={async () => {
                if (!window.confirm("Disconnect your Gmail? RENUABL stops reading it, and Google is told to forget the connection."))
                  return;
                await disconnectGmail();
                setAsks((n) => n + 1);
              }}
            >
              Disconnect
            </button>
          </>
        )}
      </PageHead>
      {said && GMAIL_SAYS[said] && (
        <p
          className={clsx(
            "rounded-md px-4 py-2.5 text-sm",
            said === "connected" ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning",
          )}
          role="status"
        >
          {GMAIL_SAYS[said]}
        </p>
      )}
      {problem && (
        <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {data && data.shared.length > 0 && (
        <section className={clsx(ui.card, "p-4")} aria-label="Shared with you">
          <p className={ui.eyebrow}>Shared with you</p>
          <ul className="mt-2 divide-y divide-line">
            {data.shared.map((s) => (
              <li key={`${s.owner}-${s.id}`}>
                <button
                  type="button"
                  onClick={() => setOpen({ id: s.id, owner: s.owner })}
                  className="flex w-full items-center gap-3 py-2 text-left hover:bg-surface-2"
                >
                  <span className="w-40 shrink-0 truncate text-sm font-medium text-ink">{s.from.name}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{s.subject}</span>
                  <span className="shrink-0 text-xs text-muted">
                    from {handle(s.owner)} · {s.notes} {s.notes === 1 ? "note" : "notes"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!data ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : data.viewing ? (
        <p className={clsx(ui.card, "p-5 text-sm text-ink-2")}>You&apos;re viewing as someone else: their mailbox isn&apos;t read.</p>
      ) : !data.connected ? (
        <ConnectCard ready={data.ready !== false} broken={data.broken} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Show" className="flex rounded-md border border-line bg-surface-2 p-0.5 text-sm">
              {INBOX_FILTERS.map((f) => (
                <button
                  key={f.id}
                  role="radio"
                  aria-checked={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={clsx(
                    "rounded-[5px] px-3 py-1",
                    filter === f.id ? "bg-surface text-ink shadow-[0_1px_3px_rgba(11,11,12,0.12)]" : "text-ink-2",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search these emails"
                className={clsx(ui.input, "h-9 min-h-9 pl-9")}
              />
            </div>
          </div>
          {!shown.length ? (
            <p className="text-sm text-ink-2">Nothing here.</p>
          ) : (
            <div className={clsx(ui.card, "overflow-hidden")}>
              {groups.map((g) => (
                <section key={g.day}>
                  <p className="border-b border-line bg-surface-2 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                    {g.day}
                  </p>
                  <ul className="divide-y divide-line">
                    {g.emails.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setOpen({ id: e.id })}
                          className={clsx(
                            "relative flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2",
                            e.automated && "opacity-70",
                          )}
                        >
                          {e.unread && <span className="absolute inset-y-1 left-0 w-1 rounded-r bg-sun-line" aria-label="Unread" />}
                          <span
                            className={clsx(
                              "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                              e.deal ? "bg-sun-line text-white" : e.automated ? "bg-surface-2 text-muted" : "bg-ink text-white",
                            )}
                            aria-hidden
                          >
                            {e.automated ? <Bot className="size-4" /> : (e.from.name[0] ?? "?").toUpperCase()}
                          </span>
                          <span className="w-44 shrink-0 truncate">
                            <span className={clsx("block truncate text-sm", e.unread ? "font-semibold text-ink" : "text-ink")}>
                              {e.from.name}
                            </span>
                            {e.deal ? (
                              <span className="block truncate text-[11px] text-sun-ink">{e.deal.customer}&apos;s deal</span>
                            ) : e.automated ? (
                              <span className="block text-[11px] text-muted">Automated</span>
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            <span className={clsx(e.unread ? "font-semibold text-ink" : "text-ink")}>{e.subject}</span>
                            <span className="text-muted"> · {e.snippet}</span>
                          </span>
                          {e.notes > 0 && <span className="shrink-0 rounded-full bg-sun px-2 text-[11px] text-sun-ink">{e.notes}</span>}
                          <span className="w-16 shrink-0 text-right text-xs text-muted">{when(e.at)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <p className="text-xs text-muted">
            The newest {data.emails.length} in your inbox. RENUABL only reads: archive, mark read and reply in Gmail or from the deal&apos;s
            Email tab.
          </p>
        </>
      )}
    </div>
  );
}

function ConnectCard({ ready, broken }: { ready: boolean; broken?: string }) {
  return (
    <section className={clsx(ui.card, "max-w-xl p-6")}>
      <h2 className="text-lg font-semibold tracking-tight text-ink">Connect your Gmail</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        See your inbox here with each customer&apos;s deal beside their emails, keep notes on an email, and share one with a teammate.
        RENUABL only reads your email: it never sends, deletes or changes anything in it. Only you see your inbox.
      </p>
      {broken && <p className="mt-3 text-sm text-warning">{broken}</p>}
      {ready ? (
        <a href={CONNECT_GMAIL} className={clsx(ui.primary, "mt-4")}>
          Connect Gmail
        </a>
      ) : (
        <p className="mt-4 text-sm text-muted">Connecting Gmail isn&apos;t set up here yet (it needs the Google sign-in set up).</p>
      )}
      <p className="mt-3 text-xs text-muted">Until Google has reviewed RENUABL, only test accounts can connect.</p>
    </section>
  );
}

function EmailView({ id, owner, onBack }: { id: string; owner?: string; onBack: () => void }) {
  const [account] = useDesignAccount();
  const me = account?.signedIn ? account.email.toLowerCase() : "";
  const [email, setEmail] = useState<OpenedEmail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [told, setTold] = useState<string[]>([]);
  const [sol, setSol] = useState<{ mode: "summary" | "reply"; text: string | null } | null>(null);
  useEffect(() => {
    let gone = false;
    void openInboxEmail(id, owner).then((res) => {
      if (gone) return;
      if (res.ok) setEmail(res.email);
      else setProblem(res.message);
    });
    return () => {
      gone = true;
    };
  }, [id, owner]);
  const send = async () => {
    if (!email || !note.trim()) return;
    const res = await noteOnEmail(id, email.owner, note.trim());
    if (!res.ok) return setProblem(res.message);
    setEmail(res.email);
    setTold(res.told);
    setNote("");
  };
  const askSol = async (mode: "summary" | "reply") => {
    if (!email) return;
    setSol({ mode, text: null });
    const res = await solOnEmail(id, email.owner, mode);
    setSol({ mode, text: res.ok ? res.text : res.message });
  };
  return (
    <div className={clsx(ui.page, "space-y-4")}>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Back to the inbox
      </button>
      {problem && (
        <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      {!email ? (
        !problem && <p className="text-sm text-muted">Opening…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <article className={clsx(ui.card, "min-w-0 p-5")}>
            <h1 className="text-xl font-semibold tracking-tight text-ink">{email.subject}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white" aria-hidden>
                {(email.from.name[0] ?? "?").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">
                  <span className="font-medium">{email.from.name}</span> <span className="text-muted">&lt;{email.from.email}&gt;</span>
                </p>
                <p className="text-xs text-muted">
                  {email.copy ? `Shared by ${handle(email.owner)}` : "to me"} ·{" "}
                  {new Date(email.at).toLocaleString("en-AU", { timeZone: "Australia/Melbourne" })}
                </p>
              </div>
              {email.deal && (
                <Link
                  href={`${PATHS.deals}/${encodeURIComponent(email.deal.id)}`}
                  className="rounded-full bg-sun px-3 py-1 text-xs font-medium text-sun-ink hover:brightness-95"
                >
                  {email.deal.customer}&apos;s deal
                </Link>
              )}
              {!email.copy && (
                <a
                  href={`https://mail.google.com/mail/u/0/#all/${email.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                >
                  Open in Gmail <ExternalLink className="size-3" aria-hidden />
                </a>
              )}
            </div>
            <div className="mt-4 border-t border-line pt-4">
              {email.html ? (
                // The email as sent, in a frame where nothing runs; links open in a new tab.
                <iframe
                  title="The email"
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  srcDoc={email.html}
                  className="h-[60dvh] w-full rounded-md bg-white"
                />
              ) : (
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{email.text || "(No words in this email.)"}</p>
              )}
            </div>
            {email.files.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {email.files.map((f) => (
                  <li key={f.n}>
                    <a
                      href={emailFileHref(email.id, f.n)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink hover:border-forest"
                    >
                      <Paperclip className="size-3.5" aria-hidden /> {f.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </article>
          <aside className="space-y-4">
            <section className={clsx(ui.card, "p-4")}>
              <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <Lock className="size-3.5" aria-hidden /> Notes on this email
              </p>
              <p className="text-xs text-muted">
                Only you and anyone you tag can see these. Tagging someone shares this one email with them.
              </p>
              <ul className="mt-3 space-y-2">
                {email.notes.map((n) => (
                  <li key={n.id} className="rounded-md bg-sun px-3 py-2">
                    <p className="whitespace-pre-line text-sm text-ink">{n.text}</p>
                    <p className="mt-1 text-[11px] text-sun-ink">
                      {n.by === me ? "You" : handle(n.by)} · {when(n.at)}
                    </p>
                  </li>
                ))}
              </ul>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                maxLength={NOTE_MAX}
                placeholder="A note, @someone to share it. Enter sends."
                className={clsx(ui.input, "mt-3 min-h-16 py-2")}
              />
              {told.length > 0 && <p className="mt-1 text-xs text-positive">Shared with {told.map(handle).join(", ")}.</p>}
              {email.shared.length > 0 && <p className="mt-1 text-xs text-muted">Shared with {email.shared.map(handle).join(", ")}.</p>}
            </section>
            <section className={clsx(ui.card, "p-4")}>
              <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <SolIcon className="size-3.5 text-sun-line" aria-hidden /> Sol
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" className={clsx(ui.quiet, "h-8 px-3 text-xs")} onClick={() => void askSol("summary")}>
                  Summarise
                </button>
                <button type="button" className={clsx(ui.quiet, "h-8 px-3 text-xs")} onClick={() => void askSol("reply")}>
                  Draft a reply
                </button>
              </div>
              {sol && (
                <div className="mt-3 rounded-md bg-surface-2 p-3">
                  <p className="whitespace-pre-line text-sm text-ink">{sol.text ?? "Sol is reading it…"}</p>
                  {sol.text && sol.mode === "reply" && (
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(sol.text ?? "")}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink"
                    >
                      <Copy className="size-3" aria-hidden /> Copy, then send it from {email.deal ? "the deal's Email tab" : "Gmail"}
                    </button>
                  )}
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted">Nothing is sent and nothing Sol writes is kept.</p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
