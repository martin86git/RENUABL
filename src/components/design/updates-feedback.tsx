"use client";

import clsx from "clsx";
import { Check, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  FEEDBACK_KINDS,
  FEEDBACK_MAX,
  FEEDBACK_TABS,
  feedbackOrder,
  mayRemove,
  type FeedbackItem,
  type FeedbackKind,
  type FeedbackTab,
} from "@/lib/domain/design/feedback";
import { updatesByDay } from "@/lib/domain/design/updates";
import { feedbackAction, loadFeedback, updatesOpened } from "@/lib/services/crm";
import { useDesignAccount } from "./design-account";
import { PageHead, ui } from "./design-shell";

const dayWords = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });
const handle = (email: string | null) => (email ? email.split("@")[0] : "");

/** Updates: what has changed in RENUABL, a day a row, newest first. Opening it clears the count on the gear. */
export function UpdatesPage() {
  useEffect(() => {
    void updatesOpened().then(() => window.dispatchEvent(new Event("renuabl:updates")));
  }, []);
  const days = updatesByDay();
  return (
    <div className={clsx(ui.page, "max-w-3xl space-y-5")}>
      <PageHead title="Updates" />
      <p className="-mt-2 text-sm text-ink-2">What&apos;s changed in RENUABL, newest first.</p>
      <ol
        className={clsx(ui.card, "relative p-5 before:absolute before:bottom-6 before:left-[27px] before:top-6 before:w-px before:bg-line")}
      >
        {days.map((d, i) => (
          <li key={d.day} className="relative pb-5 pl-8 last:pb-0">
            <span
              className={clsx(
                "absolute left-0.5 top-1 size-[11px] rounded-full ring-4 ring-surface",
                i === 0 ? "bg-sun-line" : "bg-line-strong",
              )}
              aria-hidden
            />
            <p className="text-xs font-medium text-muted">{dayWords(d.day)}</p>
            <ul className="mt-1.5 space-y-1">
              {d.items.map((u) => (
                <li key={u.words} className="flex gap-2 text-sm text-ink">
                  <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-2">{u.area}</span>
                  <span>{u.words}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Feedback: improvements, requests and issues the team raises, with comments; the owner ticks them off. */
export function FeedbackPage() {
  const [account] = useDesignAccount();
  const me = account?.signedIn ? account.email.toLowerCase() : "";
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [owner, setOwner] = useState(false);
  const [tab, setTab] = useState<FeedbackTab>("open");
  const [kind, setKind] = useState<FeedbackKind>("Improvement");
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void loadFeedback().then((res) => {
      if (res.ok) {
        setItems(res.items);
        setOwner(res.owner);
      } else setProblem(res.message);
    });
  }, []);
  const act = async (body: Record<string, unknown>) => {
    const res = await feedbackAction(body);
    if (!res.ok) {
      setProblem(res.message);
      return false;
    }
    setProblem(null);
    setItems(res.items);
    setOwner(res.owner);
    return true;
  };
  const shown = items ? feedbackOrder(items, tab) : null;
  return (
    <div className={clsx(ui.page, "max-w-3xl space-y-5")}>
      <PageHead title="Feedback" />
      <p className="-mt-2 text-sm text-ink-2">
        Raise an improvement, a request or an issue. Everyone in your business sees them and can comment; the owner ticks them off.
      </p>
      <form
        className={clsx(ui.card, "space-y-3 p-4")}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act({ do: "add", kind, text })) setText("");
        }}
      >
        <div role="radiogroup" aria-label="What it is" className="flex w-fit rounded-md border border-line bg-surface-2 p-0.5 text-sm">
          {FEEDBACK_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={clsx(
                "rounded-[5px] px-3 py-1",
                kind === k ? "bg-surface text-ink shadow-[0_1px_3px_rgba(11,11,12,0.12)]" : "text-ink-2",
              )}
            >
              {k}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={FEEDBACK_MAX}
          placeholder="What would make it better, or what went wrong?"
          className={clsx(ui.input, "min-h-20 py-2")}
        />
        <button type="submit" className={ui.primary} disabled={!text.trim()}>
          Add
        </button>
      </form>
      {problem && (
        <p className="rounded-md bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      <div role="tablist" className="flex gap-5 border-b border-line text-sm">
        {FEEDBACK_TABS.map((t) => (
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
            {items ? ` · ${feedbackOrder(items, t.id).length}` : ""}
          </button>
        ))}
      </div>
      {!shown ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !shown.length ? (
        <p className="text-sm text-ink-2">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((i) => (
            <Item key={i.id} item={i} owner={owner} me={me} act={act} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Item({
  item,
  owner,
  me,
  act,
}: {
  item: FeedbackItem;
  owner: boolean;
  me: string;
  act: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [reply, setReply] = useState("");
  return (
    <li className={clsx(ui.card, "p-4", item.doneAt && "opacity-80")}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={Boolean(item.doneAt)}
          disabled={!owner}
          onClick={() => void act({ do: "done", id: item.id, done: !item.doneAt })}
          title={owner ? (item.doneAt ? "Reopen" : "Tick it off") : "Only the owner ticks items off"}
          className={clsx(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
            item.doneAt ? "border-positive bg-positive text-white" : "border-line-strong bg-surface",
          )}
        >
          {item.doneAt && <Check className="size-3.5" aria-hidden />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            <span className="mr-1.5 rounded bg-surface-2 px-1.5 py-0.5 font-medium text-ink-2">{item.kind}</span>
            {handle(item.by)} · {when(item.at)}
            {item.doneAt ? ` · done by ${handle(item.doneBy)} ${when(item.doneAt)}` : ""}
          </p>
          <p className={clsx("mt-1.5 whitespace-pre-line text-sm text-ink", item.doneAt && "line-through decoration-line-strong")}>
            {item.text}
          </p>
          {item.comments.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-l-2 border-line pl-3">
              {item.comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="text-xs text-muted">
                    {handle(c.by)} · {when(c.at)}
                  </span>
                  <p className="whitespace-pre-line text-ink">{c.text}</p>
                </li>
              ))}
            </ul>
          )}
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && reply.trim() && (await act({ do: "comment", id: item.id, text: reply }))) setReply("");
            }}
            maxLength={FEEDBACK_MAX}
            placeholder="Comment, then Enter"
            aria-label="A comment"
            className={clsx(ui.input, "mt-3 h-9 min-h-9")}
          />
        </div>
        {mayRemove(item, me, owner) && (
          <button
            type="button"
            onClick={() => window.confirm("Remove this item and its comments?") && void act({ do: "remove", id: item.id })}
            aria-label="Remove"
            className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}
