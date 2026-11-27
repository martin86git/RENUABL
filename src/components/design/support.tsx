"use client";

import clsx from "clsx";
import { ChevronDown, ImagePlus, LifeBuoy, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  STATE_WORDS,
  SUPPORT_LIMITS,
  TICKET_AREAS,
  TICKET_TABS,
  ticketOrder,
  ticketPicturesProblem,
  type Ticket,
  type TicketArea,
  type TicketState,
  type TicketTab,
} from "@/lib/domain/design/support";
import { loadTickets, supportAction } from "@/lib/services/crm";
import { useDesignAccount } from "./design-account";
import { PageHead, ui } from "./design-shell";
import { EmailFileChips, useEmailFiles, type EmailFiles } from "./email-compose";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });
const handle = (email: string) => email.split("@")[0];

const STATE_LOOK: Record<TicketState, string> = {
  open: "bg-surface-2 text-ink-2",
  waiting: "bg-sun-line text-white",
  resolved: "bg-positive-soft text-positive",
};

/**
 * RENUABL support (domain/design/support.ts): the business raises a ticket to RENUABL for an issue, sees where each
 * one stands, reads RENUABL's answers and replies. Everyone in the business sees the business's tickets.
 */
export function SupportPage() {
  const [account] = useDesignAccount();
  const me = account?.signedIn ? account.email.toLowerCase() : "";
  const demo = Boolean(account?.signedIn && account.demo);
  const linked = useSearchParams().get("ticket");
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [tab, setTab] = useState<TicketTab>("open");
  const [openId, setOpenId] = useState<string | null>(linked);
  const [raising, setRaising] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [raisedRef, setRaisedRef] = useState<string | null>(null);

  useEffect(() => {
    void loadTickets().then((res) => {
      if (!res.ok) return setProblem(res.message);
      setTickets(res.tickets);
      // A link from RENUABL's email opens its ticket, whichever tab it is under.
      if (linked && res.tickets.some((t) => t.id === linked && t.state === "resolved")) setTab("all");
    });
  }, [linked]);

  const act = async (body: Record<string, unknown>, files: readonly File[] = []) => {
    const res = await supportAction(body, files);
    if (!res.ok) {
      setProblem(res.message);
      return null;
    }
    setProblem(null);
    setTickets(res.tickets);
    window.dispatchEvent(new Event("renuabl:support"));
    return res;
  };

  const open = (t: Ticket) => {
    const opening = openId !== t.id;
    setOpenId(opening ? t.id : null);
    if (opening && t.unread) void act({ do: "seen", id: t.id });
  };
  // A ticket opened by its link is read once it is on screen.
  useEffect(() => {
    const t = tickets?.find((x) => x.id === linked);
    if (t?.unread) void supportAction({ do: "seen", id: t.id }).then(() => window.dispatchEvent(new Event("renuabl:support")));
    // Only when the list first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets === null]);

  const shown = tickets ? ticketOrder(tickets, tab) : null;
  const answered = tickets?.filter((t) => t.unread).length ?? 0;

  return (
    <div className={clsx(ui.page, "max-w-3xl space-y-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageHead title="RENUABL support" />
          <p className="mt-1 text-sm text-ink-2">
            Something not working, or not sure how to do it? Raise a ticket and RENUABL&apos;s team will answer it here and by email.
          </p>
        </div>
        {!raising && !demo && (
          <button type="button" className={clsx(ui.primary, "gap-1.5")} onClick={() => setRaising(true)}>
            <Plus className="size-4" aria-hidden /> Raise a ticket
          </button>
        )}
      </div>

      {demo && (
        <p className={clsx(ui.card, "p-4 text-sm text-ink-2")}>
          Support tickets aren&apos;t part of the demo. Once your business is on RENUABL, this is where you raise them.
        </p>
      )}

      {raising && (
        <RaiseForm
          onCancel={() => setRaising(false)}
          onRaise={async (ticket, files) => {
            const res = await act({ do: "raise", ...ticket }, files);
            if (!res) return false;
            const made = res.tickets.find((t) => t.id === res.raised);
            setRaisedRef(made?.ref ?? null);
            setOpenId(made?.id ?? null);
            setTab("open");
            setRaising(false);
            return true;
          }}
        />
      )}

      {raisedRef && (
        <p className="rounded-md bg-positive-soft px-4 py-2.5 text-sm text-positive" role="status">
          Ticket {raisedRef} is with RENUABL. We&apos;ll answer here, and email whoever raised it when we do.
        </p>
      )}
      {problem && (
        <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}

      <div role="tablist" className="flex gap-5 border-b border-line text-sm">
        {TICKET_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "-mb-px border-b-2 pb-2",
              tab === t.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {tickets ? ` · ${ticketOrder(tickets, t.id).length}` : ""}
          </button>
        ))}
        {answered > 0 && (
          <span className="ml-auto pb-2 text-sm font-medium text-sun-line">
            RENUABL has answered {answered} {answered === 1 ? "ticket" : "tickets"}
          </span>
        )}
      </div>

      {!shown ? (
        !problem && <p className="text-sm text-muted">Loading…</p>
      ) : !shown.length ? (
        <div className={clsx(ui.card, "flex flex-col items-center gap-2 px-6 py-10 text-center")}>
          <LifeBuoy className="size-6 text-muted" aria-hidden />
          <p className="text-sm text-ink-2">
            {tab === "resolved" ? "No resolved tickets yet." : "No tickets open. If something goes wrong, raise one and we'll pick it up."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((t) => (
            <TicketCard key={t.id} ticket={t} me={me} open={openId === t.id} onOpen={() => open(t)} act={act} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Pictures to go with a message: a button to choose them, and what is chosen as chips (paste and drop work too). */
function Pictures({ files }: { files: EmailFiles }) {
  const pick = useRef<HTMLInputElement>(null);
  const problem = ticketPicturesProblem(files.files);
  return (
    <div>
      <input
        ref={pick}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          files.add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          className={clsx(ui.quiet, "gap-1.5")}
          onClick={() => pick.current?.click()}
          disabled={files.files.length >= SUPPORT_LIMITS.pictures}
        >
          <ImagePlus className="size-4" aria-hidden /> Add a picture
        </button>
        <span className="text-xs text-muted">A screenshot helps. Paste or drop one in, up to {SUPPORT_LIMITS.pictures}.</span>
      </div>
      <EmailFileChips files={files} />
      {problem && !files.busy && (
        <p className="mt-1.5 text-xs text-warning" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}

function RaiseForm({
  onRaise,
  onCancel,
}: {
  onRaise: (ticket: { subject: string; area: TicketArea; urgent: boolean; text: string }, files: readonly File[]) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [area, setArea] = useState<TicketArea>("Something else");
  const [urgent, setUrgent] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const files = useEmailFiles();
  const notReady = files.busy || Boolean(ticketPicturesProblem(files.files));
  return (
    <form
      className={clsx(ui.card, "space-y-4 p-5")}
      onPaste={files.onPaste}
      onDragOver={files.onDragOver}
      onDrop={files.onDrop}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onRaise({ subject, area, urgent, text }, files.files);
        setBusy(false);
      }}
    >
      <label className="block text-sm">
        <span className="font-medium text-ink">What&apos;s the issue?</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={SUPPORT_LIMITS.subject}
          placeholder="A proposal won't publish"
          autoFocus
          className={clsx(ui.input, "mt-1.5")}
        />
      </label>
      <div className="text-sm">
        <span className="font-medium text-ink">What is it about?</span>
        <div role="radiogroup" aria-label="What it is about" className="mt-1.5 flex flex-wrap gap-1.5">
          {TICKET_AREAS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={area === a}
              onClick={() => setArea(a)}
              className={clsx(
                "rounded-full px-3 py-1 text-[13px] ring-1 ring-inset",
                area === a ? "bg-ink text-white ring-ink" : "bg-surface text-ink-2 ring-line hover:ring-line-strong",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-ink">What happened?</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={SUPPORT_LIMITS.text}
          placeholder="What you were doing, what you expected, and what happened instead. Name the customer or deal if it's about one."
          className={clsx(ui.input, "mt-1.5 min-h-32 py-2")}
        />
      </label>
      <Pictures files={files} />
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="size-4" />
        It&apos;s stopping us from working
      </label>
      <div className="flex gap-2">
        <button type="submit" className={ui.primary} disabled={busy || notReady || !subject.trim() || !text.trim()}>
          {busy ? "Sending…" : "Send to RENUABL"}
        </button>
        <button type="button" className={ui.quiet} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function TicketCard({
  ticket: t,
  me,
  open,
  onOpen,
  act,
}: {
  ticket: Ticket;
  me: string;
  open: boolean;
  onOpen: () => void;
  act: (body: Record<string, unknown>, files?: readonly File[]) => Promise<unknown>;
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const files = useEmailFiles();
  const notReady = files.busy || Boolean(ticketPicturesProblem(files.files));
  const last = t.messages[t.messages.length - 1];
  return (
    <li className={clsx(ui.card, "overflow-hidden", t.unread && "ring-1 ring-sun-line")}>
      <button type="button" onClick={onOpen} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className={clsx("rounded-full px-2 py-0.5 font-medium", STATE_LOOK[t.state])}>{STATE_WORDS[t.state]}</span>
            {t.urgent && t.state !== "resolved" && (
              <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">Urgent</span>
            )}
            <span className="tabular-nums">{t.ref}</span>
            <span>
              {t.area} · raised by {handle(t.by)} · {when(t.at)}
            </span>
          </p>
          <p className="mt-1.5 text-sm font-medium text-ink">{t.subject}</p>
          {!open && last && (
            <p className="mt-0.5 truncate text-sm text-ink-2">
              {last.side === "renuabl" ? "RENUABL support: " : ""}
              {last.text}
            </p>
          )}
        </div>
        <ChevronDown className={clsx("mt-1 size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-4">
          <ol className="space-y-3">
            {t.messages.map((m) => (
              <li key={m.id} className={clsx("flex", m.side === "business" ? "justify-end" : "justify-start")}>
                <div
                  className={clsx(
                    "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm",
                    m.side === "business" ? "bg-surface-2 text-ink" : "bg-sun text-ink ring-1 ring-sun-line/25",
                  )}
                >
                  <p className="text-xs text-muted">
                    {m.side === "renuabl" ? "RENUABL support" : m.by === me ? "You" : handle(m.by)} · {when(m.at)}
                  </p>
                  <p className="mt-1 whitespace-pre-line">{m.text}</p>
                  {m.pictures.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {m.pictures.map((p, i) => (
                        <li key={p}>
                          <a href={`/api/design/support/pictures/${p}`} target="_blank" rel="noreferrer" title="Open the picture">
                            {/* eslint-disable-next-line @next/next/no-img-element -- the business's own picture, served to its members only */}
                            <img
                              src={`/api/design/support/pictures/${p}`}
                              alt={`Picture ${i + 1} with this message`}
                              loading="lazy"
                              className="h-28 max-w-56 rounded-lg object-cover ring-1 ring-line"
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <form
            className="space-y-2"
            onPaste={files.onPaste}
            onDragOver={files.onDragOver}
            onDrop={files.onDrop}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              if (await act({ do: "reply", id: t.id, text: reply }, files.files)) {
                setReply("");
                files.clear();
              }
              setBusy(false);
            }}
          >
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={SUPPORT_LIMITS.text}
              placeholder={t.state === "resolved" ? "Still not right? Reply to open it again." : "Add to this ticket"}
              aria-label="Your reply"
              className={clsx(ui.input, "min-h-20 py-2")}
            />
            <Pictures files={files} />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={ui.primary} disabled={busy || notReady || (!reply.trim() && !files.files.length)}>
                Send reply
              </button>
              {t.state === "resolved" ? (
                <button type="button" className={ui.quiet} onClick={() => void act({ do: "reopen", id: t.id })}>
                  Open it again
                </button>
              ) : (
                <button type="button" className={ui.quiet} onClick={() => void act({ do: "resolve", id: t.id })}>
                  It&apos;s sorted: mark resolved
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </li>
  );
}
