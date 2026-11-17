"use client";

import { useState } from "react";
import { ArrowRight, CircleHelp, CornerUpLeft, PencilLine, X } from "lucide-react";
import {
  isYesNoQuestion,
  namedItem,
  solBlocks,
  solRow,
  solRuns,
  threadDepths,
  withSections,
  type SolBlock,
  type SolOption,
  type SolSection,
} from "@/lib/domain/design/sol-format";

/**
 * Answering one of Sol's questions from his message (8 Nov 2026, Martin): `answer` is the words to send at once (Yes,
 * No, an option picked, something else typed), or null to reply to it in the box.
 */
export type OnAnswer = (question: string, answer: string | null) => void;

/** Picking one row of a section to work on with Sol (15 Nov 2026, Martin: "be able to click for an outcome"). */
export type OnPick = (item: string) => void;

/**
 * Sol's words laid out to read at a glance (5 Nov 2026, Martin; sol-format.ts reads them): short paragraphs, lists with
 * round bullets, the point that matters most in a warm pad, and a question to the reader ringed in the signal orange
 * so it is never missed. `tail` is put at the end of the last block (Sol's caret while he types).
 */
export function SolText({
  text,
  tail,
  onAnswer,
  onPick,
  threads = false,
}: {
  text: string;
  tail?: React.ReactNode;
  onAnswer?: OnAnswer;
  onPick?: OnPick;
  /**
   * His own chat's layout (15 Nov 2026, Martin: no pads, white text, "blocks that maintain the same distance between
   * blocks of text as if an invisible pad existed", and mini threads): blocks sit further apart, and one that follows
   * on from the block before is stepped in and joined to it (`threadDepths`). A place that draws his answer inside a
   * bubble of its own doesn't ask for it.
   */
  threads?: boolean;
}) {
  // A heading and the list under it are one section, numbered when there are several, so the eye has landmarks to
  // come back to (15 Nov 2026, Martin: the headings and bullets ran into one).
  const blocks = withSections(solBlocks(text));
  if (!blocks.length) return tail ? <>{tail}</> : null;
  const sections = blocks.filter((b) => b.kind === "section").length;
  let nth = 0;
  const depths = threads ? threadDepths(blocks) : [];
  return (
    <div className={threads ? "space-y-6" : "space-y-4"}>
      {blocks.map((b, i) =>
        b.kind === "section" ? (
          <Section
            key={i}
            section={b}
            number={sections > 1 ? ++nth : null}
            tail={i === blocks.length - 1 ? tail : null}
            onPick={tail ? undefined : onPick}
          />
        ) : (
          <Follows key={i} depth={depths[i] ?? 0}>
            <Block block={b} tail={i === blocks.length - 1 ? tail : null} onAnswer={tail ? undefined : onAnswer} />
          </Follows>
        ),
      )}
    </div>
  );
}

/** How far each step of a thread sits in from the one before, in rem. */
const THREAD_STEP = 1.5;

/**
 * A block in its place in a thread: one that follows on is stepped in by its depth and joined to the block before it
 * by a fine elbow (`.sol-follows` in globals.css), so related blocks read as one small thread without a pad.
 */
function Follows({ depth, children }: { depth: number; children: React.ReactNode }) {
  if (depth <= 0) return <>{children}</>;
  return (
    <div className="sol-follows" style={{ marginLeft: `${depth * THREAD_STEP}rem` }}>
      {children}
    </div>
  );
}

/**
 * One section of his answer (15 Nov 2026, Martin: clarity, less to hold in mind, a click for an outcome, and a place to
 * find again after looking away): its number and heading over a tinted panel of rows, one a line item, each with who
 * or what it is about, its amount set to the right, and the rest quieter under it. With `onPick`, a row's arrow takes
 * that one up with Sol.
 */
function Section({
  section,
  number,
  tail,
  onPick,
}: {
  section: SolSection;
  number: number | null;
  tail: React.ReactNode;
  onPick?: OnPick;
}) {
  return (
    <section>
      <h4 className="flex items-baseline gap-2.5 border-b border-ink/80 pb-2 text-ink">
        {number !== null && (
          <span className="shrink-0 text-[10.5px] tabular-nums text-muted" aria-hidden>
            {String(number).padStart(2, "0")}
          </span>
        )}
        <span className="min-w-0 font-[560]">{section.title}</span>
        <span className="ml-auto shrink-0 pl-2 text-[10.5px] font-normal tabular-nums text-muted">{section.items.length}</span>
      </h4>
      <ul className="divide-y divide-line">
        {section.items.map((item, i) => {
          const row = solRow(item);
          return (
            <li key={i} className="group/row flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                {row.name && (
                  <p className="flex items-baseline gap-3">
                    <span className="min-w-0 font-medium text-ink">{row.name}</span>
                    {row.amount && <span className="ml-auto shrink-0 text-[0.94em] tabular-nums text-ink">{row.amount}</span>}
                  </p>
                )}
                <p className={row.name ? "mt-0.5 text-[0.95em] leading-[1.5] text-muted" : "text-ink"}>
                  <Runs text={row.name ? row.detail.charAt(0).toUpperCase() + row.detail.slice(1) : row.detail} />
                  {i === section.items.length - 1 && tail}
                </p>
              </div>
              {onPick && (
                <button
                  type="button"
                  onClick={() => onPick(item.replace(/\*\*/g, ""))}
                  title="Work on this one with Sol"
                  aria-label={`Work on this one with Sol: ${row.name ?? row.detail}`}
                  className="-mr-1 grid size-7 shrink-0 place-items-center rounded-full text-muted/70 transition hover:bg-ink hover:text-surface group-hover/row:text-ink group-hover/row:hover:text-surface"
                >
                  <ArrowRight className="size-3.5" aria-hidden />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * One line of his words with what matters set apart (sol-format.ts `solRuns`): figures and marked words a weight
 * heavier (medium, not bold: 15 Nov 2026, Martin, "less loud") and never broken across lines, a phone number or an email as something to press.
 */
function Runs({ text }: { text: string }) {
  return (
    <>
      {solRuns(text).map((r, i) => {
        if (r.kind === "strong")
          return (
            <strong key={i} className="font-medium text-ink">
              {r.text}
            </strong>
          );
        if (r.kind === "figure")
          return (
            <span key={i} className="whitespace-nowrap font-medium text-ink">
              {r.text}
            </span>
          );
        if (r.kind === "phone")
          return (
            <a
              key={i}
              href={`tel:${r.dial}`}
              className="whitespace-nowrap font-medium text-ink underline decoration-ink/25 underline-offset-[3px] hover:decoration-ink"
            >
              {r.text}
            </a>
          );
        if (r.kind === "link")
          return (
            <a
              key={i}
              href={r.text}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-medium text-ink underline decoration-ink/25 underline-offset-[3px] hover:decoration-ink"
            >
              {r.text}
            </a>
          );
        if (r.kind === "email")
          return (
            <a
              key={i}
              href={`mailto:${r.text}`}
              className="font-medium text-ink underline decoration-ink/25 underline-offset-[3px] hover:decoration-ink"
            >
              {r.text}
            </a>
          );
        return <span key={i}>{r.text}</span>;
      })}
    </>
  );
}

function Block({ block, tail, onAnswer }: { block: SolBlock; tail: React.ReactNode; onAnswer?: OnAnswer }) {
  switch (block.kind) {
    case "list":
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => {
            const named = namedItem(item);
            return (
              <li key={i} className="flex gap-3">
                <span className="mt-[0.7em] size-1 shrink-0 rounded-full bg-ink/70" aria-hidden />
                <span className="min-w-0">
                  {named ? (
                    <>
                      <strong className="font-medium text-ink">{named.name}</strong>
                      <span className="text-muted"> · </span>
                      <Runs text={named.rest} />
                    </>
                  ) : (
                    <Runs text={item} />
                  )}
                  {i === block.items.length - 1 && tail}
                </span>
              </li>
            );
          })}
        </ul>
      );
    case "key":
      return (
        // The point that matters most is the conversation's one highlight (15 Nov 2026, Martin: "default to black and
        // white. and add highlights. which will make key points stand out"): a wash of the signal colour, named in it,
        // its words a size up. Nothing else in his answer is coloured.
        <div className="sol-key rounded-2xl px-4 py-3">
          <p className="text-[10px] font-[560] uppercase tracking-[0.18em] text-sun-line">Key point</p>
          <p className="mt-1 font-[460] leading-[1.55] text-ink">
            <Runs text={block.text} />
            {tail}
          </p>
        </div>
      );
    case "ask":
      return (
        <div className="rounded-2xl bg-surface px-3.5 py-3 font-medium text-ink ring-1 ring-line-strong">
          <p className="flex gap-2.5">
            <CircleHelp className="mt-[0.2em] size-4 shrink-0 text-ink" aria-label="A question for you" />
            <span className="min-w-0">
              {block.text}
              {tail}
            </span>
          </p>
          {onAnswer && (
            <div className="mt-2 flex flex-wrap gap-1.5 pl-[1.625rem] text-[13px] font-medium">
              {isYesNoQuestion(block.text) && (
                <>
                  <button
                    type="button"
                    onClick={() => onAnswer(block.text, "Yes")}
                    className="rounded-full bg-primary px-3.5 py-1 text-primary-ink hover:opacity-90"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => onAnswer(block.text, "No")}
                    className="rounded-full bg-canvas px-3.5 py-1 text-ink ring-1 ring-line hover:bg-surface-2"
                  >
                    No
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onAnswer(block.text, null)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-ink-2 hover:bg-canvas hover:text-ink"
              >
                <CornerUpLeft className="size-3.5" aria-hidden />
                Reply
              </button>
            </div>
          )}
        </div>
      );
    case "choose":
      return <ChoiceCard question={block.text} options={block.options} onAnswer={onAnswer} tail={tail} />;
    case "more":
      return (
        <p className="text-[0.95em] text-muted">
          {block.text}
          {tail}
        </p>
      );
    default:
      return (
        <p className="whitespace-pre-line">
          <Runs text={block.text} />
          {tail}
        </p>
      );
  }
}

/**
 * Sol's question with its options as a card (8 Nov 2026, Martin, after Claude's own): the question, each option numbered
 * with its line, then Something else to type an answer of their own, Skip and a cross. A press sends that option at
 * once; once answered the card shows what was picked. Without `onAnswer` (while he writes) it is a card to read.
 */
function ChoiceCard({
  question,
  options,
  onAnswer,
  tail,
}: {
  question: string;
  options: SolOption[];
  onAnswer?: OnAnswer;
  tail: React.ReactNode;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [own, setOwn] = useState("");
  const [skipped, setSkipped] = useState(false);
  const live = Boolean(onAnswer) && !picked && !skipped;
  const choose = (answer: string) => {
    if (!onAnswer || picked) return;
    setPicked(answer);
    onAnswer(question, answer);
  };
  if (skipped)
    return (
      <p className="flex items-center gap-2 text-[0.92em] text-muted">
        <CircleHelp className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0">{question} · skipped</span>
      </p>
    );
  return (
    <div
      className="overflow-hidden rounded-2xl bg-surface font-normal text-ink ring-1 ring-line-strong"
      onKeyDown={(e) => {
        const n = Number(e.key);
        if (live && n >= 1 && n <= options.length && !(e.target instanceof HTMLInputElement)) choose(options[n - 1].label);
      }}
    >
      <div className="flex items-start gap-3 border-b border-line px-3.5 py-2.5">
        <p className="min-w-0 flex-1 font-semibold">
          {question}
          {tail}
        </p>
        {onAnswer && !picked && (
          <button
            type="button"
            onClick={() => setSkipped(true)}
            aria-label="Skip this question"
            className="mt-0.5 text-muted hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <ol>
        {options.map((o, i) => {
          const chosen = picked === o.label;
          return (
            <li key={o.label} className="border-b border-line last:border-b-0">
              <button
                type="button"
                disabled={!live}
                onClick={() => choose(o.label)}
                className={
                  "flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition " +
                  (chosen ? "bg-sun/60" : live ? "hover:bg-canvas" : picked ? "opacity-50" : "")
                }
              >
                <span
                  className={
                    "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] tabular-nums " +
                    (chosen ? "bg-sun-line text-white" : "bg-canvas text-ink-2 ring-1 ring-line")
                  }
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{o.label}</span>
                  {o.detail && <span className="block text-[0.92em] text-muted">{o.detail}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {onAnswer && !picked && (
        <form
          className="flex items-center gap-2 border-t border-line bg-canvas px-3.5 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (own.trim()) choose(own.trim());
          }}
        >
          <PencilLine className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            maxLength={500}
            placeholder="Something else"
            aria-label="Answer in your own words"
            className="min-w-0 flex-1 bg-transparent py-1 text-ink outline-none placeholder:text-muted"
          />
          {own.trim() ? (
            <button type="submit" className="rounded-full bg-primary px-3 py-1 text-[13px] font-medium text-primary-ink">
              Send
            </button>
          ) : (
            <button type="button" onClick={() => setSkipped(true)} className="px-1 text-[13px] text-muted hover:text-ink">
              Skip
            </button>
          )}
        </form>
      )}
    </div>
  );
}
