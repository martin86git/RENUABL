"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, NotebookPen, ClipboardList, PenTool, Search, Trash2, Wrench } from "lucide-react";
import { JobCardDialog } from "./job-card";
import { CallNotetaker, type NotetakerHandle } from "./call-notetaker";
import { ListOnMarketplace } from "./marketplace";
import { suburbAlone } from "@/lib/domain/design/marketplace";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";
import clsx from "clsx";
import { DealTeamChat } from "./deal-team-chat";
import {
  JOB_STAGES,
  STAGE_LABELS,
  type Activity,
  type ActivityKind,
  type Customer,
  type CustomerInput,
  type Job,
  type JobStage,
  PRE_INSTALL_STAGES,
} from "@/lib/domain/design/crm";
import { systemDetails, type DealDetail, type JobExtra } from "@/lib/domain/design/deal";
import { fieldLine, resolveDealFields, type DealFieldsConfig } from "@/lib/domain/design/deal-sections";
import { INSTALLER_KEY, splitName } from "@/lib/domain/design/crm";
import { loadInstallExtras } from "@/lib/services/after-sale";
import {
  addActivity,
  deleteJob,
  dollars,
  loadCustomer,
  loadDealDesign,
  loadDealFields,
  loadJob,
  markNotificationsRead,
  saveCustomer,
  saveJob,
  setDealOwner,
  shortDate,
} from "@/lib/services/crm";
import { loadMembers } from "@/lib/services/design-account";
import { handleOf, mentionText } from "@/lib/domain/design/mentions";
import { ACTIVITY_WORD } from "./design-home";
import { DealChat } from "./chat-panel";
import { DealService } from "./design-service";
import { AddressField } from "./design-customers";
import { useDesignAccount } from "./design-account";
import { DealEmail, SectionFieldLine } from "./deal-tools";
import { DesignDrawer } from "./design-drawer";
import { DealBanner } from "./deal-banner";
import { DealProposal } from "./design-proposal";
import { PATHS, ui } from "./design-shell";
import { DealFiles } from "./deal-pulse";
import { DealSol } from "./deal-sol";
import { hasPulse, type DealPulse } from "@/lib/domain/design/deal-heat";
import { NOT_TRACKED, openedWords } from "@/lib/domain/design/email-opens";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { loadOpens, loadPulses } from "@/lib/services/deal-pulse";
import { setFrameInFront, usePageAbout } from "@/lib/services/page-context";

type Written = "note" | "call" | "email";
type Tab = "overview" | "activities" | "team" | "email" | "chat" | "sol" | "files" | "service" | "details";
/** The deal's tabs under its banner, in order; Service sits apart after them. */
const DEAL_TABS: [Exclude<Tab, "service">, string][] = [
  ["overview", "Overview"],
  ["activities", "Activity"],
  ["team", "Team"],
  ["email", "Email"],
  ["chat", "Chat"],
  ["sol", "Sol"],
  ["files", "Files"],
  ["details", "Details"],
];
const FILTERS: { key: "all" | ActivityKind; label: string }[] = [
  { key: "all", label: "All activities" },
  { key: "note", label: "Notes" },
  { key: "email", label: "Emails" },
  { key: "call", label: "Calls" },
  { key: "stage", label: "Stage moves" },
  { key: "proposal", label: "Proposal" },
  { key: "message", label: "Messages" },
  { key: "service", label: "Service" },
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

/**
 * A deal detail typed in place and kept when the box is left (or on Enter). A refused save puts back what was there,
 * so the box never shows something that wasn't kept. Give it a `key` of the saved value to start again from a new one.
 */
function EditLine(props: {
  label: string;
  value: string;
  onSave: (value: string) => Promise<boolean>;
  type?: "text" | "email" | "tel";
  placeholder?: string;
  max?: number;
  /** Laid out as a row of the deal's header card: the label beside the value, which looks like text until clicked. */
  row?: boolean;
}) {
  const [text, setText] = useState(props.value);
  // Escape leaves the box without keeping what was typed.
  const dropped = useRef(false);
  const keep = async () => {
    if (dropped.current) {
      dropped.current = false;
      return setText(props.value);
    }
    const next = text.trim();
    if (next === props.value) return setText(props.value);
    if (!(await props.onSave(next))) setText(props.value);
  };
  const box = (
    <input
      className={props.row ? HEAD_INPUT : clsx(ui.input, "mt-1")}
      type={props.type ?? "text"}
      value={text}
      maxLength={props.max ?? 200}
      placeholder={props.placeholder ?? "--"}
      aria-label={props.row ? props.label : undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => void keep()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          dropped.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
  if (props.row) return <HeadRow label={props.label}>{box}</HeadRow>;
  return (
    <label className="block text-xs text-muted">
      {props.label}
      {box}
    </label>
  );
}

/** How a value in the deal's header card looks: plain text until hovered or clicked, then a box. */
const HEAD_INPUT =
  "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-ink outline-none placeholder:text-muted hover:bg-surface-2 focus:border-line focus:bg-surface";

/** One row of the deal's header card: the label on the left, its value beside it. */
function HeadRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
      <span className="text-xs text-muted">{label}</span>
      <div className="min-w-0">{children}</div>
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
  // The address search is open in Deal details, to give the deal a new address.
  const [moving, setMoving] = useState(false);
  // "?tab=chat" (from Messages, and from the email about a new message) opens the deal on its conversation; "?tab=email"
  // (a draft Sol wrote) on its Email tab.
  const asked = useSearchParams().get("tab");
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    asked === "chat"
      ? "chat"
      : asked === "email"
        ? "email"
        : asked === "sol"
          ? "sol"
          : asked === "service"
            ? "service"
            : asked === "team"
              ? "team"
              : asked === "details"
                ? "details"
                : asked === "activities"
                  ? "activities"
                  : "overview",
  );
  // The designer as a centred pop-up over the deal (8 Nov 2026, Martin: in the same space, the page's grey either side, so
  // it reads as quick); ?design=1 opens it. Kept loaded once opened, so closing never loses the work.
  const [drawer, setDrawer] = useState(params.get("design") === "1");
  // A link to this deal's own design anywhere on the page (the proposal's "Open the design") opens this pop-up rather than
  // the shell's: heard first, on the window, so the shell leaves it alone.
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self")) return;
      const u = new URL(link.href);
      if (u.origin !== window.location.origin || u.pathname !== PATHS.designer || u.searchParams.get("job") !== id) return;
      e.preventDefault();
      setDrawer(true);
    };
    window.addEventListener("click", click, true);
    return () => window.removeEventListener("click", click, true);
  }, [id]);
  // The installation's job card, over the page (wave 7).
  const [card, setCard] = useState(false);
  // The note-taker, started from the banner's phone round or Overview's button; kept on the page whatever the tab.
  const notetaker = useRef<NotetakerHandle>(null);
  // Bumped each time the designer saves, so the banner draws the design as it now is.
  const [designVersion, setDesignVersion] = useState(0);
  const [account] = useDesignAccount();
  // Which of the deal's tabs of fields is showing, and the signed proposal's figures for Financials.
  const [section, setSection] = useState("system");
  // The business's own arrangement of a deal's fields (Settings → Deal fields); ours until it has loaded.
  const [fieldsConfig, setFieldsConfig] = useState<DealFieldsConfig | null>(null);
  // The business's people: who a deal can be given to, and who can be @mentioned in a note.
  const [members, setMembers] = useState<string[]>([]);
  // The deal's clock and temperature while it is being sold, and when its emails were opened.
  const [pulse, setPulse] = useState<DealPulse | null>(null);
  const [opens, setOpens] = useState<{ times: Record<string, string[]>; counts: Record<string, number> } | null>(null);
  useEffect(() => {
    let gone = false;
    void loadPulses().then((r) => !gone && r.ok && setPulse(r.pulses[id] ?? null));
    void loadOpens(id).then((r) => !gone && r.ok && setOpens({ times: r.opens, counts: r.counts ?? {} }));
    return () => {
      gone = true;
    };
  }, [id, activity.length]);
  useEffect(() => {
    void loadMembers().then((m) => m && setMembers(m.map((x) => x.email.toLowerCase())));
    // Opening the deal reads any mention of this member on it.
    void markNotificationsRead({ jobId: id }).then(() => window.dispatchEvent(new Event("renuabl:notifications")));
  }, [id]);
  useEffect(() => {
    void loadDealFields().then((res) => res.ok && setFieldsConfig(res.fields));
  }, []);
  const [extra, setExtra] = useState<JobExtra | null>(null);
  useEffect(() => {
    void loadInstallExtras().then((res) => res.ok && setExtra(res.extras.find((e) => e.jobId === id) ?? null));
  }, [id]);
  const business = account?.signedIn ? (account.business?.name ?? "") : "";
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
  // The same, saying whether it was kept, for a box that puts back what was there when it wasn't.
  const patchOk = async (change: Parameters<typeof saveJob>[1]) => {
    const res = await saveJob(id, change);
    if (!res.ok) {
      setStatus(res.message);
      return false;
    }
    setStatus("Saved");
    setJob(res.job);
    return true;
  };
  // The customer's own details, changed from their deal: kept on the customer, so every deal of theirs shows them.
  const saveWho = async (change: Partial<CustomerInput>) => {
    if (!customer) return false;
    const res = await saveCustomer(customer.id, change as CustomerInput);
    if (!res.ok) {
      setStatus(res.message);
      return false;
    }
    setCustomer(res.customer);
    setStatus("Saved");
    return true;
  };
  const say = async () => {
    if (!job || !text.trim()) return;
    const res = await addActivity(job.customerId, { kind, text: text.trim(), jobId: id });
    if (!res.ok) return setStatus(res.message);
    setActivity([res.activity, ...activity]);
    setText("");
    if (res.mentioned?.length) setStatus(`Told ${res.mentioned.map(handleOf).join(", ")}`);
  };

  // What Sol's side panel sees of this page (page-context.ts): the deal in a line; its fields and record are the words
  // on show. With the design drawer open, he looks at the design in it instead.
  usePageAbout(
    "Deal",
    job && customer
      ? [
          `Deal: ${customer.name}, ${job.title} at ${job.address || "no address yet"}.`,
          `Stage: ${STAGE_LABELS[job.stage]}${job.kw ? `; ${job.kw} kW` : ""}${job.value != null ? `; value $${Math.round(job.value).toLocaleString("en-AU")}` : ""}${job.installDate ? `; installing ${job.installDate}` : ""}.`,
        ].join("\n")
      : null,
  );
  useEffect(() => {
    setFrameInFront(drawer);
    return () => setFrameInFront(false);
  }, [drawer]);

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
  // The tabs and fields as the business has set them out; each field's line from the deal, its design and its proposal.
  const tabs = resolveDealFields(fieldsConfig).filter((t) => !t.hidden);
  const shownTab = tabs.find((t) => t.id === section) ?? tabs[0];
  const fromDesign = Object.fromEntries(details.filter((d) => d.designed).map((d) => [d.key, d.designed!]));
  const ctx = {
    installDate: job.installDate ? shortDate(job.installDate) : null,
    installer: job.details?.[INSTALLER_KEY] ?? null,
    designed: fromDesign,
    signed: extra
      ? {
          incGst: extra.incGst ?? null,
          stc: extra.stc ?? null,
          youPay: extra.youPay,
          depositAsked: extra.depositAsked ?? null,
          depositReceived: extra.depositReceived,
          solarVicRebate: extra.solarVicRebate ?? null,
          solarVicLoan: extra.solarVicLoan ?? null,
        }
      : null,
  };
  const tabFields = shownTab ? shownTab.fields.filter((f) => !f.hidden) : [];
  const tabLines = tabFields.map((f) => fieldLine(f, job.details, ctx));
  const tabFilled = tabLines.filter((l) => l.value).length;
  const PROPOSAL_KEYS = ["incGst", "stc", "youPay", "depositAsked", "depositReceived"];
  const setDetail = (key: string, text: string) => {
    const next = { ...job.details };
    if (text) next[key] = text;
    else delete next[key];
    void patch({ details: next });
  };

  return (
    <div className="mx-auto w-full max-w-[64rem] space-y-4 px-5 py-6">
      {job.lat !== null && (
        <DesignDrawer
          src={`${PATHS.designer}?job=${encodeURIComponent(job.id)}`}
          open={drawer}
          onOpen={() => setDrawer(true)}
          onFold={() => setDrawer(false)}
          onSaved={() => {
            void load();
            setDesignVersion((v) => v + 1);
          }}
          onGo={(href) => {
            // This deal: the tab asked for (the customer's name in the designer comes back to Overview).
            if (href.startsWith(`${PATHS.deals}/${job.id}`)) {
              const want = new URL(href, window.location.origin).searchParams.get("tab");
              return setTab(want && (DEAL_TABS.some(([k]) => k === want) || want === "service") ? (want as Tab) : "overview");
            }
            router.push(href);
          }}
          back="Back to the deal"
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <Link href={PATHS.pipelines} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
          <ChevronLeft className="size-4 text-muted" aria-hidden /> Deals
        </Link>
        <p className="min-h-4 flex-1 text-right text-xs text-muted" role="status">
          {status}
        </p>
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

      {/* The deal as a picture (8 Nov 2026, Martin): the roof across the top with who it's for laid over it. */}
      <DealBanner
        job={job}
        designVersion={designVersion}
        customer={customer}
        pulse={pulse && hasPulse(job.stage) ? pulse : null}
        onDesign={job.lat !== null ? () => setDrawer(true) : null}
        onEmail={() => setTab("email")}
        onCall={() => {
          // A browser that cannot listen just dials.
          if (!notetaker.current?.start() && customer.phone) window.location.href = `tel:${customer.phone.replace(/\s/g, "")}`;
        }}
        onSol={() => setTab("sol")}
        onPlace={() => {
          setTab("details");
          setMoving(true);
        }}
      />

      <CallNotetaker
        handle={notetaker}
        button={false}
        jobId={job.id}
        customerId={customer.id}
        phone={customer.phone}
        onAdded={() => void load()}
      />
      <div className="min-w-0">
        {/* Under the picture, the ways of looking at the deal; its fields are behind Details. */}
        <div className="flex items-center gap-2">
          {/* The design first, as the design tool is everywhere: its orange round opens it over the deal. Without a place on
              the map, it asks for one. */}
          <button
            type="button"
            aria-label="Design"
            title={job.lat !== null ? "Design" : "Give the deal an address to design it"}
            onClick={() => {
              if (job.lat !== null) return setDrawer(true);
              setTab("details");
              setMoving(true);
            }}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sun-line text-white shadow-[0_6px_18px_rgba(255,90,31,0.3)] transition hover:brightness-105"
          >
            <PenTool className="size-[18px]" aria-hidden />
          </button>
          <div
            className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto rounded-full bg-surface p-1 ring-1 ring-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
          >
            {DEAL_TABS.map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={clsx(
                  "h-9 shrink-0 rounded-full px-4 text-sm transition-colors",
                  tab === key ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Service sits apart at the end, in its own colour: putting something right after the sale. */}
          <button
            role="tab"
            aria-selected={tab === "service"}
            aria-label="Service"
            title="Service"
            onClick={() => setTab("service")}
            className={clsx(
              "flex size-11 shrink-0 items-center justify-center rounded-full ring-1",
              tab === "service"
                ? "bg-warning text-white ring-warning"
                : "bg-warning-soft text-warning ring-warning/20 hover:bg-warning-soft/70",
            )}
          >
            <Wrench className="size-4" aria-hidden />
          </button>
        </div>

        {tab === "team" ? (
          <section className={clsx(ui.card, "mt-5 p-5")}>
            <h2 className="text-[15px] font-medium text-ink">Team chat on this deal</h2>
            <div className="mt-3">
              <DealTeamChat jobId={id} />
            </div>
          </section>
        ) : tab === "email" ? (
          <div className="mt-5">
            <DealEmail job={job} customer={customer} business={business} onSent={(a) => a && setActivity((all) => [a, ...all])} />
          </div>
        ) : tab === "chat" ? (
          <div className="mt-5">
            <DealChat jobId={id} />
          </div>
        ) : tab === "sol" ? (
          <div className="mt-5">
            <DealSol jobId={id} name={`${customer.name} · ${job.title}`} />
          </div>
        ) : tab === "service" ? (
          <section className={clsx(ui.card, "mt-5 p-5")}>
            <h2 className="flex items-center gap-2 text-[15px] font-medium text-ink">
              <Wrench className="size-4 text-warning" aria-hidden /> Service
            </h2>
            <p className="mt-1 text-xs text-muted">Something to put right after the sale: its open case, or the way to flag one.</p>
            <div className="mt-4">
              <DealService jobId={job.id} />
            </div>
          </section>
        ) : tab === "files" ? (
          <div className="mt-5">
            <DealFiles jobId={id} />
          </div>
        ) : tab === "details" ? (
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
            <section className={clsx(ui.card, "p-5")}>
              <h2 className="text-[15px] font-medium text-ink">Who it&apos;s for</h2>
              <div className="mt-4 space-y-1.5">
                <EditLine
                  row
                  key={`name:${customer.name}`}
                  label="Customer name"
                  value={customer.name}
                  max={120}
                  onSave={async (name) => {
                    const parts = splitName(name);
                    if (!parts.firstName) {
                      setStatus("Enter the customer's name.");
                      return false;
                    }
                    return saveWho(parts);
                  }}
                />
                <HeadRow label="Address">
                  <AddressField
                    wrap
                    value={moving ? "" : job.address}
                    placed={job.lat !== null}
                    onChange={(place) => {
                      if (!place.address) return setMoving(true);
                      setMoving(false);
                      void patchOk(place);
                    }}
                  />
                  {moving && (
                    <button type="button" onClick={() => setMoving(false)} className={clsx(ui.link, "mt-1 text-xs")}>
                      Keep {job.address ? "the address as it was" : "it empty"}
                    </button>
                  )}
                </HeadRow>
                <HeadRow label="Deal stage">
                  <select
                    className={clsx(HEAD_INPUT, "appearance-auto")}
                    aria-label="Deal stage"
                    value={job.stage}
                    onChange={(e) => void patch({ stage: e.target.value as JobStage })}
                  >
                    {JOB_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </HeadRow>
                <EditLine
                  row
                  key={`email:${customer.email}`}
                  label="Email"
                  type="email"
                  value={customer.email}
                  onSave={(email) => saveWho({ email })}
                />
                <EditLine
                  row
                  key={`phone:${customer.phone}`}
                  label="Contact #"
                  type="tel"
                  value={customer.phone}
                  max={30}
                  onSave={(phone) => saveWho({ phone })}
                />
              </div>
            </section>
            <section className={clsx(ui.card, "space-y-4 p-5")}>
              <h2 className="text-[15px] font-medium text-ink">The deal</h2>
              <EditLine
                key={`title:${job.title}`}
                label="Deal name"
                value={job.title}
                max={120}
                onSave={async (title) => {
                  if (!title) {
                    setStatus("Give the deal a name.");
                    return false;
                  }
                  return patchOk({ title });
                }}
              />
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
              <EditLine
                key={`source:${customer.source}`}
                label="Lead source"
                value={customer.source}
                max={120}
                placeholder="Website, referral, Facebook…"
                onSave={(source) => saveWho({ source })}
              />
              <label className="block text-xs text-muted">
                Owner
                <select
                  className={clsx(ui.input, "mt-1 appearance-auto")}
                  value={job.owner ?? ""}
                  onChange={async (e) => {
                    const res = await setDealOwner(job.id, e.target.value || null);
                    if (!res.ok) return setStatus(res.message);
                    setJob(res.job);
                    setStatus("Saved");
                    void load();
                  }}
                >
                  <option value="">No one yet</option>
                  {/* Someone who has left the business still shows, so the deal isn't silently handed on. */}
                  {[...new Set([...members, ...(job.owner ? [job.owner] : [])])].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <Link href={`${PATHS.customers}/${customer.id}`} className={clsx(ui.link, "block text-xs")}>
                Open {customer.firstName || "the customer"}&apos;s page
              </Link>
            </section>
            <section className={clsx(ui.card, "overflow-hidden lg:col-span-2")}>
              <Block
                title="Deal properties"
                action={
                  <span className="text-xs tabular-nums text-muted">
                    {tabFilled} of {tabLines.length} filled
                  </span>
                }
              >
                {/* The tabs as the business has set them out (Settings → Deal fields). */}
                <div className="-mx-1 flex flex-wrap gap-1 rounded-md bg-surface-2 p-1" role="tablist" aria-label="Deal properties">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={shownTab?.id === t.id}
                      onClick={() => setSection(t.id)}
                      className={clsx(
                        "h-7 flex-1 whitespace-nowrap rounded px-1.5 text-[11.5px] font-medium",
                        shownTab?.id === t.id ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-ink-2 hover:text-ink",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {tabFields.some((f) => f.source === "design") && (
                  <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-2">
                    {job.projectId
                      ? "Filled in from the design. Click any line to type over it."
                      : "These fill in from the design once the roof has been drawn and saved. Click any line to type it in now."}
                  </p>
                )}
                {!extra && tabFields.some((f) => PROPOSAL_KEYS.includes(f.key)) && (
                  <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-2">
                    The price, STCs and deposit fill in once the customer signs a proposal.
                  </p>
                )}
                {tabLines.map((l) => {
                  const d = l.source === "design" ? details.find((x) => x.key === l.key) : null;
                  return d ? (
                    <DetailField key={l.key} line={{ ...d, label: l.label }} onSave={(text) => setDetail(l.key, text)} />
                  ) : (
                    <SectionFieldLine key={l.key} line={l} onSave={(text) => setDetail(l.key, text)} />
                  );
                })}
                {tabs.length === 0 && <p className="text-sm text-ink-2">Every tab is hidden in Settings → Deal fields.</p>}
                <Link
                  href={`${PATHS.settings}/deal-fields`}
                  className="block text-xs text-muted underline underline-offset-4 hover:text-ink"
                >
                  Arrange these fields
                </Link>
              </Block>
            </section>
          </div>
        ) : tab === "overview" ? (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => notetaker.current?.start()} className={ui.quiet}>
                <NotebookPen className="size-4" aria-hidden /> Note-taker
              </button>
              {job.projectId && (
                <Link href={`${PATHS.deals}/${job.id}/materials`} className={ui.quiet}>
                  <ClipboardList className="size-4" aria-hidden /> Materials order
                </Link>
              )}
              <button type="button" onClick={() => setCard(true)} className={ui.quiet}>
                <Wrench className="size-4" aria-hidden /> Job card
              </button>
              {marketplaceOpen() && PRE_INSTALL_STAGES.includes(job.stage) && (
                <ListOnMarketplace jobId={job.id} suburb={suburbAlone(job.address || customer.address)} />
              )}
            </div>
            {card && <JobCardDialog jobId={job.id} onClose={() => setCard(false)} />}
            <section className={clsx(ui.card, "overflow-hidden [&>div]:border-t-0")}>
              <DealProposal jobId={job.id} hasDesign={Boolean(job.projectId)} />
            </section>
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
                placeholder="Write a note, or log a call or an email. Type @ to mention someone"
              />
              {members.length > 1 && (
                <select
                  aria-label="Mention someone"
                  className={clsx(ui.input, "w-36 appearance-auto")}
                  value=""
                  onChange={(e) => {
                    const who = e.target.value;
                    if (who) setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${mentionText(who)}`);
                  }}
                >
                  <option value="">Mention…</option>
                  {members.map((m) => (
                    <option key={m} value={m}>
                      @{handleOf(m)}
                    </option>
                  ))}
                </select>
              )}
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
                      {a.kind === "email" &&
                        opens &&
                        (opens.times[a.id] ? (
                          <p
                            className={clsx("mt-1.5 text-xs", opens.times[a.id].length ? "font-medium text-positive" : "text-muted")}
                            title="Only the customer's copy is counted. Apple Mail can open an email by itself when it arrives, so this is a guide."
                          >
                            {openedWords(opens.times[a.id], LAUNCH_MARKET.timeZone, new Date(), opens.counts[a.id])}
                          </p>
                        ) : (
                          <p
                            className="mt-1.5 text-xs text-muted"
                            title="Opens are counted for emails sent from this deal while the site's address is set up. This one was sent before, or another way."
                          >
                            {NOT_TRACKED}
                          </p>
                        ))}
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
