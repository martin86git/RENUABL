"use client";

import { useDealStageLabel } from "./stage-select";
import Link from "next/link";
import { distributorFor } from "@/lib/domain/design/networks";
import { interestsOf } from "@/lib/domain/design/deal-interest";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  FileText,
  HardHat,
  LayoutList,
  Mail,
  Phone,
  MessagesSquare,
  Paperclip,
  PenTool,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { SolBadge, SolMark } from "./sol-sun";
import { JobCardDialog } from "./job-card";
import { CallNotetaker, type NotetakerHandle } from "./call-notetaker";
import { ListOnMarketplace } from "./marketplace";
import { suburbAlone } from "@/lib/domain/design/marketplace";
import { marketplaceOpen } from "@/lib/domain/design/marketplace-launch";
import clsx from "clsx";
import { DealTeamChat } from "./deal-team-chat";
import {
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
import { INSTALLER_KEY, type ActivityKind } from "@/lib/domain/design/crm";
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
import { finishDealTour, loadTeam } from "@/lib/services/design-account";
import { handleOf, mentionText } from "@/lib/domain/design/mentions";
import { ACTIVITY_WORD } from "./design-home";

/**
 * Each kind of entry on a deal's timeline in a colour of its own (26 Nov 2026, Martin: the timeline "needs some color…
 * to help distinguish between events"), from the kind tokens the rest of the product uses.
 */
const ENTRY_TINT: Record<ActivityKind, "lead" | "message" | "follow-up" | "order" | "date" | "approvals" | "install"> = {
  note: "follow-up",
  call: "order",
  email: "lead",
  message: "message",
  stage: "approvals",
  proposal: "date",
  order: "install",
  invoice: "install",
  reminder: "follow-up",
  service: "date",
};
import { DealChat } from "./chat-panel";
import { DealService } from "./design-service";
import { AddressField } from "./design-customers";
import { StageSelect } from "./stage-select";
import { DealMoreMenu } from "./deal-menus";
import { useDesignAccount } from "./design-account";
import { DealEmail, SectionFieldLine } from "./deal-tools";
import { DesignDrawer, designHref, proposalHref, toolOf } from "./design-drawer";
import { DealBanner } from "./deal-banner";
import { SolOnDealCard } from "./sol-on-deal";
import { DEAL_SOL_STATE, DEAL_SOL_TOGGLE } from "@/lib/services/sol";
import { Spotlight } from "./new-look";
import { DEAL_TOUR, DEAL_TOUR_KEY } from "@/lib/domain/design/deal-tour";
import { EXAMPLE_SOURCE } from "@/lib/domain/design/example-deals";
import { DealProposal } from "./design-proposal";
import { PATHS, ui } from "./design-shell";
import { DealFiles } from "./deal-pulse";
import { DealSol } from "./deal-sol";
import { hasPulse, type DealPulse } from "@/lib/domain/design/deal-heat";
import { NOT_TRACKED, openedWords } from "@/lib/domain/design/email-opens";
import { LAUNCH_MARKET } from "@/lib/domain/market";
import { bannerFigures } from "@/lib/domain/design/system-summary";
import { loadDealMail, loadOpens, loadPulses } from "@/lib/services/deal-pulse";
import type { DealMail } from "@/lib/domain/design/deal-mail";
import { outlookWebLink, providerOfId } from "@/lib/domain/design/outlook-mail";
import { DealEmails } from "./deal-emails";
import { CallEntryBy, CallEntryText } from "./call-entry";
import { CallChoices } from "./call-choice";
import { setFrameInFront, usePageAbout } from "@/lib/services/page-context";

type Tab = "activities" | "team" | "email" | "chat" | "sol" | "files" | "service" | "details";
/**
 * The deal's tabs under its banner, in order; Service sits apart after them. Activity is the deal at a glance and its
 * record (8 Nov 2026, Martin: Overview folded into it); the team's chat and the files are their icons. Call sits beside
 * Email, and Sol is his own lit round after the row (10 Nov 2026, Martin: off the banner).
 */
/**
 * What Details holds (14 Nov 2026, Martin: Details is the button, and the timeline is nested inside it): the timeline
 * first, where a deal opens (25 Nov 2026, Martin, as HubSpot: every email, note, call, design and proposal, newest
 * first), then the deal's fields and the two chats.
 */
const NOTES_VIEWS = [
  ["activities", "Timeline"],
  ["details", "Details"],
  ["chat", "Customer chat"],
  ["team", "Team chat"],
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
  // Stages by the business's own names (pipeline-stages.ts).
  const stageWords = useDealStageLabel();
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
  // The box that asks for the address when Design is pressed on a deal with no place on the map (12 Nov 2026, Martin:
  // pressing Design did nothing he could see): "design" opens the designer once it is found.
  const [askPlace, setAskPlace] = useState<null | "design" | "place">(null);
  // "?tab=chat" (from Messages, and from the email about a new message) opens the deal on its conversation; "?tab=email"
  // (a draft Sol wrote) on its Email tab.
  const asked = useSearchParams().get("tab");
  const params = useSearchParams();
  // A tab opened from Sol's card is brought into view (18 Nov 2026, Martin: Open the chat with the chat already the tab
  // open changed nothing on screen, so it seemed to do nothing).
  const goTab = (next: Tab) => {
    setTab(next);
    window.setTimeout(() => {
      document.getElementById("deal-work")?.scrollIntoView({ behavior: "smooth", block: "start" });
      const box = document.querySelector<HTMLElement>("#deal-work ~ * textarea, #deal-work ~ * input[type='text']");
      box?.focus({ preventScroll: true });
    }, 80);
  };
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
                  : asked === "notes" || asked === "activities"
                    ? "activities"
                    : // A deal opens on its timeline (25 Nov 2026, Martin, as HubSpot's); its fields are beside it.
                      "activities",
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
  // ?section=network opens Details on that tab (19 Nov 2026: Move the approvals on lands where the pre-approval is set).
  const [section, setSection] = useState(() => params.get("section") || "deal");
  // The business's own arrangement of a deal's fields (Settings → Deal fields); ours until it has loaded.
  const [fieldsConfig, setFieldsConfig] = useState<DealFieldsConfig | null>(null);
  // The business's people: who a deal can be given to, and who can be @mentioned in a note.
  const [members, setMembers] = useState<string[]>([]);
  // People kept to own deals without being invited (Your account → Deal owners not invited yet): owners only, never mentioned.
  const [ownerOnly, setOwnerOnly] = useState<{ email: string; name: string }[]>([]);
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
    void loadTeam().then((t) => {
      if (!t) return;
      setMembers(t.members.map((x) => x.email.toLowerCase()));
      setOwnerOnly(t.ownerOnly);
    });
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
  // The tour of a deal, on the sample deal a new business starts with (20 Nov 2026, Martin): once on this device, the
  // first time it is opened, from the pipeline or anywhere; Show me around starts it again (23 Nov 2026, Martin: it kept
  // running each time the sample was opened). It counts as seen the moment it starts, so leaving it half way or
  // reloading doesn't bring it back.
  const [touring, setTouring] = useState(false);
  // The starter sample only: the example deals a demo is filled with are marked sample too, and aren't a tour each.
  const isSample = Boolean(customer?.sample) && customer?.source !== EXAMPLE_SOURCE;
  // Seen is also kept on the person's own account (24 Nov 2026, Martin: it started again on his iPhone, whose Safari and
  // Home Screen app each keep their own storage), so it runs once for them, not once a device. It waits for the account.
  const tourSeenOnAccount = account?.signedIn ? Boolean(account.dealTourSeen) : null;
  useEffect(() => {
    if (!isSample || tourSeenOnAccount === null) return;
    let seen = tourSeenOnAccount;
    try {
      if (window.localStorage.getItem(DEAL_TOUR_KEY) === "1") seen = true;
    } catch {}
    if (seen) return;
    // A moment for Sol's card and the fields to be on the page, so each has a place to light. Never under a window
    // already open over the page (an agent's chat on a phone).
    const t = window.setTimeout(() => {
      if (document.documentElement.dataset.phoneWindow !== undefined) return;
      try {
        window.localStorage.setItem(DEAL_TOUR_KEY, "1");
      } catch {}
      void finishDealTour();
      setTouring(true);
    }, 900);
    return () => window.clearTimeout(t);
  }, [isSample, tourSeenOnAccount]);
  const endTour = useCallback(() => {
    setTouring(false);
    try {
      window.localStorage.setItem(DEAL_TOUR_KEY, "1");
    } catch {}
    void finishDealTour();
  }, []);
  // The customer's emails in this member's own mailboxes, beside the record on the Notes timeline (23 Nov 2026, Martin).
  const [mail, setMail] = useState<DealMail[]>([]);
  useEffect(() => {
    let gone = false;
    void loadDealMail(id).then((r) => !gone && r.ok && setMail(r.mail));
    return () => {
      gone = true;
    };
  }, [id, activity.length]);
  const [text, setText] = useState("");
  const [value, setValue] = useState("");
  const [priceFocused, setPriceFocused] = useState(false);

  const load = useCallback(async () => {
    const res = await loadJob(id);
    if (!res.ok) return setProblem(res.message);
    setJob(res.job);
    setCustomer(res.customer);
    setValue(res.job.value === null ? "" : String(res.job.value));
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
    const res = await addActivity(job.customerId, { kind: "note", text: text.trim(), jobId: id });
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
          `Stage: ${stageWords(job)}${job.kw ? `; ${job.kw} kW` : ""}${job.value != null ? `; value $${Math.round(job.value).toLocaleString("en-AU")}` : ""}${job.installDate ? `; installing ${job.installDate}` : ""}.`,
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

  // Notes are the deal's whole timeline (23 Nov 2026, Martin): the record and the customer's emails to and from them in
  // this member's own mailboxes, newest first, under the month they happened in.
  const timeline: Timed[] = [
    ...activity.map((a): Timed => ({ ...a, mail: null })),
    ...mail.map((m): Timed => ({ id: `mail:${m.box}:${m.id}`, at: m.at, mail: m })),
  ].sort((x, y) => y.at.localeCompare(x.at));
  const months: { month: string; items: Timed[] }[] = [];
  for (const a of timeline) {
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
          grossMargin: extra.grossMargin ?? null,
          grossShare: extra.grossShare ?? null,
          commission: extra.commission ?? null,
          afterCommission: extra.afterCommission ?? null,
        }
      : null,
  };
  const tabFields = shownTab ? shownTab.fields.filter((f) => !f.hidden) : [];
  const tabLines = tabFields.map((f) => fieldLine(f, job.details, ctx));
  const tabFilled = tabLines.filter((l) => l.value).length;
  const PROPOSAL_KEYS = ["incGst", "stc", "youPay", "depositAsked", "depositReceived", "grossMargin", "afterCommission"];
  const menu = {
    tab,
    onTab: setTab,
    stage: job.stage,
    designable: job.lat !== null,
    onDesign: () => (job.lat !== null ? openTool("design") : setAskPlace("design")),
    onProposal: () => openTool("proposal"),
    onCard: () => setCard(true),
    jobId: job.id,
    phone: customer.phone,
    name: customer.firstName,
    onNotes: () => notetaker.current?.start(),
  };
  const deleteDeal = async () => {
    if (!window.confirm(`Delete this deal for ${customer.name}? Its design and history are kept.`)) return;
    const res = await deleteJob(id);
    if (res.ok) router.push(PATHS.pipelines);
    else setStatus(res.message);
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
      className="mx-auto w-full max-w-[64rem] px-5 py-6 max-sm:-mx-3 max-sm:w-auto max-sm:px-0 max-sm:pt-0 max-sm:pb-[var(--deal-sol-h,0px)] xl:grid xl:max-w-[72rem] xl:grid-cols-[4rem_minmax(0,1fr)] xl:items-start xl:gap-6 xl:px-0 xl:py-0"
    >
      {touring && <Spotlight steps={DEAL_TOUR} onEnd={endTour} />}
      <DealMenu vertical {...menu} />
      <div className="min-w-0 space-y-4 max-sm:space-y-3 xl:min-h-[calc(100dvh-10rem)] xl:rounded-[28px] xl:bg-canvas xl:p-6">
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
        {/* On a phone the way back and Delete are on the slim rail, so the deal starts at the top. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 max-sm:gap-y-0">
          <Link
            href={PATHS.pipelines}
            data-tour="deal-back"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink max-sm:hidden"
          >
            <ChevronLeft className="size-4 text-muted" aria-hidden /> Deals
          </Link>
          {isSample && (
            <button
              type="button"
              onClick={() => {
                setTab("details");
                setSection("deal");
                window.setTimeout(() => setTouring(true), 150);
              }}
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-sun px-3 text-xs font-medium text-sun-ink ring-1 ring-sun-line/30 hover:ring-sun-line/60"
            >
              Sample deal · Show me around
            </button>
          )}
          <p className="min-h-4 flex-1 text-right text-xs text-muted max-sm:min-h-0" role="status">
            {status}
          </p>
          {/* Delete is in a ⋯ menu, never one tap away (26 Nov 2026, Martin). */}
          <span className="max-sm:hidden">
            <DealMoreMenu tone="light" onDelete={() => void deleteDeal()} />
          </span>
        </div>

        {/* The deal as a picture (8 Nov 2026, Martin): the roof across the top with who it's for laid over it. */}
        <div data-tour="deal-banner">
          <DealBanner
            job={job}
            designVersion={designVersion}
            customer={customer}
            pulse={pulse && hasPulse(job.stage) ? pulse : null}
            compact={tab !== "activities"}
            // The system as drawn when it has a design (22 Nov 2026, Martin: an imported 3.8 kW beside two 7 kW designs).
            figures={bannerFigures(
              details.map((d) => (d.designed ? { ...d, value: d.designed } : d)),
              job.kw,
            )}
            onDesign={job.lat !== null ? () => openTool("design") : null}
            onPlace={() => setAskPlace("place")}
            actions={
              // On a phone, ringing and writing to the customer sit in the banner itself (21 Nov 2026, Martin).
              <div data-tour="deal-reach" className="flex gap-1.5">
                <CallMenu
                  round="banner"
                  jobId={job.id}
                  phone={customer.phone}
                  name={customer.firstName}
                  onNotes={menu.onNotes}
                  toBook={PRE_INSTALL_STAGES.includes(job.stage)}
                />
                <button
                  type="button"
                  onClick={() => setTab("email")}
                  aria-label={`Email ${customer.firstName || "the customer"}`}
                  className={clsx(
                    "flex size-9 items-center justify-center rounded-full ring-1 transition",
                    tab === "email" ? "bg-white text-ink ring-white" : "bg-white/10 text-white ring-white/15",
                  )}
                >
                  <Mail className="size-4" aria-hidden />
                </button>
                <DealMoreMenu onDelete={() => void deleteDeal()} />
              </div>
            }
            onStage={(to) => void patch(to)}
          />
        </div>
        <DealPills {...menu} />
        {askPlace && (
          <AskPlace
            name={customer.firstName}
            had={job.address}
            then={askPlace}
            onClose={() => setAskPlace(null)}
            onPlace={async (place) => {
              if (!(await patchOk(place))) return false;
              const then = askPlace;
              setAskPlace(null);
              if (then === "design" && place.lat !== null) openTool("design");
              return true;
            }}
          />
        )}

        {/* Sol's line (16 Nov 2026, Martin): what happened, what he does next, what the deal needs from you. */}
        <DealSolSheet name={customer.firstName}>
          <SolOnDealCard
            jobId={job.id}
            phone={customer.phone || null}
            refresh={activity.length * 1000 + designVersion}
            onNotes={() => notetaker.current?.start()}
            onMove={(kind) =>
              kind === "reply"
                ? goTab("chat")
                : kind === "email"
                  ? goTab("email")
                  : kind === "design"
                    ? menu.onDesign()
                    : kind === "proposal"
                      ? openTool("proposal")
                      : kind === "approvals"
                        ? (setSection("network"), goTab("details"))
                        : kind === "book"
                          ? goTab("details")
                          : goTab("team")
            }
          />
        </DealSolSheet>

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
          <div id="deal-work" className="scroll-mt-24" aria-hidden />

          {/* Notes holds the deal's timeline and, beside it, its details and both chats (12 Nov 2026, Martin). */}
          {NOTES_VIEWS.some(([key]) => key === tab) && (
            <div
              role="tablist"
              aria-label="Details"
              data-tour="deal-views"
              className="mt-5 inline-flex flex-wrap gap-0.5 rounded-full bg-surface p-1 ring-1 ring-line"
            >
              {NOTES_VIEWS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  aria-label={key === "team" ? label : undefined}
                  title={key === "team" ? label : undefined}
                  onClick={() => setTab(key)}
                  className={clsx(
                    "h-8 rounded-full text-[13px] font-medium transition-colors max-sm:text-[12px]",
                    key === "team" ? "grid w-10 place-items-center" : "px-3.5 max-sm:px-2.5",
                    tab === key ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {/* Team chat is its icon, so the switch fits a phone (25 Nov 2026, Martin). */}
                  {key === "team" ? <MessagesSquare className="size-[18px]" aria-hidden /> : label}
                </button>
              ))}
            </div>
          )}

          {tab === "team" ? (
            <section className={clsx(ui.card, "mt-5 p-5 max-sm:p-4")}>
              <h2 className="sr-only">Team chat on this deal</h2>
              <div>
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
                className="sticky top-[var(--studio-head,0px)] z-10 flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1 shadow-[0_0_0_8px_var(--canvas)] max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden"
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
                        "h-8 flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium max-sm:flex-none",
                        on ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-ink-2 hover:text-ink",
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <section data-tour="deal-fields" className={clsx(ui.card, "p-5 max-sm:px-3.5 max-sm:py-2")}>
                {section === "deal" || !shownTab ? (
                  <>
                    <div className="deal-fields grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                      <EditLine
                        key={`title:${job.title}:${customer.name}`}
                        label="Deal name"
                        value={dealName(job.title, customer.name, job.address)}
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
                        <StageSelect job={job} className={clsx(ui.input, "mt-1 appearance-auto")} onChange={(to) => void patch(to)} />
                      </label>
                      <label className="block text-xs text-muted">
                        Quoted price, inc. GST
                        {/* With its $ and cents (26 Nov 2026, Martin); typed as plain figures. */}
                        <input
                          className={clsx(ui.input, "mt-1 tabular-nums")}
                          inputMode="decimal"
                          value={priceFocused ? value : value === "" ? "" : dollarsAndCents(Number(value))}
                          onFocus={() => setPriceFocused(true)}
                          onChange={(e) => setValue(cleanPriceTyping(e.target.value))}
                          onBlur={() => {
                            setPriceFocused(false);
                            const next = value === "" ? null : Math.round(Number(value) * 100) / 100;
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
                        Deal owner
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
                          {[
                            ...new Set([...members, ...(job.owner && !ownerOnly.some((o) => o.email === job.owner) ? [job.owner] : [])]),
                          ].map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                          {ownerOnly.map((o) => (
                            <option key={o.email} value={o.email}>
                              {o.name} (not invited)
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
                    <div className="deal-fields grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
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
                <div className={clsx(ui.card, "flex flex-wrap gap-2 p-3")}>
                  <input
                    aria-label="What was said or done"
                    className={clsx(ui.input, "min-w-0 flex-1")}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void say()}
                    maxLength={1000}
                    placeholder="Write a note. Type @ to mention someone"
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

                {months.length === 0 && <p className="mt-6 text-sm text-ink-2">Nothing yet.</p>}
                {months.map(({ month, items }) => (
                  <section key={month} className="mt-6">
                    <h2 className="text-[15px] text-ink-2">{month}</h2>
                    <ol className="mt-2.5 space-y-2.5">
                      {items.map((a) =>
                        a.mail ? (
                          <MailEntry key={a.id} m={a.mail} />
                        ) : (
                          <li
                            key={a.id}
                            className={clsx(ui.card, "border-l-[3px] border-l-[var(--k)] px-5 py-4")}
                            style={{
                              ["--k" as string]: `var(--kind-${ENTRY_TINT[a.kind]})`,
                              ["--ks" as string]: `var(--kind-${ENTRY_TINT[a.kind]}-soft)`,
                            }}
                          >
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="text-sm text-ink">
                                <strong className="mr-1 inline-block rounded-full bg-[var(--ks)] px-2 py-0.5 text-[12px] font-semibold text-[var(--k)]">
                                  {a.kind === "stage" ? "Deal activity" : ACTIVITY_WORD[a.kind]}
                                </strong>{" "}
                                {a.kind === "call" ? (
                                  <CallEntryBy by={a.by} />
                                ) : (
                                  <span className="text-ink-2">by {a.by.split("@")[0]}</span>
                                )}
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
                            {a.kind === "call" ? (
                              <CallEntryText text={a.text} jobId={id} at={a.at} by={a.by} />
                            ) : (
                              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">{a.text}</p>
                            )}
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
                        ),
                      )}
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
  jobId,
  phone,
  name,
  onNotes,
  toBook = false,
  rail = false,
  round,
  mini = false,
}: {
  jobId: string;
  phone: string;
  name: string;
  onNotes: () => void;
  /** Sold and not yet installed: the admin assistant can ring to book the installation. */
  toBook?: boolean;
  /** A round of the deal's menu: down the left ("rail", its choices to its right), in the row ("row", below), or on the
   * phone's banner ("banner": a small light round on the graphite, its choices below). */
  round?: "rail" | "row" | "banner";
  /** As a line of the rail beside the page (its words shown, the menu opening to its left). */
  rail?: boolean;
  /** The phone's slim rail: a smaller round. */
  mini?: boolean;
}) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!at) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node) && setAt(null);
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
            round === "banner"
              ? { top: r.bottom + 8, left: Math.max(8, Math.min(r.right - 288, window.innerWidth - 296)) }
              : round === "rail"
                ? { top: r.top, left: Math.max(8, Math.min(r.right + 12, window.innerWidth - 296)) }
                : rail
                  ? { top: r.top, left: Math.max(8, r.left - 296) }
                  : { top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - 296)) },
          );
        }}
        className={
          round === "banner"
            ? clsx(
                "flex size-9 items-center justify-center rounded-full ring-1 transition disabled:opacity-40",
                at ? "bg-white text-ink ring-white" : "bg-white/10 text-white ring-white/15",
              )
            : round
              ? "group flex flex-col items-center gap-1 disabled:opacity-100"
              : clsx(
                  rail ? RAIL_ITEM : "flex h-9 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
                  at ? "bg-primary text-primary-ink" : "text-ink-2 hover:text-ink",
                  !phone && "text-muted hover:text-muted",
                )
        }
      >
        {round === "banner" ? (
          <Phone className="size-4" aria-hidden />
        ) : round ? (
          <>
            <span
              className={clsx(
                "flex items-center justify-center rounded-full shadow-[0_6px_18px_rgba(11,11,12,0.08)] ring-1 transition",
                mini ? "size-9" : "size-11",
                at ? "bg-primary text-primary-ink ring-primary" : "bg-surface text-ink-2 ring-line group-hover:text-ink",
                !phone && "text-muted group-hover:text-muted",
              )}
            >
              <Phone className={mini ? "size-4" : "size-[18px]"} aria-hidden />
            </span>
            <span className={clsx(mini ? "text-[9.5px]" : "text-[10.5px]", "font-medium", phone ? "text-ink-2" : "text-muted")}>Call</span>
          </>
        ) : (
          <>
            <Phone className={rail ? "size-4" : "size-[18px]"} aria-hidden />
            {rail && "Call"}
          </>
        )}
      </button>
      {/* On the page body, so nothing on the page draws over it (the rail is a layer of its own). */}
      {at &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={{ top: at.top, left: at.left }}
            className="fixed z-[70] max-h-[calc(100dvh-1.75rem)] w-72 overflow-y-auto rounded-xl bg-surface p-1.5 shadow-lift ring-1 ring-line has-[[data-ask-draft]]:w-96"
          >
            <CallChoices jobId={jobId} phone={phone} name={name} onNotes={onNotes} toBook={toBook} onClose={() => setAt(null)} />
          </div>,
          document.body,
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
 * and Proposal; then the ways of reaching the customer as one group, Call, Email and Files under it (14 Nov 2026,
 * Martin: they should feel grouped, the files under Email); then Details, which opens the deal's details and holds its
 * notes and chats; then, only once it matters, the Job card (sold) and Service (installed); then Sol. Down the left on
 * a wide screen, floating in the middle of the window; a row under the banner narrower.
 */
/**
 * The deal's tools on a phone (21 Nov 2026, Martin: the rail down the left took a fifth of the screen and cut the words
 * short): one row of pills under the banner that scrolls sideways. Call and Email are in the banner; Sol is the foot
 * bar's, so he isn't here twice.
 */
/**
 * Sol's card for the deal. On a wide screen it sits in the page; on a phone (21 Nov 2026, Martin: "sols chat box should
 * be a pop up which can be collapsed or reintroduced via the centre sol icon at the footer") it is a sheet over the foot
 * bar, folded away by its handle into the foot bar's Sol round, which brings it back (`DEAL_SOL_TOGGLE`; elsewhere
 * the round goes to Today). One element either
 * way, so the card is never mounted twice (it drafts a reply when it opens). Folded or not is kept for the tab.
 */
const SOL_TUCKED_KEY = "renuabl.design.deal-sol-tucked";
function DealSolSheet({ children, name }: { children: React.ReactNode; name: string }) {
  const [tucked, setTucked] = useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(SOL_TUCKED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [height, setHeight] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const set = useCallback((next: boolean) => {
    setTucked(next);
    try {
      sessionStorage.setItem(SOL_TUCKED_KEY, next ? "1" : "0");
    } catch {}
  }, []);
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 639px)");
    const mark = () => {
      if (phone.matches) document.documentElement.dataset.dealSol = "1";
      else delete document.documentElement.dataset.dealSol;
    };
    mark();
    phone.addEventListener("change", mark);
    const toggle = () =>
      setTucked((was) => {
        try {
          sessionStorage.setItem(SOL_TUCKED_KEY, was ? "0" : "1");
        } catch {}
        return !was;
      });
    window.addEventListener(DEAL_SOL_TOGGLE, toggle);
    return () => {
      phone.removeEventListener("change", mark);
      window.removeEventListener(DEAL_SOL_TOGGLE, toggle);
      delete document.documentElement.dataset.dealSol;
    };
  }, []);
  // Room at the foot of the page so the sheet never hides its end.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(() => setHeight(el.offsetHeight));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  // Folded, he goes into the foot bar's Sol round (22 Nov 2026, Martin: "he should minimise visually onto the centre
  // sol icon so the user can see that's where they can re-engage Sol on the deal"): the round is told, and lands him.
  useEffect(() => {
    const root = document.documentElement;
    if (tucked) root.dataset.dealSolTucked = "1";
    else delete root.dataset.dealSolTucked;
    window.dispatchEvent(new Event(DEAL_SOL_STATE));
    return () => {
      delete root.dataset.dealSolTucked;
      window.dispatchEvent(new Event(DEAL_SOL_STATE));
    };
  }, [tucked]);
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--deal-sol-h", tucked || !height ? "0px" : `${height + 16}px`);
    return () => {
      root.removeProperty("--deal-sol-h");
    };
  }, [tucked, height]);
  return (
    <>
      <div
        ref={box}
        data-tour="deal-sol"
        className={clsx(
          "[&:not(:has(section))]:hidden",
          "max-sm:fixed max-sm:inset-x-2 max-sm:bottom-[calc(3.75rem+env(safe-area-inset-bottom))] max-sm:z-30",
          "deal-sol-sheet max-sm:max-h-[58dvh] max-sm:overflow-y-auto max-sm:overscroll-contain max-sm:rounded-2xl max-sm:bg-surface max-sm:ring-1 max-sm:ring-line",
          "max-sm:shadow-[0_-6px_30px_rgba(11,11,12,0.22)]",
          tucked && "deal-sol-tucked",
        )}
        aria-hidden={tucked || undefined}
      >
        {/* On a phone it reads as a chat window (22 Nov 2026, Martin: "sols chat tab doesn't feel like a chat tab"): a
            header with Sol and who it's about, his line as a bubble, quick replies under it, the box at the foot. */}
        <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-line bg-surface px-3 pb-2 pt-1.5 sm:hidden">
          <span className="absolute left-1/2 top-1 h-1 w-9 -translate-x-1/2 rounded-full bg-ink/15" aria-hidden />
          <SolMark className="mt-1 size-8 shrink-0" />
          <span className="mt-1 min-w-0 flex-1 leading-tight">
            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
              Sol
              <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-medium text-muted ring-1 ring-line">AI</span>
            </span>
            <span className="block truncate text-[11.5px] text-muted">{name ? `On ${name}'s deal` : "On this deal"}</span>
          </span>
          <button
            type="button"
            onClick={() => set(true)}
            aria-label="Fold Sol into the Sol round below (press it to bring him back)"
            title="Fold away"
            className="mt-1 grid size-8 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
          >
            <ChevronDown className="size-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

function DealPills(props: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  stage: JobStage;
  designable: boolean;
  onDesign: () => void;
  onProposal: () => void;
  onCard: () => void;
}) {
  const sold = WON_STAGES.includes(props.stage);
  const installed = INSTALLED_STAGES.includes(props.stage);
  const inDetails = NOTES_VIEWS.some(([key]) => key === props.tab);
  return (
    <nav
      aria-label="This deal"
      className="deal-pills relative z-10 -mt-8 flex justify-between gap-1 overflow-x-auto px-1 pt-1.5 pb-0.5 [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden"
    >
      <PillRound
        label="Design"
        icon={PenTool}
        main
        tour="deal-design"
        title={props.designable ? "Design" : "Give the deal an address to design it"}
        onClick={props.onDesign}
      />
      <PillRound label="Proposal" icon={FileText} tour="deal-proposal" onClick={props.onProposal} />
      <PillRound label="Details" icon={LayoutList} on={inDetails} tour="deal-details" onClick={() => props.onTab("activities")} />
      <PillRound label="Files" icon={Paperclip} on={props.tab === "files"} onClick={() => props.onTab("files")} />
      {sold && <PillRound label="Job card" icon={HardHat} onClick={props.onCard} />}
      {installed && <PillRound label="Service" icon={Wrench} on={props.tab === "service"} onClick={() => props.onTab("service")} />}
    </nav>
  );
}

// On a phone (21 Nov 2026, Martin): the deal's tools as icon rounds, a small name under each, in one row.
function PillRound({
  label,
  icon: Icon,
  on = false,
  main = false,
  tour,
  title,
  onClick,
}: {
  label: string;
  icon: typeof PenTool;
  on?: boolean;
  main?: boolean;
  tour?: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-tour={tour}
      onClick={onClick}
      title={title ?? label}
      aria-pressed={on || undefined}
      className="flex w-14 shrink-0 flex-col items-center gap-1"
    >
      <span
        className={clsx(
          "flex size-10 items-center justify-center rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.28)] ring-1 transition",
          main
            ? "bg-sun-line text-white ring-sun-line"
            : on
              ? "bg-primary text-primary-ink ring-primary"
              : "bg-surface text-ink-2 ring-line",
        )}
        aria-hidden
      >
        <Icon className={clsx("size-[18px]", !main && !on && label === "Proposal" && "text-sun-line")} />
      </span>
      <span className={clsx("text-[10px] leading-none", on ? "font-semibold text-ink" : "text-muted")}>{label}</span>
    </button>
  );
}

function DealMenu({
  vertical = false,
  mini = false,
  tab,
  onTab,
  stage,
  designable,
  onDesign,
  onProposal,
  onCard,
  jobId,
  phone,
  name,
  onNotes,
  onDelete,
}: {
  vertical?: boolean;
  /** The phone's slim rail (21 Nov 2026, Martin): down the left, hard up to the gutter, the way back to Deals first. */
  mini?: boolean;
  tab: Tab;
  onTab: (tab: Tab) => void;
  stage: JobStage;
  designable: boolean;
  onDesign: () => void;
  onProposal: () => void;
  onCard: () => void;
  jobId: string;
  phone: string;
  name: string;
  onNotes: () => void;
  onDelete?: () => void;
}) {
  const [railRef, railStyle] = useCentredRail();
  const sold = WON_STAGES.includes(stage);
  const installed = INSTALLED_STAGES.includes(stage);
  const down = vertical || mini;
  // A little smaller on a computer (26 Nov 2026, Martin): 44 px rounds, 18 px marks.
  const size = mini ? "size-9" : "size-11";
  const icon = mini ? "size-4" : "size-[18px]";
  const round = (on: boolean) =>
    clsx(
      "flex items-center justify-center rounded-full shadow-[0_6px_18px_rgba(11,11,12,0.08)] ring-1 transition",
      size,
      on ? "bg-primary text-primary-ink ring-primary" : "bg-surface text-ink-2 ring-line group-hover:text-ink",
    );
  const line = (
    <span className={down ? clsx("h-px shrink-0 bg-line", mini ? "w-6" : "w-8") : "mt-6 h-px w-4 shrink-0 bg-line"} aria-hidden />
  );
  const page = (key: Tab, label: string, title: string, Icon: typeof Mail) => (
    <RailRound mini={mini} label={label} title={title} onClick={() => onTab(key)} on={tab === key}>
      <span className={round(tab === key)}>
        <Icon className={icon} aria-hidden />
      </span>
    </RailRound>
  );
  return (
    <nav
      ref={vertical ? railRef : undefined}
      style={vertical ? railStyle : undefined}
      aria-label="This deal"
      className={
        mini
          ? "sticky top-3 z-10 -ml-2.5 flex flex-col items-center gap-2 self-start sm:hidden"
          : vertical
            ? "sticky hidden flex-col items-center gap-3 pt-1 xl:flex"
            : "-mx-1 hidden items-start gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex xl:hidden [&::-webkit-scrollbar]:hidden"
      }
    >
      {mini && (
        <Link
          href={PATHS.pipelines}
          data-tour="deal-back"
          title="Back to Deals"
          aria-label="Back to Deals"
          className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface hover:text-ink"
        >
          <ArrowLeft className="size-[18px]" aria-hidden />
        </Link>
      )}
      <RailRound
        mini={mini}
        tour="deal-design"
        label="Design"
        title={designable ? "Design" : "Give the deal an address to design it"}
        onClick={onDesign}
      >
        <span
          className={clsx(
            "flex items-center justify-center rounded-full bg-sun-line text-white shadow-[0_6px_18px_rgba(255,90,31,0.3)] transition group-hover:brightness-105",
            size,
          )}
        >
          <PenTool className={icon} aria-hidden />
        </span>
      </RailRound>
      <RailRound mini={mini} tour="deal-proposal" label="Proposal" title="Proposal: what the customer sees" onClick={onProposal}>
        <span
          className={clsx(
            "flex items-center justify-center rounded-full bg-surface text-sun-line shadow-[0_6px_18px_rgba(11,11,12,0.12)] ring-1 ring-line transition group-hover:text-ink",
            size,
          )}
        >
          <FileText className={icon} aria-hidden />
        </span>
      </RailRound>
      {line}
      {/* Reaching the customer, as one group on a plate of its own: ring them, write to them, and what was sent or kept. */}
      <div
        role="group"
        aria-label="Reach the customer"
        data-tour="deal-reach"
        className={clsx(
          "flex shrink-0 rounded-[2.25rem] bg-surface/60 ring-1 ring-line",
          mini
            ? "flex-col items-center gap-2 px-1 py-1.5"
            : vertical
              ? "flex-col items-center gap-3 px-2.5 py-3"
              : "items-start gap-3 px-3 py-2.5",
        )}
      >
        <CallMenu
          round={down ? "rail" : "row"}
          mini={mini}
          jobId={jobId}
          phone={phone}
          name={name}
          onNotes={onNotes}
          toBook={PRE_INSTALL_STAGES.includes(stage)}
        />
        {page("email", "Email", `Email ${name || "the customer"}`, Mail)}
        {page("files", "Files", "Files kept on this deal", Paperclip)}
      </div>
      {line}
      <RailRound
        mini={mini}
        tour="deal-details"
        label="Details"
        title="Details: the deal's details, with its notes and chats inside"
        onClick={() => onTab("activities")}
        on={NOTES_VIEWS.some(([key]) => key === tab)}
      >
        <span className={round(NOTES_VIEWS.some(([key]) => key === tab))}>
          <LayoutList className={icon} aria-hidden />
        </span>
      </RailRound>
      {(sold || installed) && line}
      {sold && (
        <RailRound mini={mini} label="Job card" title="Job card: what the installers take to the job" onClick={onCard}>
          <span className={round(false)}>
            <HardHat className={icon} aria-hidden />
          </span>
        </RailRound>
      )}
      {installed && page("service", "Service", "Service: something to put right after the install", Wrench)}
      {line}
      <RailRound mini={mini} label="Sol" title="Sol on this deal" onClick={() => onTab("sol")} on={tab === "sol"}>
        <span
          className={clsx(
            "flex items-center justify-center rounded-full bg-primary shadow-[0_6px_18px_rgba(11,11,12,0.18)] transition group-hover:bg-forest",
            size,
            tab === "sol" && "ring-2 ring-sun-line/60 ring-offset-2 ring-offset-canvas",
          )}
        >
          <SolBadge className={mini ? "size-[18px]" : "size-5"} />
        </span>
      </RailRound>
      {mini && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete this deal"
          aria-label="Delete this deal"
          className="mt-1 flex size-8 items-center justify-center rounded-full text-muted hover:text-danger"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      )}
    </nav>
  );
}

/**
 * The deal has no place on the map, so there is no roof to design yet (12 Nov 2026, Martin): a box over the page says so
 * and finds the address; once picked it is kept on the deal and, from Design, the designer opens on it.
 */
function AskPlace(props: {
  name: string;
  /** The address as typed on the deal, when it has one that isn't on the map. */
  had: string;
  then: "design" | "place";
  onClose: () => void;
  onPlace: (place: { address: string; lat: number | null; lng: number | null }) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [props]);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-place-title"
      className="theme-studio fixed inset-0 z-[80] flex items-start justify-center bg-ink/40 px-4 pt-[18vh]"
      onPointerDown={(e) => e.target === e.currentTarget && props.onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl bg-surface p-5 shadow-[0_24px_60px_rgba(11,11,12,0.25)] ring-1 ring-line">
        <div className="flex items-start justify-between gap-3">
          <h2 id="ask-place-title" className="text-base font-semibold text-ink">
            {props.then === "design" ? "Where is the roof?" : "Find the address"}
          </h2>
          <button type="button" onClick={props.onClose} aria-label="Close" className="-m-1 rounded-full p-1 text-muted hover:text-ink">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 text-sm text-ink-2">
          {props.had
            ? `${props.name || "This deal"}'s address isn't on the map yet, so there's no roof to design. Find it below.`
            : `This deal has no address yet, so there's no roof to design. Type ${props.name ? `${props.name}'s` : "the"} address.`}
        </p>
        {props.had && <p className="mt-1 text-xs text-muted">As typed: {props.had}</p>}
        <div className={clsx("mt-3", saving && "pointer-events-none opacity-60")}>
          <AddressField
            value=""
            placed={false}
            onChange={async (place) => {
              if (!place.address) return;
              if (place.lat === null) return setProblem("That address isn't on the map. Pick one from the list.");
              setSaving(true);
              setProblem(null);
              const ok = await props.onPlace(place);
              setSaving(false);
              if (!ok) setProblem("It couldn't be saved. Try again.");
            }}
          />
        </div>
        {problem && <p className="mt-2 text-xs text-warning">{problem}</p>}
        <p className="mt-3 text-xs text-muted">
          {props.then === "design" ? "It's kept on the deal, then the designer opens on the roof." : "It's kept on the deal."}
        </p>
      </div>
    </div>,
    document.body,
  );
}

function RailRound({
  label,
  title,
  onClick,
  on,
  tour,
  mini = false,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  /** A tab of the page: pressed while it is the one open. */
  on?: boolean;
  /** Its place in the tour of a deal (deal-tour.ts). */
  tour?: string;
  /** On the phone's slim rail: smaller words. */
  mini?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-tour={tour}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={on}
      className={clsx("group flex flex-col items-center", mini ? "gap-0.5" : "gap-1")}
    >
      {children}
      <span className={clsx(mini ? "text-[9.5px] leading-tight" : "text-[10.5px]", "font-medium", on ? "text-ink" : "text-ink-2")}>
        {label}
      </span>
    </button>
  );
}

/** A line of the Notes timeline: the deal's record, or one of the customer's emails in the member's own mailbox. */
type Timed = { id: string; at: string } & (({ mail: null } & Activity) | { mail: DealMail });

/** One of the customer's emails as read from the member's own mailbox, opening there. */
function MailEntry({ m }: { m: DealMail }) {
  const href =
    providerOfId(m.id) === "outlook"
      ? outlookWebLink(m.id)
      : `https://mail.google.com/mail/?authuser=${encodeURIComponent(m.box)}#all/${m.id}`;
  return (
    <li className={clsx(ui.card, "px-5 py-4", m.way === "in" && "ring-1 ring-sun-line/40")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-ink">
          <strong className="font-semibold">{m.way === "in" ? "Email from" : "Email to"}</strong>{" "}
          <span className="text-ink-2">{m.way === "in" ? m.from : "the customer"}</span>
        </p>
        <time className="shrink-0 text-xs tabular-nums text-muted" dateTime={m.at}>
          {new Date(m.at).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
        </time>
      </div>
      <p className="mt-1.5 text-sm font-medium text-ink">{m.subject}</p>
      {m.snippet && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-2">{m.snippet}</p>}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs text-muted underline underline-offset-4 hover:text-ink"
      >
        Open in {providerOfId(m.id) === "outlook" ? "Outlook" : "Gmail"} · {m.box}
      </a>
    </li>
  );
}

/** A price as the business reads it: "$14,747.00". */
function dollarsAndCents(n: number): string {
  return Number.isFinite(n) ? `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
}

/** What is kept as a price is typed: figures and one point, two places after it. */
function cleanPriceTyping(typed: string): string {
  const [whole, ...rest] = typed.replace(/[^\d.]/g, "").split(".");
  const cents = rest.join("").slice(0, 2);
  return (whole.slice(0, 8) + (typed.includes(".") ? `.${cents}` : "")).replace(/^\./, "0.");
}

/**
 * The deal's name as shown (26 Nov 2026, Martin: "Deal name should be the customer name or the address"): a deal named
 * only by what they want ("Solar", "Solar and battery") reads as the customer's name, else its address. A name typed
 * over it is kept as typed.
 */
function dealName(title: string, customer: string, address: string): string {
  return interestsOf(title) !== null ? customer.trim() || address || title : title;
}
