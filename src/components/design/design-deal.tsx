"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, PenTool, Search, Trash2 } from "lucide-react";
import clsx from "clsx";
import {
  JOB_STAGES,
  STAGE_LABELS,
  type Activity,
  type ActivityKind,
  type Customer,
  type Job,
  type JobStage,
} from "@/lib/domain/design/crm";
import { systemDetails, type DealDetail } from "@/lib/domain/design/deal";
import { addActivity, deleteJob, dollars, loadCustomer, loadDealDesign, loadJob, saveJob, shortDate } from "@/lib/services/crm";
import { ACTIVITY_WORD, StageTag } from "./design-home";
import { DealProposal } from "./design-proposal";
import { PATHS, ui } from "./design-shell";

type Written = "note" | "call" | "email";
const FILTERS: { key: "all" | ActivityKind; label: string }[] = [
  { key: "all", label: "All activities" },
  { key: "note", label: "Notes" },
  { key: "email", label: "Emails" },
  { key: "call", label: "Calls" },
  { key: "stage", label: "Stage moves" },
  { key: "proposal", label: "Proposal" },
];

/** A block of the left-hand column that folds away, with its lines one under the next: a quiet label over its value. */
function Block({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-t border-line first:border-t-0">
      <div className="flex items-center justify-between gap-2 px-5 py-3.5">
        <button
          className="flex items-center gap-2 text-[15px] font-medium tracking-tight text-ink"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <ChevronDown className={clsx("size-4 text-muted", !open && "-rotate-90")} aria-hidden />
          {title}
        </button>
        {action}
      </div>
      {open && <div className="space-y-4 px-5 pb-5">{children}</div>}
    </section>
  );
}

function Line({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={clsx("mt-0.5 text-sm", value ? "text-ink" : "text-muted")}>{value ?? "--"}</p>
    </div>
  );
}

/**
 * One of the system's details, which can be typed over: click it (or tab to
 * it) and type; leaving the box saves it. What is typed in by hand stands in
 * place of what the design says and is marked so, with the way back to the
 * design's own. Emptying the box goes back to the design's too.
 */
function DetailField({ line, onSave }: { line: DealDetail; onSave: (text: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  const done = () => {
    if (text !== null && text.trim() !== (line.value ?? "")) onSave(text.trim());
    setText(null);
  };
  return (
    <div>
      <label className="block text-xs text-muted">
        {line.label}
        <input
          className={clsx(
            "mt-0.5 block h-8 w-full rounded-md border bg-transparent px-2 text-sm text-ink outline-none placeholder:text-muted focus:border-forest focus:bg-surface",
            "-mx-2 w-[calc(100%+1rem)]",
            line.typed ? "border-sun-line" : "border-transparent hover:border-line",
          )}
          value={text ?? line.value ?? ""}
          placeholder="--"
          maxLength={120}
          onChange={(e) => setText(e.target.value)}
          onBlur={done}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setText(null);
          }}
        />
      </label>
      {line.typed && (
        <button className="mt-1 text-[11px] text-sun-ink underline underline-offset-2" onClick={() => onSave("")}>
          Typed in by hand: {line.designed ? `use the design's (${line.designed})` : "clear"}
        </button>
      )}
    </div>
  );
}

/**
 * /design/deals/[id]: one deal. Down the left, everything the installation
 * needs: the deal itself (stage, price, install date, who and where) and the
 * system's details, read from its design (system type and size, the panel,
 * inverter and battery and how many, the roof, storeys and phases). A detail
 * the design doesn't say yet shows as "--", and any detail can be typed in by
 * hand (kept on the job; it then stands in place of the design's). Beside it, an overview and the
 * activities: notes, emails, calls and stage moves, by month, that can be
 * searched and added to.
 */
export function DealPage({ id }: { id: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  // What the deal's design says, once fetched: the details are worked out from it and what was typed in by hand.
  const [designed, setDesigned] = useState<Awaited<ReturnType<typeof loadDealDesign>>>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<"overview" | "activities">("activities");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [find, setFind] = useState("");
  const [kind, setKind] = useState<Written>("note");
  const [text, setText] = useState("");
  const [value, setValue] = useState("");

  const load = useCallback(async () => {
    const res = await loadJob(id);
    if (!res.ok) return setProblem(res.message);
    setJob(res.job);
    setCustomer(res.customer);
    setValue(res.job.value === null ? "" : String(Math.round(res.job.value)));
    const [history, design] = await Promise.all([
      loadCustomer(res.job.customerId),
      res.job.projectId ? loadDealDesign(res.job.projectId) : Promise.resolve(null),
    ]);
    // What was said about this deal, and what was said about the customer in general.
    if (history.ok) setActivity(history.activity.filter((a) => a.jobId === id || a.jobId === null));
    setDesigned(design);
  }, [id]);
  useEffect(() => {
    // The page's data comes from the server once it is in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const patch = async (change: Parameters<typeof saveJob>[1]) => {
    const res = await saveJob(id, change);
    if (!res.ok) return setStatus(res.message);
    setStatus("Saved");
    setJob(res.job);
    // A change of stage is written to the history on the server: fetch it.
    if (change.stage) void load();
  };
  const say = async () => {
    if (!job || !text.trim()) return;
    const res = await addActivity(job.customerId, { kind, text: text.trim(), jobId: id });
    if (!res.ok) return setStatus(res.message);
    setActivity([res.activity, ...activity]);
    setText("");
  };

  if (problem)
    return (
      <div className={ui.page}>
        <Link href={PATHS.pipelines} className={clsx(ui.link, "text-sm")}>
          <ChevronLeft className="inline size-4" aria-hidden /> Deals
        </Link>
        <p className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning" role="alert">
          {problem}
        </p>
      </div>
    );
  if (!job || !customer) return <div className={ui.page} aria-busy="true" />;

  const words = find.trim().toLowerCase();
  const shown = activity.filter(
    (a) => (filter === "all" || a.kind === filter) && (!words || `${a.text} ${a.by}`.toLowerCase().includes(words)),
  );
  // Newest first, under the month they happened in.
  const months: { month: string; items: Activity[] }[] = [];
  for (const a of shown) {
    const month = new Date(a.at).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    if (months[months.length - 1]?.month === month) months[months.length - 1].items.push(a);
    else months.push({ month, items: [a] });
  }
  const details = systemDetails(designed?.design ?? null, designed?.form ?? null, job.details);
  const known = details.filter((d) => d.value).length;
  const setDetail = (key: string, text: string) => {
    const next = { ...job.details };
    if (text) next[key] = text;
    else delete next[key];
    void patch({ details: next });
  };
  const pill = (on: boolean) =>
    clsx(
      "h-11 flex-1 border-b-2 text-sm font-medium",
      on ? "border-ink bg-surface text-ink" : "border-transparent bg-surface-2 text-ink-2 hover:text-ink",
    );

  return (
    <div className="grid items-start gap-5 px-5 py-6 lg:grid-cols-[21rem_minmax(0,1fr)] lg:px-8">
      {/* Down the left: the deal, and everything the installation needs. */}
      <aside
        className={clsx(ui.card, "lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto")}
        aria-label="The deal and its system"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <Link href={PATHS.pipelines} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:underline">
            <ChevronLeft className="size-4 text-muted" aria-hidden /> Deals
          </Link>
          <button
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-danger"
            onClick={async () => {
              if (!window.confirm(`Delete this deal for ${customer.name}? Its design and history are kept.`)) return;
              const res = await deleteJob(id);
              if (res.ok) router.push(PATHS.pipelines);
              else setStatus(res.message);
            }}
          >
            <Trash2 className="size-3.5" aria-hidden /> Delete
          </button>
        </div>
        <div className="border-b border-line px-5 py-4">
          <p className={ui.eyebrow}>Deal</p>
          <h1 className="mt-1 text-[20px] leading-snug tracking-tight text-ink">
            {customer.name} <span className="text-ink-2">· {job.title}</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StageTag stage={job.stage} />
            <span className="text-sm tabular-nums text-ink">{dollars(job.value)}</span>
          </div>
          {job.lat !== null ? (
            <Link href={`${PATHS.designer}?job=${job.id}`} className={clsx(ui.primary, "mt-4 w-full")}>
              <PenTool className="size-4" aria-hidden /> {job.projectId ? "Open design" : "Design this roof"}
            </Link>
          ) : (
            <p className="mt-3 text-xs text-muted">
              Give this deal an address found on the map (on the customer&apos;s page) to design it.
            </p>
          )}
        </div>

        {/* The proposal worked out from this deal's design: whether one is out, and the way to preview and send it. */}
        <DealProposal jobId={job.id} hasDesign={Boolean(job.projectId)} />

        <Block title="Deal details">
          <label className="block text-xs text-muted">
            Stage
            <select
              className={clsx(ui.input, "mt-1 appearance-auto")}
              value={job.stage}
              onChange={(e) => void patch({ stage: e.target.value as JobStage })}
            >
              {JOB_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Quoted price, inc. GST ($)
            <input
              className={clsx(ui.input, "mt-1 tabular-nums")}
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
              onBlur={() => {
                const next = value === "" ? null : Number(value);
                if (next !== job.value) void patch({ value: next });
              }}
              placeholder="From the design"
            />
          </label>
          <label className="block text-xs text-muted">
            Install date
            <input
              type="date"
              className={clsx(ui.input, "mt-1 tabular-nums")}
              value={job.installDate ?? ""}
              onChange={(e) => void patch({ installDate: e.target.value || null })}
            />
          </label>
          <Line label="Installation address" value={job.address || null} />
          <div>
            <p className="text-xs text-muted">Customer</p>
            <Link href={`${PATHS.customers}/${customer.id}`} className={clsx(ui.link, "mt-0.5 block text-sm")}>
              {customer.name}
            </Link>
          </div>
          <Line label="Phone" value={customer.phone || null} />
          <Line label="Email" value={customer.email || null} />
          <Line label="Lead source" value={customer.source || null} />
          <p className="text-xs text-muted" role="status">
            {status || `Started ${shortDate(job.createdAt)}`}
          </p>
        </Block>

        <Block
          title="System details"
          action={
            <span className="text-xs tabular-nums text-muted">
              {known} of {details.length}
            </span>
          }
        >
          <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-2">
            {job.projectId
              ? "Filled in from the design. Click any line to type over it."
              : "These fill in from the design once the roof has been drawn and saved. Click any line to type it in now."}
          </p>
          {details.map((d) => (
            <DetailField key={d.key} line={d} onSave={(text) => setDetail(d.key, text)} />
          ))}
        </Block>
      </aside>

      {/* Beside it: the overview, and what has been said and done. */}
      <div className="min-w-0">
        <div className="flex overflow-hidden rounded-t-lg ring-1 ring-line" role="tablist">
          <button role="tab" aria-selected={tab === "overview"} className={pill(tab === "overview")} onClick={() => setTab("overview")}>
            Overview
          </button>
          <button
            role="tab"
            aria-selected={tab === "activities"}
            className={pill(tab === "activities")}
            onClick={() => setTab("activities")}
          >
            Activities
          </button>
        </div>

        {tab === "overview" ? (
          <div className="mt-5 space-y-5">
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Stage", STAGE_LABELS[job.stage]],
                ["Quoted, inc. GST", dollars(job.value)],
                ["Install date", job.installDate ? shortDate(job.installDate) : "Not booked"],
                ["System", details.find((d) => d.key === "systemSize")?.value ?? "Not designed"],
              ].map(([k, v]) => (
                <div key={k} className={clsx(ui.card, "px-4 py-3.5")}>
                  <dt className={ui.eyebrow}>{k}</dt>
                  <dd className="mt-1.5 text-[19px] tabular-nums tracking-tight text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <section className={clsx(ui.card, "p-5")}>
              <h2 className="text-[15px] font-medium text-ink">The system</h2>
              {known ? (
                <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
                  {details
                    .filter((d) => d.value)
                    .map((d) => (
                      <div key={d.label}>
                        <dt className="text-xs text-muted">{d.label}</dt>
                        <dd className="mt-0.5 text-sm text-ink">{d.value}</dd>
                      </div>
                    ))}
                </dl>
              ) : (
                <p className="mt-2 text-sm text-ink-2">Nothing designed yet.</p>
              )}
            </section>
            <section className={clsx(ui.card, "p-5")}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-medium text-ink">Latest activity</h2>
                <button className={clsx(ui.link, "text-[13px]")} onClick={() => setTab("activities")}>
                  See all {activity.length}
                </button>
              </div>
              {activity.length === 0 ? (
                <p className="mt-2 text-sm text-ink-2">Nothing yet.</p>
              ) : (
                <ol className="mt-2 divide-y divide-line">
                  {activity.slice(0, 3).map((a) => (
                    <li key={a.id} className="flex items-start gap-3 py-2.5 text-sm">
                      <span className="mt-0.5 w-12 shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                        {ACTIVITY_WORD[a.kind]}
                      </span>
                      <span className="min-w-0 flex-1 text-ink">{a.text}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">{shortDate(a.at)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex flex-wrap gap-x-5 border-b border-line" role="group" aria-label="Kind of activity">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={clsx(
                    "-mb-px h-10 border-b-[3px] text-sm font-medium",
                    filter === f.key ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="relative block w-64 max-w-full">
                <span className="sr-only">Search activities</span>
                <input
                  className={clsx(ui.input, "rounded-full pl-4 pr-9")}
                  value={find}
                  onChange={(e) => setFind(e.target.value)}
                  placeholder="Search activities"
                />
                <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              </label>
              <p className="text-xs tabular-nums text-muted">
                Showing {shown.length} of {activity.length}
              </p>
            </div>

            <div className={clsx(ui.card, "mt-4 flex flex-wrap gap-2 p-3")}>
              <select
                aria-label="What happened"
                className={clsx(ui.input, "w-28 appearance-auto")}
                value={kind}
                onChange={(e) => setKind(e.target.value as Written)}
              >
                <option value="note">Note</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
              </select>
              <input
                aria-label="What was said or done"
                className={clsx(ui.input, "min-w-0 flex-1")}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void say()}
                maxLength={1000}
                placeholder="Write a note, or log a call or an email"
              />
              <button className={ui.primary} onClick={say} disabled={!text.trim()}>
                Add
              </button>
            </div>

            {months.length === 0 && <p className="mt-6 text-sm text-ink-2">{activity.length ? "Nothing matches that." : "Nothing yet."}</p>}
            {months.map(({ month, items }) => (
              <section key={month} className="mt-6">
                <h2 className="text-[15px] text-ink-2">{month}</h2>
                <ol className="mt-2.5 space-y-2.5">
                  {items.map((a) => (
                    <li key={a.id} className={clsx(ui.card, "px-5 py-4")}>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm text-ink">
                          <strong className="font-semibold">{a.kind === "stage" ? "Deal activity" : ACTIVITY_WORD[a.kind]}</strong>{" "}
                          <span className="text-ink-2">by {a.by.split("@")[0]}</span>
                        </p>
                        <time className="shrink-0 text-xs tabular-nums text-muted" dateTime={a.at}>
                          {new Date(a.at).toLocaleString("en-AU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">{a.text}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
