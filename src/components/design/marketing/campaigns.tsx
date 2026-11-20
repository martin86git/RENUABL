"use client";

import { Check, Copy, Loader2, Plus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, cn } from "@/components/ui/primitives";
import { DEFAULT_BRAND, type EdmSender, contentProblem, type EdmBrand, type EdmContent } from "@/lib/domain/marketing/edm";
import {
  CAMPAIGN_STATE_WORDS,
  SEND_CONFIRM_WORD,
  pct,
  reportOf,
  type CampaignState,
  type SendCounts,
} from "@/lib/domain/marketing/sequences";
import type { MarketingList } from "@/lib/domain/marketing/contacts";
import {
  addGtmDrafts,
  loadGtmDrafts,
  campaignAction,
  deleteCampaign,
  loadCampaign,
  loadCampaigns,
  loadContacts,
  NO_SENDER,
  loadMarketingSettings,
  saveCampaignDraft,
  type CampaignLine,
  type CampaignView,
} from "@/lib/services/marketing";
import { EdmBuilder, field } from "./edm-builder";

const box = "rounded-2xl bg-surface p-5 shadow-[var(--shadow-soft)]";
const n = (v: number) => v.toLocaleString("en-AU");
const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-AU", {
        timeZone: "Australia/Melbourne",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "--";

const TONE: Record<CampaignState, string> = {
  draft: "bg-canvas text-ink-2",
  scheduled: "bg-sun text-sun-ink",
  sending: "bg-sun text-sun-ink",
  sent: "bg-positive-soft text-positive",
  cancelled: "bg-canvas text-muted",
};

export function StateBadge({ state }: { state: CampaignState }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", TONE[state])}>{CAMPAIGN_STATE_WORDS[state]}</span>;
}

/** The figures of a campaign or sequence: sent, opened, clicked, unsubscribed, bounced. */
export function ReportStrip({ counts }: { counts: SendCounts }) {
  const r = reportOf(counts);
  const cells: [string, string, string?][] = [
    ["Sent", n(r.sent), r.queued ? `${n(r.queued)} still to go` : undefined],
    ["Opened", n(r.opened), pct(r.openRate)],
    ["Clicked", n(r.clicked), pct(r.clickRate)],
    ["Unsubscribed", n(r.unsubscribed)],
    ["Bounced", n(r.bounced), r.failed ? `${n(r.failed)} failed to send` : undefined],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {cells.map(([label, value, note]) => (
        <div key={label} className={box}>
          <p className="text-[12px] text-muted">{label}</p>
          <p className="mt-1 font-mono text-[22px] tabular-nums">{value}</p>
          {note && <p className="text-[12px] text-muted">{note}</p>}
        </div>
      ))}
    </div>
  );
}

export function CampaignsPage() {
  const [list, setList] = useState<CampaignLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [gtm, setGtm] = useState<{ offer: boolean; made?: boolean } | null>(null);
  const [adding, setAdding] = useState(false);
  const refresh = useCallback(() => {
    loadCampaigns().then((r) => (r.ok ? setList(r.campaigns) : setProblem(r.message)));
    loadGtmDrafts().then((r) => r.ok && setGtm(r));
  }, []);
  useEffect(refresh, [refresh]);
  async function addDrafts() {
    setAdding(true);
    const r = await addGtmDrafts();
    setAdding(false);
    if (!r.ok) return setProblem(r.message);
    refresh();
  }
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-[13px] text-muted">
            One email to a list, sent now or at a time you choose. Nothing goes until you type SEND.
          </p>
        </div>
        <ButtonLink size="sm" href="/design/marketing/campaigns/new">
          <Plus className="size-4" /> New campaign
        </ButtonLink>
      </div>
      {problem && <p className="mt-4 text-[13px] text-danger">{problem}</p>}
      {gtm?.offer && !gtm.made && (
        <div className={cn(box, "mt-5 flex flex-wrap items-center justify-between gap-3")}>
          <div>
            <p className="text-[14px] font-medium">RENUABL Business go-to-market</p>
            <p className="text-[13px] text-muted">
              A launch email and a four-email nurture sequence, added as drafts for you to read and change. Nothing is sent, and the
              sequence stays off.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={addDrafts} disabled={adding}>
            {adding && <Loader2 className="size-4 animate-spin" />} Add the drafts
          </Button>
        </div>
      )}
      <div className={cn(box, "mt-5 p-0")}>
        {!list ? (
          <p className="flex items-center gap-2 px-5 py-6 text-[13px] text-muted">
            <Loader2 className="size-4 animate-spin" /> Loading
          </p>
        ) : list.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted">No campaigns yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((c) => {
              const r = reportOf(c.counts);
              return (
                <li key={c.id}>
                  <Link
                    href={`/design/marketing/campaigns/${c.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-canvas/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium">{c.name}</p>
                      <p className="truncate text-[12px] text-muted">
                        {c.subject || "No subject"} · {c.listName ?? "No list"}
                      </p>
                    </div>
                    <StateBadge state={c.status} />
                    <span className="w-48 text-right text-[12px] text-muted tabular-nums">
                      {c.status === "draft"
                        ? `Edited ${when(c.updatedAt)}`
                        : c.status === "scheduled"
                          ? `Goes ${when(c.sendAt)}`
                          : `${n(r.sent)} sent · ${pct(r.openRate)} opened · ${pct(r.clickRate)} clicked`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function CampaignEditor({ id }: { id: string }) {
  const router = useRouter();
  const [view, setView] = useState<CampaignView | null>(null);
  const [lists, setLists] = useState<MarketingList[]>([]);
  const [brand, setBrand] = useState<EdmBrand>(DEFAULT_BRAND);
  const [sender, setSender] = useState<EdmSender>(NO_SENDER);
  const [name, setName] = useState("");
  const [content, setContent] = useState<EdmContent | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [saved, setSaved] = useState<"saved" | "saving" | "unsaved">("saved");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const loaded = useRef(false);

  const refresh = useCallback(async () => {
    const r = await loadCampaign(id);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setView(r);
    if (!loaded.current) {
      setName(r.campaign.name);
      setContent(r.campaign.content);
      setListId(r.campaign.listId);
      loaded.current = true;
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    loadContacts({ q: "", list: null, offset: 0 }).then((r) => r.ok && setLists(r.lists));
    loadMarketingSettings().then((r) => {
      if (!r.ok) return;
      setBrand(r.settings.brand);
      setSender(r.sender);
    });
  }, [refresh]);

  const draft = view?.campaign.status === "draft";

  // Saves a moment after the last change while it's a draft.
  useEffect(() => {
    if (!loaded.current || !content || !draft || saved !== "unsaved") return;
    const t = setTimeout(async () => {
      setSaved("saving");
      const r = await saveCampaignDraft(id, { name, content, listId });
      setSaved(r.ok ? "saved" : "unsaved");
      if (!r.ok) setMsg({ ok: false, text: r.message });
      else refresh();
    }, 800);
    return () => clearTimeout(t);
  }, [id, name, content, listId, saved, draft, refresh]);

  if (!view || !content) {
    return msg ? (
      <p className="text-[13px] text-danger">{msg.text}</p>
    ) : (
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <Loader2 className="size-4 animate-spin" /> Loading
      </p>
    );
  }
  const c = view.campaign;
  const changed = () => setSaved("unsaved");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/design/marketing/campaigns" className="text-[13px] text-muted hover:text-ink">
          ← Campaigns
        </Link>
        <StateBadge state={c.status} />
        {draft && (
          <span className="text-[12px] text-muted">{saved === "saved" ? "Saved" : saved === "saving" ? "Saving…" : "Not saved yet"}</span>
        )}
        <span className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const r = await campaignAction(id, { do: "duplicate" });
              if (r.ok && r.id) router.push(`/design/marketing/campaigns/${r.id}`);
            }}
          >
            <Copy className="size-4" /> Duplicate
          </Button>
          {(draft || c.status === "cancelled") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                if (!confirm("Delete this campaign?")) return;
                const r = await deleteCampaign(id);
                if (r.ok) router.push("/design/marketing/campaigns");
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
        </span>
      </div>

      <input
        value={name}
        disabled={!draft}
        onChange={(e) => (setName(e.target.value), changed())}
        aria-label="Campaign name"
        className="w-full bg-transparent text-[22px] font-semibold tracking-tight outline-none"
      />

      {c.status !== "draft" && <ReportStrip counts={c.counts} />}

      <div className={box}>
        <EdmBuilder content={content} brand={brand} sender={sender} readOnly={!draft} onChange={(next) => (setContent(next), changed())} />
      </div>

      {draft ? (
        <SendPanel
          id={id}
          content={content}
          lists={lists}
          listId={listId}
          reach={view.reach}
          onList={(l) => (setListId(l), changed())}
          saved={saved === "saved"}
          onSent={() => {
            loaded.current = false;
            refresh();
          }}
        />
      ) : (
        <div className={box}>
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <p className="flex-1 text-ink-2">
              To <span className="font-medium text-ink">{c.listName ?? "a list since removed"}</span>
              {c.status === "scheduled" && <> · goes {when(c.sendAt)}</>}
              {c.startedAt && <> · started {when(c.startedAt)}</>}
              {c.finishedAt && <> · finished {when(c.finishedAt)}</>}
              {c.sentBy && <> · sent by {c.sentBy}</>}
            </p>
            {(c.status === "scheduled" || c.status === "sending") && (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  if (!confirm(c.status === "sending" ? "Stop sending? Emails already gone stay gone." : "Cancel and go back to a draft?"))
                    return;
                  const r = await campaignAction(id, { do: "cancel" });
                  if (r.ok) {
                    loaded.current = false;
                    refresh();
                  }
                }}
              >
                {c.status === "sending" ? "Stop sending" : "Cancel, back to a draft"}
              </Button>
            )}
          </div>
          {c.status === "sending" && (
            <p className="mt-2 text-[12px] text-muted">
              Emails go in batches each hour, on working days between 9 am and 5 pm Melbourne time, up to the day&apos;s cap.
            </p>
          )}
        </div>
      )}

      {view.recipients.length > 0 && <Recipients view={view} />}
      {msg && <p className={cn("text-[13px]", msg.ok ? "text-positive" : "text-danger")}>{msg.text}</p>}
    </div>
  );
}

function SendPanel({
  id,
  content,
  lists,
  listId,
  reach,
  onList,
  saved,
  onSent,
}: {
  id: string;
  content: EdmContent;
  lists: MarketingList[];
  listId: string | null;
  reach: CampaignView["reach"];
  onList: (id: string | null) => void;
  saved: boolean;
  onSent: () => void;
}) {
  const [testTo, setTestTo] = useState("");
  const [timing, setTiming] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [confirmWord, setConfirmWord] = useState("");
  const [busy, setBusy] = useState<"test" | "send" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const problem = contentProblem(content);
  const list = lists.find((l) => l.id === listId);
  const emailable = reach && list && listId === list.id ? reach.emailable : list?.emailable;

  async function test() {
    setBusy("test");
    const r = await campaignAction(id, { do: "test", to: testTo || undefined, content });
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: `Test sent to ${r.to}.` } : { ok: false, text: r.message });
  }

  async function sendIt() {
    setBusy("send");
    const r = await campaignAction(id, {
      do: "send",
      confirm: confirmWord,
      at: timing === "later" && at ? new Date(at).toISOString() : null,
    });
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setMsg({ ok: true, text: timing === "now" ? "Sending has started." : `Scheduled for ${when(r.at ?? null)}.` });
    onSent();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={box}>
        <h2 className="text-[15px] font-semibold">Send a test</h2>
        <p className="mt-1 text-[13px] text-muted">One copy marked [Test], to you unless you type another address. Nothing is tracked.</p>
        <div className="mt-3 flex gap-2">
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Your own email" className={field} />
          <Button size="sm" variant="secondary" disabled={Boolean(problem) || busy !== null} onClick={test}>
            {busy === "test" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Test
          </Button>
        </div>
      </div>

      <div className={box}>
        <h2 className="text-[15px] font-semibold">Send to a list</h2>
        <label className="mt-3 block text-[12px] text-muted">
          List
          <select value={listId ?? ""} onChange={(e) => onList(e.target.value || null)} className={cn(field, "mt-1")}>
            <option value="">Choose a list…</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({n(l.emailable)} of {n(l.members)} can be emailed)
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px]">
          {(["now", "later"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input type="radio" checked={timing === t} onChange={() => setTiming(t)} />
              {t === "now" ? "Now" : "At a time"}
            </label>
          ))}
          {timing === "later" && (
            <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={cn(field, "h-9 w-auto")} />
          )}
        </div>
        <p className="mt-2 text-[12px] text-muted">
          Only contacts with express or inferred consent who haven&apos;t unsubscribed or bounced are sent it. Emails go in hourly batches
          on working days, 9 am to 5 pm Melbourne time, up to the day&apos;s cap in Settings.
        </p>
        {problem ? (
          <p className="mt-3 text-[13px] text-danger">{problem}</p>
        ) : !listId ? (
          <p className="mt-3 text-[13px] text-muted">Choose a list.</p>
        ) : (
          <div className="mt-3 space-y-2">
            <label className="block text-[12px] text-muted">
              Type {SEND_CONFIRM_WORD} to send to {emailable !== undefined ? n(emailable) : "the"} contacts
              <input value={confirmWord} onChange={(e) => setConfirmWord(e.target.value)} className={cn(field, "mt-1 font-mono")} />
            </label>
            <Button disabled={confirmWord !== SEND_CONFIRM_WORD || !saved || busy !== null || (timing === "later" && !at)} onClick={sendIt}>
              {busy === "send" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {timing === "now" ? "Send now" : "Schedule"}
            </Button>
            {!saved && <p className="text-[12px] text-muted">Saving your changes first…</p>}
          </div>
        )}
        {msg && <p className={cn("mt-3 text-[13px]", msg.ok ? "text-positive" : "text-danger")}>{msg.text}</p>}
      </div>
    </div>
  );
}

function Recipients({ view }: { view: CampaignView }) {
  const [filter, setFilter] = useState<"clicked" | "opened" | "all">("clicked");
  const rows = view.recipients.filter((r) => (filter === "clicked" ? r.clickedAt : filter === "opened" ? r.openedAt : true));
  return (
    <div className={cn(box, "p-0")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <h2 className="flex-1 text-[15px] font-semibold">Who engaged</h2>
        {(["clicked", "opened", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("rounded-full px-3 py-1 text-[12px]", filter === f ? "bg-ink text-canvas" : "bg-canvas text-ink-2")}
          >
            {f === "clicked" ? "Clicked" : f === "opened" ? "Opened" : "Everyone"}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] text-muted">Nobody yet.</p>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto text-[13px]">
          {rows.map((r) => (
            <li key={r.email} className="flex flex-wrap items-center gap-x-4 px-5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{r.name || r.email}</span>
                <span className="text-muted"> · {r.company ?? r.email}</span>
              </span>
              <span className="text-[12px] text-muted">
                {r.clickedAt
                  ? `Clicked ${when(r.clickedAt)}`
                  : r.openedAt
                    ? `Opened ${when(r.openedAt)}`
                    : r.status === "sent"
                      ? "Sent"
                      : r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line px-5 py-2 text-[12px] text-muted">
        Opens are a guide: some mail apps load every picture, others none.
      </p>
    </div>
  );
}
