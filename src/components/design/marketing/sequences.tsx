"use client";

import { ArrowDown, ArrowUp, Clock, Loader2, Mail, Plus, Power, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, cn } from "@/components/ui/primitives";
import type { MarketingList } from "@/lib/domain/marketing/contacts";
import { DEFAULT_BRAND, type EdmSender, newBlockId, starterContent, type EdmBrand } from "@/lib/domain/marketing/edm";
import {
  SEQUENCE_LIMITS,
  STOP_WORDS,
  TRIGGER_WORDS,
  sequenceProblem,
  type SequenceDraft,
  type SequenceStep,
  type SequenceTrigger,
  type StopReason,
} from "@/lib/domain/marketing/sequences";
import {
  deleteSequence,
  loadCampaigns,
  loadContacts,
  NO_SENDER,
  loadMarketingSettings,
  loadSequence,
  loadSequences,
  newSequence,
  saveSequenceDraft,
  switchSequence,
  type CampaignLine,
  type Sequence,
  type SequenceLine,
} from "@/lib/services/marketing";
import { ReportStrip } from "./campaigns";
import { EdmBuilder, field } from "./edm-builder";

const box = "rounded-2xl bg-surface p-5 shadow-[var(--shadow-soft)]";
const n = (v: number) => v.toLocaleString("en-AU");

function OnBadge({ on }: { on: boolean }) {
  return (
    <span
      className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", on ? "bg-positive-soft text-positive" : "bg-canvas text-ink-2")}
    >
      {on ? "On" : "Off"}
    </span>
  );
}

export function SequencesPage() {
  const router = useRouter();
  const [list, setList] = useState<SequenceLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    loadSequences().then((r) => (r.ok ? setList(r.sequences) : setProblem(r.message)));
  }, []);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Sequences</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">
            Something happens (someone joins a list, opens or clicks a campaign), then emails go with waits between them, until they sign up
            become a customer, unsubscribe or bounce. Nothing sends until a sequence is switched on.
          </p>
        </div>
        <Button
          size="sm"
          onClick={async () => {
            const r = await newSequence();
            if (r.ok) router.push(`/design/marketing/sequences/${r.id}`);
            else setProblem(r.message);
          }}
        >
          <Plus className="size-4" /> New sequence
        </Button>
      </div>
      {problem && <p className="mt-4 text-[13px] text-danger">{problem}</p>}
      <div className={cn(box, "mt-5 p-0")}>
        {!list ? (
          <p className="flex items-center gap-2 px-5 py-6 text-[13px] text-muted">
            <Loader2 className="size-4 animate-spin" /> Loading
          </p>
        ) : list.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted">No sequences yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/design/marketing/sequences/${s.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-canvas/60"
                >
                  <p className="min-w-0 flex-1 truncate text-[14px] font-medium">{s.name}</p>
                  <OnBadge on={s.status === "on"} />
                  <span className="w-64 text-right text-[12px] text-muted tabular-nums">
                    {n(s.active)} in it · {n(s.finished)} finished · {n(s.counts.sent)} emails sent
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SequenceEditor({ id }: { id: string }) {
  const router = useRouter();
  const [seq, setSeq] = useState<Sequence | null>(null);
  const [draft, setDraft] = useState<SequenceDraft | null>(null);
  const [lists, setLists] = useState<MarketingList[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignLine[]>([]);
  const [brand, setBrand] = useState<EdmBrand>(DEFAULT_BRAND);
  const [sender, setSender] = useState<EdmSender>(NO_SENDER);
  const [renuabl, setRenuabl] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [saved, setSaved] = useState<"saved" | "saving" | "unsaved">("saved");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const loaded = useRef(false);

  const refresh = useCallback(async () => {
    const r = await loadSequence(id);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setSeq(r.sequence);
    if (!loaded.current) {
      setDraft(r.sequence.draft);
      loaded.current = true;
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    loadContacts({ q: "", list: null, offset: 0 }).then((r) => r.ok && setLists(r.lists));
    loadCampaigns().then((r) => r.ok && setCampaigns(r.campaigns.filter((c) => c.status !== "draft")));
    loadMarketingSettings().then((r) => {
      if (!r.ok) return;
      setBrand(r.settings.brand);
      setSender(r.sender);
      setRenuabl(r.renuabl);
    });
  }, [refresh]);

  useEffect(() => {
    if (!draft || saved !== "unsaved") return;
    const t = setTimeout(async () => {
      setSaved("saving");
      const r = await saveSequenceDraft(id, draft);
      setSaved(r.ok ? "saved" : "unsaved");
      if (!r.ok) setMsg({ ok: false, text: r.message });
    }, 800);
    return () => clearTimeout(t);
  }, [id, draft, saved]);

  if (!seq || !draft)
    return msg ? (
      <p className="text-[13px] text-danger">{msg.text}</p>
    ) : (
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <Loader2 className="size-4 animate-spin" /> Loading
      </p>
    );

  const on = seq.status === "on";
  const update = (patch: Partial<SequenceDraft>) => {
    setDraft({ ...draft, ...patch });
    setSaved("unsaved");
  };
  const setStep = (i: number, step: SequenceStep) => update({ steps: draft.steps.map((s, j) => (j === i ? step : s)) });
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= draft.steps.length) return;
    const steps = draft.steps.slice();
    [steps[i], steps[j]] = [steps[j], steps[i]];
    update({ steps });
  };
  const problem = sequenceProblem(draft);
  let emailNo = 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/design/marketing/sequences" className="text-[13px] text-muted hover:text-ink">
          ← Sequences
        </Link>
        <OnBadge on={on} />
        <span className="text-[12px] text-muted">{saved === "saved" ? "Saved" : saved === "saving" ? "Saving…" : "Not saved yet"}</span>
        <span className="ml-auto flex gap-2">
          {!on && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                if (!confirm("Delete this sequence?")) return;
                const r = await deleteSequence(id);
                if (r.ok) router.push("/design/marketing/sequences");
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
          <Button
            size="sm"
            variant={on ? "secondary" : "primary"}
            disabled={(!on && Boolean(problem)) || saved !== "saved"}
            onClick={async () => {
              if (!on && !confirm("Switch it on? From now, people its trigger catches get its emails, in the sending hours.")) return;
              const r = await switchSequence(id, !on);
              if (!r.ok) return setMsg({ ok: false, text: r.message });
              setMsg(null);
              refresh();
            }}
          >
            <Power className="size-4" /> {on ? "Switch off" : "Switch on"}
          </Button>
        </span>
      </div>
      {!on && problem && <p className="text-[13px] text-muted">Before it can go on: {problem}</p>}
      {msg && <p className={cn("text-[13px]", msg.ok ? "text-positive" : "text-danger")}>{msg.text}</p>}

      <input
        value={draft.name}
        maxLength={SEQUENCE_LIMITS.name}
        onChange={(e) => update({ name: e.target.value })}
        aria-label="Sequence name"
        className="w-full bg-transparent text-[22px] font-semibold tracking-tight outline-none"
      />

      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["In it now", seq.active],
            ["Finished", seq.finished],
            ["Stopped early", seq.stopped],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className={box}>
            <p className="text-[12px] text-muted">{label}</p>
            <p className="mt-1 font-mono text-[22px] tabular-nums">{n(v)}</p>
          </div>
        ))}
      </div>
      {seq.counts.sent + seq.counts.queued > 0 && <ReportStrip counts={seq.counts} />}
      {Object.keys(seq.stops).length > 0 && (
        <p className="text-[12px] text-muted">
          {Object.entries(seq.stops)
            .map(([r, v]) => `${STOP_WORDS[r as StopReason]}: ${n(v ?? 0)}`)
            .join(" · ")}
        </p>
      )}

      <section className={box}>
        <h2 className="text-[15px] font-semibold">When it starts</h2>
        {on && <p className="mt-1 text-[12px] text-muted">Switch it off to change what starts it.</p>}
        <TriggerPicker
          trigger={draft.trigger}
          lists={lists}
          campaigns={campaigns}
          disabled={on}
          onChange={(trigger) => update({ trigger })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold">Then</h2>
        {draft.steps.map((s, i) => {
          if (s.kind === "email") emailNo++;
          const label = s.kind === "email" ? `Email ${emailNo}` : `Wait ${s.days} working day${s.days === 1 ? "" : "s"}`;
          return (
            <div key={s.id} className={cn(box, "p-0")}>
              <div className="flex items-center gap-3 px-5 py-3">
                {s.kind === "email" ? <Mail className="size-4 text-sun-line" /> : <Clock className="size-4 text-muted" />}
                <button className="min-w-0 flex-1 text-left" onClick={() => s.kind === "email" && setOpen(open === s.id ? null : s.id)}>
                  <span className="text-[14px] font-medium">{label}</span>
                  {s.kind === "email" && (
                    <span className="ml-2 truncate text-[13px] text-muted">{s.content.subject || "No subject yet"}</span>
                  )}
                </button>
                {s.kind === "wait" && (
                  <input
                    type="number"
                    min={1}
                    max={SEQUENCE_LIMITS.waitDays}
                    value={s.days}
                    onChange={(e) =>
                      setStep(i, { ...s, days: Math.max(1, Math.min(SEQUENCE_LIMITS.waitDays, Number(e.target.value) || 1)) })
                    }
                    aria-label="Working days to wait"
                    className={cn(field, "h-8 w-20")}
                  />
                )}
                <button
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="grid size-8 place-items-center rounded-full hover:bg-canvas disabled:text-line-strong"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  aria-label="Move down"
                  disabled={i === draft.steps.length - 1}
                  onClick={() => move(i, 1)}
                  className="grid size-8 place-items-center rounded-full hover:bg-canvas disabled:text-line-strong"
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  aria-label="Remove step"
                  onClick={() => update({ steps: draft.steps.filter((_, j) => j !== i) })}
                  className="grid size-8 place-items-center rounded-full hover:bg-canvas"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {s.kind === "email" && open === s.id && (
                <div className="border-t border-line p-5">
                  <EdmBuilder
                    content={s.content}
                    brand={brand}
                    onBrand={setBrand}
                    sender={sender}
                    onChange={(content) => setStep(i, { ...s, content })}
                  />
                </div>
              )}
            </div>
          );
        })}
        {draft.steps.length < SEQUENCE_LIMITS.steps && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => update({ steps: [...draft.steps, { id: newBlockId(), kind: "email", content: starterContent() }] })}
            >
              <Mail className="size-4" /> Add an email
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => update({ steps: [...draft.steps, { id: newBlockId(), kind: "wait", days: 3 }] })}
            >
              <Clock className="size-4" /> Add a wait
            </Button>
          </div>
        )}
        {on && <p className="text-[12px] text-muted">People already in it carry on from the step number they&apos;re at.</p>}
      </section>

      <section className={box}>
        <h2 className="text-[15px] font-semibold">It stops when</h2>
        <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2">
          <li>They become a customer: a deal of theirs is sold{renuabl ? ", or they sign up to RENUABL Business" : ""} (always)</li>
          <li>They unsubscribe, their email bounces, or their consent is taken away (always)</li>
          <li>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.stops.clicked}
                onChange={(e) => update({ stops: { ...draft.stops, clicked: e.target.checked } })}
              />
              They click a link in one of its emails (so a person can take it from there)
            </label>
          </li>
        </ul>
      </section>
    </div>
  );
}

function TriggerPicker({
  trigger,
  lists,
  campaigns,
  disabled,
  onChange,
}: {
  trigger: SequenceTrigger | null;
  lists: MarketingList[];
  campaigns: CampaignLine[];
  disabled: boolean;
  onChange: (t: SequenceTrigger | null) => void;
}) {
  const kind = trigger?.kind ?? "list";
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <select
        disabled={disabled}
        value={trigger ? kind : ""}
        onChange={(e) => {
          const k = e.target.value as SequenceTrigger["kind"] | "";
          if (!k) return onChange(null);
          onChange(
            k === "list"
              ? lists[0]
                ? { kind: "list", listId: lists[0].id }
                : null
              : campaigns[0]
                ? { kind: k, campaignId: campaigns[0].id }
                : null,
          );
        }}
        className={field}
      >
        <option value="">Choose what starts it…</option>
        {(Object.keys(TRIGGER_WORDS) as SequenceTrigger["kind"][]).map((k) => (
          <option key={k} value={k}>
            {TRIGGER_WORDS[k]}
          </option>
        ))}
      </select>
      {trigger?.kind === "list" && (
        <select
          disabled={disabled}
          value={trigger.listId}
          onChange={(e) => onChange({ kind: "list", listId: e.target.value })}
          className={field}
        >
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}
      {trigger && trigger.kind !== "list" && (
        <select
          disabled={disabled}
          value={trigger.campaignId}
          onChange={(e) => onChange({ kind: trigger.kind, campaignId: e.target.value })}
          className={field}
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <p className="text-[12px] text-muted sm:col-span-2">
        Only people the trigger catches after the sequence is switched on are let in, each once. A list needs at least one list; opens and
        clicks need a campaign that has been sent.
      </p>
    </div>
  );
}
