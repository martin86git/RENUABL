"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/components/ui/primitives";
import {
  BUSINESS_LEAD_STAGES,
  KIND_WORDS,
  LEAD_REMIND_HOURS,
  STAFF_NOTE_MAX,
  STAGE_WORDS,
  demoWhen,
  leadBoard,
  type BusinessLead,
  type BusinessLeadStage,
} from "@/lib/domain/design/business-leads";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
  return fetch("/api/admin/business-leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json() as Promise<{ ok: boolean; message?: string }>)
    .catch(() => ({ ok: false, message: "That didn't go through." }));
}

/**
 * Staff: RENUABL Business's own sales pipeline (domain/design/business-leads.ts). The stages across the top with their
 * counts, then the leads at the stage picked, each moved on with its own stage menu and given a note.
 */
export function BusinessLeadsBoard({ leads }: { leads: BusinessLead[] }) {
  const board = leadBoard(leads);
  const [stage, setStage] = useState<BusinessLeadStage>("new");
  const shown = board.find((s) => s.stage === stage)?.leads ?? [];
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3">
        {board.map((s) => (
          <button
            key={s.stage}
            type="button"
            onClick={() => setStage(s.stage)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset",
              s.stage === stage ? "bg-ink text-canvas ring-ink" : "bg-surface text-ink-2 ring-line hover:ring-ink/40",
            )}
          >
            {STAGE_WORDS[s.stage]} <span className="tabular-nums opacity-70">{s.leads.length}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="px-5 py-6 text-[14px] text-muted">Nothing at {STAGE_WORDS[stage]}.</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((l) => (
            <LeadRow key={l.id} lead={l} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LeadRow({ lead }: { lead: BusinessLead }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(lead.staffNote ?? "");
  const [noting, setNoting] = useState(false);
  const [booking, setBooking] = useState(false);

  const move = async (stage: BusinessLeadStage) => {
    if (stage === "booked") return setBooking(true);
    setBusy(true);
    const r = await post({ id: lead.id, stage });
    setBusy(false);
    if (!r.ok) window.alert(r.message ?? "That didn't go through.");
    router.refresh();
  };
  const keepNote = async () => {
    setBusy(true);
    const r = await post({ id: lead.id, note });
    setBusy(false);
    if (!r.ok) return window.alert(r.message ?? "That didn't go through.");
    setNoting(false);
    router.refresh();
  };

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium">{lead.name || lead.email}</span>
            {lead.business && <span className="text-[14px] text-ink-2">· {lead.business}</span>}
            <Badge tone={lead.kind === "enterprise" ? "info" : lead.kind === "demo-request" ? "positive" : "neutral"}>
              {KIND_WORDS[lead.kind]}
            </Badge>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            <a href={`mailto:${lead.email}`} className="underline underline-offset-4">
              {lead.email}
            </a>
            {lead.mobile && (
              <>
                {" · "}
                <a href={`tel:${lead.mobile.replace(/\s/g, "")}`} className="underline underline-offset-4">
                  {lead.mobile}
                </a>
              </>
            )}
            {lead.users ? ` · ${lead.users} users` : ""} · came in {when(lead.at)}
            {lead.stageAt && lead.movedBy ? ` · moved ${when(lead.stageAt)} by ${lead.movedBy}` : ""}
          </p>
          {lead.note && <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] text-ink-2">&ldquo;{lead.note}&rdquo;</p>}
          {lead.staffNote && !noting && <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-ink">Note: {lead.staffNote}</p>}
          {lead.stage === "booked" && lead.demo && !booking && <DemoLine lead={lead} onChange={() => setBooking(true)} />}
          {lead.stage === "booked" && !lead.demo && !booking && (
            <button type="button" onClick={() => setBooking(true)} className="mt-1.5 text-[13px] text-warning underline underline-offset-4">
              No time on this demo yet: add it for the reminders
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`stage-${lead.id}`}>
            Stage
          </label>
          <select
            id={`stage-${lead.id}`}
            value={lead.stage}
            disabled={busy}
            onChange={(e) => void move(e.target.value as BusinessLeadStage)}
            className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px]"
          >
            {BUSINESS_LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_WORDS[s]}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setNoting((n) => !n)} className="text-[13px] text-ink-2 underline underline-offset-4">
            {lead.staffNote ? "Change note" : "Add a note"}
          </button>
        </div>
      </div>
      {booking && <BookDemo lead={lead} onDone={() => setBooking(false)} />}
      {noting && (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            maxLength={STAFF_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Booked for Tuesday 10am, wants to see the designer…"
            className="h-20 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void keepNote()}
              className="h-9 rounded-full bg-ink px-4 text-[13px] font-medium text-canvas disabled:bg-surface-2 disabled:text-muted"
            >
              Save note
            </button>
            <button type="button" onClick={() => setNoting(false)} className="h-9 px-3 text-[13px] text-ink-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** When the demo is and which reminders go: staff an hour before, the lead the day before when ticked. */
function DemoLine({ lead, onChange }: { lead: BusinessLead; onChange: () => void }) {
  const demo = lead.demo!;
  const [now] = useState(() => Date.now());
  const passed = Date.parse(demo.at) <= now;
  const them = !demo.remindLead
    ? "No reminder to them"
    : demo.leadReminded
      ? "Their reminder sent"
      : `They're reminded ${LEAD_REMIND_HOURS} hours before`;
  const you = demo.staffReminded ? "your reminder sent" : "you're reminded an hour before";
  return (
    <p className="mt-1.5 text-[13px] text-ink">
      <span className="font-medium">Demo {demoWhen(demo.at)}</span>
      {demo.link && (
        <>
          {" · "}
          <a href={demo.link} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4">
            link to join
          </a>
        </>
      )}
      <span className="text-muted">{passed ? " · it has passed: move it to Demo done" : ` · ${them}, ${you}`}</span>
      {" · "}
      <button type="button" onClick={onChange} className="text-ink-2 underline underline-offset-4">
        Change time
      </button>
    </p>
  );
}

/** Melbourne's day and clock for an ISO time, for the form's boxes. */
function melbourneParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Melbourne",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return { date, time };
}

/** Booking the demo moves the lead to Demo booked; the reminders go from the ten-minute cron. */
function BookDemo({ lead, onDone }: { lead: BusinessLead; onDone: () => void }) {
  const router = useRouter();
  const start = lead.demo ? melbourneParts(lead.demo.at) : { date: "", time: "10:00" };
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [link, setLink] = useState(lead.demo?.link ?? "");
  const [remindLead, setRemindLead] = useState(lead.demo ? lead.demo.remindLead : true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const first = (lead.name ?? "").trim().split(/\s+/)[0] || "them";

  const save = async () => {
    setBusy(true);
    setProblem("");
    const r = await post({ id: lead.id, demo: { date, time, link, remindLead } });
    setBusy(false);
    if (!r.ok) return setProblem(r.message ?? "That didn't go through.");
    onDone();
    router.refresh();
  };

  const box = "h-9 rounded-lg border border-line bg-surface px-2 text-[14px]";
  return (
    <div className="mt-3 space-y-2.5 rounded-xl border border-line p-3">
      <p className="text-[13px] font-medium">Book the demo (Melbourne time)</p>
      <div className="flex flex-wrap gap-2">
        <input type="date" aria-label="Day" value={date} onChange={(e) => setDate(e.target.value)} className={box} />
        <input type="time" aria-label="Time" value={time} onChange={(e) => setTime(e.target.value)} className={box} />
        <input
          type="url"
          aria-label="Link to join"
          placeholder="Link to join (Google Meet, Zoom…), optional"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className={`${box} min-w-[16rem] flex-1`}
        />
      </div>
      <label className="flex items-start gap-2 text-[13px]">
        <input type="checkbox" checked={remindLead} onChange={(e) => setRemindLead(e.target.checked)} className="mt-0.5" />
        <span>Email {first} a reminder the day before, from RENUABL, with the link (replies come to you)</span>
      </label>
      <p className="text-[12px] text-muted">You and the lead alert addresses are emailed an hour before.</p>
      {problem && (
        <p className="text-[13px] text-danger" role="alert">
          {problem}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !date || !time}
          onClick={() => void save()}
          className="h-9 rounded-full bg-ink px-4 text-[13px] font-medium text-canvas disabled:bg-surface-2 disabled:text-muted"
        >
          {lead.demo ? "Save the new time" : "Book it"}
        </button>
        <button type="button" onClick={onDone} className="h-9 px-3 text-[13px] text-ink-2">
          Cancel
        </button>
      </div>
    </div>
  );
}
