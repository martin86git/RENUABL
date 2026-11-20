"use client";

import { ArrowRight, CalendarDays, GraduationCap, Megaphone, Rocket, RotateCcw, Tag, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, cn } from "@/components/ui/primitives";
import { CAMPAIGN_GOALS, GOAL_WORDS, campaignName, type CampaignGoal } from "@/lib/domain/marketing/campaign-goals";
import type { MarketingList } from "@/lib/domain/marketing/contacts";
import { EDM_LAYOUTS, LAYOUT_WORDS, layoutContent, type EdmLayout, type EdmSectionsAnswer } from "@/lib/domain/marketing/edm-sections";
import { EDM_SOL_LIMITS } from "@/lib/domain/marketing/edm-sol";
import { loadCampaigns, loadContacts, newCampaign, saveCampaignDraft, writeWithSol, type CampaignLine } from "@/lib/services/marketing";
import { SolIcon } from "../sol-icon";
import { SolThinking } from "../sol-thinking";
import { field } from "./edm-builder";

const ICONS: Record<CampaignGoal, LucideIcon> = {
  new: Rocket,
  offer: Tag,
  news: Megaphone,
  teach: GraduationCap,
  winback: RotateCcw,
  invite: CalendarDays,
};

/** A layout as a small drawing of the email: its heading, words and picture spots, part by part. */
function LayoutThumb({ layout, on }: { layout: EdmLayout; on: boolean }) {
  const bar = on ? "bg-ink" : "bg-line-strong";
  const tile = on ? "bg-sun-line" : "bg-line";
  return (
    <span aria-hidden className="flex h-20 w-14 flex-col gap-[3px] overflow-hidden rounded-md bg-canvas p-1.5">
      {layout === 1 ? (
        <>
          <span className={cn("h-1 w-2/3 rounded-full", bar)} />
          <span className="h-0.5 w-full rounded-full bg-line-strong" />
          <span className="h-0.5 w-full rounded-full bg-line-strong" />
          <span className="h-0.5 w-3/4 rounded-full bg-line-strong" />
          <span className={cn("mt-auto h-2 w-1/2 self-center rounded-full", tile)} />
        </>
      ) : (
        Array.from({ length: layout }, (_, i) => (
          <span key={i} className="flex min-h-0 flex-1 flex-col gap-[2px]">
            <span className={cn("h-[3px] w-1/2 rounded-full", bar)} />
            <span className="flex min-h-0 flex-1 gap-[2px]">
              <span className={cn("flex-1 rounded-[2px]", tile)} />
              {i > 0 && <span className={cn("flex-1 rounded-[2px]", tile)} />}
            </span>
          </span>
        ))
      )}
    </span>
  );
}

const n = (v: number) => v.toLocaleString("en-AU");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short" });

/**
 * Where a new campaign starts (campaign-goals.ts): what it's for, a few words on it and who it goes to. Sol writes the
 * first draft from that, so the editor opens on an email to change, not an empty one. Nothing is sent from here.
 */
export function CampaignStart() {
  const router = useRouter();
  const [goal, setGoal] = useState<CampaignGoal | null>(null);
  const [brief, setBrief] = useState("");
  const [lists, setLists] = useState<MarketingList[]>([]);
  const [listId, setListId] = useState<string | null>(null);
  const [layout, setLayout] = useState<EdmLayout>(3);
  const [drafts, setDrafts] = useState<CampaignLine[]>([]);
  const [busy, setBusy] = useState<"sol" | "open" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** Pressed with nothing typed: the box says what it needs. */
  const [empty, setEmpty] = useState(false);
  const about = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadContacts({ q: "", list: null, offset: 0 }).then((r) => r.ok && setLists(r.lists));
    loadCampaigns().then((r) => r.ok && setDrafts(r.campaigns.filter((c) => c.status === "draft").slice(0, 3)));
  }, []);

  function pick(g: CampaignGoal) {
    setGoal(g);
    setProblem(null);
    // After the card is on the page.
    setTimeout(() => {
      about.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      box.current?.focus({ preventScroll: true });
    }, 50);
  }

  /** Makes the draft, with what Sol wrote in it when he did, and opens it. */
  async function open(written: Partial<EdmSectionsAnswer> | null, as: EdmLayout = layout) {
    setBusy("open");
    const name = campaignName(goal, written?.subject);
    const made = await newCampaign(name);
    if (!made.ok) return (setBusy(null), setProblem(made.message));
    if (written || listId || as > 1) {
      const saved = await saveCampaignDraft(made.id, { name, content: layoutContent(as, written), listId });
      // The draft exists either way; the editor says what it holds.
      if (!saved.ok) console.warn("campaign start not saved", saved.message);
    }
    router.push(`/design/marketing/campaigns/${made.id}`);
  }

  async function write() {
    if (!goal) return;
    if (!brief.trim()) {
      // The grey words in the box are an example, which reads as filled in: say so, and put them there to type.
      setEmpty(true);
      box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      box.current?.focus({ preventScroll: true });
      return;
    }
    setBusy("sol");
    setProblem(null);
    const r = await writeWithSol({
      part: "all",
      brief,
      draft: { subject: "", preview: "", heading: "", text: "" },
      goal,
      sections: layout,
    });
    if (!r.ok) return (setBusy(null), setProblem(r.message));
    // The simple layout is answered as one heading and its words; sections as sections.
    const sections = r.sections ?? (r.heading || r.text ? [{ heading: r.heading ?? "", text: r.text ?? "" }] : []);
    await open({ subject: r.subject, preview: r.preview, sections, button: r.button });
  }

  const words = goal ? GOAL_WORDS[goal] : null;
  const list = lists.find((l) => l.id === listId);

  return (
    <div className="mx-auto max-w-[58rem] pb-10">
      <Link href="/design/marketing/campaigns" className="text-[13px] text-muted hover:text-ink">
        ← Campaigns
      </Link>

      <div className="mt-6 text-center">
        <p className="text-[12px] font-medium tracking-[0.14em] text-muted uppercase">New campaign · Step {goal ? "2" : "1"} of 2</p>
        <h1 className="mt-2 text-[30px] font-semibold tracking-tight sm:text-[34px]">What do you want to achieve?</h1>
        <p className="mt-2 text-[14px] text-muted">Pick one and Sol writes the first draft. You change anything before it&apos;s sent.</p>
      </div>

      <div role="radiogroup" aria-label="What the campaign is for" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CAMPAIGN_GOALS.map((g) => {
          const Icon = ICONS[g];
          const on = goal === g;
          return (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={busy !== null}
              onClick={() => pick(g)}
              className={cn(
                "group flex flex-col items-center rounded-2xl bg-surface px-5 py-6 text-center shadow-[var(--shadow-soft)] ring-1 ring-inset transition-shadow",
                on ? "ring-2 ring-ink" : "ring-line hover:ring-ink/40",
                goal && !on && "opacity-60 hover:opacity-100",
              )}
            >
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-full",
                  on ? "bg-sun-line text-white" : "bg-canvas text-ink-2 group-hover:text-ink",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              <span className="mt-3 text-[15px] font-medium">{GOAL_WORDS[g].label}</span>
              <span className="mt-1 text-[12.5px] leading-snug text-muted">{GOAL_WORDS[g].what}</span>
            </button>
          );
        })}
      </div>

      {words && (
        <div ref={about} className="mt-6 scroll-mb-6 rounded-2xl bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6">
          {busy ? (
            <div className="py-6">
              <SolThinking say={busy === "sol" ? "Writing your email…" : "Opening your draft…"} plain={busy === "open"} />
            </div>
          ) : (
            <>
              <label className="block">
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  <SolIcon className="size-4" /> {words.ask}
                </span>
                <textarea
                  ref={box}
                  value={brief}
                  rows={4}
                  maxLength={EDM_SOL_LIMITS.brief}
                  aria-invalid={empty}
                  onChange={(e) => {
                    setBrief(e.target.value);
                    setEmpty(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void write();
                  }}
                  placeholder={`For example: ${words.example}`}
                  className={cn(field, "mt-3 h-auto py-2.5 leading-relaxed", empty && "ring-2 ring-sun-line")}
                />
              </label>
              {!brief.trim() && (
                <p className={cn("mt-2 text-[13px]", empty ? "font-medium text-ink" : "text-muted")}>
                  {empty
                    ? "Tell Sol what the email is about first. The grey words are only an example. "
                    : "The grey words are only an example. "}
                  <button
                    type="button"
                    className="underline underline-offset-4 hover:text-ink"
                    onClick={() => {
                      setBrief(words.example);
                      setEmpty(false);
                      box.current?.focus({ preventScroll: true });
                    }}
                  >
                    Start from the example
                  </button>
                </p>
              )}
              <p className="mt-2 text-[12px] text-muted">
                Sol uses only what you write here: no figures, offers, dates or promises of his own. Writing it uses Sol credits.
              </p>

              <fieldset className="mt-5">
                <legend className="text-[13px] font-medium">How should it be laid out?</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {EDM_LAYOUTS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={layout === l}
                      title={LAYOUT_WORDS[l].what}
                      onClick={() => setLayout(l)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl bg-surface px-3 py-3 ring-1 ring-inset",
                        layout === l ? "ring-2 ring-ink" : "ring-line hover:ring-ink/40",
                      )}
                    >
                      <LayoutThumb layout={l} on={layout === l} />
                      <span className="text-[13px] font-medium">{LAYOUT_WORDS[l].label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-muted">
                  {LAYOUT_WORDS[layout].what}
                  {layout > 1 && " Sol writes each part; you drop your own pictures in, as many as each part needs."}
                </p>
              </fieldset>

              <label className="mt-5 block text-[13px] font-medium">
                Who is it going to?
                <select value={listId ?? ""} onChange={(e) => setListId(e.target.value || null)} className={cn(field, "mt-2 font-normal")}>
                  <option value="">Choose later</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({n(l.emailable)} of {n(l.members)} can be emailed)
                    </option>
                  ))}
                </select>
              </label>
              {list && list.emailable === 0 && (
                <p className="mt-2 text-[12px] text-muted">Nobody on this list can be emailed yet. Set their consent in Contacts first.</p>
              )}
              {lists.length === 0 && (
                <p className="mt-2 text-[12px] text-muted">
                  No lists yet. You can write the email now and{" "}
                  <Link href="/design/marketing" className="underline underline-offset-4 hover:text-ink">
                    add contacts
                  </Link>{" "}
                  before sending.
                </p>
              )}

              {problem && <p className="mt-4 text-[13px] text-danger">{problem}</p>}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button onClick={() => void write()}>
                  <SolIcon className="size-4" /> Write the first draft
                </Button>
                <Button variant="ghost" onClick={() => void open(null)}>
                  I&apos;ll write it myself
                </Button>
                <span className="ml-auto text-[12px] text-muted">Nothing is sent until you type SEND.</span>
              </div>
            </>
          )}
        </div>
      )}

      {!goal && (
        <>
          {drafts.length > 0 && (
            <div className="mt-10">
              <p className="text-center text-[13px] font-medium text-ink-2">Or carry on with a draft</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/design/marketing/campaigns/${d.id}`}
                      className="flex h-full flex-col rounded-2xl bg-surface px-5 py-4 ring-1 ring-line ring-inset hover:ring-ink/40"
                    >
                      <span className="truncate text-[14px] font-medium">{d.name}</span>
                      <span className="mt-0.5 truncate text-[12.5px] text-muted">{d.subject || "No subject yet"}</span>
                      <span className="mt-3 text-[12px] text-muted">
                        Draft · edited {day(d.updatedAt)}
                        {d.listName ? ` · ${d.listName}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-8 text-center">
            {problem && <p className="mb-3 text-[13px] text-danger">{problem}</p>}
            <Button variant="secondary" disabled={busy !== null} onClick={() => void open(null, 1)}>
              Start with a blank email <ArrowRight className="size-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
