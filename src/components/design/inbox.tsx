"use client";

import clsx from "clsx";
import { Archive, ArrowLeft, Bot, Copy, ExternalLink, Lock, Mail, MailOpen, Paperclip, Plus, RefreshCw, Search, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  INBOX_FILTERS,
  NOTE_MAX,
  afterAction,
  dayGroup,
  filterInbox,
  type EmailAction,
  type InboxEmail,
  type InboxFilter,
} from "@/lib/domain/design/inbox";
import {
  changeInboxEmail,
  connectGmailHere,
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
  failed: "Gmail couldn't be connected. Try again, and allow RENUABL to read and organise your email when Google asks.",
  off: "Connecting Gmail isn't set up here yet.",
  "signed-out": "Sign in to your business first.",
  full: "That's as many mailboxes as one person can connect. Disconnect one to add another.",
};

/**
 * Email (1 Nov 2026, Martin: Primero's copied across, wave 7): this member's own Gmail inbox. Opening an email marks
 * it read in Gmail, and it can be marked unread or archived here, the same in Gmail (5 Nov 2026, Martin). The newest
 * emails by day, customers' with their deal, machines' quieter; an email opens over the list as sent, with private
 * notes beside it (tag someone to share that one email with them), and Sol to sum it up or draft a reply.
 */
export function InboxPage() {
  const [data, setData] = useState<InboxAnswer | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [asks, setAsks] = useState(0);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<{ id: string; owner?: string; box?: string } | null>(null);
  // One mailbox picked out of several (5 Nov 2026: a person may connect more than one); none is every mailbox.
  const [box, setBox] = useState<string | null>(null);
  // How connecting went: from the small Google window (connected then and there), else from coming back from Google.
  const [heard, setHeard] = useState<string | null>(null);
  const cameBack = useSearchParams().get("gmail");
  const said = heard ?? cameBack;
  const connect = async (add = false) => {
    const outcome = await connectGmailHere(add);
    if (outcome === "closed") return;
    setHeard(outcome);
    setAsks((n) => n + 1);
  };
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
  const boxes = data?.addresses ?? (data?.address ? [data.address] : []);
  const changeable = data?.changeable ?? [];
  const readOnly = boxes.filter((b) => !changeable.includes(b));
  // What was done to an email, kept in the list as Gmail now has it (no need to ask Gmail again).
  const changed = (id: string, b: string | undefined, action: EmailAction) =>
    setData((d) => (d ? { ...d, emails: afterAction(d.emails, id, b, action) } : d));
  const [rowProblem, setRowProblem] = useState<string | null>(null);
  const archiveRow = async (e: InboxEmail) => {
    setRowProblem(null);
    const res = await changeInboxEmail(e.id, e.box, "archive");
    if (res.ok) changed(e.id, e.box, "archive");
    else setRowProblem(res.message);
  };
  const picked = box && boxes.includes(box) ? box : undefined;
  const shown = data ? filterInbox(data.emails, filter, search, picked) : [];
  const groups: { day: string; emails: InboxEmail[] }[] = [];
  for (const e of shown) {
    const day = dayGroup(e.at, now);
    if (groups.at(-1)?.day === day) groups.at(-1)!.emails.push(e);
    else groups.push({ day, emails: [e] });
  }

  if (open)
    return (
      <EmailView
        id={open.id}
        owner={open.owner}
        box={open.box}
        onBack={() => setOpen(null)}
        onChanged={(action) => changed(open.id, open.box, action)}
        onReconnect={() => void connect(true)}
      />
    );
  return (
    <div className={clsx(ui.page, "space-y-4")}>
      <PageHead title="Email">
        {data?.connected && (
          <button type="button" className={clsx(ui.quiet, "h-9 px-3")} onClick={() => setAsks((n) => n + 1)}>
            <RefreshCw className="size-4" aria-hidden /> Refresh
          </button>
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
        <ConnectCard ready={data.ready !== false} broken={data.broken} onConnect={() => void connect()} />
      ) : (
        <>
          <Mailboxes
            boxes={boxes}
            picked={picked}
            more={data.more !== false}
            onAdd={() => void connect(true)}
            onPick={(b) => setBox(b)}
            onRemove={async (b) => {
              if (!window.confirm(`Disconnect ${b}? RENUABL stops reading it, and Google is told to forget the connection.`)) return;
              await disconnectGmail(b);
              if (box === b) setBox(null);
              setAsks((n) => n + 1);
            }}
          />
          {readOnly.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-sun px-4 py-2.5 text-sm text-sun-ink" role="status">
              <span>
                {readOnly.join(", ")} {readOnly.length === 1 ? "was" : "were"} connected read only. Connect again to mark emails read and
                archive them from here.
              </span>
              <button type="button" onClick={() => void connect(true)} className="font-medium underline underline-offset-2">
                Connect again
              </button>
            </p>
          )}
          {rowProblem && (
            <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
              {rowProblem}
            </p>
          )}
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
                      <li key={`${e.box ?? ""}-${e.id}`} className="group relative">
                        <button
                          type="button"
                          onClick={() => setOpen({ id: e.id, box: e.box })}
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
                            {boxes.length > 1 && !picked && e.box && (
                              <span className="block truncate text-[11px] text-muted">to {e.box}</span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            <span className={clsx(e.unread ? "font-semibold text-ink" : "text-ink")}>{e.subject}</span>
                            <span className="text-muted"> · {e.snippet}</span>
                          </span>
                          {e.notes > 0 && <span className="shrink-0 rounded-full bg-sun px-2 text-[11px] text-sun-ink">{e.notes}</span>}
                          <span className="w-16 shrink-0 text-right text-xs text-muted">{when(e.at)}</span>
                        </button>
                        {e.box && changeable.includes(e.box) && (
                          <button
                            type="button"
                            onClick={() => void archiveRow(e)}
                            aria-label={`Archive "${e.subject}"`}
                            title="Archive"
                            className="absolute right-2 top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink-2 shadow-[0_1px_3px_rgba(11,11,12,0.16)] hover:text-ink group-focus-within:flex group-hover:flex"
                          >
                            <Archive className="size-4" aria-hidden />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <p className="text-xs text-muted">
            The newest {data.emails.length} {boxes.length > 1 ? "across your inboxes" : "in your inbox"}. Opening an email marks it read,
            and archiving here archives it in Gmail too. Reply in Gmail or from the deal&apos;s Email tab.
          </p>
        </>
      )}
    </div>
  );
}

/** The mailboxes this person has connected: each picks the inbox down to it, or goes; and room to add another. */
function Mailboxes({
  boxes,
  picked,
  more,
  onPick,
  onRemove,
  onAdd,
}: {
  boxes: string[];
  picked?: string;
  more: boolean;
  onAdd: () => void;
  onPick: (box: string | null) => void;
  onRemove: (box: string) => void;
}) {
  const chip = (on: boolean) =>
    clsx(
      "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] ring-1 transition",
      on ? "bg-primary text-primary-ink ring-primary" : "bg-surface text-ink-2 ring-line hover:text-ink",
    );
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Your mailboxes">
      {boxes.length > 1 && (
        <button type="button" className={chip(!picked)} onClick={() => onPick(null)} aria-pressed={!picked}>
          All mailboxes
        </button>
      )}
      {boxes.map((b) => (
        <span key={b} className={clsx(chip(picked === b), "pr-1")}>
          <button type="button" onClick={() => onPick(picked === b ? null : b)} aria-pressed={picked === b} className="truncate">
            {b}
          </button>
          <button
            type="button"
            onClick={() => onRemove(b)}
            aria-label={`Disconnect ${b}`}
            title={`Disconnect ${b}`}
            className="inline-flex size-6 items-center justify-center rounded-full opacity-60 hover:opacity-100"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      {more && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          <Plus className="size-4" aria-hidden /> Add another Gmail
        </button>
      )}
    </div>
  );
}

function ConnectCard({ ready, broken, onConnect }: { ready: boolean; broken?: string; onConnect: () => void }) {
  return (
    <section className={clsx(ui.card, "max-w-xl p-6")}>
      <h2 className="text-lg font-semibold tracking-tight text-ink">Connect your email</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Connect one Gmail or several (your own and a shared one like sales@) and see them here as one inbox, with each customer&apos;s deal
        beside their emails. Keep notes on an email, and share one with a teammate. Opening an email marks it read in Gmail, and you can
        archive it or mark it unread from here. RENUABL never sends or deletes your email. Only you see your inbox.
      </p>
      {broken && <p className="mt-3 text-sm text-warning">{broken}</p>}
      {ready ? (
        <button type="button" onClick={onConnect} className={clsx(ui.primary, "mt-4")}>
          Connect with Google
        </button>
      ) : (
        <p className="mt-4 text-sm text-muted">Connecting Gmail isn&apos;t set up here yet (it needs the Google sign-in set up).</p>
      )}
      <p className="mt-3 text-xs text-muted">
        Google opens in a small window: pick your account and allow access, and your inbox appears here. Until Google has reviewed RENUABL,
        only test accounts can connect.
      </p>
    </section>
  );
}

function EmailView({
  id,
  owner,
  box,
  onBack,
  onChanged,
  onReconnect,
}: {
  id: string;
  owner?: string;
  box?: string;
  onBack: () => void;
  /** Tells the inbox what was done to it (read on opening, unread, archived). */
  onChanged: (action: EmailAction) => void;
  onReconnect: () => void;
}) {
  const [account] = useDesignAccount();
  const me = account?.signedIn ? account.email.toLowerCase() : "";
  const [email, setEmail] = useState<OpenedEmail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [told, setTold] = useState<string[]>([]);
  const [sol, setSol] = useState<{ mode: "summary" | "reply"; text: string | null } | null>(null);
  const tell = useRef(onChanged);
  useEffect(() => {
    let gone = false;
    void openInboxEmail(id, owner, box).then((res) => {
      if (gone) return;
      if (!res.ok) return setProblem(res.message);
      setEmail(res.email);
      // The server marked it read in Gmail on opening, where it could.
      if (res.email.canChange && !res.email.unread) {
        tell.current("read");
        window.dispatchEvent(new Event("renuabl:inbox"));
      }
    });
    return () => {
      gone = true;
    };
  }, [id, owner, box]);
  const [busy, setBusy] = useState<EmailAction | null>(null);
  const act = async (action: EmailAction) => {
    if (!email?.canChange || busy) return;
    setBusy(action);
    setProblem(null);
    const res = await changeInboxEmail(email.id, email.box, action);
    setBusy(null);
    if (!res.ok) return setProblem(res.message);
    onChanged(action);
    // As in Gmail: archived or marked unread, it goes back to the inbox.
    if (action === "read") setEmail({ ...email, unread: false });
    else onBack();
  };
  const latestAct = useRef(act);
  useEffect(() => {
    tell.current = onChanged;
    latestAct.current = act;
  });
  // Gmail's own keys: e archives, Shift+U marks unread; never while typing.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "e") void latestAct.current("archive");
      else if (e.key === "U") void latestAct.current("unread");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
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
              {email.canChange && (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void act("archive")}
                    disabled={busy !== null}
                    title="Archive (e)"
                    className={clsx(ui.quiet, "h-8 px-3 text-xs")}
                  >
                    <Archive className="size-3.5" aria-hidden /> {busy === "archive" ? "Archiving…" : "Archive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(email.unread ? "read" : "unread")}
                    disabled={busy !== null}
                    title={email.unread ? "Mark read" : "Mark unread (Shift+U)"}
                    className={clsx(ui.quiet, "h-8 px-3 text-xs")}
                  >
                    {email.unread ? <MailOpen className="size-3.5" aria-hidden /> : <Mail className="size-3.5" aria-hidden />}
                    {email.unread ? "Mark read" : "Mark unread"}
                  </button>
                </span>
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
            {!email.copy && !email.canChange && (
              <p className="mt-3 text-xs text-muted">
                This mailbox was connected read only.{" "}
                <button type="button" onClick={onReconnect} className="font-medium text-ink underline underline-offset-2">
                  Connect it again
                </button>{" "}
                to mark read and archive from here.
              </p>
            )}
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
                      href={emailFileHref(email.id, f.n, email.box)}
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
