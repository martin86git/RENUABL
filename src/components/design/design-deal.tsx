"use client";

import Link from "next/link";
import { distributorFor } from "@/lib/domain/design/networks";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ClipboardList,
  FileText,
  HardHat,
  Mail,
  NotebookPen,
  Phone,
  MessagesSquare,
  Paperclip,
  PenTool,
  ScrollText,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { SolBadge } from "./sol-icon";
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
  type Customer,
  type CustomerInput,
  type Job,
  type JobStage,
  PRE_INSTALL_STAGES,
  WON_STAGES,
  INSTALLED_STAGES,
} from "@/lib/domain/design/crm";
import { systemDetails, type DealDetail, type JobExtra } from "@/lib/domain/design/deal";
import { fieldLine, resolveDealFields, type DealFieldsConfig } from "@/lib/domain/design/deal-sections";
import { INSTALLER_KEY } from "@/lib/domain/design/crm";
import { loadInstallExtras } from "@/lib/services/after-sale";
import {
  addActivity,
  deleteJob,
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
import { DesignDrawer, designHref, proposalHref, toolOf } from "./design-drawer";
import { DealBanner } from "./deal-banner";
import { DealProposal } from "./design-proposal";
import { PATHS, ui } from "./design-shell";
import { DealFiles } from "./deal-pulse";
import { DealSol } from "./deal-sol";
import { hasPulse, type DealPulse } from "@/lib/domain/design/deal-heat";
import { NOT_TRACKED, openedWords } from "@/lib/domain/design/email-opens";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { bannerFigures } from "@/lib/domain/design/system-summary";
import { loadOpens, loadPulses } from "@/lib/services/deal-pulse";
import { DealEmails } from "./deal-emails";
import { setFrameInFront, usePageAbout } from "@/lib/services/page-context";

type Written = "note" | "call" | "email";
type Tab = "activities" | "team" | "email" | "chat" | "sol" | "files" | "service" | "details";
/**
 * The deal's tabs under its banner, in order; Service sits apart after them. Activity is the deal at a glance and its
 * record (8 Nov 2026, Martin: Overview folded into it); the team's chat and the files are their icons. Call sits beside
 * Email, and Sol is his own lit round after the row (10 Nov 2026, Martin: off the banner).
 */
/** What Notes holds: the timeline first, then the two chats and the deal's details. */
const NOTES_VIEWS = [
  ["activities", "Timeline"],
  ["chat", "Customer chat"],
  ["team", "Team chat"],
  ["details", "Details"],
] as const;
const DEAL_TABS: { key: Exclude<Tab, "service">; label: string; icon?: (p: { className?: string }) => React.ReactNode }[] = [
  { key: "activities", label: "Activity" },
  { key: "team", label: "Team chat", icon: ({ className }) => <MessagesSquare className={className} aria-hidden /> },
  { key: "email", label: "Email" },
  { key: "chat", label: "Chat" },
  { key: "files", label: "Files", icon: ({ className }) => <Paperclip className={className} aria-hidden /> },
  { key: "details", label: "Details" },
];

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
                : asked === "files"
                  ? "files"
                  : "activities",
  );
  // The designer as a centred pop-up over the deal (8 Nov 2026, Martin: in the same space, the page's grey either side, so
  // it reads as quick); ?design=1 opens it. Kept loaded once opened, so closing never loses the work.
  const [drawer, setDrawer] = useState(params.get("design") === "1" || params.get("proposal") === "1");
  // Which of the deal's two tools the pop-up holds (8 Nov 2026, Martin: the proposal is a tool like the designer).
  const [tool, setTool] = useState<"design" | "proposal">(params.get("proposal") === "1" ? "proposal" : "design");
  const openTool = (t: "design" | "proposal") => {
    setTool(t);
    setDrawer(true);
  };
  // A link to this deal's own design anywhere on the page (the proposal's "Open the design") opens this pop-up rather than
  // the shell's: heard first, on the window, so the shell leaves it alone.
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self")) return;
      const u = new URL(link.href);
      if (u.origin !== window.location.origin) return;
      const asked = toolOf(u.pathname + u.search);
      const mine = (asked.kind === "design" && u.pathname === PATHS.designer) || asked.kind === "proposal";
      if (!mine || asked.job !== id) return;
      e.preventDefault();
      setTool(asked.kind);
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
  const [section, setSection] = useState("deal");
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
  const shown = activity.filter((a) => !words || `${a.text} ${a.by}`.toLowerCase().includes(words));
  // Newest first, under the month they happened in.
  const months: { month: string; items: Activity[] }[] = [];
  for (const a of shown) {
    const month = new Date(a.at).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    if (months[months.length - 1]?.month === month) months[months.length - 1].items.push(a);
    else months.push({ month, items: [a] });
  }
  const details = systemDetails(designed?.design ?? null, designed?.form ?? null, job.details);
  // The tabs and fields as the business has set them out; each field's line from the deal, its design and its proposal.
  const tabs = resolveDealFields(fieldsConfig).filter((t) => !t.hidden);
  const shownTab = tabs.find((t) => t.id === section) ?? tabs[0];
  const fromDesign = Object.fromEntries(details.filter((d) => d.designed).map((d) => [d.key, d.designed!]));
  const ctx = {
    installDate: job.installDate ? shortDate(job.installDate) : null,
    installer: job.details?.[INSTALLER_KEY] ?? null,
    designed: fromDesign,
    // 8 Nov 2026, Martin: the Distributor fills itself once the address is known (the NMI wins when there is one).
    distributor: distributorFor({ address: job.address, nmi: job.details?.nmi })?.name ?? null,
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
  // The address lives on Details' first tab; a deal with no place on the map is sent there to find one.
  const findAddress = () => {
    setTab("details");
    setSection("deal");
    setMoving(true);
  };
  const menu = {
    tab,
    onTab: setTab,
    stage: job.stage,
    designable: job.lat !== null,
    onDesign: () => (job.lat !== null ? openTool("design") : findAddress()),
    onProposal: () => openTool("proposal"),
    onCard: () => setCard(true),
    phone: customer.phone,
    name: customer.firstName,
    onNotes: () => notetaker.current?.start(),
  };
  const setDetail = (key: string, text: string) => {
    const next = { ...job.details };
    if (text) next[key] = text;
    else delete next[key];
    void patch({ details: next });
  };

  return (
    // On a wide screen the deal's tools and pages float beside it as two rails that stay in view while it scrolls (10 Nov
    // 2026, Martin: as the designer's rounds beside its window, so more of the deal is in the first fold); narrower, the
    // row under the banner.
    // From xl the shell's grey pad steps back (data-rails-out, globals.css) and only the deal's own column sits on grey, so
    // the two rails float on the page outside it (10 Nov 2026, Martin).
    <div
      data-rails-out
      className="mx-auto w-full max-w-[64rem] px-5 py-6 xl:grid xl:max-w-[72rem] xl:grid-cols-[4rem_minmax(0,1fr)] xl:items-start xl:gap-6 xl:px-0 xl:py-0"
    >
      <DealMenu vertical {...menu} />
      <div className="min-w-0 space-y-4 xl:min-h-[calc(100dvh-10rem)] xl:rounded-[28px] xl:bg-canvas xl:p-6">
        {(job.lat !== null || tool === "proposal") && (
          <DesignDrawer
            src={tool === "proposal" ? proposalHref(job.id) : designHref(job.id)}
            onSwitch={(href) => openTool(toolOf(href).kind)}
            open={drawer}
            onOpen={() => setDrawer(true)}
            onFold={() => setDrawer(false)}
            onSaved={() => {
              void load();
              setDesignVersion((v) => v + 1);
            }}
            onGo={(href) => {
              // This deal: the tab asked for (the customer's name in the designer comes back to Activity).
              if (href.startsWith(`${PATHS.deals}/${job.id}`)) {
                const want = new URL(href, window.location.origin).searchParams.get("tab");
                return setTab(want && (DEAL_TABS.some((t) => t.key === want) || want === "service") ? (want as Tab) : "activities");
              }
              router.push(href);
            }}
            back="Back to the deal"
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
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
          compact={tab !== "activities"}
          figures={bannerFigures(details, job.kw)}
          onDesign={job.lat !== null ? () => openTool("design") : null}
          onPlace={() => {
            findAddress();
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
          {/* Under the picture, the ways of looking at the deal; its fields are behind Details. On a wide screen the rails
            beside the page take its place. */}
          <DealMenu {...menu} />
          {card && <JobCardDialog jobId={job.id} onClose={() => setCard(false)} />}

          {/* Notes holds the deal's timeline and, beside it, its details and both chats (12 Nov 2026, Martin). */}
          {NOTES_VIEWS.some(([key]) => key === tab) && (
            <div
              role="tablist"
              aria-label="Notes"
              className="mt-5 inline-flex flex-wrap gap-0.5 rounded-full bg-surface p-1 ring-1 ring-line"
            >
              {NOTES_VIEWS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={clsx(
                    "h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                    tab === key ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {tab === "team" ? (
            <section className={clsx(ui.card, "mt-5 p-5")}>
              <h2 className="text-[15px] font-medium text-ink">Team chat on this deal</h2>
              <div className="mt-3">
                <DealTeamChat jobId={id} />
              </div>
            </section>
          ) : tab === "email" ? (
            <div className="mt-5">
              <DealEmail
                job={job}
                customer={customer}
                business={business}
                onSent={(a) => {
                  if (a) setActivity((all) => [a, ...all]);
                  // The new email's tracking, so it reads "Not opened yet" at once.
                  void loadOpens(job.id).then((r) => r.ok && setOpens({ times: r.opens, counts: r.counts ?? {} }));
                }}
              />
              <DealEmails activity={activity.filter((a) => !a.jobId || a.jobId === job.id)} opens={opens} />
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
                <Wrench className="size-4 text-ink-2" aria-hidden /> Service
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
            // One row of tabs at the top, The deal first, then the deal's properties as the business has set them out
            // (10 Nov 2026, Martin: the tabs anchored at the top, the fields in columns rather than one long list down the left).
            <div className="mt-5 space-y-4">
              <div
                role="tablist"
                aria-label="Deal details"
                className="sticky top-[var(--studio-head,0px)] z-10 flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1 shadow-[0_0_0_8px_var(--canvas)]"
              >
                {[{ id: "deal", label: "The deal" }, ...tabs].map((t) => {
                  const on = t.id === "deal" ? section === "deal" || !shownTab : section !== "deal" && shownTab?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={on}
                      onClick={() => setSection(t.id)}
                      className={clsx(
                        "h-8 flex-1 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium",
                        on ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-ink-2 hover:text-ink",
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <section className={clsx(ui.card, "p-5")}>
                {section === "deal" || !shownTab ? (
                  <>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
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
                        Deal stage
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
                          onChange={(e) => setValue(e.target.value.replace(/[^d]/g, "").slice(0, 8))}
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
                      <EditLine
                        key={`email:${customer.email}`}
                        label="Email"
                        type="email"
                        value={customer.email}
                        onSave={(email) => saveWho({ email })}
                      />
                      <EditLine
                        key={`phone:${customer.phone}`}
                        label="Contact #"
                        type="tel"
                        value={customer.phone}
                        max={30}
                        onSave={(phone) => saveWho({ phone })}
                      />
                      <div className="text-xs text-muted sm:col-span-2 xl:col-span-3">
                        Address
                        <div className="mt-1">
                          <AddressField
                            value={moving ? "" : job.address}
                            placed={job.lat !== null}
                            onChange={(place) => {
                              if (!place.address) return setMoving(true);
                              setMoving(false);
                              void patchOk(place);
                            }}
                          />
                        </div>
                        {moving && (
                          <button type="button" onClick={() => setMoving(false)} className={clsx(ui.link, "mt-1 text-xs")}>
                            Keep {job.address ? "the address as it was" : "it empty"}
                          </button>
                        )}
                      </div>
                    </div>
                    <Link href={`${PATHS.customers}/${customer.id}`} className={clsx(ui.link, "mt-4 block text-xs")}>
                      Open {customer.firstName || "the customer"}&apos;s page to change their name
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                      {tabFields.some((f) => f.source === "design") && (
                        <p className="flex-1 text-xs text-ink-2">
                          {job.projectId
                            ? "Filled in from the design. Click any line to type over it."
                            : "These fill in from the design once the roof has been drawn and saved. Click any line to type it in now."}
                        </p>
                      )}
                      {!extra && tabFields.some((f) => PROPOSAL_KEYS.includes(f.key)) && (
                        <p className="flex-1 text-xs text-ink-2">The price, STCs and deposit fill in once the customer signs a proposal.</p>
                      )}
                      <span className="ml-auto text-xs tabular-nums text-muted">
                        {tabFilled} of {tabLines.length} filled
                      </span>
                    </div>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                      {tabLines.map((l) => {
                        const d = l.source === "design" ? details.find((x) => x.key === l.key) : null;
                        return (
                          <div key={l.key} className={l.field?.kind === "long" ? "sm:col-span-2 xl:col-span-3" : undefined}>
                            {d ? (
                              <DetailField line={{ ...d, label: l.label }} onSave={(text) => setDetail(l.key, text)} />
                            ) : (
                              <SectionFieldLine line={l} onSave={(text) => setDetail(l.key, text)} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Link
                      href={`${PATHS.settings}/deal-fields`}
                      className="mt-4 block text-xs text-muted underline underline-offset-4 hover:text-ink"
                    >
                      Arrange these fields
                    </Link>
                  </>
                )}
              </section>
            </div>
          ) : (
            // Notes: the deal's whole record as one timeline, newest first (12 Nov 2026, Martin: notes are the feed of the job).
            <div className="mt-5 space-y-5">
              {(job.projectId || (marketplaceOpen() && PRE_INSTALL_STAGES.includes(job.stage))) && (
                <div className="flex flex-wrap gap-2">
                  {job.projectId && (
                    <Link href={`${PATHS.deals}/${job.id}/materials`} className={ui.quiet}>
                      <ClipboardList className="size-4" aria-hidden /> Materials order
                    </Link>
                  )}
                  {marketplaceOpen() && PRE_INSTALL_STAGES.includes(job.stage) && (
                    <ListOnMarketplace jobId={job.id} suburb={suburbAlone(job.address || customer.address)} />
                  )}
                </div>
              )}
              {/* What was sent and its deposit, once a proposal is out; the Proposal round opens it. */}
              <section className={clsx(ui.card, "overflow-hidden empty:hidden [&>div]:border-t-0")}>
                <DealProposal jobId={job.id} hasDesign={Boolean(job.projectId)} statusOnly />
              </section>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="relative block w-64 max-w-full">
                    <span className="sr-only">Search notes</span>
                    <input
                      className={clsx(ui.input, "rounded-full pl-4 pr-9")}
                      value={find}
                      onChange={(e) => setFind(e.target.value)}
                      placeholder="Search notes"
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

                {months.length === 0 && (
                  <p className="mt-6 text-sm text-ink-2">{activity.length ? "Nothing matches that." : "Nothing yet."}</p>
                )}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Call, beside Email (10 Nov 2026, Martin: you either email or call, and the note-taker is part of calling): one round
 * offering to ring the customer, or to ring them with the note-taker open. The menu is drawn fixed under the round, so
 * the row's scrolling doesn't cut it off.
 */
function CallMenu({
  phone,
  name,
  onNotes,
  rail = false,
  round,
}: {
  phone: string;
  name: string;
  onNotes: () => void;
  /** A round of the deal's menu: down the left ("rail", its choices to its right) or in the row ("row", below). */
  round?: "rail" | "row";
  /** As a line of the rail beside the page (its words shown, the menu opening to its left). */
  rail?: boolean;
}) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const dial = phone.replace(/\s/g, "");
  useEffect(() => {
    if (!at) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setAt(null);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setAt(null);
    const gone = () => setAt(null);
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", gone, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
      window.removeEventListener("scroll", gone, true);
    };
  }, [at]);
  const row = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface-2";
  return (
    <div ref={box} className="contents">
      <button
        type="button"
        aria-label={phone ? `Call ${name || "them"}` : "No phone on file"}
        title={phone ? `Call ${name || "them"}` : "No phone on file"}
        aria-expanded={Boolean(at)}
        disabled={!phone}
        onClick={(e) => {
          if (at) return setAt(null);
          const r = e.currentTarget.getBoundingClientRect();
          setAt(
            round === "rail"
              ? { top: r.top, left: r.right + 12 }
              : rail
                ? { top: r.top, left: Math.max(8, r.left - 264) }
                : { top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - 264)) },
          );
        }}
        className={
          round
            ? "group flex flex-col items-center gap-1 disabled:opacity-100"
            : clsx(
                rail ? RAIL_ITEM : "flex h-9 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
                at ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
                !phone && "text-muted hover:text-muted",
              )
        }
      >
        {round ? (
          <>
            <span
              className={clsx(
                "flex size-12 items-center justify-center rounded-full shadow-[0_6px_18px_rgba(11,11,12,0.08)] ring-1 transition",
                at ? "bg-primary text-primary-ink ring-primary" : "bg-surface text-ink-2 ring-line group-hover:text-ink",
                !phone && "text-muted group-hover:text-muted",
              )}
            >
              <Phone className="size-5" aria-hidden />
            </span>
            <span className={clsx("text-[11px] font-medium", phone ? "text-ink-2" : "text-muted")}>Call</span>
          </>
        ) : (
          <>
            <Phone className={rail ? "size-4" : "size-[18px]"} aria-hidden />
            {rail && "Call"}
          </>
        )}
      </button>
      {at && (
        <div
          role="menu"
          style={{ top: at.top, left: at.left }}
          className="fixed z-50 w-64 rounded-xl bg-surface p-1.5 shadow-lift ring-1 ring-line"
        >
          <a role="menuitem" href={`tel:${dial}`} onClick={() => setAt(null)} className={row}>
            <Phone className="size-4 text-ink-2" aria-hidden />
            <span>
              Call {name || "them"}
              <span className="block text-xs tabular-nums text-muted">{phone}</span>
            </span>
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setAt(null);
              onNotes();
            }}
            className={row}
          >
            <NotebookPen className="size-4 text-ink-2" aria-hidden />
            <span>
              Call with the note-taker
              <span className="block text-xs text-muted">Ring on your phone, notes typed up here</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/** One line of the rail of the deal's pages: its icon and its word. */
const RAIL_ITEM = "flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm transition-colors";

/**
 * The deal's tools, down the left of the page (10 Nov 2026, Martin: grouped by what they have to do with each other):
 * Design and Proposal (the sale), then the Job card and Service (after it), then Sol on his own. Each opens over the
 * page or its own tab; the rail stays in view while the deal scrolls. Wide screens only.
 */
/**
 * A rail that floats in the middle of the window (10 Nov 2026, Martin: the rails sat too high): it measures its own
 * height and sits midway between the top bar and the foot of the window, as the page first opens (a margin) and as it
 * scrolls (sticky), never under the top bar.
 */
function useCentredRail() {
  const [el, ref] = useState<HTMLElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const place = () => {
      const h = el.offsetHeight;
      if (!h) return;
      const head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--studio-head")) || 0;
      const want = Math.max(head + 16, (window.innerHeight + head) / 2 - h / 2);
      const parentTop = parent.getBoundingClientRect().top + window.scrollY;
      setStyle({ top: want, marginTop: Math.max(0, want - parentTop) });
    };
    place();
    const watch = new ResizeObserver(place);
    watch.observe(el);
    window.addEventListener("resize", place);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [el]);
  return [ref, style] as const;
}

/**
 * The deal's one menu (12 Nov 2026, Martin: the CRM straight to the point, the work to be done): the two tools, Design
 * and Proposal; then the ways of working the deal, Call, Email, Notes (the deal's whole record as a timeline) and Files;
 * then, only once it matters, the Job card (sold) and Service (installed); then Sol. Down the left on a wide screen,
 * floating in the middle of the window; a row under the banner narrower.
 */
function DealMenu({
  vertical = false,
  tab,
  onTab,
  stage,
  designable,
  onDesign,
  onProposal,
  onCard,
  phone,
  name,
  onNotes,
}: {
  vertical?: boolean;
  tab: Tab;
  onTab: (tab: Tab) => void;
  stage: JobStage;
  designable: boolean;
  onDesign: () => void;
  onProposal: () => void;
  onCard: () => void;
  phone: string;
  name: string;
  onNotes: () => void;
}) {
  const [railRef, railStyle] = useCentredRail();
  const sold = WON_STAGES.includes(stage);
  const installed = INSTALLED_STAGES.includes(stage);
  const round = (on: boolean) =>
    clsx(
      "flex size-12 items-center justify-center rounded-full shadow-[0_6px_18px_rgba(11,11,12,0.08)] ring-1 transition",
      on ? "bg-primary text-primary-ink ring-primary" : "bg-surface text-ink-2 ring-line group-hover:text-ink",
    );
  const line = <span className={vertical ? "h-px w-8 shrink-0 bg-line" : "mt-6 h-px w-4 shrink-0 bg-line"} aria-hidden />;
  const page = (key: Tab, label: string, title: string, Icon: typeof Mail) => (
    <RailRound label={label} title={title} onClick={() => onTab(key)} on={tab === key}>
      <span className={round(tab === key)}>
        <Icon className="size-5" aria-hidden />
      </span>
    </RailRound>
  );
  return (
    <nav
      ref={vertical ? railRef : undefined}
      style={vertical ? railStyle : undefined}
      aria-label="This deal"
      className={
        vertical
          ? "sticky hidden flex-col items-center gap-3.5 pt-1 xl:flex"
          : "-mx-1 flex items-start gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] xl:hidden [&::-webkit-scrollbar]:hidden"
      }
    >
      <RailRound label="Design" title={designable ? "Design" : "Give the deal an address to design it"} onClick={onDesign}>
        <span className="flex size-12 items-center justify-center rounded-full bg-sun-line text-white shadow-[0_6px_18px_rgba(255,90,31,0.3)] transition group-hover:brightness-105">
          <PenTool className="size-5" aria-hidden />
        </span>
      </RailRound>
      <RailRound label="Proposal" title="Proposal: what the customer sees" onClick={onProposal}>
        <span className="flex size-12 items-center justify-center rounded-full bg-surface text-sun-line shadow-[0_6px_18px_rgba(11,11,12,0.12)] ring-1 ring-line transition group-hover:text-ink">
          <FileText className="size-5" aria-hidden />
        </span>
      </RailRound>
      {line}
      <CallMenu round={vertical ? "rail" : "row"} phone={phone} name={name} onNotes={onNotes} />
      {page("email", "Email", `Email ${name || "the customer"}`, Mail)}
      <RailRound
        label="Notes"
        title="Notes: the timeline, the chats and the deal's details"
        onClick={() => onTab("activities")}
        on={NOTES_VIEWS.some(([key]) => key === tab)}
      >
        <span className={round(NOTES_VIEWS.some(([key]) => key === tab))}>
          <ScrollText className="size-5" aria-hidden />
        </span>
      </RailRound>
      {page("files", "Files", "Files kept on this deal", Paperclip)}
      {(sold || installed) && line}
      {sold && (
        <RailRound label="Job card" title="Job card: what the installers take to the job" onClick={onCard}>
          <span className={round(false)}>
            <HardHat className="size-5" aria-hidden />
          </span>
        </RailRound>
      )}
      {installed && page("service", "Service", "Service: something to put right after the install", Wrench)}
      {line}
      <RailRound label="Sol" title="Sol on this deal" onClick={() => onTab("sol")} on={tab === "sol"}>
        <span
          className={clsx(
            "flex size-12 items-center justify-center rounded-full bg-primary shadow-[0_6px_18px_rgba(11,11,12,0.18)] transition group-hover:bg-forest",
            tab === "sol" && "ring-2 ring-sun-line/60 ring-offset-2 ring-offset-canvas",
          )}
        >
          <SolBadge className="size-[22px]" />
        </span>
      </RailRound>
    </nav>
  );
}

function RailRound({
  label,
  title,
  onClick,
  on,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  /** A tab of the page: pressed while it is the one open. */
  on?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={on}
      className="group flex flex-col items-center gap-1"
    >
      {children}
      <span className={clsx("text-[11px] font-medium", on ? "text-ink" : "text-ink-2")}>{label}</span>
    </button>
  );
}
