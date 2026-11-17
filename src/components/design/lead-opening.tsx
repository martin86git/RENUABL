"use client";

/**
 * Sol's opening on a new lead, under its card when it is picked from the deals panel (lead-opening.ts; 18 Nov 2026,
 * Martin: "Sol immediately starts to prepare you with options on how to tackle the new lead"). A short conversation:
 * Sol's line, three ways in, the member's choice said back as their line, then Sol's next step for that choice with its
 * buttons. Every send goes through the deal's own routes (the outbox's email, the deal's text route, the call route), so
 * nothing here reaches a customer without a press.
 */
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { ArrowRight, Check, FileText, Mail, MessageSquare, PenTool, Phone, PhoneCall } from "lucide-react";
import type { FeedDeal } from "@/lib/domain/design/deal-feed";
import { OPENING_WORDS, helloText, type OpeningPath } from "@/lib/domain/design/lead-opening";
import { askAssistantToCall, textCustomer, useCallerInfo } from "@/lib/services/caller";
import { leadPageFor } from "@/lib/services/hello";
import { PATHS } from "./design-shell";
import { SolBadge } from "./sol-icon";
import { CallerAvatar } from "./settings-caller";

const W = OPENING_WORDS;
const first = (name: string) => name.trim().split(/\s+/)[0] || "";

export function LeadOpening(props: {
  deal: FeedDeal;
  /** The business's name, for the text. */
  business: string;
  /** Opens the hello email Sol lined up, to read and send (the card's own review box). */
  onReviewEmail: () => void;
  /** Opens the card's call choices (you on your phone, from the computer, the note-taker). */
  onCallMyself: () => void;
  onChanged: () => void;
}) {
  const d = props.deal;
  const info = useCallerInfo();
  const [path, setPath] = useState<OpeningPath | null>(null);
  const hasHello = Boolean(d.sol?.id) && d.canEmail;
  const canText = info.textsOn && Boolean(d.phone);
  const agent = info.caller;
  const canAgent = info.callsOn && agent.named && Boolean(d.phone);

  // The text with the link to their page: drafted on asking, changed as wanted, sent by a press.
  const [text, setText] = useState<string | null>(null);
  const [textBusy, setTextBusy] = useState(false);
  const [textSent, setTextSent] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const draftText = async () => {
    setNote(null);
    setTextBusy(true);
    const r = await leadPageFor(d.jobId);
    setTextBusy(false);
    if (!r.ok) return setNote(r.message);
    setText(helloText({ firstName: first(d.customer), business: props.business, url: `${window.location.origin}${r.path}` }));
  };
  const sendText = async () => {
    if (!text?.trim()) return;
    setTextBusy(true);
    const r = await textCustomer(d.jobId, text.trim());
    setTextBusy(false);
    if (!r.ok) return setNote(r.message);
    setTextSent(true);
    setText(null);
    props.onChanged();
  };
  const [agentBusy, setAgentBusy] = useState(false);
  const handToAgent = async () => {
    setAgentBusy(true);
    const r = await askAssistantToCall(d.jobId, agent.role ?? "sales");
    setAgentBusy(false);
    setNote(r.message);
    if (r.ok) props.onChanged();
  };

  const choose = (p: OpeningPath) => {
    setPath(p);
    setNote(null);
    setText(null);
  };
  const designed = Boolean(d.projectId);

  return (
    <section aria-label="How Sol would start" className="mt-3 space-y-3">
      <SolLine>{W.hello(d.customer)}</SolLine>

      <div className="grid gap-2 pl-10">
        <Choice on={path === "confirm"} icon={Mail} title={W.confirm.title} why={W.confirm.why} onClick={() => choose("confirm")} />
        <Choice on={path === "call"} icon={Phone} title={W.call.title} why={W.call.why} onClick={() => choose("call")} />
        <Choice
          on={path === "design"}
          icon={PenTool}
          title={W.design.title}
          why={designed ? W.design.designed : W.design.why}
          onClick={() => choose("design")}
        />
      </div>

      {path && (
        <>
          <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[13.5px] text-primary-ink">
            {W.chose[path]}
          </p>

          {path === "confirm" && (
            <SolLine>
              <p>{textSent ? W.textSent : W.confirmNext}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {hasHello || !d.canEmail ? (
                  <Act icon={Mail} onClick={props.onReviewEmail} off={!d.canEmail ? W.noEmail : null} primary={textSent}>
                    Read the email
                  </Act>
                ) : (
                  // No hello lined up (no place on the map yet, or the Leads agent hasn't run): write one on the deal.
                  <Link
                    href={`${PATHS.deals}/${encodeURIComponent(d.jobId)}?tab=email`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-surface-2"
                  >
                    <Mail className="size-4" aria-hidden /> Write the email
                  </Link>
                )}
                {!textSent && (
                  <Act
                    icon={MessageSquare}
                    onClick={() => void draftText()}
                    busy={textBusy && !text}
                    off={!d.phone ? W.noMobile : !info.textsOn ? W.textsOff : null}
                  >
                    Text the link
                  </Act>
                )}
              </div>
              {text !== null && (
                <div className="mt-3 rounded-xl bg-surface p-3 ring-1 ring-line">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={4}
                    className="w-full resize-y bg-transparent text-[13.5px] leading-relaxed text-ink focus:outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[12px] text-muted">To {d.phone} · your sign-off is added</span>
                    <button
                      type="button"
                      disabled={textBusy || !canText}
                      onClick={() => void sendText()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-ink disabled:bg-surface-2 disabled:text-muted"
                    >
                      {textBusy ? "Sending…" : "Send text"}
                    </button>
                  </div>
                </div>
              )}
            </SolLine>
          )}

          {path === "call" && (
            <SolLine>
              <p>{W.callNext(d.customer)}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Act icon={Phone} onClick={props.onCallMyself} off={!d.phone ? W.noMobile : null}>
                  I&apos;ll call
                </Act>
                <Act
                  avatar={<CallerAvatar caller={agent} size={20} />}
                  onClick={() => void handToAgent()}
                  busy={agentBusy}
                  off={!d.phone ? W.noMobile : !canAgent ? W.callsOff : null}
                >
                  {agent.named ? `${agent.name} calls` : "Your voice agent calls"}
                </Act>
              </div>
            </SolLine>
          )}

          {path === "design" && (
            <SolLine>
              <p>{W.designNext}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Link
                  href={`${PATHS.designer}?job=${encodeURIComponent(d.jobId)}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-ink hover:brightness-110"
                >
                  <PenTool className="size-4" aria-hidden /> {designed ? "Open the design" : "Design the roof"}
                </Link>
                {designed && (
                  <Link
                    href={`${PATHS.deals}/${encodeURIComponent(d.jobId)}/proposal`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-ink ring-1 ring-line hover:bg-surface-2"
                  >
                    <FileText className="size-4" aria-hidden /> Send the indicative proposal
                  </Link>
                )}
              </div>
            </SolLine>
          )}

          {note && (
            <p role="status" className="pl-10 text-[13px] text-ink-2">
              {note}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function SolLine(props: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-line">
        <SolBadge className="size-5" />
      </span>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink ring-1 ring-line">
        {props.children}
      </div>
    </div>
  );
}

function Choice(props: {
  on: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  why: string;
  onClick: () => void;
}) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.on}
      className={clsx(
        "flex items-center gap-3 rounded-xl bg-surface px-3.5 py-3 text-left ring-1 transition",
        props.on ? "ring-2 ring-sun-line" : "ring-line hover:ring-ink-2",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sun-line/10">
        <Icon className="size-4 text-sun-line" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-ink">{props.title}</span>
        <span className="block text-[12.5px] leading-snug text-ink-2">{props.why}</span>
      </span>
      {props.on ? (
        <Check className="size-4 shrink-0 text-sun-line" aria-hidden />
      ) : (
        <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
      )}
    </button>
  );
}

/** One of Sol's next-step buttons; greyed with why when it can't be done here. */
function Act(props: {
  icon?: React.ComponentType<{ className?: string }>;
  avatar?: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  off?: string | null;
  primary?: boolean;
  children: React.ReactNode;
}) {
  const Icon = props.icon ?? PhoneCall;
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={props.onClick}
        disabled={Boolean(props.off) || props.busy}
        className={clsx(
          "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition disabled:bg-surface-2 disabled:text-muted disabled:ring-0",
          props.primary ? "bg-primary text-primary-ink hover:brightness-110" : "text-ink ring-1 ring-line hover:bg-surface-2",
        )}
      >
        {props.avatar ?? <Icon className="size-4" aria-hidden />}
        {props.busy ? "One moment…" : props.children}
      </button>
      {props.off && <span className="mt-1 pl-2 text-[11.5px] text-muted">{props.off}</span>}
    </span>
  );
}
