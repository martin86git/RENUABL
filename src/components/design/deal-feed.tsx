"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  ArrowRight,
  ArrowUpRight,
  CornerUpLeft,
  Eye,
  FileText,
  Flame,
  Mail,
  MessageCircle,
  Phone,
  Snowflake,
  StickyNote,
  PenTool,
  UserPlus,
  X,
} from "lucide-react";
import {
  FEED_VIEWS,
  agoWords,
  caption,
  feedOf,
  needsYou,
  systemLine,
  type FeedDeal,
  type FeedEventKind,
  type FeedView,
} from "@/lib/domain/design/deal-feed";
import { OPEN_STAGES, STAGE_LABELS } from "@/lib/domain/design/crm";
import { countdownWords } from "@/lib/domain/design/sol-agents";
import { dmRoom } from "@/lib/domain/design/team-chat";
import { emailDeal } from "@/lib/services/crm";
import { exampleDeals, loadFeed, solCalls, writeWithSol, type FeedAnswer } from "@/lib/services/deal-feed";
import { DEAL_TEAM_CHANGED } from "@/lib/services/deal-team";
import { sayInTeam, TEAM_OPEN } from "@/lib/services/team-chat";
import { AerialRoof, type AerialRoofSpec, type RoofFinish, type RoofForm } from "./aerial-roof";
import { PATHS } from "./design-shell";
import { DealTeamChat } from "./deal-team-chat";
import { SolIcon } from "./sol-icon";

const FEED_VIEW_KEY = "renuabl.design.feed-view";
const POLL_MS = 60_000;

const EVENT_ICONS: Record<FeedEventKind, React.ComponentType<{ className?: string }>> = {
  message: MessageCircle,
  reply: CornerUpLeft,
  email: Mail,
  opened: Eye,
  call: Phone,
  note: StickyNote,
  proposal: FileText,
  stage: ArrowRight,
  sol: SolIcon,
};

/**
 * Today's deal feed (6 Nov 2026, Martin; deal-feed.ts): Sol runs the deals, this is the controls, and the owner steps
 * in wherever their judgement says. One card a deal, newest happening first: the roof, the system and price, how warm,
 * where it's at in Sol's words, the latest of the conversation and what Sol has lined up, with the controls to write
 * to the customer with Sol, have Sol call them, or bring in a teammate, all without leaving Today.
 */
export function DealFeed({ me }: { me: string }) {
  const [data, setData] = useState<FeedAnswer | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [view, setView] = useState<FeedView>(() => {
    try {
      const v = typeof window !== "undefined" ? localStorage.getItem(FEED_VIEW_KEY) : null;
      return v === "needs" || v === "sol" || v === "all" ? v : "all";
    } catch {
      return "all";
    }
  });
  const load = useCallback(async () => {
    const r = await loadFeed();
    if (r.ok) {
      setData({ deals: r.deals, callsOn: r.callsOn, team: r.team, examples: r.examples });
      setProblem(null);
    } else setProblem(r.message);
  }, []);
  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const t = window.setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    // A deal's team chat changed somewhere else (the team chat window, the deal's Team tab): its pad follows at once.
    const changed = () => void load();
    window.addEventListener(DEAL_TEAM_CHANGED, changed);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
      window.removeEventListener(DEAL_TEAM_CHANGED, changed);
    };
  }, [load]);
  const pick = (v: FeedView) => {
    setView(v);
    try {
      localStorage.setItem(FEED_VIEW_KEY, v);
    } catch {
      // Private window: the view resets next time.
    }
  };
  const now = new Date();
  const deals = useMemo(() => data?.deals ?? [], [data]);
  const shown = feedOf(deals, view, now);
  const needs = deals.filter((d) => needsYou(d, now)).length;
  const open = deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const openValue = open.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const [filling, setFilling] = useState(false);
  const examples = async (what: "add" | "clear") => {
    setFilling(true);
    await exampleDeals(what);
    await load();
    setFilling(false);
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[13px] text-ink-2">
          {data ? (
            <>
              <span className="font-semibold text-ink">{needs}</span> need{needs === 1 ? "s" : ""} you ·{" "}
              <span className="font-semibold text-ink">{open.length}</span> being sold
              {openValue > 0 && (
                <>
                  {" "}
                  · <span className="font-semibold text-ink">${Math.round(openValue / 1000).toLocaleString("en-AU")}k</span> in play
                </>
              )}
            </>
          ) : (
            "Looking over your deals…"
          )}
        </p>
        <div role="tablist" aria-label="What to show" className="inline-flex rounded-full bg-surface p-1 ring-1 ring-line">
          {FEED_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => pick(v.id)}
              className={clsx(
                "rounded-full px-3 py-1 text-[12.5px] font-medium transition",
                view === v.id ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              {v.label}
              {v.id === "needs" && needs > 0 && <span className="ml-1 tabular-nums">{needs}</span>}
            </button>
          ))}
        </div>
      </div>
      {data?.examples !== null && data?.examples !== undefined && (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
          {data.examples > 0
            ? `This made-up business has ${data.examples} example deals to try the feed with.`
            : "A made-up business: add example deals to try the feed."}
          <button
            type="button"
            disabled={filling}
            onClick={() => void examples(data.examples ? "clear" : "add")}
            className="ml-auto rounded-full bg-surface px-3 py-1 font-medium text-ink ring-1 ring-line hover:ring-ink-2 disabled:text-muted"
          >
            {filling ? "Working…" : data.examples ? "Clear example deals" : "Add example deals"}
          </button>
        </p>
      )}
      {problem && (
        <p className="mt-4 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {data && shown.length === 0 && (
          <p className="rounded-2xl bg-surface px-5 py-8 text-center text-[14px] text-ink-2 ring-1 ring-line">
            {view === "needs"
              ? "Nothing needs you right now. Sol has the rest in hand."
              : view === "sol"
                ? "Sol has nothing lined up just now."
                : "No deals being sold yet."}
          </p>
        )}
        {shown.map((d) => (
          <DealCard key={d.jobId} deal={d} now={now} me={me} callsOn={Boolean(data?.callsOn)} team={data?.team ?? []} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

type Panel = "write" | "call" | "team" | null;

function DealCard(props: {
  deal: FeedDeal;
  now: Date;
  me: string;
  callsOn: boolean;
  team: { email: string; name: string }[];
  onChanged: () => void;
}) {
  const { deal: d, now } = props;
  const [panel, setPanel] = useState<Panel>(null);
  const need = needsYou(d, now);
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const first = d.customer.split(/\s+/)[0] || "them";
  return (
    <article
      className={clsx(
        "grid gap-4 rounded-2xl bg-surface p-4 ring-1 sm:p-5 lg:grid-cols-[minmax(0,1fr)_17.5rem]",
        need ? "ring-sun-line/50" : "ring-line",
      )}
    >
      <div className="min-w-0">
        <div className="flex gap-4">
          <RoofThumb deal={d} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link href={`${PATHS.deals}/${d.jobId}`} className="truncate text-[15px] font-semibold text-ink hover:underline">
                {d.customer}
              </Link>
              {d.suburb && <span className="text-[13px] text-muted">· {d.suburb}</span>}
              <HeatChip deal={d} />
              <span className="ml-auto text-[12px] text-muted">{agoWords(d.events[0]?.at ?? d.createdAt, now)}</span>
            </div>
            <p className="mt-0.5 text-[13px] text-ink-2">
              {systemLine(d) || d.title || "Solar"} · <span className="text-ink">{STAGE_LABELS[d.stage]}</span>
              {d.clock && OPEN_STAGES.includes(d.stage) ? ` · ${d.clock}` : ""}
            </p>
            {need && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sun px-2.5 py-0.5 text-[12px] font-medium text-sun-ink">
                {need}
              </p>
            )}
          </div>
        </div>

        {d.events.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
            {d.events.map((e, i) => {
              const Icon = EVENT_ICONS[e.kind];
              return (
                <li key={i} className="flex items-start gap-2 text-[13.5px] leading-snug">
                  <Icon className={clsx("mt-0.5 size-3.5 shrink-0", e.kind === "message" ? "text-sun-line" : "text-muted")} />
                  <span className="min-w-0 flex-1">
                    {e.by && <span className={clsx("font-medium", e.kind === "message" ? "text-ink" : "text-ink-2")}>{e.by}: </span>}
                    <span className={e.kind === "message" ? "text-ink" : "text-ink-2"}>{e.text}</span>
                  </span>
                  <span className="shrink-0 text-[11.5px] text-muted">{agoWords(e.at, now)}</span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2">
          <SolIcon className="mt-0.5 size-4 shrink-0 text-sun-line" />
          <p className="text-[13px] leading-snug text-ink">
            {caption(d, now)}
            {d.sol && !d.sol.held && <span className="text-muted"> Goes {countdownWords(d.sol.firesAt, now)}.</span>}
          </p>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <Control label={`Write to ${first} with Sol`} on={panel === "write"} onClick={() => toggle("write")}>
            <SolIcon className="size-4" />
            <span className="hidden sm:inline">Write</span>
          </Control>
          <Control label={`Have Sol call ${first}`} on={panel === "call"} onClick={() => toggle("call")}>
            <Phone className="size-4" />
            <span className="hidden sm:inline">Call</span>
          </Control>
          <Control label="Bring in a teammate" on={panel === "team"} onClick={() => toggle("team")}>
            <UserPlus className="size-4" />
            <span className="hidden sm:inline">Teammate</span>
          </Control>
          {/* The designer for this deal (8 Nov 2026, Martin: Sol asks for a design, so the card opens it). Orange while
              a deal being sold has no design yet; a link to the designer opens over the page wherever the frame shows it. */}
          <Link
            href={`${PATHS.designer}?job=${encodeURIComponent(d.jobId)}`}
            aria-label={d.projectId ? `Open ${first}'s design` : `Design ${first}'s roof`}
            title={d.projectId ? "Open the design" : "Design this roof"}
            className={clsx(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
              !d.projectId && OPEN_STAGES.includes(d.stage)
                ? "bg-sun-line text-white hover:brightness-105"
                : "text-ink ring-1 ring-line hover:bg-surface-2",
            )}
          >
            <PenTool className="size-4" aria-hidden />
            <span className="hidden sm:inline">{d.projectId ? "Design" : "Design it"}</span>
          </Link>
          <Link
            href={`${PATHS.deals}/${d.jobId}`}
            className="ml-auto inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            Open <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {panel === "write" && <WritePanel deal={d} onDone={() => (setPanel(null), props.onChanged())} />}
        {panel === "call" && <CallPanel deal={d} callsOn={props.callsOn} onDone={() => (setPanel(null), props.onChanged())} />}
        {panel === "team" && <TeamPanel deal={d} me={props.me} team={props.team} onDone={() => setPanel(null)} />}
      </div>
      {/* The request pad: the deal's team chat, its latest lines and a box (deal-team.ts). */}
      <aside
        className="flex min-w-0 flex-col gap-2 rounded-xl bg-canvas p-3 ring-1 ring-line"
        aria-label={`Team chat on ${d.customer}'s deal`}
      >
        <p className="flex items-center justify-between text-[11.5px] font-medium uppercase tracking-wide text-muted">
          Team chat
          <Link href={`${PATHS.deals}/${d.jobId}?tab=team`} className="normal-case tracking-normal text-ink-2 hover:text-ink">
            All
          </Link>
        </p>
        <DealTeamChat jobId={d.jobId} pad initial={d.team?.lines ?? []} onChanged={props.onChanged} />
      </aside>
    </article>
  );
}

function Control(props: { label: string; on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      aria-expanded={props.on}
      onClick={props.onClick}
      className={clsx(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ring-1 transition",
        props.on ? "bg-primary text-primary-ink ring-primary" : "bg-surface text-ink ring-line hover:ring-ink-2",
      )}
    >
      {props.children}
    </button>
  );
}

const box = "mt-3 rounded-xl bg-canvas p-3 ring-1 ring-line";
const field =
  "w-full rounded-lg bg-surface px-3 py-2 text-[14px] text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-sun-line";
const dark =
  "inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-ink transition hover:brightness-110 disabled:bg-surface-2 disabled:text-muted";

function PanelHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <p className="text-[12.5px] font-semibold text-ink">{title}</p>
      <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1 text-muted hover:text-ink">
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Write with Sol: what to say, Sol's email, changed and sent through the deal's own email. */
function WritePanel({ deal: d, onDone }: { deal: FeedDeal; onDone: () => void }) {
  const first = d.customer.split(/\s+/)[0] || "them";
  const [askText, setAskText] = useState("");
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!d.canEmail)
    return (
      <div className={box}>
        <PanelHead title={`Write to ${first}`} onClose={onDone} />
        <p className="text-[13px] text-ink-2">
          There&apos;s no email on {first}&apos;s record yet. Add one on the deal to write from here.
        </p>
      </div>
    );
  const write = async () => {
    setBusy(true);
    setNote(null);
    const r = await writeWithSol(d.jobId, askText);
    setBusy(false);
    if (r.ok) setDraft({ subject: r.subject, body: r.body });
    else setNote(r.message);
  };
  const send = async () => {
    if (!draft) return;
    setBusy(true);
    const r = await emailDeal(d.jobId, { subject: draft.subject, body: draft.body, toCustomer: true });
    setBusy(false);
    if (r.ok) onDone();
    else setNote(r.message);
  };
  return (
    <div className={box}>
      <PanelHead title={`Write to ${first} with Sol`} onClose={onDone} />
      {!draft ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (askText.trim().length >= 3) void write();
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input
            className={field}
            value={askText}
            onChange={(e) => setAskText(e.target.value)}
            placeholder={`What should Sol say to ${first}?`}
            autoFocus
          />
          <button type="submit" className={dark} disabled={busy || askText.trim().length < 3}>
            {busy ? "Writing…" : "Write it"}
          </button>
        </form>
      ) : (
        <div className="space-y-2">
          <input
            className={field}
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            aria-label="Subject"
          />
          <textarea
            className={`${field} min-h-40`}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            aria-label="Email"
          />
          <div className="flex items-center gap-2">
            <button type="button" className={dark} disabled={busy} onClick={() => void send()}>
              <Mail className="size-4" /> {busy ? "Sending…" : `Send to ${first}`}
            </button>
            <button type="button" className="text-[13px] font-medium text-ink-2 hover:text-ink" onClick={() => setDraft(null)}>
              Start again
            </button>
          </div>
        </div>
      )}
      {note && (
        <p className="mt-2 text-[13px] text-danger" role="alert">
          {note}
        </p>
      )}
    </div>
  );
}

/** Have Sol call: the assistant rings the customer in calling hours; or ring them yourself. */
function CallPanel({ deal: d, callsOn, onDone }: { deal: FeedDeal; callsOn: boolean; onDone: () => void }) {
  const first = d.customer.split(/\s+/)[0] || "them";
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const call = async () => {
    setBusy(true);
    const r = await solCalls(d.jobId);
    setBusy(false);
    setSaid(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.message });
  };
  return (
    <div className={box}>
      <PanelHead title={`Call ${first}`} onClose={onDone} />
      {callsOn ? (
        <>
          <p className="text-[13px] leading-snug text-ink-2">
            Sol rings {first} on the number on their record, answers their questions and meets their worries, and writes the call up on the
            deal. He never changes a price or promises anything. Calls start only in calling hours.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!said?.ok && (
              <button type="button" className={dark} disabled={busy || !d.canCall} onClick={() => void call()}>
                <Phone className="size-4" /> {busy ? "Lining it up…" : `Have Sol call ${first}`}
              </button>
            )}
            {d.phone && (
              <a
                href={`tel:${d.phone.replace(/\s+/g, "")}`}
                className="text-[13px] font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
              >
                Or call {first} yourself
              </a>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] leading-snug text-ink-2">
            Sol&apos;s phone calls aren&apos;t switched on for your business yet. When they are, he&apos;ll ring {first}, answer their
            questions and write the call up here.
          </p>
          {d.phone && (
            <a href={`tel:${d.phone.replace(/\s+/g, "")}`} className={`${dark} mt-2`}>
              <Phone className="size-4" /> Call {first} yourself
            </a>
          )}
        </>
      )}
      {said && (
        <p className={clsx("mt-2 text-[13px]", said.ok ? "text-positive" : "text-danger")} role="status">
          {said.text}
        </p>
      )}
    </div>
  );
}

/** Bring in a teammate: a note to them in team chat, with the deal as a card. */
function TeamPanel(props: { deal: FeedDeal; me: string; team: { email: string; name: string }[]; onDone: () => void }) {
  const { deal: d, team } = props;
  const [who, setWho] = useState(team[0]?.email ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  if (!team.length)
    return (
      <div className={box}>
        <PanelHead title="Bring in a teammate" onClose={props.onDone} />
        <p className="text-[13px] text-ink-2">It&apos;s just you in the business so far. Add people in Settings → Users and permissions.</p>
      </div>
    );
  const send = async () => {
    setBusy(true);
    const room = dmRoom(props.me.toLowerCase(), who);
    const r = await sayInTeam(room, text.trim() || `Can you take a look at ${d.customer}'s deal?`, [d.jobId], []);
    setBusy(false);
    if (r.ok) {
      const name = team.find((t) => t.email === who)?.name ?? who;
      setSaid(`Sent to ${name} in team chat.`);
      window.dispatchEvent(new CustomEvent(TEAM_OPEN, { detail: { room } }));
    } else setSaid(r.message);
  };
  return (
    <div className={box}>
      <PanelHead title="Bring in a teammate" onClose={props.onDone} />
      {said ? (
        <p className="text-[13px] text-ink" role="status">
          {said}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <select className={field} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who">
            {team.map((t) => (
              <option key={t.email} value={t.email}>
                {t.name}
              </option>
            ))}
          </select>
          <textarea
            className={`${field} min-h-20`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What do you need from them? (the deal goes with it)"
          />
          <div>
            <button type="button" className={dark} disabled={busy || !who} onClick={() => void send()}>
              <UserPlus className="size-4" /> {busy ? "Sending…" : "Send in team chat"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HeatChip({ deal: d }: { deal: FeedDeal }) {
  if (!d.heat) return null;
  const title = d.heatWhy.join(" · ") || undefined;
  if (d.heat === "hot")
    return (
      <span
        title={title}
        className="inline-flex items-center gap-1 rounded-full bg-sun px-2 py-0.5 text-[11.5px] font-semibold text-sun-ink"
      >
        <Flame className="size-3" /> Hot
      </span>
    );
  if (d.heat === "cold")
    return (
      <span
        title={title}
        className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-muted"
      >
        <Snowflake className="size-3" /> Cold
      </span>
    );
  return (
    <span title={title} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-ink-2">
      Warm
    </span>
  );
}

const FORMS: RoofForm[] = ["hip", "gable", "ell", "hip", "skillion"];
const FINISHES: RoofFinish[] = ["charcoal-tile", "monument", "terracotta", "surfmist", "woodland", "shale"];

/** A steady number from a deal's id, so its illustrated roof is always the same. */
function seedOf(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** An example deal's roof, drawn (never a real home), panels on it once it is designed. */
function sampleRoof(d: FeedDeal): AerialRoofSpec {
  const s = seedOf(d.jobId);
  const form = FORMS[s % FORMS.length];
  const panels = d.projectId || d.kw ? Math.max(8, Math.round((d.kw ?? 6.6) / 0.44)) : 0;
  return {
    form,
    finish: FINISHES[(s >>> 3) % FINISHES.length],
    at: [160, 64, 320, 186],
    ...(form === "ell" ? { wing: [330, 100, 70] as [number, number, number] } : {}),
    panels: panels ? { north: Math.min(panels, 22) } : {},
    pool: s % 5 === 0,
    seed: s % 97,
  };
}

function RoofThumb({ deal: d }: { deal: FeedDeal }) {
  const frame = "relative h-[84px] w-[112px] shrink-0 overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line sm:h-[96px] sm:w-[128px]";
  if (d.sample)
    return (
      <div className={frame}>
        <AerialRoof spec={sampleRoof(d)} className="absolute inset-0 h-full w-full" />
        {d.kw ? <DesignedTag /> : null}
      </div>
    );
  if (d.place)
    return (
      <div className={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/design/roof?lat=${d.place.lat}&lng=${d.place.lng}`}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full scale-150 object-cover"
        />
        {d.projectId && <DesignedTag />}
      </div>
    );
  return (
    <div className={`${frame} flex items-center justify-center text-center text-[11px] leading-tight text-muted`}>
      No address on the map yet
    </div>
  );
}

function DesignedTag() {
  return (
    <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">Designed</span>
  );
}
